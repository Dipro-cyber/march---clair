/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import {
  DEFAULT_PROGRESS,
  isLessonId,
  Language,
  LessonId,
  loadProgress,
  recordLessonCompletion,
  saveProgress,
  ScreenId,
  StallId,
  UI_TEXT,
} from './data/content';
import { NetworkState } from './shared/simWallet';
import {
  DEFAULT_GAME_EXTRAS,
  loadGameExtras,
  recordHintUsed,
  saveGameExtras,
} from './shared/gameMechanics';
import { playLessonFanfareSound } from './shared/soundEffects';
import {
  fetchWalletBalanceWithOfflineFallback,
  resetPracticeWalletWithOfflineFallback,
} from './shared/offlinePracticeWallet';
import { LightningBoltSvg } from './components/LightningBoltIcon';
import { HomeScreen } from './components/HomeScreen';
import {
  OfflineBanner,
  PWAInstallButton,
} from './components/OfflineAndInstallBar';
import type { WalletMode } from './shared/validation';
import type { NwcStatusSummary } from './components/NwcRealModeDialog';

const LazyMarketScreen = React.lazy(() =>
  import('./components/MarketScreen').then((m) => ({ default: m.MarketScreen }))
);

const LazyLessonCardScreen = React.lazy(() =>
  import('./components/LessonCardScreen').then((m) => ({
    default: m.LessonCardScreen,
  }))
);

const LazyProgressScreen = React.lazy(() =>
  import('./components/ProgressScreen').then((m) => ({
    default: m.ProgressScreen,
  }))
);

const LazyNwcRealModeDialog = React.lazy(() =>
  import('./components/NwcRealModeDialog').then((m) => ({
    default: m.NwcRealModeDialog,
  }))
);

export default function App() {
  const [progress, setProgress] = useState(() => loadProgress());
  const [gameExtras, setGameExtras] = useState(() => loadGameExtras());
  const [screen, setScreen] = useState<ScreenId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('lesson')) {
        return 'market';
      }
    }
    return 'home';
  });
  const [activeLesson, setActiveLesson] = useState<LessonId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const num = Number(params.get('lesson'));
      if (isLessonId(num)) return num;
    }
    return 1;
  });
  const [balanceSats, setBalanceSats] = useState<number>(1200);
  const [network, setNetwork] = useState<NetworkState | null>(null);
  // Real mode state is kept strictly in runtime memory (never stored in localStorage)
  const [walletMode, setWalletMode] = useState<WalletMode>('practice');
  const [nwcStatus, setNwcStatus] = useState<NwcStatusSummary>({
    connected: false,
    relayHostPreview: null,
    walletPubkeyPreview: null,
    balanceSats: null,
    networkName: null,
    allowedMethods: ['make_invoice', 'lookup_invoice', 'get_balance'],
    neverCallsPayInvoice: true,
  });
  const [isNwcDialogOpen, setIsNwcDialogOpen] = useState<boolean>(false);

  const lang = progress.language;

  // Keep document lang and dataset.state updated for accessibility & testing
  useEffect(() => {
    document.documentElement.lang = lang;
    document.body.dataset.state = screen === 'home' ? 'title' : 'playing';
    document.body.dataset.screen = screen;
  }, [lang, screen]);

  // Warm code-split chunks in the background after initial paint so Practice mode works 100% offline after the first visit
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import('./components/MarketScreen');
      void import('./components/LessonCardScreen');
      void import('./components/ProgressScreen');
      void import('./components/MarketIllustrations');
      void import('./components/LessonVisuals');
      void import('./components/Lesson6ScamPanel');
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  const fetchWalletBalance = useCallback(async () => {
    const walletData = await fetchWalletBalanceWithOfflineFallback('practice');
    setBalanceSats(walletData.balance);
    setNetwork(walletData.network);

    try {
      const nwcRes = await fetch('/api/nwc/status');
      if (nwcRes.ok) {
        const statusData = await nwcRes.json();
        setNwcStatus(statusData);
      }
    } catch {
      // Offline mode: Real Mode NWC status stays disconnected
    }
  }, []);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  function handleSelectLanguage(newLang: Language) {
    const updated = { ...progress, language: newLang };
    setProgress(updated);
    saveProgress(updated);
  }

  function handleSelectStall(newStall: StallId) {
    const updated = { ...progress, selectedStall: newStall };
    setProgress(updated);
    saveProgress(updated);
  }

  function handleToggleDataSaver() {
    const updated = { ...progress, dataSaver: !progress.dataSaver };
    setProgress(updated);
    saveProgress(updated);
  }

  function handleToggleSound() {
    const updated = { ...gameExtras, soundEnabled: !gameExtras.soundEnabled };
    setGameExtras(updated);
    saveGameExtras(updated);
  }

  function handleHintUsed(lessonId: LessonId) {
    const updated = recordHintUsed(gameExtras, lessonId);
    setGameExtras(updated);
    saveGameExtras(updated);
  }

  function handleStartLesson(lessonId: LessonId) {
    setActiveLesson(lessonId);
    setScreen('market');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOpenLessonCard(lessonId: LessonId) {
    setActiveLesson(lessonId);
    setScreen('lesson-card');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCompleteLesson(
    lessonId: LessonId,
    score: number,
    terms: string[]
  ) {
    const updated = recordLessonCompletion(progress, lessonId, score, terms);
    setProgress(updated);
    saveProgress(updated);
    playLessonFanfareSound(gameExtras.soundEnabled);
  }

  async function handleResetAll() {
    const resetState = {
      ...DEFAULT_PROGRESS,
      language: progress.language,
      dataSaver: progress.dataSaver,
    };
    const resetExtras = {
      ...DEFAULT_GAME_EXTRAS,
      soundEnabled: gameExtras.soundEnabled,
    };
    setProgress(resetState);
    saveProgress(resetState);
    setGameExtras(resetExtras);
    saveGameExtras(resetExtras);
    const data = await resetPracticeWalletWithOfflineFallback();
    setBalanceSats(data.balance);
    setNetwork(data.network);
  }

  const loadingFallback = (
    <div
      role="status"
      aria-live="polite"
      className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-6 text-center font-display font-bold text-lg text-[#1F2A6B]"
    >
      {lang === 'fr' ? 'Chargement du marché...' : 'Loading market...'}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF6E5] text-[#1B1B1F]">
      {/* Accessible Skip-to-Main-Content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-[#1F2A6B] focus:text-[#FFF6E5] focus:font-display focus:font-bold focus:border-2 focus:border-[#F2B01E]"
      >
        {lang === 'fr'
          ? 'Aller au contenu principal'
          : 'Skip to main content'}
      </a>

      {/* Striped Market Awning Top Accent */}
      <div
        className="h-3.5 w-full awning-stripes border-b-2 border-[#1B1B1F]"
        aria-hidden="true"
      />

      {/* Offline Practice Mode Banner when device has no mobile data */}
      <OfflineBanner lang={lang} />

      {/* Top Navigation Bar following the 3-Zone Contract */}
      <header className="bg-[#FFFDF9] border-b-2 border-[#1F2A6B] px-3 sm:px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-8">
          {/* Zone 1: Single-line Brand Title */}
          <button
            type="button"
            onClick={() => setScreen('home')}
            className="min-h-[48px] inline-flex items-center gap-2 font-display font-extrabold text-xl sm:text-2xl text-[#1F2A6B] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1F2A6B]"
          >
            <LightningBoltSvg className="w-6 h-6 shrink-0" />
            <span>{UI_TEXT.appName[lang]}</span>
          </button>

          {/* Zone 2: 4 Single-line Navigation Links */}
          <nav
            aria-label={
              lang === 'fr' ? 'Navigation principale' : 'Main navigation'
            }
            className="order-3 md:order-2 w-full md:w-auto flex items-center justify-between md:justify-start gap-1 sm:gap-6 border-t md:border-t-0 border-[#1F2A6B]/15 pt-1.5 md:pt-0"
          >
            {(
              [
                { id: 'home', label: UI_TEXT.nav.home[lang] },
                { id: 'market', label: UI_TEXT.nav.market[lang] },
                { id: 'lesson-card', label: UI_TEXT.nav.lessonCard[lang] },
                { id: 'progress', label: UI_TEXT.nav.progress[lang] },
              ] as const
            ).map((item) => {
              const isActive = screen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScreen(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[48px] px-1.5 sm:px-3 py-1.5 text-sm sm:text-base font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-3 ${
                    isActive
                      ? 'text-[#1F2A6B] border-[#D9582B]'
                      : 'text-[#1B1B1F]/80 border-transparent hover:text-[#1F2A6B]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (Language Toggle FR / EN) */}
          <div className="order-2 md:order-3 flex items-center shrink-0">
            <button
              type="button"
              onClick={() => handleSelectLanguage(lang === 'fr' ? 'en' : 'fr')}
              aria-label={
                lang === 'fr'
                  ? 'Passer en anglais (Switch to English)'
                  : 'Switch to French (Passer en français)'
              }
              className="min-h-[48px] px-3.5 sm:px-4 py-2 rounded-2xl bg-[#1F2A6B] hover:bg-[#151d4d] text-[#FFF6E5] font-display font-bold text-sm sm:text-base border-2 border-[#1B1B1F] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lang === 'fr' ? 'FR · English' : 'EN · Français'}
            </button>
          </div>
        </div>
      </header>

      {/* Subtle woven-pattern border below header */}
      <div
        className="h-1.5 w-full woven-border border-b border-[#1B1B1F]/30"
        aria-hidden="true"
      />

      {/* Main Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 focus:outline-none"
      >
        {screen === 'home' && (
          <HomeScreen
            lang={lang}
            selectedStall={progress.selectedStall}
            completedLessons={progress.completedLessons}
            quizScores={progress.quizScores}
            hintsUsedByLesson={gameExtras.hintsUsedByLesson}
            balanceSats={balanceSats}
            onSelectLanguage={handleSelectLanguage}
            onSelectStall={handleSelectStall}
            onStartLesson={handleStartLesson}
          />
        )}

        {screen === 'market' && (
          <Suspense fallback={loadingFallback}>
            <LazyMarketScreen
              lang={lang}
              stallId={progress.selectedStall}
              activeLesson={activeLesson}
              completedLessons={progress.completedLessons}
              quizScores={progress.quizScores}
              hintsUsedByLesson={gameExtras.hintsUsedByLesson}
              balanceSats={balanceSats}
              network={network}
              dataSaver={progress.dataSaver}
              soundEnabled={gameExtras.soundEnabled}
              onToggleDataSaver={handleToggleDataSaver}
              onToggleSound={handleToggleSound}
              onHintUsed={handleHintUsed}
              onSelectLesson={(id) => setActiveLesson(id)}
              onWalletUpdated={(bal, net) => {
                setBalanceSats(bal);
                setNetwork(net);
              }}
              onOpenLessonCard={handleOpenLessonCard}
              walletMode={walletMode}
              nwcStatus={nwcStatus}
              onOpenNwcDialog={() => setIsNwcDialogOpen(true)}
            />
          </Suspense>
        )}

        {screen === 'lesson-card' && (
          <Suspense fallback={loadingFallback}>
            <LazyLessonCardScreen
              lang={lang}
              lessonId={activeLesson}
              completedLessons={progress.completedLessons}
              quizScores={progress.quizScores}
              onSelectLesson={(id) => setActiveLesson(id)}
              onCompleteLesson={handleCompleteLesson}
              onStartNextLesson={handleStartLesson}
              onGoToProgress={() => setScreen('progress')}
            />
          </Suspense>
        )}

        {screen === 'progress' && (
          <Suspense fallback={loadingFallback}>
            <LazyProgressScreen
              lang={lang}
              selectedStall={progress.selectedStall}
              completedLessons={progress.completedLessons}
              quizScores={progress.quizScores}
              hintsUsedByLesson={gameExtras.hintsUsedByLesson}
              seenTerms={progress.seenTerms}
              balanceSats={balanceSats}
              network={network}
              onStartLesson={handleStartLesson}
              onOpenLessonCard={handleOpenLessonCard}
              onResetAll={handleResetAll}
            />
          </Suspense>
        )}
      </main>

      {/* Quiet Footer with Practice / Real Mode Notice & PWA Install Action */}
      <footer className="mt-auto border-t-2 border-[#1F2A6B]/20 bg-[#FFFDF9] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-semibold text-[#1B1B1F]/80">
          <div className="flex flex-wrap items-center gap-3">
            <span>{UI_TEXT.practiceBadge[lang]}</span>
            <button
              type="button"
              data-testid="footer-nwc-mode-btn"
              onClick={() => setIsNwcDialogOpen(true)}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FFF6E5] hover:bg-[#F2B01E]/25 border border-[#1F2A6B] text-[#1F2A6B] font-bold text-xs cursor-pointer"
            >
              {walletMode === 'real' && nwcStatus.connected
                ? lang === 'fr'
                  ? '⚡ Mode Réel (Testnet NWC) actif'
                  : '⚡ Real Mode (Testnet NWC) active'
                : lang === 'fr'
                ? '⚡ Mode Réel (Réseau de test uniquement · NWC)'
                : '⚡ Real Mode (Test network only · NWC)'}
            </button>
            <PWAInstallButton lang={lang} />
          </div>
          <span className="tabular-nums">
            {UI_TEXT.walletBalanceLabel[lang]} : {balanceSats} sats
          </span>
        </div>
      </footer>

      {/* Real Mode (Test Network Only) NWC Dialog (lazy-loaded on open) */}
      {isNwcDialogOpen && (
        <Suspense fallback={null}>
          <LazyNwcRealModeDialog
            isOpen={isNwcDialogOpen}
            lang={lang}
            walletMode={walletMode}
            nwcStatus={nwcStatus}
            onClose={() => setIsNwcDialogOpen(false)}
            onModeChanged={(nextMode, nextStatus) => {
              setWalletMode(nextMode);
              setNwcStatus(nextStatus);
              if (typeof nextStatus.balanceSats === 'number') {
                setBalanceSats(nextStatus.balanceSats);
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
