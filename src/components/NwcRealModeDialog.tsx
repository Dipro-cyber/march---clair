import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Lock,
  PlugZap,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { Language } from '../data/content';
import { sanitizeUntrustedDisplayText } from '../shared/aiCharacters';
import { localizeQuotes } from '../shared/localizeQuotes';

export type WalletMode = 'practice' | 'real';

export interface NwcStatusSummary {
  connected: boolean;
  relayHostPreview: string | null;
  walletPubkeyPreview: string | null;
  balanceSats: number | null;
  networkName: string | null;
  allowedMethods: readonly string[];
  neverCallsPayInvoice: boolean;
}

export interface NwcCheckResponse {
  ok: boolean;
  connected: boolean;
  failureCategory:
    | 'none'
    | 'blocked_network'
    | 'bad_string'
    | 'expired_permission'
    | 'mainnet_refused';
  outboundWebSocketBlocked: boolean;
  relayHostPreview: string | null;
  walletPubkeyPreview: string | null;
  balanceSats: number | null;
  networkName: string | null;
  allowedMethods: readonly string[];
  neverCallsPayInvoice: boolean;
  messageFr: string;
  messageEn: string;
  runLocallyOrCloudRunGuideFr?: string;
  runLocallyOrCloudRunGuideEn?: string;
}

interface NwcRealModeDialogProps {
  isOpen: boolean;
  lang: Language;
  walletMode: WalletMode;
  nwcStatus: NwcStatusSummary;
  onClose: () => void;
  onModeChanged: (newMode: WalletMode, updatedStatus: NwcStatusSummary) => void;
}

export function NwcRealModeDialog({
  isOpen,
  lang,
  walletMode,
  nwcStatus,
  onClose,
  onModeChanged,
}: NwcRealModeDialogProps) {
  const [connectionInput, setConnectionInput] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<NwcCheckResponse | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleRunConnectionCheck(saveInSession = false) {
    setIsChecking(true);
    try {
      const endpoint = saveInSession ? '/api/nwc/connect' : '/api/nwc/check';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: connectionInput.trim(),
          saveInSession,
          language: lang,
        }),
      });
      const raw = await res.json();
      const data: NwcCheckResponse =
        typeof raw?.messageFr === 'string' && typeof raw?.messageEn === 'string'
          ? raw
          : {
              ok: false,
              connected: false,
              failureCategory: 'bad_string',
              outboundWebSocketBlocked: false,
              relayHostPreview: null,
              walletPubkeyPreview: null,
              balanceSats: null,
              networkName: null,
              allowedMethods: ['make_invoice', 'lookup_invoice', 'get_balance'],
              neverCallsPayInvoice: true,
              messageFr:
                'Mauvaise chaîne de connexion (bad string) : veuillez coller une URI nostr+walletconnect:// valide.',
              messageEn:
                'Bad connection string: please paste a valid nostr+walletconnect:// URI.',
            };
      setCheckResult(data);

      if (data.ok && saveInSession) {
        // Immediately wipe input from browser memory so it never stays in client state
        setConnectionInput('');
        onModeChanged('real', {
          connected: true,
          relayHostPreview: data.relayHostPreview,
          walletPubkeyPreview: data.walletPubkeyPreview,
          balanceSats: data.balanceSats,
          networkName: data.networkName,
          allowedMethods: data.allowedMethods ?? [
            'make_invoice',
            'lookup_invoice',
            'get_balance',
          ],
          neverCallsPayInvoice: true,
        });
      }
    } catch {
      setCheckResult({
        ok: false,
        connected: false,
        failureCategory: 'blocked_network',
        outboundWebSocketBlocked: true,
        relayHostPreview: null,
        walletPubkeyPreview: null,
        balanceSats: null,
        networkName: null,
        allowedMethods: ['make_invoice', 'lookup_invoice', 'get_balance'],
        neverCallsPayInvoice: true,
        messageFr:
          'Réseau bloqué (blocked network) : impossible de joindre le serveur NWC.',
        messageEn:
          'Blocked network: could not reach the NWC check endpoint.',
        runLocallyOrCloudRunGuideFr:
          'Exécutez l’application localement (`npm install && npm run dev`) ou déployez-la sur Google Cloud Run.',
        runLocallyOrCloudRunGuideEn:
          'Run the app locally (`npm install && npm run dev`) or deploy it on Google Cloud Run.',
      });
    } finally {
      setIsChecking(false);
    }
  }

  async function handleDisconnect() {
    setIsChecking(true);
    try {
      const res = await fetch('/api/nwc/disconnect', { method: 'POST' });
      const statusData = await res.json();
      setConnectionInput('');
      setCheckResult(null);
      onModeChanged('practice', statusData);
    } finally {
      setIsChecking(false);
    }
  }

  const categoryBadgeLabel = () => {
    if (!checkResult) return null;
    if (checkResult.ok) {
      return lang === 'fr'
        ? 'Connexion vérifiée ✓'
        : 'Connection verified ✓';
    }
    switch (checkResult.failureCategory) {
      case 'mainnet_refused':
        return lang === 'fr'
          ? 'Refusé : Portefeuille Mainnet détecté (Mainnet refused)'
          : 'Refused: Mainnet wallet detected (mainnet_refused)';
      case 'bad_string':
        return lang === 'fr'
          ? 'Échec : Mauvaise chaîne NWC (Bad string)'
          : 'Failed: Bad connection string (bad_string)';
      case 'expired_permission':
        return lang === 'fr'
          ? 'Échec : Permission expirée ou refusée (Expired permission)'
          : 'Failed: Expired or missing permission (expired_permission)';
      case 'blocked_network':
      default:
        return lang === 'fr'
          ? 'Échec : Réseau / WebSocket bloqué (Blocked network)'
          : 'Failed: Blocked network / WebSocket (blocked_network)';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nwc-dialog-title"
      data-testid="nwc-real-mode-dialog"
      className="fixed inset-0 z-50 bg-[#1B1B1F]/60 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-[#FFFDF9] border-3 border-[#1B1B1F] rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#1F2A6B]/20 pb-3.5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#D9582B]">
              <PlugZap className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Nostr Wallet Connect (NIP-47 · @getalby/sdk)</span>
            </div>
            <h2
              id="nwc-dialog-title"
              className="font-display font-extrabold text-xl sm:text-2xl text-[#1F2A6B]"
            >
              {lang === 'fr'
                ? 'Mode Réel (Réseau de test uniquement / Test network only)'
                : 'Real mode (test network only)'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'fr' ? 'Fermer la fenêtre' : 'Close dialog'}
            className="min-h-[48px] min-w-[48px] rounded-xl bg-[#FFF6E5] hover:bg-[#F2B01E]/30 border-2 border-[#1B1B1F] flex items-center justify-center text-[#1B1B1F] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Mandatory Testnet & Tiny Balance Warning */}
        <div
          data-testid="nwc-testnet-warning"
          className="bg-[#D9582B]/15 border-2 border-[#D9582B] rounded-2xl p-4 space-y-1.5"
        >
          <div className="flex items-center gap-2 font-display font-extrabold text-base sm:text-lg text-[#D9582B]">
            <ShieldAlert className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>
              Use a wallet on a TEST network with a tiny balance. Never use real savings.
            </span>
          </div>
          {lang === 'fr' && (
            <p className="text-sm font-bold text-[#1B1B1F]">
              Utilisez uniquement un portefeuille sur un RÉSEAU DE TEST (Testnet / Signet / Mutinynet) avec un tout petit solde. N’utilisez jamais vos vraies économies.
            </p>
          )}
        </div>

        {/* Mandatory Least Privilege & Server RAM Privacy Notice */}
        <div
          data-testid="nwc-least-privilege-box"
          className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-4 space-y-2.5"
        >
          <div className="flex items-center gap-2 font-display font-bold text-base text-[#1F2A6B]">
            <ShieldCheck className="w-5 h-5 text-[#2E7D4F] shrink-0" aria-hidden="true" />
            <span>
              {lang === 'fr'
                ? 'Privilège minimum (Least privilege) & Sécurité de session'
                : 'Least Privilege & Session Memory Security'}
            </span>
          </div>

          <p className="text-sm sm:text-base font-semibold text-[#1B1B1F]">
            {lang === 'fr'
              ? 'Cette application utilise uniquement make_invoice, lookup_invoice et get_balance. Elle n’appelle et ne demande jamais pay_invoice (elle ne peut jamais dépenser vos sats).'
              : 'Least privilege: this app only uses make_invoice, lookup_invoice and get_balance. It never calls or requests pay_invoice.'}
          </p>

          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-[#2E7D4F] text-[#FFF6E5] border border-[#1B1B1F]">
              ✓ make_invoice
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#2E7D4F] text-[#FFF6E5] border border-[#1B1B1F]">
              ✓ lookup_invoice
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#2E7D4F] text-[#FFF6E5] border border-[#1B1B1F]">
              ✓ get_balance
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#D9582B] text-[#FFF6E5] border border-[#1B1B1F]">
              ✕ NEVER pay_invoice
            </span>
          </div>

          <p className="text-xs font-bold text-[#1F2A6B] flex items-center gap-1.5 pt-1">
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {lang === 'fr'
                ? 'Gardé uniquement dans la mémoire vive (RAM) du serveur pour la session : jamais journalisé (logged), jamais envoyé à Gemini, jamais stocké dans localStorage.'
                : 'Kept only in server memory for the session: never logged, never sent to Gemini, never stored in localStorage or the client.'}
            </span>
          </p>
        </div>

        {/* Mode Switcher (Practice Mode vs Real Mode) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFF6E5] border-2 border-[#1B1B1F] rounded-2xl p-3.5">
          <div className="space-y-0.5">
            <div className="text-xs font-bold uppercase text-[#1F2A6B]">
              {lang === 'fr' ? 'Mode actuel du portefeuille' : 'Current wallet mode'}
            </div>
            <div className="font-display font-extrabold text-base text-[#1B1B1F]">
              {walletMode === 'real' && nwcStatus.connected
                ? lang === 'fr'
                  ? `⚡ Mode Réel actif (${nwcStatus.relayHostPreview ?? 'NWC'})`
                  : `⚡ Real Mode active (${nwcStatus.relayHostPreview ?? 'NWC'})`
                : lang === 'fr'
                ? '🛡️ Mode Pratique (SimWallet · Sats de jeu)'
                : '🛡️ Practice Mode (SimWallet · Play sats)'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="switch-to-practice-btn"
              onClick={() => onModeChanged('practice', nwcStatus)}
              aria-pressed={walletMode === 'practice'}
              className={`min-h-[48px] px-3.5 py-2 rounded-xl font-bold text-sm border-2 cursor-pointer ${
                walletMode === 'practice'
                  ? 'bg-[#1F2A6B] text-[#FFF6E5] border-[#1B1B1F]'
                  : 'bg-white text-[#1F2A6B] border-[#1F2A6B]'
              }`}
            >
              {lang === 'fr' ? 'Mode Pratique (SimWallet)' : 'Practice Mode (SimWallet)'}
            </button>

            {nwcStatus.connected && (
              <button
                type="button"
                data-testid="disconnect-nwc-btn"
                onClick={handleDisconnect}
                disabled={isChecking}
                className="min-h-[48px] px-3.5 py-2 rounded-xl bg-[#D9582B] hover:bg-[#b8431b] text-[#FFF6E5] font-bold text-sm border-2 border-[#1B1B1F] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'fr'
                    ? 'Effacer de la mémoire'
                    : 'Clear from session memory'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* NWC Connection String Input + Run Connection Check + Connect */}
        <div className="space-y-3">
          <label
            htmlFor="nwc-connection-string-input"
            className="block font-display font-bold text-base text-[#1F2A6B]"
          >
            {lang === 'fr'
              ? 'Collez votre chaîne de connexion NWC (nostr+walletconnect://...)'
              : 'Paste your NWC connection string (nostr+walletconnect://...)'}
          </label>
          <input
            id="nwc-connection-string-input"
            data-testid="nwc-connection-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={connectionInput}
            onChange={(e) => setConnectionInput(e.target.value)}
            placeholder="nostr+walletconnect://<pubkey>?relay=wss://...&secret=..."
            className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#FFF6E5] border-2 border-[#1B1B1F] font-mono text-sm text-[#1B1B1F] focus:outline-2 focus:outline-[#1F2A6B]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              data-testid="run-connection-check-btn"
              disabled={isChecking}
              onClick={() => handleRunConnectionCheck(false)}
              className="min-h-[50px] px-4 py-2.5 rounded-2xl bg-[#FFF6E5] hover:bg-[#F2B01E]/30 text-[#1F2A6B] border-2 border-[#1F2A6B] font-display font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 shrink-0 ${isChecking ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {lang === 'fr'
                  ? 'Tester la connexion (Run connection check)'
                  : 'Run connection check'}
              </span>
            </button>

            <button
              type="button"
              data-testid="connect-nwc-session-btn"
              disabled={isChecking || !connectionInput.trim()}
              onClick={() => handleRunConnectionCheck(true)}
              className="min-h-[50px] px-4 py-2.5 rounded-2xl bg-[#2E7D4F] hover:bg-[#23633e] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <PlugZap className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'fr'
                  ? 'Activer le Mode Réel (Leçon 1)'
                  : 'Connect Real Mode (Lesson 1)'}
              </span>
            </button>
          </div>
        </div>

        {/* Diagnostic Result Card */}
        {checkResult && (
          <div
            role="status"
            data-testid="nwc-check-result"
            data-failure-category={checkResult.failureCategory}
            className={`rounded-2xl p-4 border-2 space-y-3 ${
              checkResult.ok
                ? 'bg-[#2E7D4F]/15 border-[#2E7D4F] text-[#1B1B1F]'
                : 'bg-[#D9582B]/15 border-[#D9582B] text-[#1B1B1F]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span
                data-testid="nwc-failure-badge"
                className={`px-3 py-1 rounded-xl font-bold text-xs border inline-flex items-center gap-1.5 ${
                  checkResult.ok
                    ? 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]'
                    : 'bg-[#D9582B] text-[#FFF6E5] border-[#1B1B1F]'
                }`}
              >
                {checkResult.ok ? (
                  <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{categoryBadgeLabel()}</span>
              </span>

              {checkResult.relayHostPreview && (
                <span className="text-xs font-mono font-bold text-[#1F2A6B]">
                  Relay: {sanitizeUntrustedDisplayText(checkResult.relayHostPreview)}
                </span>
              )}
            </div>

            <p className="text-base font-bold text-[#1B1B1F]">
              {localizeQuotes(
                sanitizeUntrustedDisplayText(
                  lang === 'fr' ? checkResult.messageFr : checkResult.messageEn
                ),
                lang
              )}
            </p>

            {/* Clear instructions to run locally or deploy on Cloud Run when outbound WebSockets are blocked */}
            {checkResult.outboundWebSocketBlocked && (
              <div
                data-testid="nwc-cloudrun-local-instructions"
                className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-xl p-3.5 space-y-2 text-sm text-[#1B1B1F]"
              >
                <div className="font-display font-bold text-[#1F2A6B] flex items-center gap-1.5">
                  <Server className="w-4 h-4 shrink-0 text-[#D9582B]" aria-hidden="true" />
                  <span>
                    {lang === 'fr'
                      ? 'Connexions WebSocket sortantes bloquées : comment utiliser le Mode Réel'
                      : 'Outbound WebSockets blocked by hosting runtime: how to run Real Mode'}
                  </span>
                </div>
                <p className="font-semibold">
                  {lang === 'fr'
                    ? checkResult.runLocallyOrCloudRunGuideFr
                    : checkResult.runLocallyOrCloudRunGuideEn}
                </p>
                <div className="bg-[#FFF6E5] border border-[#1B1B1F]/30 rounded-lg p-2.5 font-mono text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#1F2A6B]">
                    <Terminal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>1. Run locally (Exécuter en local) :</span>
                  </div>
                  <div>npm install &amp;&amp; npm run dev</div>
                  <div className="pt-1 font-bold text-[#1F2A6B]">
                    2. Deploy on Google Cloud Run (Déployer sur Cloud Run) :
                  </div>
                  <div>
                    gcloud run deploy marche-eclair --source . --allow-unauthenticated
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
