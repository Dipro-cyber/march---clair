import type { Request, Response, NextFunction } from 'express';
import { localizeQuotes } from '../shared/localizeQuotes';

/**
 * Scrubs secrets, NWC connection strings, hex keys, API keys, BOLT11 invoices,
 * email addresses, and phone numbers from any log string or object.
 */
export function scrubLogMessage(input: unknown): string {
  let raw: string;
  if (typeof input === 'string') {
    raw = input;
  } else if (input instanceof Error) {
    raw = `${input.name}: ${input.message}`;
  } else {
    try {
      raw = JSON.stringify(input);
    } catch {
      raw = String(input);
    }
  }

  return (
    raw
      // 1. NWC connection URIs
      .replace(/nostr\+?walletconnect:\/\/[^\s"'`<>]+/gi, '[REDACTED_NWC_URI]')
      // 2. Query secret parameters
      .replace(/secret=[0-9a-fA-F]{8,}/gi, 'secret=[REDACTED]')
      .replace(/secret=[^\s&"'`<>]+/gi, 'secret=[REDACTED]')
      // 3. Bech32 Nostr secret keys (nsec1...)
      .replace(/\bnsec1[02-9ac-hj-np-z]{20,}\b/gi, '[REDACTED_NSEC]')
      // 4. Google / Gemini API keys (AIza...)
      .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED_API_KEY]')
      // 5. Bearer tokens
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]')
      // 6. BOLT11 invoices (mainnet lnbc, testnet lntb, signet lntbs, regtest lnbcrt)
      .replace(
        /\bln(?:bcrt|tbs|tb|bc)[0-9a-z]{25,}\b/gi,
        '[REDACTED_BOLT11_INVOICE]'
      )
      // 7. 64-character hex strings (Nostr private keys, pubkeys, payment hashes)
      .replace(/\b[0-9a-fA-F]{64}\b/g, '[REDACTED_HEX_KEY]')
      // 8. Email addresses (PII)
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        '[REDACTED_EMAIL]'
      )
      // 9. Phone numbers (8 to 15 consecutive digits, with optional + prefix)
      .replace(/(?:\+|\b)[0-9]{8,15}\b/g, '[REDACTED_PHONE]')
  );
}

let scrubberInstalled = false;

/**
 * Installs a global console scrubber so any accidental console.log / warn / error
 * automatically strips secrets and personal data before writing to stdout/stderr.
 */
export function installGlobalLogScrubber(): void {
  if (scrubberInstalled) return;
  scrubberInstalled = true;

  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
  for (const method of methods) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const scrubbedArgs = args.map((arg) => scrubLogMessage(arg));
      original(...scrubbedArgs);
    };
  }
}

/**
 * Detects whether an NWC connection string or its query/relay metadata
 * explicitly points to Bitcoin Mainnet so it can be refused immediately.
 */
export function detectMainnetInNwcUri(rawUrl: string): {
  isMainnet: boolean;
  reasonFr: string;
  reasonEn: string;
} {
  const trimmed = (rawUrl || '').trim();
  const lower = trimmed.toLowerCase();

  try {
    const normalized = trimmed
      .replace(/^nostr\+walletconnect:\/\//i, 'http://')
      .replace(/^nostrwalletconnect:\/\//i, 'http://');
    const parsed = new URL(normalized);

    const networkParam = (
      parsed.searchParams.get('network') ||
      parsed.searchParams.get('chain') ||
      parsed.searchParams.get('net') ||
      parsed.searchParams.get('env') ||
      ''
    )
      .trim()
      .toLowerCase();

    if (
      networkParam === 'mainnet' ||
      networkParam === 'bitcoin' ||
      networkParam === 'btc' ||
      networkParam === 'prod' ||
      networkParam === 'production' ||
      networkParam === 'livenet'
    ) {
      return {
        isMainnet: true,
        reasonFr: `Portefeuille Mainnet refusé : le paramètre ${localizeQuotes(`network=${networkParam}`, 'fr', true)} indique le réseau Bitcoin principal (vrai argent). Marché Éclair n’accepte que les réseaux de TEST (testnet, signet, mutinynet). N’utilisez jamais vos vraies économies.`,
        reasonEn: `Mainnet connection string refused: parameter ${localizeQuotes(`network=${networkParam}`, 'en', true)} indicates Bitcoin Mainnet (real funds). Marché Éclair only accepts TEST networks (testnet, signet, mutinynet). Never use real savings.`,
      };
    }

    const relays = parsed.searchParams.getAll('relay');
    for (const relay of relays) {
      const relayLower = relay.toLowerCase();
      if (
        relayLower.includes('//mainnet.') ||
        relayLower.includes('.mainnet.') ||
        relayLower.includes('/mainnet')
      ) {
        return {
          isMainnet: true,
          reasonFr: localizeQuotes(
            'Portefeuille Mainnet refusé : l’adresse du relais indique explicitement "mainnet". Utilisez uniquement un portefeuille sur un réseau de TEST (testnet, signet, mutinynet).',
            'fr'
          ),
          reasonEn: localizeQuotes(
            'Mainnet connection string refused: the relay URL explicitly indicates "mainnet". Only use a wallet on a TEST network (testnet, signet, mutinynet).',
            'en'
          ),
        };
      }
    }
  } catch {
    // Fallback to substring pattern checks below
  }

  if (
    /[?&](?:network|chain|env)=(?:mainnet|bitcoin|prod|production|livenet)\b/i.test(
      lower
    )
  ) {
    return {
      isMainnet: true,
      reasonFr:
        'Portefeuille Mainnet refusé : cette chaîne NWC indique le réseau principal (mainnet). Utilisez uniquement un portefeuille sur un réseau de TEST.',
      reasonEn:
        'Mainnet connection string refused: this NWC URI indicates mainnet. Only use a wallet on a TEST network.',
    };
  }

  return {
    isMainnet: false,
    reasonFr: '',
    reasonEn: '',
  };
}

/**
 * Checks whether a network identifier returned by NIP-47 `get_info` represents Bitcoin Mainnet.
 */
export function isMainnetNetworkName(
  networkName: string | undefined | null
): boolean {
  if (!networkName) return false;
  const normalized = networkName.trim().toLowerCase();
  return (
    normalized === 'mainnet' ||
    normalized === 'bitcoin' ||
    normalized === 'btc-mainnet' ||
    normalized === 'livenet' ||
    normalized === 'prod' ||
    normalized === 'production'
  );
}

/**
 * Checks whether a BOLT11 payment request string is a Bitcoin Mainnet invoice (`lnbc...`
 * excluding regtest `lnbcrt...`, testnet `lntb...`, and signet `lntbs...`).
 */
export function isMainnetBolt11Invoice(bolt11: string): boolean {
  const normalized = (bolt11 || '').trim().toLowerCase();
  if (!normalized.startsWith('lnbc')) {
    return false;
  }
  // Regtest starts with lnbcrt; test prefixes starting with lnbctest are also non-mainnet
  if (normalized.startsWith('lnbcrt') || normalized.startsWith('lnbctest')) {
    return false;
  }
  return true;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  maxTrackedIps?: number;
}

interface IpRateRecord {
  count: number;
  resetAt: number;
}

/**
 * Memory-bounded per-IP rate limiter to protect API, NWC, and Gemini endpoints
 * from abuse and denial-of-service.
 */
export class InMemoryRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxTrackedIps: number;
  private readonly records = new Map<string, IpRateRecord>();
  private readonly nowFn: () => number;

  constructor(
    options: RateLimiterOptions,
    nowFn: () => number = () => Date.now()
  ) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.maxTrackedIps = options.maxTrackedIps ?? 5000;
    this.nowFn = nowFn;
  }

  public check(ipKey: string): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetSeconds: number;
    retryAfterSeconds: number;
  } {
    const now = this.nowFn();
    const key = ipKey || 'unknown';
    const existing = this.records.get(key);

    if (!existing || now >= existing.resetAt) {
      if (this.records.size >= this.maxTrackedIps && !this.records.has(key)) {
        this.evictOldestOrExpired(now);
      }
      const resetAt = now + this.windowMs;
      this.records.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: Math.max(0, this.maxRequests - 1),
        resetSeconds: Math.ceil(this.windowMs / 1000),
        retryAfterSeconds: 0,
      };
    }

    existing.count += 1;
    const remainingMs = Math.max(1000, existing.resetAt - now);
    const resetSeconds = Math.ceil(remainingMs / 1000);

    if (existing.count > this.maxRequests) {
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetSeconds,
        retryAfterSeconds: resetSeconds,
      };
    }

    return {
      allowed: true,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - existing.count),
      resetSeconds,
      retryAfterSeconds: 0,
    };
  }

  private evictOldestOrExpired(now: number): void {
    for (const [k, rec] of this.records.entries()) {
      if (now >= rec.resetAt) {
        this.records.delete(k);
      }
    }
    if (this.records.size >= this.maxTrackedIps) {
      const oldestKey = this.records.keys().next().value;
      if (oldestKey !== undefined) {
        this.records.delete(oldestKey);
      }
    }
  }
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket?.remoteAddress || '127.0.0.1').slice(0, 64);
}

export function createRateLimiterMiddleware(
  limiter: InMemoryRateLimiter,
  scopeLabel = 'api'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = `${scopeLabel}:${extractClientIp(req)}`;
    const status = limiter.check(ip);

    res.setHeader('RateLimit-Limit', String(status.limit));
    res.setHeader('RateLimit-Remaining', String(status.remaining));
    res.setHeader('RateLimit-Reset', String(status.resetSeconds));

    if (!status.allowed) {
      res.setHeader('Retry-After', String(status.retryAfterSeconds));
      res.status(429).json({
        error: `Too many requests (${scopeLabel}). Please wait ${status.retryAfterSeconds}s before trying again.`,
        errorFr: `Trop de requêtes (${scopeLabel}). Veuillez patienter ${status.retryAfterSeconds} s avant de réessayer.`,
        retryAfterSeconds: status.retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

/**
 * Builds a restrictive Content-Security-Policy header.
 * - Blocks all plugins/objects (`object-src 'none'`), base-tag hijacking (`base-uri 'self'`),
 *   and external form submissions (`form-action 'self'`).
 * - Restricts `connect-src` to `'self'` so the browser can never exfiltrate NWC strings
 *   or connect to external relays/APIs directly from client scripts.
 */
export function buildContentSecurityPolicy(isProduction: boolean): string {
  const scriptSrc = isProduction
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline'";
  const connectSrc = isProduction
    ? "connect-src 'self'"
    : "connect-src 'self' ws://localhost:* ws://127.0.0.1:*";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    connectSrc,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self' https://*.google.com https://*.corp.google.com https://*.run.app",
  ].join('; ');
}

/**
 * Express middleware setting restrictive CSP and standard security headers on every response.
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Content-Security-Policy',
    buildContentSecurityPolicy(isProduction)
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  if (req.path.startsWith('/api/')) {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}
