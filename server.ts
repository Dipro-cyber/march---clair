import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { SimWallet, Wallet } from './src/shared/simWallet';
import {
  classifyNwcError,
  CLOUD_RUN_AND_LOCAL_GUIDE_EN,
  CLOUD_RUN_AND_LOCAL_GUIDE_FR,
  NwcWallet,
} from './src/server/nwcWallet';
import {
  CoachQuestionRequestSchema,
  ComparePaymentBodySchema,
  CreateInvoiceSchema,
  CustomerDialogueRequestSchema,
  EmptyBodySchema,
  EmptyQuerySchema,
  InvoiceIdParamSchema,
  NwcCheckRequestSchema,
  NwcConnectRequestSchema,
  PayInvoiceBodySchema,
  PrepareLessonBodySchema,
  TopUpChannelBodySchema,
  WalletModeQuerySchema,
} from './src/shared/validation';
import {
  generateCoachAnswer,
  generateCustomerDialogue,
} from './src/server/geminiService';
import { sanitizeUntrustedDisplayText } from './src/shared/aiCharacters';
import {
  createRateLimiterMiddleware,
  InMemoryRateLimiter,
  installGlobalLogScrubber,
  securityHeadersMiddleware,
} from './src/server/security';

// Install global log scrubber before any route or library runs so no secrets or PII can ever be logged
installGlobalLogScrubber();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Practice mode uses SimWallet; Real mode (test network only) uses NwcWallet implementing the same Wallet interface
const simWallet = new SimWallet();
const nwcWallet = new NwcWallet();
const practiceWalletInterface: Wallet = simWallet;
const realWalletInterface: Wallet = nwcWallet;

// Per-IP Rate Limiters (memory-bounded)
const generalApiLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
});
const aiEndpointLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 25,
});
const nwcEndpointLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '16kb' }));

  // Per-IP rate limiting across API routes
  app.use('/api', createRateLimiterMiddleware(generalApiLimiter, 'api'));
  app.use('/api/ai', createRateLimiterMiddleware(aiEndpointLimiter, 'ai'));
  app.use('/api/nwc', createRateLimiterMiddleware(nwcEndpointLimiter, 'nwc'));

  // GET /api/nwc/status -> strict query validation, returns non-sensitive session status
  app.get('/api/nwc/status', (req, res) => {
    const parsedQuery = EmptyQuerySchema.safeParse(req.query ?? {});
    if (!parsedQuery.success) {
      res.status(400).json({ error: 'Unexpected query parameters' });
      return;
    }
    res.json(nwcWallet.getStatusSummary());
  });

  // POST /api/nwc/check -> strict Zod validation, runs connection check and reports in plain words
  app.post('/api/nwc/check', async (req, res) => {
    const parsed = NwcCheckRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue =
        parsed.error.issues[0]?.message ?? 'Invalid NWC check request';
      res.status(400).json({
        ok: false,
        connected: false,
        failureCategory: 'bad_string',
        outboundWebSocketBlocked: false,
        messageFr: `Mauvaise requête : ${sanitizeUntrustedDisplayText(firstIssue)}`,
        messageEn: `Invalid request: ${sanitizeUntrustedDisplayText(firstIssue)}`,
      });
      return;
    }

    const checkResult = await nwcWallet.runConnectionCheck(
      parsed.data.connectionString,
      parsed.data.saveInSession
    );
    res.json(checkResult);
  });

  // POST /api/nwc/connect -> strict Zod validation, connects NWC in server session memory only
  app.post('/api/nwc/connect', async (req, res) => {
    const parsed = NwcConnectRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue =
        parsed.error.issues[0]?.message ?? 'Invalid NWC connection string';
      res.status(400).json({
        ok: false,
        connected: false,
        failureCategory: 'bad_string',
        outboundWebSocketBlocked: false,
        messageFr: `Mauvaise chaîne (bad string) : ${sanitizeUntrustedDisplayText(firstIssue)}`,
        messageEn: `Bad connection string: ${sanitizeUntrustedDisplayText(firstIssue)}`,
      });
      return;
    }

    const result = await nwcWallet.runConnectionCheck(
      parsed.data.connectionString,
      true
    );
    res.status(result.ok ? 200 : 400).json(result);
  });

  // POST /api/nwc/disconnect -> strict Zod validation, clears NWC connection string from server RAM
  app.post('/api/nwc/disconnect', (req, res) => {
    const parsed = EmptyBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Unexpected request body parameters' });
      return;
    }
    nwcWallet.disconnect();
    res.json(nwcWallet.getStatusSummary());
  });

  // GET /api/wallet/balance -> strict query validation, uses Wallet.getBalance() + network state
  app.get('/api/wallet/balance', async (req, res) => {
    const parsedQuery = WalletModeQuerySchema.safeParse(req.query ?? {});
    if (!parsedQuery.success) {
      res.status(400).json({ error: 'Invalid wallet mode query parameter' });
      return;
    }

    const useReal = parsedQuery.data.mode === 'real' && nwcWallet.isConnected();
    if (useReal) {
      try {
        const balance = await realWalletInterface.getBalance();
        res.json({
          balance,
          network: simWallet.getNetworkState(),
          mode: 'real',
        });
        return;
      } catch {
        res.json({
          balance: nwcWallet.getStatusSummary().balanceSats ?? 0,
          network: simWallet.getNetworkState(),
          mode: 'real',
        });
        return;
      }
    }

    const balance = await practiceWalletInterface.getBalance();
    const network = simWallet.getNetworkState();
    res.json({ balance, network, mode: 'practice' });
  });

  // POST /api/wallet/prepare-lesson -> strict Zod validation, deterministically configures network state for lessons 1-6
  app.post('/api/wallet/prepare-lesson', async (req, res) => {
    const parsed = PrepareLessonBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid lesson number' });
      return;
    }

    const network = simWallet.prepareLessonScenario(parsed.data.lessonId);
    const balance = await practiceWalletInterface.getBalance();
    res.json({
      balance,
      network,
    });
  });

  // POST /api/wallet/top-up-channel -> strict Zod validation, Lesson 4: tops up inbound channel capacity
  app.post('/api/wallet/top-up-channel', async (req, res) => {
    const parsed = TopUpChannelBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid channel top-up amount' });
      return;
    }

    const network = simWallet.topUpChannelCapacity(parsed.data.additionalSats);
    const balance = await practiceWalletInterface.getBalance();
    res.json({
      balance,
      network,
    });
  });

  // POST /api/wallet/compare-methods -> strict Zod validation, Lesson 3: compares Lightning vs on-chain fees and speed
  app.post('/api/wallet/compare-methods', (req, res) => {
    const parsed = ComparePaymentBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid comparison amount' });
      return;
    }

    const comparison = simWallet.comparePaymentMethods(parsed.data.amountSats);
    res.json({ comparison });
  });

  // POST /api/wallet/invoices -> strict Zod validation, calls Wallet.createInvoice(amountSats, memo)
  app.post('/api/wallet/invoices', async (req, res) => {
    const parsed = CreateInvoiceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue =
        parsed.error.issues[0]?.message ?? 'Invalid invoice input';
      res
        .status(400)
        .json({ error: sanitizeUntrustedDisplayText(firstIssue) });
      return;
    }

    const { amountSats, expirySeconds, mode } = parsed.data;
    const safeMemo = sanitizeUntrustedDisplayText(parsed.data.memo);

    if (mode === 'real') {
      if (!nwcWallet.isConnected()) {
        res.status(400).json({
          error:
            'Real mode is not connected. Open the Real Mode (NWC) dialog and connect a test wallet first.',
          failureCategory: 'bad_string',
        });
        return;
      }

      try {
        const invoice = await realWalletInterface.createInvoice(
          amountSats,
          safeMemo,
          expirySeconds
        );
        const balance =
          nwcWallet.getStatusSummary().balanceSats ??
          (await realWalletInterface.getBalance());
        res.status(201).json({
          invoice,
          balance,
          network: simWallet.getNetworkState(),
          mode: 'real',
        });
        return;
      } catch (err) {
        const classified = classifyNwcError(err);
        res.status(502).json({
          error: classified.messageEn,
          errorFr: classified.messageFr,
          failureCategory: classified.failureCategory,
          outboundWebSocketBlocked: classified.outboundWebSocketBlocked,
          runLocallyOrCloudRunGuideFr: classified.outboundWebSocketBlocked
            ? CLOUD_RUN_AND_LOCAL_GUIDE_FR
            : undefined,
          runLocallyOrCloudRunGuideEn: classified.outboundWebSocketBlocked
            ? CLOUD_RUN_AND_LOCAL_GUIDE_EN
            : undefined,
        });
        return;
      }
    }

    const invoice = await practiceWalletInterface.createInvoice(
      amountSats,
      safeMemo,
      expirySeconds
    );
    const balance = await practiceWalletInterface.getBalance();
    res.status(201).json({
      invoice,
      balance,
      network: simWallet.getNetworkState(),
      mode: 'practice',
    });
  });

  // GET /api/wallet/invoices/:id -> strict Zod validation on params AND query, calls Wallet.lookupInvoice(id)
  app.get('/api/wallet/invoices/:id', async (req, res) => {
    const parsedParam = InvoiceIdParamSchema.safeParse(req.params ?? {});
    const parsedQuery = WalletModeQuerySchema.safeParse(req.query ?? {});
    if (!parsedParam.success || !parsedQuery.success) {
      res.status(400).json({ error: 'Invalid invoice ID or query parameter' });
      return;
    }

    const id = parsedParam.data.id;
    const isRealInvoice =
      parsedQuery.data.mode === 'real' || id.startsWith('nwc_inv_');

    if (isRealInvoice) {
      try {
        const invoice = await realWalletInterface.lookupInvoice(id);
        if (!invoice) {
          res.status(404).json({ error: 'Invoice not found' });
          return;
        }
        const balance =
          nwcWallet.getStatusSummary().balanceSats ??
          (await practiceWalletInterface.getBalance());
        res.json({
          invoice,
          balance,
          network: simWallet.getNetworkState(),
          mode: 'real',
        });
        return;
      } catch (err) {
        const classified = classifyNwcError(err);
        res.status(502).json({
          error: classified.messageEn,
          errorFr: classified.messageFr,
          failureCategory: classified.failureCategory,
          outboundWebSocketBlocked: classified.outboundWebSocketBlocked,
          runLocallyOrCloudRunGuideFr: classified.outboundWebSocketBlocked
            ? CLOUD_RUN_AND_LOCAL_GUIDE_FR
            : undefined,
          runLocallyOrCloudRunGuideEn: classified.outboundWebSocketBlocked
            ? CLOUD_RUN_AND_LOCAL_GUIDE_EN
            : undefined,
        });
        return;
      }
    }

    const invoice = await practiceWalletInterface.lookupInvoice(id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const balance = await practiceWalletInterface.getBalance();
    res.json({
      invoice,
      balance,
      network: simWallet.getNetworkState(),
      mode: 'practice',
    });
  });

  // POST /api/wallet/invoices/:id/pay -> strict Zod validation on params and body
  app.post('/api/wallet/invoices/:id/pay', (req, res) => {
    const parsedParam = InvoiceIdParamSchema.safeParse(req.params ?? {});
    if (!parsedParam.success) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    const parsedBody = PayInvoiceBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Invalid payment request parameters' });
      return;
    }

    const result = simWallet.payInvoice(
      parsedParam.data.id,
      parsedBody.data.simulateLatePayment,
      parsedBody.data.multiHop
    );

    if (result.code === 'NOT_FOUND') {
      res.status(404).json(result);
      return;
    }

    res.json(result);
  });

  // POST /api/wallet/invoices/:id/expire -> strict Zod validation on params and body
  app.post('/api/wallet/invoices/:id/expire', async (req, res) => {
    const parsedParam = InvoiceIdParamSchema.safeParse(req.params ?? {});
    const parsedBody = EmptyBodySchema.safeParse(req.body ?? {});
    if (!parsedParam.success || !parsedBody.success) {
      res.status(400).json({ error: 'Invalid invoice ID or request body' });
      return;
    }

    const invoice = simWallet.forceExpireInvoice(parsedParam.data.id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const balance = await practiceWalletInterface.getBalance();
    res.json({
      invoice,
      balance,
      network: simWallet.getNetworkState(),
    });
  });

  // POST /api/wallet/reset -> strict Zod validation, resets practice wallet state
  app.post('/api/wallet/reset', async (req, res) => {
    const parsedBody = EmptyBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Unexpected request body parameters' });
      return;
    }
    simWallet.reset();
    const balance = await practiceWalletInterface.getBalance();
    res.json({
      balance,
      network: simWallet.getNetworkState(),
    });
  });

  // POST /api/ai/customer-dialogue -> strict Zod validation, server-only Gemini customer dialogue
  app.post('/api/ai/customer-dialogue', async (req, res) => {
    const parsed = CustomerDialogueRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue =
        parsed.error.issues[0]?.message ?? 'Invalid dialogue request';
      res
        .status(400)
        .json({ error: sanitizeUntrustedDisplayText(firstIssue) });
      return;
    }

    const result = await generateCustomerDialogue(parsed.data);
    res.json({
      dialogue: result.data,
      source: result.source,
    });
  });

  // POST /api/ai/coach -> strict Zod validation, server-only Gemini Friendly Coach
  app.post('/api/ai/coach', async (req, res) => {
    const parsed = CoachQuestionRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const firstIssue =
        parsed.error.issues[0]?.message ?? 'Invalid coach question';
      res
        .status(400)
        .json({ error: sanitizeUntrustedDisplayText(firstIssue) });
      return;
    }

    const result = await generateCoachAnswer(parsed.data);
    res.json({
      answer: result.data,
      source: result.source,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Marché Éclair server listening on port ${PORT}`);
  });
}

startServer();
