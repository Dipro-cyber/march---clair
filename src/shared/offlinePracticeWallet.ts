import { Language } from '../data/content';
import { localizeQuotes } from './localizeQuotes';
import {
  Invoice,
  NetworkState,
  PaymentComparison,
  PaymentResult,
  SimWallet,
} from './simWallet';

function sanitizeErrorText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>&"'`]/g, '')
    .trim()
    .slice(0, 320);
}

/**
 * Browser-side fallback SimWallet so Practice Mode works 100% offline
 * after the first visit even when mobile data drops completely.
 */
const offlineSimWallet = new SimWallet();

export function getOfflinePracticeWallet(): SimWallet {
  return offlineSimWallet;
}

/**
 * Translates any server/Zod error message into the learner's selected language (FR/EN)
 * so every error string in the app has complete French and English translations.
 */
export function translateServerError(
  rawError: string | undefined | null,
  lang: Language
): string {
  const cleaned = sanitizeErrorText(localizeQuotes(rawError || '', lang));
  if (!cleaned) {
    return lang === 'fr'
      ? 'Une erreur inattendue est survenue. Veuillez réessayer.'
      : 'An unexpected error occurred. Please try again.';
  }

  const lower = cleaned.toLowerCase();

  if (lower.includes('phone numbers or email')) {
    return lang === 'fr'
      ? 'Ne mettez jamais de numéro de téléphone ni d’adresse e-mail dans la note (mémo).'
      : 'Do not include phone numbers or email addresses in the memo.';
  }
  if (lower.includes('amount must be at least 1 sat')) {
    return lang === 'fr'
      ? 'Le montant doit être d’au moins 1 sat.'
      : 'Amount must be at least 1 sat.';
  }
  if (lower.includes('exceeds practice channel capacity')) {
    return lang === 'fr'
      ? 'Le montant dépasse la capacité du canal d’entraînement (maximum 2 500 sats).'
      : 'Amount exceeds practice channel capacity (max 2,500 sats).';
  }
  if (lower.includes('whole number of sats')) {
    return lang === 'fr'
      ? 'Le montant doit être un nombre entier de sats (ex : 250).'
      : 'Amount must be a whole number of sats (e.g., 250).';
  }
  if (lower.includes('memo cannot be empty') || lower.includes('memo is required')) {
    return lang === 'fr'
      ? 'La note (mémo) de la facture ne peut pas être vide.'
      : 'The invoice note (memo) cannot be empty.';
  }
  if (lower.includes('memo must be 120 characters')) {
    return lang === 'fr'
      ? 'La note (mémo) ne doit pas dépasser 120 caractères.'
      : 'Memo must be 120 characters or fewer.';
  }
  if (lower.includes('invalid invoice creation input')) {
    return lang === 'fr'
      ? 'Les données de création de la facture sont invalides. Vérifiez le montant (1 à 2 500 sats) et la note.'
      : 'Invalid invoice creation input. Please check the amount (1 to 2,500 sats) and memo.';
  }
  if (lower.includes('real mode is not connected') || lower.includes('real mode (nwc) is not connected')) {
    return lang === 'fr'
      ? 'Le Mode Réel n’est pas connecté. Ouvrez la fenêtre Mode Réel (NWC) et connectez un portefeuille de test.'
      : 'Real mode is not connected. Open the Real Mode (NWC) dialog and connect a test wallet first.';
  }
  if (lower.includes('mainnet_refused') || lower.includes('mainnet invoice detected')) {
    return lang === 'fr'
      ? 'Refus de sécurité (MAINNET_REFUSED) : ce portefeuille utilise le réseau Bitcoin principal (Mainnet). Utilisez uniquement un réseau de test.'
      : 'Security refusal (MAINNET_REFUSED): this wallet uses the real Bitcoin Mainnet. Please use a test network only.';
  }
  if (lower.includes('too many requests')) {
    return lang === 'fr'
      ? 'Trop de requêtes envoyées rapidement. Veuillez patienter quelques secondes avant de réessayer.'
      : 'Too many requests sent quickly. Please wait a few seconds before trying again.';
  }
  if (lower.includes('invoice not found')) {
    return lang === 'fr'
      ? 'Facture introuvable. Créez une nouvelle facture Lightning.'
      : 'Invoice not found. Please create a new Lightning invoice.';
  }
  if (lower.includes('invalid invoice id')) {
    return lang === 'fr'
      ? 'Identifiant de facture invalide.'
      : 'Invalid invoice ID.';
  }

  return cleaned;
}

export async function fetchWalletBalanceWithOfflineFallback(
  mode: 'practice' | 'real' = 'practice'
): Promise<{
  balance: number;
  network: NetworkState;
  offline: boolean;
}> {
  try {
    const query = mode === 'real' ? '?mode=real' : '';
    const res = await fetch(`/api/wallet/balance${query}`);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.balance === 'number' && data.network) {
        return {
          balance: data.balance,
          network: data.network,
          offline: false,
        };
      }
    }
  } catch {
    // Offline fallback below
  }

  return {
    balance: offlineSimWallet.getBalance(),
    network: offlineSimWallet.getNetworkState(),
    offline: true,
  };
}

export async function prepareLessonWithOfflineFallback(
  lessonId: number
): Promise<{
  balance: number;
  network: NetworkState;
  offline: boolean;
}> {
  const networkFallback = offlineSimWallet.prepareLessonScenario(lessonId);
  const balanceFallback = offlineSimWallet.getBalance();

  try {
    const res = await fetch('/api/wallet/prepare-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.balance === 'number' && data.network) {
        return {
          balance: data.balance,
          network: data.network,
          offline: false,
        };
      }
    }
  } catch {
    // Use offline SimWallet
  }

  return {
    balance: balanceFallback,
    network: networkFallback,
    offline: true,
  };
}

export async function compareMethodsWithOfflineFallback(
  amountSats: number
): Promise<PaymentComparison> {
  const localComparison = offlineSimWallet.comparePaymentMethods(amountSats);
  try {
    const res = await fetch('/api/wallet/compare-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountSats }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.comparison) {
        return data.comparison;
      }
    }
  } catch {
    // Use offline SimWallet comparison
  }
  return localComparison;
}

export async function createInvoiceWithOfflineFallback(params: {
  amountSats: number;
  memo: string;
  expirySeconds: number;
  mode: 'practice' | 'real';
  lang: Language;
}): Promise<{
  ok: boolean;
  invoice?: Invoice;
  balance?: number;
  network?: NetworkState;
  offline?: boolean;
  error?: string;
}> {
  const safeMemo = sanitizeErrorText(params.memo);
  if (/[0-9]{8,}|@/.test(safeMemo)) {
    return {
      ok: false,
      error: translateServerError('Do not include phone numbers or email', params.lang),
    };
  }
  if (params.amountSats < 1 || params.amountSats > 2500) {
    return {
      ok: false,
      error: translateServerError(
        params.amountSats < 1
          ? 'Amount must be at least 1 sat'
          : 'Amount exceeds practice channel capacity',
        params.lang
      ),
    };
  }

  // Always keep offline practice wallet in sync for practice mode
  const localInvoice =
    params.mode === 'practice'
      ? offlineSimWallet.createInvoice(
          params.amountSats,
          safeMemo,
          params.expirySeconds
        )
      : null;

  try {
    const res = await fetch('/api/wallet/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountSats: params.amountSats,
        memo: safeMemo,
        expirySeconds: params.expirySeconds,
        mode: params.mode,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const rawErr =
        params.lang === 'fr' && data.errorFr ? data.errorFr : data.error;
      return {
        ok: false,
        error: translateServerError(rawErr, params.lang),
      };
    }
    return {
      ok: true,
      invoice: data.invoice,
      balance: data.balance,
      network: data.network,
      offline: false,
    };
  } catch {
    if (params.mode === 'practice' && localInvoice) {
      return {
        ok: true,
        invoice: localInvoice,
        balance: offlineSimWallet.getBalance(),
        network: offlineSimWallet.getNetworkState(),
        offline: true,
      };
    }
    return {
      ok: false,
      error:
        params.lang === 'fr'
          ? 'Mode hors-ligne : le Mode Réel (NWC) nécessite une connexion réseau. Passez en Mode Pratique (SimWallet) pour jouer hors-ligne.'
          : 'Offline: Real Mode (NWC) requires an internet connection. Switch to Practice Mode (SimWallet) to play offline.',
    };
  }
}

export async function lookupInvoiceWithOfflineFallback(params: {
  id: string;
  mode?: 'practice' | 'real';
  isRealMode?: boolean;
  lang: Language;
}): Promise<{
  ok: boolean;
  invoice?: Invoice;
  balance?: number;
  network?: NetworkState;
  error?: string;
}> {
  const useReal = params.mode === 'real' || Boolean(params.isRealMode);
  try {
    const modeQuery = useReal ? '?mode=real' : '';
    const res = await fetch(
      `/api/wallet/invoices/${encodeURIComponent(params.id)}${modeQuery}`
    );
    const data = await res.json();
    if (res.ok && data.invoice) {
      return {
        ok: true,
        invoice: data.invoice,
        balance: data.balance,
        network: data.network,
      };
    }
    return {
      ok: false,
      error: translateServerError(
        params.lang === 'fr' && data.errorFr ? data.errorFr : data.error,
        params.lang
      ),
    };
  } catch {
    if (!useReal) {
      const localInv = offlineSimWallet.lookupInvoice(params.id);
      if (localInv) {
        return {
          ok: true,
          invoice: localInv,
          balance: offlineSimWallet.getBalance(),
          network: offlineSimWallet.getNetworkState(),
        };
      }
    }
    return {
      ok: false,
      error:
        params.lang === 'fr'
          ? 'Impossible de vérifier la facture hors-ligne en Mode Réel.'
          : 'Cannot lookup Real Mode invoice while offline.',
    };
  }
}

export async function payPracticeInvoiceWithOfflineFallback(params: {
  id: string;
  simulateLatePayment: boolean;
  multiHop: boolean;
}): Promise<PaymentResult> {
  const localPay = offlineSimWallet.payInvoice(
    params.id,
    params.simulateLatePayment,
    params.multiHop
  );

  try {
    const res = await fetch(
      `/api/wallet/invoices/${encodeURIComponent(params.id)}/pay`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulateLatePayment: params.simulateLatePayment,
          multiHop: params.multiHop,
        }),
      }
    );
    const data = await res.json();
    if (data && typeof data.code === 'string') {
      return data as PaymentResult;
    }
  } catch {
    // Fall back to local SimWallet payment result
  }

  return localPay;
}

export async function expirePracticeInvoiceWithOfflineFallback(
  id: string
): Promise<{
  invoice: Invoice | null;
  balance: number;
  network: NetworkState;
}> {
  const localExpired = offlineSimWallet.forceExpireInvoice(id);
  try {
    const res = await fetch(
      `/api/wallet/invoices/${encodeURIComponent(id)}/expire`,
      { method: 'POST' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.invoice) {
        return {
          invoice: data.invoice,
          balance: data.balance,
          network: data.network,
        };
      }
    }
  } catch {
    // Offline fallback
  }

  return {
    invoice: localExpired,
    balance: offlineSimWallet.getBalance(),
    network: offlineSimWallet.getNetworkState(),
  };
}

export async function topUpChannelWithOfflineFallback(
  additionalSats: number
): Promise<{
  balance: number;
  network: NetworkState;
}> {
  const localNet = offlineSimWallet.topUpChannelCapacity(additionalSats);
  try {
    const res = await fetch('/api/wallet/top-up-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ additionalSats }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.network) {
        return {
          balance: data.balance,
          network: data.network,
        };
      }
    }
  } catch {
    // Offline fallback
  }

  return {
    balance: offlineSimWallet.getBalance(),
    network: localNet,
  };
}

export async function resetPracticeWalletWithOfflineFallback(): Promise<{
  balance: number;
  network: NetworkState;
}> {
  offlineSimWallet.reset();
  try {
    const res = await fetch('/api/wallet/reset', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return {
        balance: data.balance,
        network: data.network,
      };
    }
  } catch {
    // Offline fallback
  }

  return {
    balance: offlineSimWallet.getBalance(),
    network: offlineSimWallet.getNetworkState(),
  };
}
