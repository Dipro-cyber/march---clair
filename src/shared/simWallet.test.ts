import test from 'node:test';
import assert from 'node:assert/strict';
import { SimWallet } from './simWallet';
import {
  CoachAnswerResponseSchema,
  CreateInvoiceSchema,
  CustomerDialogueResponseSchema,
  InvoiceIdParamSchema,
  PrepareLessonBodySchema,
} from './validation';
import {
  SCAM_SCENES,
  DEFAULT_PROGRESS,
  recordLessonCompletion,
  LESSONS,
} from '../data/content';
import {
  escapeHtmlEntities,
  executeWithResilience,
  getScriptedCoachAnswer,
  getScriptedCustomerDialogue,
  isRetryableAiError,
  sanitizeCoachAnswer,
  sanitizeCustomerDialogue,
  sanitizeUntrustedDisplayText,
} from './aiCharacters';
import {
  computeLessonStars,
  computeMarketStreetNodes,
  DEFAULT_GAME_EXTRAS,
  deriveCustomerSceneMood,
  recordHintUsed,
} from './gameMechanics';

test('SimWallet starts with 1200 sats balance and 3 nodes connected by 2 channels', () => {
  const wallet = new SimWallet();
  assert.equal(wallet.getBalance(), 1200);
  const net = wallet.getNetworkState();
  assert.equal(net.nodes.length, 3);
  assert.equal(net.channels.length, 2);
  assert.equal(net.customerBalanceSats, 3500);
});

test('Lesson 1 flow: createInvoice, lookupInvoice, and payInvoice update balance and channels', () => {
  let currentNow = 1_700_000_000_000;
  const wallet = new SimWallet(() => currentNow);

  const inv = wallet.createInvoice(250, 'Panier de mangues', 180);
  assert.equal(inv.amountSats, 250);
  assert.equal(inv.memo, 'Panier de mangues');
  assert.equal(inv.status, 'PENDING');
  assert.ok(inv.paymentRequest.startsWith('lnbc250n1p'));

  const lookedUp = wallet.lookupInvoice(inv.id);
  assert.ok(lookedUp);
  assert.equal(lookedUp.status, 'PENDING');

  const payment = wallet.payInvoice(inv.id);
  assert.equal(payment.ok, true);
  assert.equal(payment.code, 'PAID');
  assert.equal(payment.balance, 1450);
  assert.equal(wallet.getBalance(), 1450);

  const afterLookup = wallet.lookupInvoice(inv.id);
  assert.equal(afterLookup?.status, 'PAID');
  assert.equal(payment.network.customerBalanceSats, 3250);
});

test('Lesson 2 flow: expired invoice rejects late payment and preserves balances', () => {
  let currentNow = 1_700_000_000_000;
  const wallet = new SimWallet(() => currentNow);

  const inv = wallet.createInvoice(400, 'Tissu wax 2 mètres', 60);
  assert.equal(inv.status, 'PENDING');

  // Advance clock past expiry (61 seconds later)
  currentNow += 61_000;

  const lookedUp = wallet.lookupInvoice(inv.id);
  assert.equal(lookedUp?.status, 'EXPIRED');

  // Customer attempts to pay too late
  const latePayment = wallet.payInvoice(inv.id);
  assert.equal(latePayment.ok, false);
  assert.equal(latePayment.code, 'INVOICE_EXPIRED');
  assert.equal(wallet.getBalance(), 1200);
});

test('Lesson 3 flow: comparePaymentMethods contrasts fast cheap Lightning with slow costly on-chain', () => {
  const wallet = new SimWallet();
  const cmp = wallet.comparePaymentMethods(300);
  assert.equal(cmp.amountSats, 300);
  assert.equal(cmp.lightning.feeSats, 1);
  assert.equal(cmp.lightning.timeSeconds, 1);
  assert.ok(cmp.onChain.feeSats > cmp.lightning.feeSats * 100);
  assert.ok(cmp.onChain.timeMinutes >= 10);
});

test('Lesson 4 flow: constrained inbound liquidity blocks 600-sat invoice until topped up or reduced', () => {
  const wallet = new SimWallet();
  const netState = wallet.prepareLessonScenario(4);
  assert.equal(netState.inboundLiquiditySats, 300);

  // 600 sats fails when inbound capacity is 300 sats
  const largeInv = wallet.createInvoice(600, 'Grand panier familial');
  const failedAttempt = wallet.payInvoice(largeInv.id);
  assert.equal(failedAttempt.ok, false);
  assert.equal(failedAttempt.code, 'INSUFFICIENT_CAPACITY');
  assert.equal(wallet.getBalance(), 1200);

  // Fix 1: Ask customer to pay smaller amount (300 sats)
  const smallInv = wallet.createInvoice(300, 'Petit panier');
  const smallPay = wallet.payInvoice(smallInv.id);
  assert.equal(smallPay.ok, true);
  assert.equal(smallPay.code, 'PAID');
  assert.equal(wallet.getBalance(), 1500);

  // Reset to Lesson 4 and test Fix 2: Top up channel capacity (+500 sats -> 800 sats inbound)
  wallet.prepareLessonScenario(4);
  const toppedUp = wallet.topUpChannelCapacity(500);
  assert.equal(toppedUp.inboundLiquiditySats, 800);
  const retryLarge = wallet.payInvoice(largeInv.id);
  assert.equal(retryLarge.ok, true);
  assert.equal(retryLarge.code, 'PAID');
});

test('Lesson 5 flow: multi-hop routing across two intermediate nodes records hop fees deterministically', () => {
  const wallet = new SimWallet();
  wallet.prepareLessonScenario(5);

  const inv = wallet.createInvoice(500, 'Commande routée');
  const result = wallet.payInvoice(inv.id, false, true);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'PAID');
  assert.ok(result.routeHops);
  assert.equal(result.routeHops.length, 3);
  // Hop 1 takes 2 sats, Hop 2 takes 1 sat, Vendor receives full 500 sats
  assert.equal(result.routeHops[0].feeSats, 2);
  assert.equal(result.routeHops[1].feeSats, 1);
  assert.equal(result.routeHops[2].forwardedSats, 500);
  // Customer paid 500 + 3 = 503 sats total
  assert.equal(result.network.customerBalanceSats, 3500 - 503);
});

test('Zod validation schemas accept valid inputs and reject invalid or personal-data inputs', () => {
  const valid = CreateInvoiceSchema.safeParse({
    amountSats: 250,
    memo: '3 mangues bien mûres',
  });
  assert.equal(valid.success, true);

  const invalidNegative = CreateInvoiceSchema.safeParse({
    amountSats: -10,
    memo: 'Mangues',
  });
  assert.equal(invalidNegative.success, false);

  const invalidPersonalPhone = CreateInvoiceSchema.safeParse({
    amountSats: 200,
    memo: 'Call me 0778123456',
  });
  assert.equal(invalidPersonalPhone.success, false);

  const validId = InvoiceIdParamSchema.safeParse({ id: 'inv_1_abc' });
  assert.equal(validId.success, true);

  assert.equal(PrepareLessonBodySchema.safeParse({ lessonId: 6 }).success, true);
  assert.equal(PrepareLessonBodySchema.safeParse({ lessonId: 9 }).success, false);
});

test('Lesson 6 scam scenes and progress persistence cover all 6 lessons and 3 scam scenarios', () => {
  assert.equal(SCAM_SCENES.length, 3);
  for (const scene of SCAM_SCENES) {
    const safeCount = scene.options.filter((c) => c.isSafe).length;
    assert.equal(safeCount, 1);
  }

  let state = DEFAULT_PROGRESS;
  for (const lessonId of [1, 2, 3, 4, 5, 6] as const) {
    state = recordLessonCompletion(
      state,
      lessonId,
      2,
      LESSONS[lessonId].termsTaught
    );
  }
  assert.deepEqual(state.completedLessons, [1, 2, 3, 4, 5, 6]);
  assert.equal(state.quizScores[6], 2);
});

test('AI Safety: escapeHtmlEntities and sanitizeUntrustedDisplayText neutralize tags and wallet API paths', () => {
  const malicious =
    '<script>fetch("/api/wallet/invoices")</script> javascript:alert(1) Bonjour!';
  const escaped = escapeHtmlEntities(malicious);
  assert.ok(!escaped.includes('<script>'));

  const sanitized = sanitizeUntrustedDisplayText(malicious);
  assert.ok(!sanitized.includes('<'));
  assert.ok(!sanitized.includes('>'));
  assert.ok(!sanitized.includes('javascript:'));
  assert.ok(!sanitized.includes('/api/wallet'));
  assert.ok(sanitized.includes('Bonjour!'));
});

test('AI Resilience: retries ONLY on 429 and 5xx with backoff, and falls back instantly on 400 or timeout', async () => {
  assert.equal(isRetryableAiError({ status: 429 }), true);
  assert.equal(isRetryableAiError({ status: 503 }), true);
  assert.equal(isRetryableAiError({ status: 400 }), false);
  assert.equal(isRetryableAiError({ status: 403 }), false);

  const req = {
    lessonId: 1,
    language: 'fr' as const,
    stallId: 'fruit' as const,
    stage: 'intro' as const,
    itemName: 'Panier de mangues',
    amountSats: 250,
  };

  // 1) 429 then 503 then success -> retries twice and succeeds
  let calls = 0;
  const retrySuccess = await executeWithResilience(
    async () => {
      calls += 1;
      if (calls === 1) throw { status: 429, message: 'Rate limited 429' };
      if (calls === 2) throw { status: 503, message: 'Service unavailable 503' };
      return {
        customerName: 'Amina',
        lines: [
          'Bonjour ! Tes mangues sentent très bon.',
          'Je prends un panier à 250 sats.',
          'Prépare-moi la facture Lightning !',
        ],
        conceptHint: 'Une facture Lightning contient déjà le montant.',
      };
    },
    CustomerDialogueResponseSchema,
    sanitizeCustomerDialogue,
    () => getScriptedCustomerDialogue(req),
    { timeoutMs: 2000, maxRetries: 2, baseBackoffMs: 5 }
  );
  assert.equal(retrySuccess.source, 'ai');
  assert.equal(retrySuccess.attempts, 3);
  assert.equal(retrySuccess.data.lines.length, 3);

  // 2) Non-retryable 400 error -> does NOT retry, falls back on attempt 1
  let badCalls = 0;
  const nonRetryFallback = await executeWithResilience(
    async () => {
      badCalls += 1;
      throw { status: 400, message: 'Bad Request 400' };
    },
    CustomerDialogueResponseSchema,
    sanitizeCustomerDialogue,
    () => getScriptedCustomerDialogue(req),
    { timeoutMs: 2000, maxRetries: 2, baseBackoffMs: 5 }
  );
  assert.equal(nonRetryFallback.source, 'scripted-fallback');
  assert.equal(badCalls, 1);

  // 3) Slow AI exceeding timeout -> falls back immediately to scripted dialogue
  const slowFallback = await executeWithResilience(
    async () => {
      await new Promise((r) => setTimeout(r, 200));
      return {};
    },
    CustomerDialogueResponseSchema,
    sanitizeCustomerDialogue,
    () => getScriptedCustomerDialogue(req),
    { timeoutMs: 40, maxRetries: 1, baseBackoffMs: 5 }
  );
  assert.equal(slowFallback.source, 'scripted-fallback');
  assert.equal(slowFallback.data.customerName, 'Amina');
});

test('Scripted Customer dialogues (3-4 lines) and Coach non-financial-advice answers validate with Zod for all 6 lessons', () => {
  for (const lessonId of [1, 2, 3, 4, 5, 6] as const) {
    for (const language of ['fr', 'en'] as const) {
      const d = getScriptedCustomerDialogue({
        lessonId,
        language,
        stallId: 'fruit',
        stage: 'intro',
        itemName: 'Mangues',
        amountSats: 250,
      });
      const parsedD = CustomerDialogueResponseSchema.safeParse(d);
      assert.equal(parsedD.success, true);
      assert.ok(d.lines.length >= 3 && d.lines.length <= 4);

      const c = sanitizeCoachAnswer(
        getScriptedCoachAnswer({
          lessonId,
          language,
          question: 'Why did that happen?',
          recentEvent: '',
        })
      );
      const parsedC = CoachAnswerResponseSchema.safeParse(c);
      assert.equal(parsedC.success, true);
    }
  }

  // Financial advice refusal check
  const refusal = getScriptedCoachAnswer({
    lessonId: 3,
    language: 'en',
    question: 'Should I buy Bitcoin as an investment to get rich?',
    recentEvent: '',
  });
  assert.ok(
    refusal.answerLines.some((line) =>
      line.toLowerCase().includes('never give financial advice')
    )
  );
});

test('Game Mechanics: computeLessonStars awards 1 to 3 stars based on quiz answers and hints used', () => {
  // Incomplete lesson -> 0 stars
  assert.equal(computeLessonStars(2, 0, false), 0);
  // 2/2 quiz + 0 hints -> 3 stars
  assert.equal(computeLessonStars(2, 0, true), 3);
  // 2/2 quiz + 1 hint -> 2 stars
  assert.equal(computeLessonStars(2, 1, true), 2);
  // 1/2 quiz + 0 hints -> 2 stars
  assert.equal(computeLessonStars(1, 0, true), 2);
  // 1/2 quiz + 2 hints -> 1 star
  assert.equal(computeLessonStars(1, 2, true), 1);
  // 0/2 quiz completed -> 1 star minimum
  assert.equal(computeLessonStars(0, 3, true), 1);
});

test('Game Mechanics: computeMarketStreetNodes produces 6 stall nodes with locked, unlocked, and completed states', () => {
  // Initial state: Lesson 1 unlocked, Lessons 2-6 locked
  const initialNodes = computeMarketStreetNodes([], {}, {});
  assert.equal(initialNodes.length, 6);
  assert.equal(initialNodes[0].state, 'unlocked');
  assert.equal(initialNodes[0].stars, 0);
  assert.equal(initialNodes[1].state, 'locked');
  assert.equal(initialNodes[5].state, 'locked');

  // Complete Lesson 1 (2/2 quiz, 0 hints) and Lesson 2 (2/2 quiz, 1 hint)
  let extras = DEFAULT_GAME_EXTRAS;
  extras = recordHintUsed(extras, 2);
  const midNodes = computeMarketStreetNodes(
    [1, 2],
    { 1: 2, 2: 2 },
    extras.hintsUsedByLesson
  );
  assert.equal(midNodes[0].state, 'completed');
  assert.equal(midNodes[0].stars, 3);
  assert.equal(midNodes[1].state, 'completed');
  assert.equal(midNodes[1].stars, 2);
  assert.equal(midNodes[2].state, 'unlocked'); // Lesson 3 unlocked next
  assert.equal(midNodes[3].state, 'locked'); // Lesson 4 still locked
});

test('Game Mechanics: deriveCustomerSceneMood transitions from entering to waiting, happy-leaving, or confused-leaving', () => {
  assert.equal(
    deriveCustomerSceneMood({
      isEntering: true,
      invoiceStatus: undefined,
      capacityFailedOnce: false,
      allScamsSpotted: false,
      hasUnsafeScamChoice: false,
    }),
    'entering'
  );

  assert.equal(
    deriveCustomerSceneMood({
      isEntering: false,
      invoiceStatus: 'PENDING',
      capacityFailedOnce: false,
      allScamsSpotted: false,
      hasUnsafeScamChoice: false,
    }),
    'waiting'
  );

  assert.equal(
    deriveCustomerSceneMood({
      isEntering: false,
      invoiceStatus: 'PAID',
      capacityFailedOnce: false,
      allScamsSpotted: false,
      hasUnsafeScamChoice: false,
    }),
    'happy-leaving'
  );

  assert.equal(
    deriveCustomerSceneMood({
      isEntering: false,
      invoiceStatus: 'EXPIRED',
      capacityFailedOnce: false,
      allScamsSpotted: false,
      hasUnsafeScamChoice: false,
    }),
    'confused-leaving'
  );
});

test('NwcWallet: validateNwcConnectionString catches bad strings, expired permissions, and valid NWC URIs without logging secrets', async () => {
  const {
    validateNwcConnectionString,
    classifyNwcError,
    redactSensitiveNwcText,
  } = await import('../server/nwcWallet');

  const badScheme = validateNwcConnectionString('https://example.com');
  assert.equal(badScheme.valid, false);
  if (!badScheme.valid) {
    assert.equal(badScheme.failureCategory, 'bad_string');
  }

  const validPubkey = 'a'.repeat(64);
  const validSecret = 'b'.repeat(64);
  const missingSecret = validateNwcConnectionString(
    `nostr+walletconnect://${validPubkey}?relay=wss://relay.getalby.com/v1`
  );
  assert.equal(missingSecret.valid, false);
  if (!missingSecret.valid) {
    assert.equal(missingSecret.failureCategory, 'bad_string');
  }

  const expiredUri = `nostr+walletconnect://${validPubkey}?relay=wss://relay.getalby.com/v1&secret=${validSecret}&expires_at=1600000000`;
  const expiredCheck = validateNwcConnectionString(expiredUri);
  assert.equal(expiredCheck.valid, false);
  if (!expiredCheck.valid) {
    assert.equal(expiredCheck.failureCategory, 'expired_permission');
  }

  const validUri = `nostr+walletconnect://${validPubkey}?relay=wss://relay.getalby.com/v1&secret=${validSecret}`;
  const validCheck = validateNwcConnectionString(validUri);
  assert.equal(validCheck.valid, true);
  if (validCheck.valid) {
    assert.equal(validCheck.relayHostPreview, 'relay.getalby.com');
  }

  // Verify secret redaction
  const redacted = redactSensitiveNwcText(
    `Failed to connect with ${validUri} and secret=${validSecret}`
  );
  assert.ok(!redacted.includes(validSecret));
  assert.ok(redacted.includes('[REDACTED]'));

  // Verify error classification for blocked network, expired permission, and bad string
  const blockedDiag = classifyNwcError(
    new Error('WebSocket error: ECONNREFUSED wss://relay.getalby.com/v1')
  );
  assert.equal(blockedDiag.failureCategory, 'blocked_network');
  assert.equal(blockedDiag.outboundWebSocketBlocked, true);

  const expiredDiag = classifyNwcError({
    code: 'UNAUTHORIZED',
    message: 'Connection budget expired',
  });
  assert.equal(expiredDiag.failureCategory, 'expired_permission');
  assert.equal(expiredDiag.outboundWebSocketBlocked, false);
});

test('NwcWallet implements Wallet interface (createInvoice, lookupInvoice, getBalance) with least privilege and millisatoshi conversion', async () => {
  const { NwcWallet, ALLOWED_NWC_METHODS } = await import(
    '../server/nwcWallet'
  );

  assert.deepEqual(ALLOWED_NWC_METHODS, [
    'make_invoice',
    'lookup_invoice',
    'get_balance',
  ]);
  assert.ok(!(ALLOWED_NWC_METHODS as readonly string[]).includes('pay_invoice'));

  const validPubkey = 'c'.repeat(64);
  const validSecret = 'd'.repeat(64);
  const validUri = `nostr+walletconnect://${validPubkey}?relay=wss://relay.getalby.com/v1&secret=${validSecret}`;

  let settled = false;
  let lastMakeInvoiceAmountMsats = 0;

  const wallet = new NwcWallet((uri) => {
    assert.equal(uri, validUri);
    return {
      async getBalance() {
        // 2,450 sats = 2,450,000 msats in NIP-47
        return { balance: settled ? 2_700_000 : 2_450_000 };
      },
      async makeInvoice(req) {
        lastMakeInvoiceAmountMsats = req.amount;
        const nowSec = Math.floor(Date.now() / 1000);
        return {
          invoice: 'lntb2500n1prealnwctestbolt11',
          description: req.description ?? '',
          payment_hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          preimage: '',
          amount: req.amount,
          state: 'pending',
          settled_at: 0,
          created_at: nowSec,
          expires_at: nowSec + (req.expiry ?? 300),
        };
      },
      async lookupInvoice(req) {
        assert.equal(
          req.payment_hash,
          'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
        );
        const nowSec = Math.floor(Date.now() / 1000);
        return {
          invoice: 'lntb2500n1prealnwctestbolt11',
          description: 'Panier de mangues',
          payment_hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          preimage: settled ? 'preimage_abc' : '',
          amount: 250_000,
          state: settled ? 'settled' : 'pending',
          settled_at: settled ? nowSec : 0,
          created_at: nowSec,
          expires_at: nowSec + 300,
        };
      },
      close() {},
    };
  });

  // Connect and run connection check (saveOnSuccess = true)
  const checkRes = await wallet.runConnectionCheck(validUri, true);
  assert.equal(checkRes.ok, true);
  assert.equal(checkRes.balanceSats, 2450);
  assert.equal(wallet.isConnected(), true);
  assert.equal(wallet.getStatusSummary().neverCallsPayInvoice, true);

  // Create invoice (250 sats -> 250,000 msats sent to NWC makeInvoice)
  const created = await wallet.createInvoice(250, 'Panier de mangues', 300);
  assert.equal(lastMakeInvoiceAmountMsats, 250_000);
  assert.ok(created.id.startsWith('nwc_inv_'));
  assert.equal(created.amountSats, 250);
  assert.equal(created.status, 'PENDING');
  assert.equal(created.paymentRequest, 'lntb2500n1prealnwctestbolt11');

  // Lookup while pending
  const pendingLookup = await wallet.lookupInvoice(created.id);
  assert.equal(pendingLookup?.status, 'PENDING');

  // Simulate learner paying the invoice from a second test wallet
  settled = true;
  const settledLookup = await wallet.lookupInvoice(created.id);
  assert.equal(settledLookup?.status, 'PAID');

  const updatedBalance = await wallet.getBalance();
  assert.equal(updatedBalance, 2700);

  // Disconnect clears in-memory connection string
  wallet.disconnect();
  assert.equal(wallet.isConnected(), false);
});

test('Security Pass: Log scrubber, Per-IP rate limiter, CSP builder, and strict Zod schemas reject unexpected fields', async () => {
  const {
    buildContentSecurityPolicy,
    InMemoryRateLimiter,
    scrubLogMessage,
  } = await import('../server/security');
  const { EmptyQuerySchema, WalletModeQuerySchema } = await import(
    './validation'
  );

  // 1. Strict Zod schemas reject unexpected extra properties
  const extraPropInvoice = CreateInvoiceSchema.safeParse({
    amountSats: 250,
    memo: 'Mangues',
    unexpectedField: 'malicious',
  });
  assert.equal(extraPropInvoice.success, false);

  assert.equal(EmptyQuerySchema.safeParse({ foo: 'bar' }).success, false);
  assert.equal(
    WalletModeQuerySchema.safeParse({ mode: 'real', extra: '1' }).success,
    false
  );

  // 2. Log scrubber removes NWC URIs, secrets, hex keys, Gemini keys, BOLT11, emails, and phones
  const dirtyLog =
    'Conn nostr+walletconnect://aaaa?relay=wss://r.com&secret=1234567890abcdef key=AIzaSyDa12345678901234567890123456 email=user@example.com phone=+221771234567 inv=lnbc2500n1pabcdefghijklmnopqrstuvwxyz0123456789';
  const scrubbed = scrubLogMessage(dirtyLog);
  assert.ok(!scrubbed.includes('1234567890abcdef'));
  assert.ok(!scrubbed.includes('AIzaSyDa'));
  assert.ok(!scrubbed.includes('user@example.com'));
  assert.ok(!scrubbed.includes('221771234567'));
  assert.ok(scrubbed.includes('[REDACTED_NWC_URI]'));
  assert.ok(scrubbed.includes('[REDACTED_API_KEY]'));
  assert.ok(scrubbed.includes('[REDACTED_EMAIL]'));
  assert.ok(scrubbed.includes('[REDACTED_PHONE]'));

  // 3. Per-IP Rate Limiter enforces window limit and resets after windowMs
  let fakeNow = 1_000_000;
  const limiter = new InMemoryRateLimiter(
    { windowMs: 60_000, maxRequests: 3 },
    () => fakeNow
  );
  assert.equal(limiter.check('10.0.0.1').allowed, true);
  assert.equal(limiter.check('10.0.0.1').allowed, true);
  assert.equal(limiter.check('10.0.0.1').allowed, true);
  const blocked = limiter.check('10.0.0.1');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0);
  // Different IP is unaffected
  assert.equal(limiter.check('10.0.0.2').allowed, true);
  // Advance past 60s window
  fakeNow += 61_000;
  assert.equal(limiter.check('10.0.0.1').allowed, true);

  // 4. Restrictive CSP directives
  const prodCsp = buildContentSecurityPolicy(true);
  assert.ok(prodCsp.includes("default-src 'self'"));
  assert.ok(prodCsp.includes("script-src 'self'"));
  assert.ok(prodCsp.includes("object-src 'none'"));
  assert.ok(prodCsp.includes("connect-src 'self'"));
});

test('Security Pass: Mainnet NWC connection strings, Mainnet get_info wallets, and Mainnet lnbc invoices are refused', async () => {
  const { NwcWallet, validateNwcConnectionString } = await import(
    '../server/nwcWallet'
  );

  const pub = 'e'.repeat(64);
  const sec = 'f'.repeat(64);

  // Layer 1: URI parameter network=mainnet is refused before opening any WebSocket
  const uriMainnet = validateNwcConnectionString(
    `nostr+walletconnect://${pub}?relay=wss://relay.getalby.com/v1&secret=${sec}&network=mainnet`
  );
  assert.equal(uriMainnet.valid, false);
  if (!uriMainnet.valid) {
    assert.equal(uriMainnet.failureCategory, 'mainnet_refused');
  }

  // Layer 2: NIP-47 get_info reporting network="mainnet" is refused during runConnectionCheck
  const validTestLookingUri = `nostr+walletconnect://${pub}?relay=wss://relay.getalby.com/v1&secret=${sec}`;
  const mainnetInfoWallet = new NwcWallet(() => ({
    async getInfo() {
      return {
        alias: 'Real Savings Wallet',
        network: 'mainnet',
        methods: ['make_invoice', 'lookup_invoice', 'get_balance'],
      };
    },
    async getBalance() {
      return { balance: 500_000_000 };
    },
    async makeInvoice() {
      throw new Error('Should not be called');
    },
    async lookupInvoice() {
      throw new Error('Should not be called');
    },
    close() {},
  }));

  const infoCheck = await mainnetInfoWallet.runConnectionCheck(
    validTestLookingUri,
    true
  );
  assert.equal(infoCheck.ok, false);
  assert.equal(infoCheck.failureCategory, 'mainnet_refused');
  assert.equal(mainnetInfoWallet.isConnected(), false);

  // Layer 3: Connected wallet returning a Mainnet BOLT11 invoice (lnbc2500n1...) is disconnected and refused
  const sneakyMainnetInvoiceWallet = new NwcWallet(() => ({
    async getBalance() {
      return { balance: 100_000 };
    },
    async makeInvoice(req) {
      return {
        invoice: 'lnbc2500n1pmainnetrealbitcoininvoice',
        description: req.description ?? '',
        payment_hash: '1'.repeat(64),
        amount: req.amount,
        state: 'pending',
      };
    },
    async lookupInvoice() {
      throw new Error('Not reached');
    },
    close() {},
  }));

  await sneakyMainnetInvoiceWallet.runConnectionCheck(
    validTestLookingUri,
    true
  );
  assert.equal(sneakyMainnetInvoiceWallet.isConnected(), true);

  await assert.rejects(
    async () => {
      await sneakyMainnetInvoiceWallet.createInvoice(250, 'Mangues', 300);
    },
    (err: Error & { code?: string }) => {
      assert.equal(err.code, 'MAINNET_REFUSED');
      return true;
    }
  );
  // Wallet is immediately disconnected from session memory
  assert.equal(sneakyMainnetInvoiceWallet.isConnected(), false);
});

test('Translations & Accessibility Content: every lesson, quiz feedback, scam scene, glossary term, and error message has complete French and English translations', async () => {
  const { LESSONS, TERMS, STALLS, SCAM_SCENES, UI_TEXT } = await import(
    '../data/content'
  );
  const { translateServerError } = await import('./offlinePracticeWallet');

  for (const lesson of Object.values(LESSONS)) {
    assert.ok(lesson.title.fr.length > 3 && lesson.title.en.length > 3);
    assert.ok(lesson.subtitle.fr.length > 3 && lesson.subtitle.en.length > 3);
    assert.ok(lesson.badge.fr.length > 3 && lesson.badge.en.length > 3);
    assert.ok(
      lesson.whatYouLearnedTitle.fr.length > 5 &&
        lesson.whatYouLearnedTitle.en.length > 5
    );
    assert.ok(
      lesson.whatYouLearnedPoints.fr.length >= 2 &&
        lesson.whatYouLearnedPoints.en.length >= 2
    );
    assert.equal(lesson.questions.length, 2);
    for (const q of lesson.questions) {
      assert.ok(q.prompt.fr.length > 5 && q.prompt.en.length > 5);
      for (const opt of q.options) {
        assert.ok(opt.text.fr.length > 1 && opt.text.en.length > 1);
        assert.ok(opt.feedback.fr.length > 5 && opt.feedback.en.length > 5);
      }
    }
  }

  for (const term of Object.values(TERMS)) {
    assert.ok(term.term.fr.length > 1 && term.term.en.length > 1);
    assert.ok(
      term.plainMeaning.fr.length > 10 && term.plainMeaning.en.length > 10
    );
    assert.ok(
      term.marketAnalogy.fr.length > 10 && term.marketAnalogy.en.length > 10
    );
  }

  for (const stall of Object.values(STALLS)) {
    assert.ok(stall.name.fr.length > 2 && stall.name.en.length > 2);
  }

  for (const scene of SCAM_SCENES) {
    assert.ok(scene.title.fr.length > 3 && scene.title.en.length > 3);
    assert.ok(
      scene.redFlagSummary.fr.length > 5 && scene.redFlagSummary.en.length > 5
    );
  }

  assert.ok(UI_TEXT.appName.fr.length > 2 && UI_TEXT.appName.en.length > 2);

  // Server error translation completeness in French and English
  const sampleErrors = [
    'Invalid invoice creation input',
    'Invoice not found',
    'Real mode (NWC) is not connected. Please connect a test wallet first.',
    'Too many requests from this IP. Please wait a moment and try again.',
    'MAINNET_REFUSED: Mainnet invoice detected',
  ];
  for (const errCode of sampleErrors) {
    const frText = translateServerError(errCode, 'fr');
    const enText = translateServerError(errCode, 'en');
    assert.ok(frText.length > 5);
    assert.ok(enText.length > 5);
    assert.notEqual(frText, enText);
  }
});

test('Offline Practice Mode Wallet: client-side SimWallet fallback executes all lesson scenarios deterministically when offline', async () => {
  const { getOfflinePracticeWallet } = await import('./offlinePracticeWallet');
  const offlineWallet = getOfflinePracticeWallet();

  offlineWallet.reset();
  assert.equal(offlineWallet.getBalance(), 1200);

  // Lesson 1 offline payment
  const inv1 = offlineWallet.createInvoice(250, 'Mangues (Hors-ligne)', 300);
  const pay1 = offlineWallet.payInvoice(inv1.id);
  assert.equal(pay1.ok, true);
  assert.equal(offlineWallet.getBalance(), 1450);

  // Lesson 4 offline channel capacity check & top-up
  offlineWallet.prepareLessonScenario(4);
  const inv4 = offlineWallet.createInvoice(600, '3 mètres de tissu', 300);
  const fail4 = offlineWallet.payInvoice(inv4.id);
  assert.equal(fail4.ok, false);
  assert.equal(fail4.code, 'INSUFFICIENT_CAPACITY');

  offlineWallet.topUpChannelCapacity(500);
  const ok4 = offlineWallet.payInvoice(inv4.id);
  assert.equal(ok4.ok, true);
  assert.equal(ok4.code, 'PAID');
});





