import React, { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { Language } from '../data/content';
import { localizeQuotes } from '../shared/localizeQuotes';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function OfflineBanner({ lang }: { lang: Language }) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-status-banner"
      className="bg-[#F2B01E] text-[#1B1B1F] border-b-2 border-[#1B1B1F] px-4 py-2 text-sm font-bold"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-center">
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>
          {lang === 'fr'
            ? 'Mode Hors-Ligne actif — Le Mode Pratique (SimWallet) et les 6 leçons fonctionnent sans connexion Internet.'
            : 'Offline Mode active — Practice Mode (SimWallet) and all 6 lessons work without an internet connection.'}
        </span>
      </div>
    </div>
  );
}

export function PWAInstallButton({ lang }: { lang: Language }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) {
    return null;
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
      return;
    }
    setShowGuide(true);
  }

  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        data-testid="pwa-install-btn"
        onClick={handleInstallClick}
        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#1F2A6B] hover:bg-[#151d4d] text-[#FFF6E5] border border-[#1B1B1F] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          {lang === 'fr'
            ? 'Installer l’application (Hors-ligne)'
            : 'Install app (Offline ready)'}
        </span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          className="fixed inset-0 z-50 bg-[#1B1B1F]/60 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFDF9] border-2 border-[#1B1B1F] rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3
                id="ios-install-title"
                className="font-display font-extrabold text-lg text-[#1F2A6B]"
              >
                {lang === 'fr'
                  ? 'Installer Marché Éclair sur votre téléphone'
                  : 'Install Marché Éclair on your phone'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label={lang === 'fr' ? 'Fermer' : 'Close'}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-[#FFF6E5] border border-[#1B1B1F] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-base text-[#1B1B1F]">
              {localizeQuotes(
                lang === 'fr'
                  ? '1. Touchez le bouton Partager de votre navigateur.\n2. Choisissez « Sur l’écran d’accueil » pour jouer même sans connexion.'
                  : '1. Tap your browser’s Share button.\n2. Tap "Add to Home Screen" to play even without mobile data.',
                lang
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
