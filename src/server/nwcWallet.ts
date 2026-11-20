import WebSocket from 'ws';
import {
  NWCClient,
  Nip47NetworkError,
  Nip47PublishError,
  Nip47PublishTimeoutError,
  Nip47ReplyTimeoutError,
  Nip47ResponseDecodingError,
  Nip47TimeoutError,
  Nip47WalletError,
} from '@getalby/sdk/nwc';
import { Invoice, Wallet } from '../shared/simWallet';
import { sanitizeUntrustedDisplayText } from '../shared/aiCharacters';
import { localizeQuotes } from '../shared/localizeQuotes';
import {
  detectMainnetInNwcUri,
  isMainnetBolt11Invoice,
  isMainnetNetworkName,
  scrubLogMessage,
} from './security';

// Ensure global WebSocket is available in Node.js for nostr-tools / @getalby/sdk
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
    WebSocket;
}

/**
 * Least privilege policy:
 * Marché Éclair ONLY uses make_invoice, lookup_invoice, and get_balance.
 * It NEVER calls or requests pay_invoice.
 */
export const ALLOWED_NWC_METHODS = [
  'make_invoice',
  'lookup_invoice',
  'get_balance',
] as const;

export const FORBIDDEN_NWC_METHODS = ['pay_invoice', 'pay_keysend'] as const;

export type NwcFailureCategory =
  | 'none'
  | 'blocked_network'
  | 'bad_string'
  | 'expired_permission'
  | 'mainnet_refused';

export interface NwcConnectionCheckResult {
  ok: boolean;
  connected: boolean;
  failureCategory: NwcFailureCategory;
  outboundWebSocketBlocked: boolean;
  relayHostPreview: string | null;
  walletPubkeyPreview: string | null;
  balanceSats: number | null;
  networkName: string | null;
  allowedMethods: readonly string[];
  neverCallsPayInvoice: true;
  messageFr: string;
  messageEn: string;
  runLocallyOrCloudRunGuideFr?: string;
  runLocallyOrCloudRunGuideEn?: string;
}

export interface NwcClientLike {
  getBalance(): Promise<{ balance: number }>;
  makeInvoice(request: {
    amount: number;
    description?: string;
    expiry?: number;
  }): Promise<{
    invoice: string;
    description?: string;
    payment_hash: string;
    preimage?: string;
    amount: number;
    state?: 'settled' | 'pending' | 'failed' | 'accepted';
    settled_at?: number;
    created_at?: number;
    expires_at?: number;
  }>;
  lookupInvoice(request: {
    payment_hash?: string;
    invoice?: string;
  }): Promise<{
    invoice: string;
    description?: string;
    payment_hash: string;
    preimage?: string;
    amount: number;
    state?: 'settled' | 'pending' | 'failed' | 'accepted';
    settled_at?: number;
    created_at?: number;
    expires_at?: number;
  }>;
  getInfo?(): Promise<{
    alias?: string;
    network?: string;
    methods?: string[];
  }>;
  close(): void;
}

interface StoredNwcInvoiceRecord {
  invoice: Invoice;
  paymentHash: string;
}

const SILENT_LOGGER = {
  debug: () => {
    // Never log NWC secrets, events, or connection strings
  },
};

export const CLOUD_RUN_AND_LOCAL_GUIDE_FR =
  'Cet environnement bloque les connexions WebSocket sortantes (wss://) vers les relais Nostr. Pour utiliser le Mode Réel avec un vrai portefeuille de test : (1) Exécutez l’application localement sur votre ordinateur ou téléphone (`npm install && npm run dev`, puis ouvrez http://localhost:3000), ou (2) Déployez l’application sur Google Cloud Run (`gcloud run deploy marche-eclair --source .`) où les connexions WebSocket sortantes vers les relais Nostr sont autorisées.';

export const CLOUD_RUN_AND_LOCAL_GUIDE_EN =
  'This hosting runtime blocks outbound WebSocket connections (wss://) to Nostr relays. To use Real Mode with a live test wallet: (1) Run the app locally on your machine (`npm install && npm run dev`, then open http://localhost:3000), or (2) Deploy the app on Google Cloud Run (`gcloud run deploy marche-eclair --source .`) where outbound WebSocket connections to Nostr relays are permitted.';

/**
 * Redacts any hex keys or query secrets from an error string so secrets can never leak.
 */
export function redactSensitiveNwcText(input: string): string {
  return scrubLogMessage(input)
    .replace(/nostr\+?walletconnect:\/\/[^\s"']+/gi, '[REDACTED_NWC_URI]')
    .replace(/secret=[0-9a-fA-F]+/gi, 'secret=[REDACTED]')
    .replace(/\b[0-9a-fA-F]{64}\b/g, '[REDACTED_HEX_KEY]');
}

/**
 * Validates an NWC connection string without logging or storing it.
 * Uses @getalby/sdk's real NWCClient.parseWalletConnectUrl(url, true) API,
 * and refuses Mainnet connection strings whenever detectable.
 */
export function validateNwcConnectionString(rawUrl: string):
  | {
      valid: true;
      relayUrls: string[];
      relayHostPreview: string;
      walletPubkeyPreview: string;
    }
  | {
      valid: false;
      failureCategory: 'bad_string' | 'expired_permission' | 'mainnet_refused';
      messageFr: string;
      messageEn: string;
    } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      failureCategory: 'bad_string',
      messageFr:
        'Chaîne NWC vide : veuillez coller une adresse commençant par nostr+walletconnect://.',
      messageEn:
        'Empty NWC string: please paste a connection string starting with nostr+walletconnect://.',
    };
  }

  if (
    !trimmed.toLowerCase().startsWith('nostr+walletconnect://') &&
    !trimmed.toLowerCase().startsWith('nostrwalletconnect://')
  ) {
    return {
      valid: false,
      failureCategory: 'bad_string',
      messageFr: localizeQuotes(
        'Mauvaise chaîne (bad string) : le lien doit commencer par "nostr+walletconnect://".',
        'fr'
      ),
      messageEn: localizeQuotes(
        'Bad connection string: the URI must start with "nostr+walletconnect://".',
        'en'
      ),
    };
  }

  // Refuse Mainnet connection strings if detectable from URI parameters or relay hostname
  const mainnetCheck = detectMainnetInNwcUri(trimmed);
  if (mainnetCheck.isMainnet) {
    return {
      valid: false,
      failureCategory: 'mainnet_refused',
      messageFr: mainnetCheck.reasonFr,
      messageEn: mainnetCheck.reasonEn,
    };
  }

  // Check if the URI contains an explicit expiry timestamp in query parameters before connecting
  try {
    const normalizedForUrl = trimmed
      .replace(/^nostr\+walletconnect:\/\//i, 'http://')
      .replace(/^nostrwalletconnect:\/\//i, 'http://');
    const urlObj = new URL(normalizedForUrl);
    const expiresAtParam =
      urlObj.searchParams.get('expires_at') ||
      urlObj.searchParams.get('expiry') ||
      urlObj.searchParams.get('expires');
    if (expiresAtParam) {
      const expiresAtSec = Number(expiresAtParam);
      const nowSec = Math.floor(Date.now() / 1000);
      if (!Number.isNaN(expiresAtSec) && expiresAtSec > 0 && expiresAtSec <= nowSec) {
        return {
          valid: false,
          failureCategory: 'expired_permission',
          messageFr:
            'Permission expirée (expired permission) : cette connexion NWC a dépassé sa date d’expiration. Créez une nouvelle connexion de test dans votre portefeuille.',
          messageEn:
            'Expired permission: this NWC connection string has passed its expiration timestamp. Create a fresh test connection in your wallet.',
        };
      }
    }
  } catch {
    // Will be caught by NWCClient.parseWalletConnectUrl below
  }

  try {
    const parsed = NWCClient.parseWalletConnectUrl(trimmed, true);
    for (const relayUrl of parsed.relayUrls) {
      const parsedRelay = new URL(relayUrl);
      if (parsedRelay.protocol !== 'wss:' && parsedRelay.protocol !== 'ws:') {
        return {
          valid: false,
          failureCategory: 'bad_string',
          messageFr:
            'Mauvaise chaîne (bad string) : l’adresse du relais Nostr doit utiliser wss:// ou ws://.',
          messageEn:
            'Bad connection string: the Nostr relay URL must use wss:// or ws://.',
        };
      }
    }

    const firstRelayHost = new URL(parsed.relayUrls[0]).host;
    const pubkeyPreview = `${parsed.walletPubkey.slice(0, 6)}…${parsed.walletPubkey.slice(-4)}`;

    return {
      valid: true,
      relayUrls: parsed.relayUrls,
      relayHostPreview: firstRelayHost,
      walletPubkeyPreview: pubkeyPreview,
    };
  } catch (err) {
    const safeReason = redactSensitiveNwcText(
      err instanceof Error ? err.message : 'Invalid format'
    );
    return {
      valid: false,
      failureCategory: 'bad_string',
      messageFr: `Mauvaise chaîne (bad string) : format NWC invalide (${safeReason}). Vérifiez qu’elle contient bien la clé du portefeuille, un paramètre relay=wss://... et un paramètre secret=...`,
      messageEn: `Bad connection string: invalid NWC format (${safeReason}). Check that it includes the wallet pubkey, a relay=wss://... parameter, and a 64-character hex secret=...`,
    };
  }
}

/**
 * Classifies runtime NWC / WebSocket errors into plain-word categories:
 * - blocked_network (outbound WebSocket blocked or relay unreachable)
 * - expired_permission (wallet rejected permission, expired budget/connection, or missing make_invoice/lookup_invoice/get_balance)
 * - bad_string (malformed key or decryption error)
 */
export function classifyNwcError(err: unknown): {
  failureCategory: Exclude<NwcFailureCategory, 'none'>;
  outboundWebSocketBlocked: boolean;
  messageFr: string;
  messageEn: string;
} {
  const rawMessage =
    err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const safeMessage = redactSensitiveNwcText(rawMessage);
  const lower = safeMessage.toLowerCase();
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '').toUpperCase()
      : '';

  // 0. Explicit Mainnet refusal
  if (
    code === 'MAINNET_REFUSED' ||
    lower.includes('mainnet_refused') ||
    lower.includes('mainnet connection') ||
    lower.includes('mainnet wallet refused') ||
    lower.includes('mainnet bolt11')
  ) {
    return {
      failureCategory: 'mainnet_refused',
      outboundWebSocketBlocked: false,
      messageFr:
        'Portefeuille Mainnet refusé pour votre sécurité : Marché Éclair est un jeu d’apprentissage et refuse les portefeuilles ou factures sur le réseau Bitcoin principal (mainnet). Utilisez uniquement un réseau de TEST (testnet, signet, mutinynet).',
      messageEn:
        'Mainnet wallet refused for your safety: Marché Éclair is a learning game and refuses Bitcoin Mainnet wallets or invoices. Only use a TEST network wallet (testnet, signet, mutinynet).',
    };
  }

  // 1. Expired or restricted permission from the wallet service
  if (
    err instanceof Nip47WalletError ||
    code === 'UNAUTHORIZED' ||
    code === 'RESTRICTED' ||
    code === 'QUOTA_EXCEEDED' ||
    code === 'NOT_IMPLEMENTED' ||
    lower.includes('expired') ||
    lower.includes('unauthorized') ||
    lower.includes('restricted') ||
    lower.includes('permission') ||
    lower.includes('quota') ||
    lower.includes('budget') ||
    lower.includes('revoked')
  ) {
    return {
      failureCategory: 'expired_permission',
      outboundWebSocketBlocked: false,
      messageFr:
        'Permission expirée ou refusée (expired permission) : le portefeuille a refusé l’accès. Vérifiez que la connexion NWC n’est pas expirée et qu’elle autorise uniquement make_invoice, lookup_invoice et get_balance.',
      messageEn:
        'Expired or restricted permission: the wallet rejected the request. Make sure the NWC connection has not expired and grants make_invoice, lookup_invoice, and get_balance.',
    };
  }

  // 2. Bad string / bad key / decryption mismatch
  if (
    err instanceof Nip47ResponseDecodingError ||
    lower.includes('invalid nwc url') ||
    lower.includes('missing secret') ||
    lower.includes('invalid secret') ||
    lower.includes('failed to deserialize') ||
    lower.includes('decrypt')
  ) {
    return {
      failureCategory: 'bad_string',
      outboundWebSocketBlocked: false,
      messageFr:
        'Mauvaise chaîne NWC (bad string) : la clé secrète ou l’adresse du portefeuille est incorrecte et ne permet pas de déchiffrer la réponse NIP-47.',
      messageEn:
        'Bad connection string: the secret key or wallet pubkey is invalid and could not decrypt the NIP-47 response.',
    };
  }

  // 3. Blocked outbound WebSocket or relay timeout
  if (
    err instanceof Nip47NetworkError ||
    err instanceof Nip47PublishError ||
    err instanceof Nip47PublishTimeoutError ||
    err instanceof Nip47ReplyTimeoutError ||
    err instanceof Nip47TimeoutError ||
    lower.includes('failed to connect') ||
    lower.includes('websocket') ||
    lower.includes('connection failure') ||
    lower.includes('econnrefused') ||
    lower.includes('eacces') ||
    lower.includes('enetunreach') ||
    lower.includes('ehostunreach') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('timeout') ||
    lower.includes('no info event')
  ) {
    return {
      failureCategory: 'blocked_network',
      outboundWebSocketBlocked: true,
      messageFr:
        'Réseau ou WebSocket bloqué (blocked network) : impossible d’ouvrir une connexion WebSocket sortante vers le relais Nostr ou délai dépassé.',
      messageEn:
        'Blocked network or unreachable relay: could not establish an outbound WebSocket connection to the Nostr relay or the request timed out.',
    };
  }

  return {
    failureCategory: 'blocked_network',
    outboundWebSocketBlocked: true,
    messageFr: `Connexion au relais Nostr impossible (${safeMessage}).`,
    messageEn: `Could not reach Nostr relay (${safeMessage}).`,
  };
}

/**
 * Enforces Least Privilege on an NWCClient instance by disabling payInvoice and payKeysend
 * so the application can NEVER call or request pay_invoice under any circumstance.
 */
function enforceLeastPrivilegeOnClient(client: NWCClient): NWCClient {
  const guarded = client as unknown as Record<string, unknown>;
  guarded.payInvoice = async () => {
    throw new Error(
      'LEAST_PRIVILEGE_VIOLATION: Marché Éclair never calls or requests pay_invoice.'
    );
  };
  guarded.payKeysend = async () => {
    throw new Error(
      'LEAST_PRIVILEGE_VIOLATION: Marché Éclair never calls or requests pay_keysend.'
    );
  };
  return client;
}

function defaultClientFactory(connectionString: string): NwcClientLike {
  const client = new NWCClient({
    nostrWalletConnectUrl: connectionString,
    requireSecret: true,
    logger: SILENT_LOGGER,
  });
  return enforceLeastPrivilegeOnClient(client);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Nip47NetworkError('WebSocket relay connection timeout', 'TIMEOUT'));
    }, timeoutMs);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Server-side NwcWallet implementing the same Wallet interface as SimWallet:
 * { createInvoice(amountSats, memo, expirySeconds), lookupInvoice(id), getBalance() }
 *
 * Security & Privacy guarantees:
 * - Connection string is kept ONLY in server RAM for the current session.
 * - Never logged to stdout/stderr, never sent to Gemini, never returned to the client.
 * - Least privilege: only calls make_invoice, lookup_invoice, and get_balance; never calls pay_invoice.
 */
export class NwcWallet implements Wallet {
  private connectionStringInMemory: string | null = null;
  private activeClient: NwcClientLike | null = null;
  private relayHostPreview: string | null = null;
  private walletPubkeyPreview: string | null = null;
  private lastKnownBalanceSats = 0;
  private networkName: string | null = 'testnet';
  private invoicesById: Map<string, StoredNwcInvoiceRecord> = new Map();
  private counter = 1;
  private clientFactory: (connectionString: string) => NwcClientLike;
  private timeoutMs: number;

  constructor(
    clientFactory: (connectionString: string) => NwcClientLike = defaultClientFactory,
    timeoutMs = 5500
  ) {
    this.clientFactory = clientFactory;
    this.timeoutMs = timeoutMs;
  }

  public isConnected(): boolean {
    return Boolean(this.connectionStringInMemory && this.activeClient);
  }

  public getStatusSummary() {
    return {
      connected: this.isConnected(),
      relayHostPreview: this.relayHostPreview,
      walletPubkeyPreview: this.walletPubkeyPreview,
      balanceSats: this.isConnected() ? this.lastKnownBalanceSats : null,
      networkName: this.networkName,
      allowedMethods: ALLOWED_NWC_METHODS,
      neverCallsPayInvoice: true as const,
    };
  }

  /**
   * Clears the NWC connection string and client from server RAM.
   */
  public disconnect(): void {
    if (this.activeClient) {
      try {
        this.activeClient.close();
      } catch {
        // Ignore close errors
      }
    }
    this.activeClient = null;
    this.connectionStringInMemory = null;
    this.relayHostPreview = null;
    this.walletPubkeyPreview = null;
    this.lastKnownBalanceSats = 0;
    this.invoicesById.clear();
  }

  /**
   * Tests an NWC connection string (or the currently stored session connection)
   * and reports in plain words what succeeded or exactly what failed
   * (blocked_network, bad_string, expired_permission).
   * If saveOnSuccess is true and the check succeeds, keeps it in server session RAM.
   */
  public async runConnectionCheck(
    candidateConnectionString?: string,
    saveOnSuccess = false
  ): Promise<NwcConnectionCheckResult> {
    const targetString =
      candidateConnectionString?.trim() || this.connectionStringInMemory || '';

    const validation = validateNwcConnectionString(targetString);
    if (!validation.valid) {
      return {
        ok: false,
        connected: false,
        failureCategory: validation.failureCategory,
        outboundWebSocketBlocked: false,
        relayHostPreview: null,
        walletPubkeyPreview: null,
        balanceSats: null,
        networkName: null,
        allowedMethods: ALLOWED_NWC_METHODS,
        neverCallsPayInvoice: true,
        messageFr: validation.messageFr,
        messageEn: validation.messageEn,
      };
    }

    let tempClient: NwcClientLike | null = null;
    try {
      tempClient = this.clientFactory(targetString);

      // Step 1: Optional getInfo check to verify network & capabilities if supported by wallet
      let detectedNetwork = 'testnet';
      if (tempClient.getInfo) {
        try {
          const info = await withTimeout(tempClient.getInfo(), this.timeoutMs);
          if (info?.network) {
            detectedNetwork = info.network.toLowerCase();
            if (isMainnetNetworkName(detectedNetwork)) {
              tempClient.close();
              return {
                ok: false,
                connected: false,
                failureCategory: 'mainnet_refused',
                outboundWebSocketBlocked: false,
                relayHostPreview: validation.relayHostPreview,
                walletPubkeyPreview: validation.walletPubkeyPreview,
                balanceSats: null,
                networkName: detectedNetwork,
                allowedMethods: ALLOWED_NWC_METHODS,
                neverCallsPayInvoice: true,
                messageFr: `Portefeuille Mainnet refusé pour votre sécurité : ce portefeuille indique le réseau principal (${localizeQuotes(sanitizeUntrustedDisplayText(detectedNetwork), 'fr', true)}). Marché Éclair n’accepte que les portefeuilles sur un réseau de TEST (testnet, signet, mutinynet, regtest). N’utilisez jamais vos vraies économies.`,
                messageEn: `Mainnet wallet refused for your safety: this wallet reports network ${localizeQuotes(sanitizeUntrustedDisplayText(detectedNetwork), 'en', true)}. Marché Éclair only accepts TEST network wallets (testnet, signet, mutinynet, regtest). Never use real savings.`,
              };
            }
          }
          if (Array.isArray(info?.methods) && info.methods.length > 0) {
            const missingRequired = ALLOWED_NWC_METHODS.filter(
              (m) => !info.methods!.includes(m)
            );
            if (missingRequired.length > 0) {
              tempClient.close();
              return {
                ok: false,
                connected: false,
                failureCategory: 'expired_permission',
                outboundWebSocketBlocked: false,
                relayHostPreview: validation.relayHostPreview,
                walletPubkeyPreview: validation.walletPubkeyPreview,
                balanceSats: null,
                networkName: detectedNetwork,
                allowedMethods: ALLOWED_NWC_METHODS,
                neverCallsPayInvoice: true,
                messageFr: `Permission incomplète (expired/missing permission) : votre portefeuille NWC n’autorise pas ${missingRequired.join(', ')}. Activez uniquement make_invoice, lookup_invoice et get_balance.`,
                messageEn: `Missing permission: your NWC connection does not permit ${missingRequired.join(', ')}. Please enable make_invoice, lookup_invoice, and get_balance.`,
              };
            }
          }
        } catch (infoErr) {
          // If get_info itself failed with a permission or network error, let getBalance confirm
          if (infoErr instanceof Nip47WalletError) {
            const code = String(infoErr.code || '').toUpperCase();
            if (code === 'UNAUTHORIZED' || code === 'EXPIRED') {
              throw infoErr;
            }
          }
        }
      }

      // Step 2: Execute NIP-47 get_balance to verify live relay round-trip and read permission
      const balanceRes = await withTimeout(
        tempClient.getBalance(),
        this.timeoutMs
      );
      // NIP-47 get_balance returns millisatoshis
      const balanceSats = Math.max(0, Math.floor((balanceRes?.balance ?? 0) / 1000));

      if (saveOnSuccess) {
        if (this.activeClient && this.activeClient !== tempClient) {
          try {
            this.activeClient.close();
          } catch {
            // ignore
          }
        }
        this.connectionStringInMemory = targetString;
        this.activeClient = tempClient;
        this.relayHostPreview = validation.relayHostPreview;
        this.walletPubkeyPreview = validation.walletPubkeyPreview;
        this.lastKnownBalanceSats = balanceSats;
        this.networkName = detectedNetwork;
      } else {
        tempClient.close();
      }

      return {
        ok: true,
        connected: this.isConnected(),
        failureCategory: 'none',
        outboundWebSocketBlocked: false,
        relayHostPreview: validation.relayHostPreview,
        walletPubkeyPreview: validation.walletPubkeyPreview,
        balanceSats,
        networkName: detectedNetwork,
        allowedMethods: ALLOWED_NWC_METHODS,
        neverCallsPayInvoice: true,
        messageFr: `✓ Connexion NWC réussie avec le relais ${validation.relayHostPreview} ! Solde du portefeuille de test : ${balanceSats} sats. (Privilège minimum actif : make_invoice, lookup_invoice, get_balance uniquement — jamais pay_invoice).`,
        messageEn: `✓ NWC connection verified via relay ${validation.relayHostPreview}! Test wallet balance: ${balanceSats} sats. (Least privilege active: make_invoice, lookup_invoice, and get_balance only — never pay_invoice).`,
      };
    } catch (err) {
      if (tempClient) {
        try {
          tempClient.close();
        } catch {
          // ignore
        }
      }
      const classified = classifyNwcError(err);
      return {
        ok: false,
        connected: false,
        failureCategory: classified.failureCategory,
        outboundWebSocketBlocked: classified.outboundWebSocketBlocked,
        relayHostPreview: validation.relayHostPreview,
        walletPubkeyPreview: validation.walletPubkeyPreview,
        balanceSats: null,
        networkName: null,
        allowedMethods: ALLOWED_NWC_METHODS,
        neverCallsPayInvoice: true,
        messageFr: classified.messageFr,
        messageEn: classified.messageEn,
        runLocallyOrCloudRunGuideFr: classified.outboundWebSocketBlocked
          ? CLOUD_RUN_AND_LOCAL_GUIDE_FR
          : undefined,
        runLocallyOrCloudRunGuideEn: classified.outboundWebSocketBlocked
          ? CLOUD_RUN_AND_LOCAL_GUIDE_EN
          : undefined,
      };
    }
  }

  /**
   * Implements Wallet.getBalance() using NIP-47 get_balance.
   */
  public async getBalance(): Promise<number> {
    if (!this.activeClient) {
      throw new Error('NWC wallet is not connected in server session memory.');
    }
    const res = await withTimeout(this.activeClient.getBalance(), this.timeoutMs);
    const sats = Math.max(0, Math.floor((res?.balance ?? 0) / 1000));
    this.lastKnownBalanceSats = sats;
    return sats;
  }

  /**
   * Implements Wallet.createInvoice(amountSats, memo, expirySeconds) using NIP-47 make_invoice.
   * Converts amountSats to millisatoshis (amountSats * 1000) as required by NIP-47.
   */
  public async createInvoice(
    amountSats: number,
    memo: string,
    expirySeconds = 300
  ): Promise<Invoice> {
    if (!this.activeClient) {
      throw new Error('NWC wallet is not connected in server session memory.');
    }

    const nowMs = Date.now();
    const tx = await withTimeout(
      this.activeClient.makeInvoice({
        amount: amountSats * 1000, // NIP-47 amount is in millisatoshis
        description: memo,
        expiry: expirySeconds,
      }),
      this.timeoutMs
    );

    const rawBolt11 = String(tx.invoice || '').trim();
    if (isMainnetBolt11Invoice(rawBolt11)) {
      this.disconnect();
      const mainnetErr = new Error(
        'MAINNET_REFUSED: Wallet returned a Bitcoin Mainnet BOLT11 invoice (lnbc...). Connection terminated to protect real funds.'
      ) as Error & { code?: string };
      mainnetErr.code = 'MAINNET_REFUSED';
      throw mainnetErr;
    }

    const safeBolt11 = rawBolt11.replace(/[^a-zA-Z0-9]/g, '').slice(0, 1024);
    const safeMemo = sanitizeUntrustedDisplayText(tx.description || memo);

    const id = `nwc_inv_${this.counter++}_${(nowMs % 100000).toString(36)}`;
    const createdAtMs = tx.created_at ? tx.created_at * 1000 : nowMs;
    const expiresAtMs = tx.expires_at
      ? tx.expires_at * 1000
      : createdAtMs + expirySeconds * 1000;

    const invoice: Invoice = {
      id,
      paymentRequest: safeBolt11,
      amountSats,
      memo: safeMemo,
      status: 'PENDING',
      createdAt: createdAtMs,
      expiresAt: expiresAtMs,
    };

    this.invoicesById.set(id, {
      invoice,
      paymentHash: String(tx.payment_hash || '').replace(/[^a-fA-F0-9]/g, ''),
    });

    return { ...invoice };
  }

  /**
   * Implements Wallet.lookupInvoice(id) using NIP-47 lookup_invoice.
   * Polled during Lesson 1 in Real mode until the learner pays from a second test wallet.
   */
  public async lookupInvoice(id: string): Promise<Invoice | null> {
    const stored = this.invoicesById.get(id);
    if (!stored) {
      return null;
    }
    if (!this.activeClient) {
      return { ...stored.invoice };
    }

    const tx = await withTimeout(
      this.activeClient.lookupInvoice({
        payment_hash: stored.paymentHash,
        invoice: stored.invoice.paymentRequest,
      }),
      this.timeoutMs
    );

    const isSettled =
      tx.state === 'settled' ||
      Boolean(tx.settled_at && tx.settled_at > 0) ||
      Boolean(tx.preimage && tx.preimage.length > 0);

    if (isSettled && stored.invoice.status !== 'PAID') {
      stored.invoice.status = 'PAID';
      stored.invoice.paidAt = tx.settled_at
        ? tx.settled_at * 1000
        : Date.now();
      // Refresh cached balance when paid
      try {
        await this.getBalance();
      } catch {
        this.lastKnownBalanceSats += stored.invoice.amountSats;
      }
    } else if (
      stored.invoice.status === 'PENDING' &&
      (tx.state === 'failed' || Date.now() >= stored.invoice.expiresAt)
    ) {
      stored.invoice.status = 'EXPIRED';
    }

    return { ...stored.invoice };
  }
}
