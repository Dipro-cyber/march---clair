import React, { useState, useEffect, Suspense } from 'react';
import {
  Check,
  Clock,
  Copy,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Search,
  PlusCircle,
  Sparkles,
  WifiOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  Language,
  LessonId,
  LESSONS,
  SCAM_SCENES,
  STALLS,
  StallId,
  StallItem,
} from '../data/content';
import {
  Invoice,
  NetworkState,
  PaymentComparison,
  RouteHop,
} from '../shared/simWallet';
import {
  CustomerDialogueResponse,
  CustomerDialogueResponseSchema,
  CustomerDialogueStage,
  WalletMode,
} from '../shared/validation';
import { NwcStatusSummary } from './NwcRealModeDialog';
import {
  getScriptedCustomerDialogue,
  sanitizeCustomerDialogue,
  sanitizeUntrustedDisplayText,
} from '../shared/aiCharacters';
import { deriveCustomerSceneMood } from '../shared/gameMechanics';
import { localizeQuotes } from '../shared/localizeQuotes';
import {
  playCoinLandingSound,
  playConfusedOutcomeSound,
  playLessonFanfareSound,
  playTapSound,
} from '../shared/soundEffects';
import {
  compareMethodsWithOfflineFallback,
  createInvoiceWithOfflineFallback,
  expirePracticeInvoiceWithOfflineFallback,
  lookupInvoiceWithOfflineFallback,
  payPracticeInvoiceWithOfflineFallback,
  prepareLessonWithOfflineFallback,
  topUpChannelWithOfflineFallback,
} from '../shared/offlinePracticeWallet';
import { LightningBoltSvg } from './LightningBoltIcon';
import {
  LazyCustomerAvatarSvg,
  LazyInvoiceQrSvg,
  LazyRoutingPathSvg,
} from './LazyIllustrations';
import { GlossaryBar } from './GlossaryBar';
import { NetworkVisualizer } from './NetworkVisualizer';
import { CoachPanel } from './CoachPanel';
import { SatsPurseJar } from './SatsPurseJar';
import { MarketStreetMap } from './MarketStreetMap';
import { AnimatedMarketStage } from './LessonVisuals';

const LazyLesson3ComparisonBars = React.lazy(() =>
  import('./LessonVisuals').then((m) => ({ default: m.Lesson3ComparisonBars }))
);

const LazyLesson4ChannelCapacityBar = React.lazy(() =>
  import('./LessonVisuals').then((m) => ({
    default: m.Lesson4ChannelCapacityBar,
  }))
);

const LazyLesson6ScamPanel = React.lazy(() =>
  import('./Lesson6ScamPanel').then((m) => ({ default: m.Lesson6ScamPanel }))
);

interface MarketScreenProps {
  lang: Language;
  stallId: StallId;
  activeLesson: LessonId;
  completedLessons: LessonId[];
  quizScores: Record<number, number>;
  hintsUsedByLesson: Record<number, number>;
  balanceSats: number;
  network: NetworkState | null;
  dataSaver: boolean;
  soundEnabled: boolean;
  onToggleDataSaver: () => void;
  onToggleSound: () => void;
  onHintUsed: (lessonId: LessonId) => void;
  onSelectLesson: (lessonId: LessonId) => void;
  onWalletUpdated: (balance: number, network: NetworkState) => void;
  onOpenLessonCard: (lessonId: LessonId) => void;
  walletMode: WalletMode;
  nwcStatus: NwcStatusSummary;
  onOpenNwcDialog: () => void;
}

function getDefaultItemForLesson(stallId: StallId, lessonId: LessonId): StallItem {
  const stall = STALLS[stallId];
  switch (lessonId) {
    case 1:
      return stall.lesson1Item;
    case 2:
      return stall.lesson2Item;
    case 3:
      return stall.lesson3Item;
    case 4:
      return stall.lesson4Item;
    case 5:
      return stall.lesson5Item;
    case 6:
      return stall.lesson5Item;
  }
}

export function MarketScreen({
  lang,
  stallId,
  activeLesson,
  completedLessons,
  quizScores,
  hintsUsedByLesson,
  balanceSats,
  network,
  dataSaver,
  soundEnabled,
  onToggleDataSaver,
  onToggleSound,
  onHintUsed,
  onSelectLesson,
  onWalletUpdated,
  onOpenLessonCard,
  walletMode,
  nwcStatus,
  onOpenNwcDialog,
}: MarketScreenProps) {
  const stall = STALLS[stallId];
  const lesson = LESSONS[activeLesson];
  const defaultItem = getDefaultItemForLesson(stallId, activeLesson);
  const isRealModeLesson1 =
    walletMode === 'real' && activeLesson === 1 && nwcStatus.connected;

  const [amountInput, setAmountInput] = useState<string>(
    String(defaultItem.amountSats)
  );
  const [memoInput, setMemoInput] = useState<string>(defaultItem.memo[lang]);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'success' | 'expired';
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Customer walk-in CSS transform trigger when a scene starts
  const [isCustomerEntering, setIsCustomerEntering] = useState<boolean>(true);
  // Coin burst trigger & last added sats for the Purse/Jar animation
  const [coinBurstTrigger, setCoinBurstTrigger] = useState<number>(0);
  const [lastAddedSats, setLastAddedSats] = useState<number | null>(null);

  // Lesson 2 state
  const [latePaymentAttempted, setLatePaymentAttempted] = useState<boolean>(false);

  // Lesson 3 state: Fees & Speed comparison
  const [comparison, setComparison] = useState<PaymentComparison | null>(null);
  const [onChainTested, setOnChainTested] = useState<boolean>(false);

  // Lesson 4 state: Channels & Liquidity
  const [capacityFailedOnce, setCapacityFailedOnce] = useState<boolean>(false);
  const [liquidityFixChosen, setLiquidityFixChosen] = useState<
    'topup' | 'smaller' | null
  >(null);

  // Lesson 5 state: Multi-hop routing animation
  const [routeStep, setRouteStep] = useState<number>(0);
  const [routeHops, setRouteHops] = useState<RouteHop[] | null>(null);

  // Lesson 6 state: 3 Scam Scenes
  const [scamChoices, setScamChoices] = useState<Record<number, string>>({});

  // Prepare deterministic server scenario when switching lesson, stall, or language
  useEffect(() => {
    const item = getDefaultItemForLesson(stallId, activeLesson);
    setAmountInput(String(item.amountSats));
    setMemoInput(item.memo[lang]);
    setCurrentInvoice(null);
    setErrorMsg(null);
    setStatusBanner(null);
    setCopied(false);
    setLatePaymentAttempted(false);
    setComparison(null);
    setOnChainTested(false);
    setCapacityFailedOnce(false);
    setLiquidityFixChosen(null);
    setRouteStep(0);
    setRouteHops(null);
    setScamChoices({});

    // Trigger customer walk-in CSS transform at scene start
    setIsCustomerEntering(true);
    const enterTimer = setTimeout(() => {
      setIsCustomerEntering(false);
    }, 80);

    // Pre-populate Lesson 3 comparison so the two time & fee bars are always ready in Lesson 3 (works offline too)
    if (activeLesson === 3) {
      compareMethodsWithOfflineFallback(item.amountSats)
        .then((comparison) => {
          setComparison(comparison);
        })
        .catch(() => {});
    }

    if (walletMode === 'real' && activeLesson === 1 && nwcStatus.connected) {
      fetch('/api/wallet/balance?mode=real')
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.balance === 'number' && data.network) {
            onWalletUpdated(data.balance, data.network);
          }
        })
        .catch(() => {});
    } else {
      prepareLessonWithOfflineFallback(activeLesson)
        .then((data) => {
          onWalletUpdated(data.balance, data.network);
        })
        .catch(() => {});
    }

    return () => clearTimeout(enterTimer);
  }, [activeLesson, stallId, lang, walletMode, nwcStatus.connected]);

  // Lesson 1 Real Mode: Poll lookup_invoice every 3 seconds until the invoice is paid from a second test wallet
  useEffect(() => {
    if (
      !isRealModeLesson1 ||
      !currentInvoice ||
      currentInvoice.status !== 'PENDING'
    ) {
      return;
    }

    let cancelled = false;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/wallet/invoices/${encodeURIComponent(currentInvoice.id)}?mode=real`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !data?.invoice) return;

        if (data.invoice.status === 'PAID') {
          setCurrentInvoice(data.invoice);
          if (typeof data.balance === 'number' && data.network) {
            onWalletUpdated(data.balance, data.network);
          }
          setLastAddedSats(data.invoice.amountSats);
          setCoinBurstTrigger((c) => c + 1);
          playCoinLandingSound(soundEnabled);
          setStatusBanner({
            type: 'success',
            text:
              lang === 'fr'
                ? `✓ Paiement NWC réel détecté via lookup_invoice ! +${data.invoice.amountSats} sats reçus sur votre portefeuille de test.`
                : `✓ Real NWC payment detected via lookup_invoice! +${data.invoice.amountSats} sats received in your test wallet.`,
          });
        } else if (data.invoice.status === 'EXPIRED') {
          setCurrentInvoice(data.invoice);
        }
      } catch {
        // Keep polling quietly
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [
    isRealModeLesson1,
    currentInvoice?.id,
    currentInvoice?.status,
    lang,
    soundEnabled,
    onWalletUpdated,
  ]);

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatusBanner(null);
    setLatePaymentAttempted(false);
    setRouteStep(0);

    const parsedAmount = Number(amountInput);
    if (!Number.isInteger(parsedAmount) || parsedAmount < 1) {
      setErrorMsg(
        lang === 'fr'
          ? 'Veuillez entrer un montant entier en sats (ex: 250).'
          : 'Please enter a whole number of sats (e.g., 250).'
      );
      return;
    }

    if (!memoInput.trim()) {
      setErrorMsg(
        lang === 'fr'
          ? 'Veuillez écrire une courte note (mémo) pour la facture.'
          : 'Please enter a short note (memo) for the invoice.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const data = await createInvoiceWithOfflineFallback({
        amountSats: parsedAmount,
        memo: memoInput.trim(),
        expirySeconds: activeLesson === 2 ? 60 : 300,
        mode: isRealModeLesson1 ? 'real' : 'practice',
        lang,
      });
      if (!data.ok || !data.invoice) {
        setErrorMsg(
          data.error ||
            (lang === 'fr'
              ? 'Impossible de créer la facture.'
              : 'Could not create the invoice.')
        );
        return;
      }
      playTapSound(soundEnabled);
      setCurrentInvoice(data.invoice);
      if (typeof data.balance === 'number' && data.network) {
        onWalletUpdated(data.balance, data.network);
      }

      if (activeLesson === 3) {
        const cmp = await compareMethodsWithOfflineFallback(parsedAmount);
        setComparison(cmp);
      }

      setStatusBanner({
        type: 'info',
        text: isRealModeLesson1
          ? lang === 'fr'
            ? `Facture NWC réelle créée (${data.invoice.amountSats} sats) via make_invoice ! Scannez le QR ou copiez le code BOLT11 depuis un second portefeuille de test : l'application interroge lookup_invoice automatiquement.`
            : `Real NWC invoice created (${data.invoice.amountSats} sats) via make_invoice! Scan the QR or copy the BOLT11 string from a second test wallet: the app polls lookup_invoice automatically.`
          : lang === 'fr'
          ? `Facture créée (${data.invoice.amountSats} sats) ! Elle est maintenant EN ATTENTE.`
          : `Invoice created (${data.invoice.amountSats} sats)! It is now PENDING.`,
      });
    } catch {
      setErrorMsg(
        lang === 'fr'
          ? 'Impossible de contacter le serveur du portefeuille.'
          : 'Could not reach wallet server.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLookupInvoice() {
    if (!currentInvoice) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await lookupInvoiceWithOfflineFallback({
        id: currentInvoice.id,
        mode: isRealModeLesson1 ? 'real' : 'practice',
        lang,
      });
      if (data.ok && data.invoice) {
        const wasPending = currentInvoice.status === 'PENDING';
        setCurrentInvoice(data.invoice);
        if (typeof data.balance === 'number' && data.network) {
          onWalletUpdated(data.balance, data.network);
        }
        if (wasPending && data.invoice.status === 'PAID') {
          setLastAddedSats(data.invoice.amountSats);
          setCoinBurstTrigger((c) => c + 1);
          playCoinLandingSound(soundEnabled);
          setStatusBanner({
            type: 'success',
            text:
              lang === 'fr'
                ? `✓ Paiement reçu ! +${data.invoice.amountSats} sats ajoutés à votre caisse.`
                : `✓ Payment received! +${data.invoice.amountSats} sats added to your stall balance.`,
          });
        }
      } else if (!data.ok && data.error) {
        setErrorMsg(data.error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCustomerPay(useMultiHop = false) {
    if (!currentInvoice) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await payPracticeInvoiceWithOfflineFallback({
        id: currentInvoice.id,
        simulateLatePayment: false,
        multiHop: useMultiHop || activeLesson === 5,
      });
      if (data.invoice) {
        setCurrentInvoice(data.invoice);
      }
      if (data.network && typeof data.balance === 'number') {
        onWalletUpdated(data.balance, data.network);
      }

      if (data.ok && data.code === 'PAID' && data.invoice) {
        setLastAddedSats(data.invoice.amountSats);
        setCoinBurstTrigger((c) => c + 1);
        playCoinLandingSound(soundEnabled);

        if (activeLesson === 5 && data.routeHops) {
          setRouteHops(data.routeHops);
          setRouteStep(1);
          setTimeout(() => setRouteStep(2), 250);
          setTimeout(() => setRouteStep(3), 500);
          setStatusBanner({
            type: 'success',
            text:
              lang === 'fr'
                ? `✓ Paiement routé à travers 2 nœuds ! Koffi a payé ${data.invoice.amountSats + 3} sats (3 sats de frais de saut) et votre caisse a reçu +${data.invoice.amountSats} sats.`
                : `✓ Payment routed across 2 nodes! Koffi sent ${data.invoice.amountSats + 3} sats (3 sats in hop fees) and your stall received +${data.invoice.amountSats} sats.`,
          });
        } else {
          setStatusBanner({
            type: 'success',
            text:
              lang === 'fr'
                ? `✓ Paiement reçu ! +${data.invoice.amountSats} sats ajoutés instantanément à votre caisse.`
                : `✓ Payment received! +${data.invoice.amountSats} sats added instantly to your stall balance.`,
          });
        }
      } else if (data.code === 'INVOICE_EXPIRED') {
        setLatePaymentAttempted(true);
        playConfusedOutcomeSound(soundEnabled);
        setStatusBanner({
          type: 'expired',
          text:
            lang === 'fr'
              ? '✕ Paiement bloqué : la facture a expiré ! Moussa garde ses sats et aucun argent n’est perdu.'
              : '✕ Payment blocked: the invoice has expired! Moussa keeps his sats and no money is lost.',
        });
      } else if (data.code === 'INSUFFICIENT_CAPACITY') {
        setCapacityFailedOnce(true);
        playConfusedOutcomeSound(soundEnabled);
        setStatusBanner({
          type: 'expired',
          text:
            lang === 'fr'
              ? `✕ Capacité insuffisante : votre canal ne peut recevoir que ${data.network?.inboundLiquiditySats ?? 300} sats, alors que la facture demande ${currentInvoice.amountSats} sats ! Choisissez l’une des 2 solutions ci-dessous.`
              : `✕ Insufficient channel capacity: your channel can only receive ${data.network?.inboundLiquiditySats ?? 300} sats, while the invoice asks for ${currentInvoice.amountSats} sats! Choose one of the 2 fixes below.`,
        });
      }
    } catch {
      setErrorMsg(
        lang === 'fr'
          ? 'Erreur lors du paiement simulé.'
          : 'Error during simulated payment.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSimulateExpiry() {
    if (!currentInvoice) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await expirePracticeInvoiceWithOfflineFallback(
        currentInvoice.id
      );
      if (data.invoice) {
        setCurrentInvoice(data.invoice);
        onWalletUpdated(data.balance, data.network);
        playConfusedOutcomeSound(soundEnabled);
        setStatusBanner({
          type: 'expired',
          text:
            lang === 'fr'
              ? '⏱ Le compte à rebours est terminé : la facture est maintenant EXPIRÉE. Voyons ce qui se passe si Moussa essaie de la payer !'
              : '⏱ The countdown finished: the invoice is now EXPIRED. Let’s see what happens when Moussa tries to pay it!',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Lesson 4 Option A: Top up channel capacity (+500 sats -> 800 sats inbound) and pay the 600-sat invoice
  async function handleFixByTopUpChannel() {
    if (!currentInvoice) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const topUpData = await topUpChannelWithOfflineFallback(500);
      if (topUpData.network) {
        onWalletUpdated(topUpData.balance, topUpData.network);
      }

      const payData = await payPracticeInvoiceWithOfflineFallback({
        id: currentInvoice.id,
        simulateLatePayment: false,
        multiHop: false,
      });
      if (payData.invoice) {
        setCurrentInvoice(payData.invoice);
      }
      if (payData.network && typeof payData.balance === 'number') {
        onWalletUpdated(payData.balance, payData.network);
      }
      setLiquidityFixChosen('topup');
      setLastAddedSats(currentInvoice.amountSats);
      setCoinBurstTrigger((c) => c + 1);
      playCoinLandingSound(soundEnabled);
      setStatusBanner({
        type: 'success',
        text:
          lang === 'fr'
            ? `✓ Canal rechargé (+500 sats de capacité à recevoir) et paiement de ${currentInvoice.amountSats} sats encaissé !`
            : `✓ Channel topped up (+500 sats receiving capacity) and ${currentInvoice.amountSats}-sat payment received!`,
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Lesson 4 Option B: Ask customer to pay a smaller amount (300 sats) that fits the 300-sat channel
  async function handleFixBySmallerInvoice() {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const smallItem = stall.lesson4SmallItem;
      setAmountInput(String(smallItem.amountSats));
      setMemoInput(smallItem.memo[lang]);

      const createData = await createInvoiceWithOfflineFallback({
        amountSats: smallItem.amountSats,
        memo: smallItem.memo[lang],
        expirySeconds: 300,
        mode: 'practice',
        lang,
      });
      if (!createData.ok || !createData.invoice) return;

      const payData = await payPracticeInvoiceWithOfflineFallback({
        id: createData.invoice.id,
        simulateLatePayment: false,
        multiHop: false,
      });
      if (payData.invoice) {
        setCurrentInvoice(payData.invoice);
      }
      if (payData.network && typeof payData.balance === 'number') {
        onWalletUpdated(payData.balance, payData.network);
      }
      setLiquidityFixChosen('smaller');
      setLastAddedSats(smallItem.amountSats);
      setCoinBurstTrigger((c) => c + 1);
      playCoinLandingSound(soundEnabled);
      setStatusBanner({
        type: 'success',
        text:
          lang === 'fr'
            ? `✓ Nouvelle facture plus petite (${smallItem.amountSats} sats) créée et payée immédiatement dans la limite des 300 sats du canal !`
            : `✓ Smaller invoice (${smallItem.amountSats} sats) created and paid immediately within the 300-sat channel limit!`,
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopyInvoice() {
    if (!currentInvoice) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentInvoice.paymentRequest).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const allScamsSpotted =
    activeLesson === 6 &&
    SCAM_SCENES.every((scene) => {
      const chosenId = scamChoices[scene.id];
      const opt = scene.options.find((o) => o.id === chosenId);
      return Boolean(opt?.isSafe);
    });

  const hasUnsafeScamChoice =
    activeLesson === 6 &&
    SCAM_SCENES.some((scene) => {
      const chosenId = scamChoices[scene.id];
      if (!chosenId) return false;
      const opt = scene.options.find((o) => o.id === chosenId);
      return opt ? !opt.isSafe : false;
    });

  const customerMood = deriveCustomerSceneMood({
    isEntering: isCustomerEntering,
    invoiceStatus: currentInvoice ? currentInvoice.status : undefined,
    capacityFailedOnce:
      activeLesson === 4 &&
      capacityFailedOnce &&
      currentInvoice?.status !== 'PAID' &&
      !liquidityFixChosen,
    allScamsSpotted,
    hasUnsafeScamChoice,
  });

  const isLessonReadyToFinish =
    (activeLesson === 1 && currentInvoice?.status === 'PAID') ||
    (activeLesson === 2 &&
      (latePaymentAttempted || currentInvoice?.status === 'PAID')) ||
    (activeLesson === 3 && currentInvoice?.status === 'PAID') ||
    (activeLesson === 4 &&
      capacityFailedOnce &&
      currentInvoice?.status === 'PAID') ||
    (activeLesson === 5 &&
      currentInvoice?.status === 'PAID' &&
      Boolean(routeHops)) ||
    allScamsSpotted;

  // Determine current dialogue stage from lesson state (pure display, never triggers wallet actions)
  const dialogueStage: CustomerDialogueStage =
    activeLesson === 6
      ? 'scam_intro'
      : currentInvoice?.status === 'PAID'
      ? 'paid'
      : activeLesson === 4 && capacityFailedOnce
      ? 'failed_capacity'
      : currentInvoice?.status === 'EXPIRED'
      ? 'expired'
      : currentInvoice?.status === 'PENDING'
      ? 'pending'
      : 'intro';

  const currentSaleAmount =
    currentInvoice?.amountSats ?? defaultItem.amountSats;
  const currentSaleItemName =
    currentInvoice?.memo ?? defaultItem.name[lang];

  // Instant deterministic scripted dialogue so the game never blocks
  const scriptedDialogue = sanitizeCustomerDialogue(
    getScriptedCustomerDialogue({
      lessonId: activeLesson,
      language: lang,
      stallId,
      stage: dialogueStage,
      itemName: currentSaleItemName,
      amountSats: currentSaleAmount,
    })
  );

  const [aiDialogue, setAiDialogue] = useState<CustomerDialogueResponse | null>(
    null
  );
  const [dialogueSource, setDialogueSource] = useState<
    'ai' | 'scripted-fallback' | 'data-saver'
  >(dataSaver ? 'data-saver' : 'scripted-fallback');
  const [aiRefreshKey, setAiRefreshKey] = useState<number>(0);

  useEffect(() => {
    // If Data Saver is ON, turn AI off and use scripted text immediately
    if (dataSaver) {
      setAiDialogue(null);
      setDialogueSource('data-saver');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    setAiDialogue(null);
    setDialogueSource('scripted-fallback');

    fetch('/api/ai/customer-dialogue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: activeLesson,
        language: lang,
        stallId,
        stage: dialogueStage,
        itemName: currentSaleItemName,
        amountSats: currentSaleAmount,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('AI_HTTP_ERROR');
        return res.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const parsed = CustomerDialogueResponseSchema.safeParse(
          payload?.dialogue
        );
        if (parsed.success) {
          setAiDialogue(sanitizeCustomerDialogue(parsed.data));
          setDialogueSource(
            payload?.source === 'ai' ? 'ai' : 'scripted-fallback'
          );
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setAiDialogue(null);
          setDialogueSource('scripted-fallback');
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    activeLesson,
    lang,
    stallId,
    dialogueStage,
    currentSaleItemName,
    currentSaleAmount,
    dataSaver,
    aiRefreshKey,
  ]);

  const activeDialogue = dataSaver
    ? scriptedDialogue
    : aiDialogue ?? scriptedDialogue;

  return (
    <div className="space-y-6">
      {/* Top Bar: Lesson Title, Sound Toggle, Data Saver Toggle, and Compact Market Street Map */}
      <div className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-bold text-[#D9582B]">
              {stall.name[lang]} · {lesson.badge[lang]}
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#1F2A6B]">
              {lesson.title[lang]}
            </h1>
          </div>

          {/* Sound Toggle (off by default, WebAudio) + Data Saver Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="sound-toggle"
              onClick={() => {
                const nextState = !soundEnabled;
                onToggleSound();
                if (nextState) {
                  playTapSound(true);
                }
              }}
              aria-pressed={soundEnabled}
              className={`min-h-[48px] px-3.5 py-2 rounded-2xl font-display font-bold text-sm border-2 inline-flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
                soundEnabled
                  ? 'bg-[#F2B01E] text-[#1B1B1F] border-[#1B1B1F]'
                  : 'bg-[#FFF6E5] text-[#1F2A6B] border-[#1F2A6B] hover:bg-[#F2B01E]/20'
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{lang === 'fr' ? 'Sons : Activés' : 'Sound: ON'}</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{lang === 'fr' ? 'Sons : Désactivés' : 'Sound: OFF'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="data-saver-toggle"
              onClick={onToggleDataSaver}
              aria-pressed={dataSaver}
              className={`min-h-[48px] px-3.5 py-2 rounded-2xl font-display font-bold text-sm border-2 inline-flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
                dataSaver
                  ? 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]'
                  : 'bg-[#FFF6E5] text-[#1F2A6B] border-[#1F2A6B] hover:bg-[#F2B01E]/20'
              }`}
            >
              {dataSaver ? (
                <>
                  <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'fr'
                      ? 'Économie de données : Activé (Texte local)'
                      : 'Data Saver: ON (Scripted text)'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'fr'
                      ? 'Économie de données : Désactivé (IA active)'
                      : 'Data Saver: OFF (AI active)'}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="open-nwc-dialog-btn"
              onClick={onOpenNwcDialog}
              className={`min-h-[48px] px-3.5 py-2 rounded-2xl font-display font-bold text-sm border-2 inline-flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
                walletMode === 'real' && nwcStatus.connected
                  ? 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]'
                  : 'bg-[#FFF6E5] text-[#1F2A6B] border-[#1F2A6B] hover:bg-[#F2B01E]/20'
              }`}
            >
              <LightningBoltSvg className="w-4 h-4 shrink-0" />
              <span>
                {walletMode === 'real' && nwcStatus.connected
                  ? lang === 'fr'
                    ? 'Mode Réel (Testnet NWC) ✓'
                    : 'Real Mode (Testnet NWC) ✓'
                  : lang === 'fr'
                  ? 'Mode Réel (Réseau de test NWC)'
                  : 'Real Mode (Test network NWC)'}
              </span>
            </button>
          </div>
        </div>

        {/* Market Street Progress Map (6 Stall Nodes: locked, unlocked, completed, 1-3 stars) */}
        <MarketStreetMap
          lang={lang}
          completedLessons={completedLessons}
          quizScores={quizScores}
          hintsUsedByLesson={hintsUsedByLesson}
          activeLesson={activeLesson}
          compact={true}
          onSelectLesson={onSelectLesson}
        />
      </div>

      {/* Main Two-Column Market Scene: Stall & Customer on Left, Vendor Counter / Scam Scenes on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Top Stall Scene + Purse/Jar Balance + Customer Dialogue + Friendly Coach */}
        <div className="lg:col-span-6 bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 flex flex-col gap-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-lg text-[#1F2A6B]">
                {lang === 'fr' ? 'Scène du Marché' : 'Market Scene'}
              </h2>
              <SatsPurseJar
                balanceSats={balanceSats}
                lastAddedSats={lastAddedSats}
                burstTrigger={coinBurstTrigger}
                lang={lang}
              />
            </div>

            {/* Stall Scene at the top of the Market screen: SVG stall + walking customer with CSS transform */}
            <AnimatedMarketStage
              stallId={stallId}
              customerName={lesson.customerName}
              customerRole={lesson.customerRole[lang]}
              mood={customerMood}
              lang={lang}
            />

            {/* Customer Dialogue Card (3 to 4 short lines, escaped untrusted display text only) */}
            <div
              data-testid="customer-dialogue-card"
              className="bg-[#FFF6E5] border-2 border-[#1B1B1F] rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <LazyCustomerAvatarSvg
                    customer={lesson.customerName}
                    className="w-14 h-14 shrink-0"
                  />
                  <div>
                    <div className="font-display font-extrabold text-lg text-[#1F2A6B]">
                      {localizeQuotes(sanitizeUntrustedDisplayText(activeDialogue.customerName), lang)}
                    </div>
                    <div className="text-sm font-semibold text-[#1B1B1F]/75">
                      {lesson.customerRole[lang]}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    data-testid="dialogue-source-badge"
                    className="px-2.5 py-1 rounded-xl bg-white border border-[#1F2A6B]/40 text-xs font-bold text-[#1F2A6B]"
                  >
                    {dialogueSource === 'ai'
                      ? lang === 'fr'
                        ? '✨ Dialogue IA'
                        : '✨ AI Dialogue'
                      : dataSaver
                      ? lang === 'fr'
                        ? '⚡ Économie données (Scripté)'
                        : '⚡ Data Saver (Scripted)'
                      : lang === 'fr'
                      ? '📖 Dialogue du marché'
                      : '📖 Market Dialogue'}
                  </span>

                  {!dataSaver && (
                    <button
                      type="button"
                      data-testid="refresh-ai-dialogue"
                      onClick={() => setAiRefreshKey((k) => k + 1)}
                      title={
                        lang === 'fr'
                          ? 'Générer de nouvelles répliques'
                          : 'Generate fresh lines'
                      }
                      className="min-h-[48px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFFDF9] border-2 border-[#1F2A6B] text-[#1F2A6B] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{lang === 'fr' ? 'Varier' : 'Vary'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3 to 4 Short Spoken Lines (escaped before rendering, never triggers wallet actions) */}
              <div
                data-testid="customer-dialogue-lines"
                className={`rounded-2xl p-3.5 text-[17px] text-[#1B1B1F] space-y-2 border-2 ${
                  dialogueStage === 'paid'
                    ? 'bg-[#2E7D4F]/10 border-[#2E7D4F]'
                    : dialogueStage === 'expired' ||
                      dialogueStage === 'failed_capacity'
                    ? 'bg-[#D9582B]/10 border-[#D9582B]'
                    : 'bg-white border-[#1B1B1F]/30'
                }`}
              >
                {activeDialogue.lines.slice(0, 4).map((line, idx) => (
                  <p
                    key={idx}
                    className={
                      dialogueStage === 'paid' && idx === 0
                        ? 'font-bold text-[#2E7D4F]'
                        : ''
                    }
                  >
                    {localizeQuotes(sanitizeUntrustedDisplayText(line), lang, true)}
                  </p>
                ))}

                <p className="pt-1 border-t border-[#1B1B1F]/15 text-sm font-bold text-[#1F2A6B]">
                  💡 {localizeQuotes(sanitizeUntrustedDisplayText(activeDialogue.conceptHint), lang)}
                </p>
              </div>
            </div>

            {/* Friendly Coach Panel answering "Why did that happen?" about the current lesson */}
            <CoachPanel
              lang={lang}
              lessonId={activeLesson}
              dataSaver={dataSaver}
              recentEvent={statusBanner?.text ?? ''}
              onHintUsed={() => onHintUsed(activeLesson)}
            />
          </div>

          {/* Step progress indicator */}
          <div className="pt-2 border-t border-[#1B1B1F]/15 text-sm font-bold text-[#1F2A6B] flex items-center justify-between">
            <span>{lesson.subtitle[lang]}</span>
          </div>
        </div>

        {/* Right Column: Vendor Counter (Lessons 1–5) OR 3 Scam Scenes (Lesson 6) */}
        <div className="lg:col-span-6 bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 flex flex-col justify-between gap-5">
          {activeLesson < 6 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="font-display font-bold text-xl text-[#1F2A6B]">
                  {isRealModeLesson1
                    ? lang === 'fr'
                      ? 'Votre Comptoir Lightning (Mode Réel · NwcWallet Testnet)'
                      : 'Your Lightning Counter (Real Mode · Testnet NwcWallet)'
                    : lang === 'fr'
                    ? 'Votre Comptoir Lightning (Portefeuille SimWallet)'
                    : 'Your Lightning Counter (SimWallet)'}
                </h2>
                <p className="text-[17px] text-[#1B1B1F]">
                  {isRealModeLesson1
                    ? lang === 'fr'
                      ? 'Créez une vraie facture sur votre portefeuille de test (NWC) et payez-la depuis un second portefeuille de test.'
                      : 'Create a real invoice on your test wallet (NWC) and pay it from a second test wallet.'
                    : lang === 'fr'
                    ? 'Préparez la facture pour le client ou vérifiez son état.'
                    : 'Prepare the invoice for the customer or check its status.'}
                </p>

                {isRealModeLesson1 && (
                  <div
                    data-testid="real-mode-active-banner"
                    className="bg-[#2E7D4F]/15 border-2 border-[#2E7D4F] rounded-2xl p-3.5 text-sm font-semibold text-[#1B1B1F] space-y-1"
                  >
                    <div className="font-display font-extrabold text-[#1F2A6B] flex items-center justify-between gap-2 flex-wrap">
                      <span>
                        {lang === 'fr'
                          ? `⚡ NwcWallet connecté (${nwcStatus.relayHostPreview ?? 'relais Nostr'})`
                          : `⚡ NwcWallet connected (${nwcStatus.relayHostPreview ?? 'Nostr relay'})`}
                      </span>
                      <button
                        type="button"
                        onClick={onOpenNwcDialog}
                        className="underline font-bold text-[#1F2A6B] cursor-pointer"
                      >
                        {lang === 'fr' ? 'Paramètres NWC' : 'NWC Settings'}
                      </button>
                    </div>
                    <p>
                      {lang === 'fr'
                        ? 'Moindre privilège : seules make_invoice, lookup_invoice et get_balance sont utilisées. pay_invoice n’est jamais demandé ni appelé.'
                        : 'Least privilege: only make_invoice, lookup_invoice and get_balance are used. pay_invoice is never requested or called.'}
                    </p>
                  </div>
                )}

                {walletMode === 'real' && activeLesson > 1 && (
                  <div
                    data-testid="real-mode-lesson-scope-note"
                    className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-3 text-sm font-semibold text-[#1B1B1F]"
                  >
                    {lang === 'fr'
                      ? 'Note : Le Mode Réel (NwcWallet) s’utilise dans la Leçon 1 pour encaisser un vrai paiement de test. Les leçons 2 à 6 utilisent le portefeuille simulé (SimWallet) pour que les scénarios (expiration, canaux, routage, arnaques) restent 100 % déterministes.'
                      : 'Note: Real Mode (NwcWallet) is used in Lesson 1 to receive a real test payment. Lessons 2 to 6 use the Practice SimWallet so expiry, channel capacity, routing, and scam scenarios stay 100% deterministic.'}
                  </div>
                )}
              </div>

              {/* Form to create a new invoice */}
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="invoice-amount-input"
                      className="block font-bold text-base text-[#1F2A6B] mb-1.5"
                    >
                      {lang === 'fr'
                        ? 'Montant (en sats)'
                        : 'Amount (in sats)'}
                    </label>
                    <input
                      id="invoice-amount-input"
                      type="number"
                      min={1}
                      max={2500}
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg text-[#1B1B1F] tabular-nums focus:outline-2 focus:outline-[#1F2A6B]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="invoice-memo-input"
                      className="block font-bold text-base text-[#1F2A6B] mb-1.5"
                    >
                      {lang === 'fr'
                        ? 'Note / Article (mémo)'
                        : 'Note / Item (memo)'}
                    </label>
                    <input
                      id="invoice-memo-input"
                      type="text"
                      maxLength={120}
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#FFF6E5] border-2 border-[#1B1B1F] text-[17px] text-[#1B1B1F] focus:outline-2 focus:outline-[#1F2A6B]"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="bg-[#D9582B]/15 border-2 border-[#D9582B] rounded-2xl p-3.5 text-[#1B1B1F] font-bold flex items-center gap-2.5"
                  >
                    <AlertTriangle
                      className="w-5 h-5 text-[#D9582B] shrink-0"
                      aria-hidden="true"
                    />
                    <span>{localizeQuotes(sanitizeUntrustedDisplayText(errorMsg), lang)}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[50px] px-5 py-3 rounded-2xl bg-[#1F2A6B] hover:bg-[#151d4d] text-[#FFF6E5] font-display font-bold text-lg inline-flex items-center justify-center gap-2 border-2 border-[#1B1B1F] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <LightningBoltSvg className="w-5 h-5" />
                  <span>
                    {currentInvoice
                      ? lang === 'fr'
                        ? 'Créer une nouvelle facture Lightning'
                        : 'Create a new Lightning invoice'
                      : lang === 'fr'
                      ? '1. Créer la facture Lightning'
                      : '1. Create Lightning Invoice'}
                  </span>
                </button>
              </form>

              {/* Lesson 4 Visual: Channel Capacity Bar */}
              {activeLesson === 4 && (
                <Suspense fallback={null}>
                  <LazyLesson4ChannelCapacityBar
                    inboundLiquiditySats={network?.inboundLiquiditySats ?? 300}
                    invoiceAmountSats={
                      currentInvoice?.amountSats ?? (Number(amountInput) || 600)
                    }
                    lang={lang}
                  />
                </Suspense>
              )}

              {/* Lesson 3 Side-by-Side Comparison Card + Two Bars comparing Time & Fee */}
              {activeLesson === 3 && comparison && (
                <div
                  data-testid="lesson3-comparison-card"
                  className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-4 space-y-3"
                >
                  <h3 className="font-display font-bold text-lg text-[#1F2A6B]">
                    {lang === 'fr'
                      ? `Comparaison pour une vente de ${comparison.amountSats} sats :`
                      : `Comparison for a ${comparison.amountSats}-sat sale:`}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Lightning Box */}
                    <div className="bg-white border-2 border-[#2E7D4F] rounded-2xl p-3.5 space-y-1.5">
                      <div className="font-display font-bold text-base text-[#2E7D4F] flex items-center gap-1.5">
                        <LightningBoltSvg className="w-4 h-4" />
                        <span>
                          {lang === 'fr'
                            ? 'Lightning (Recommandé ✓)'
                            : 'Lightning (Recommended ✓)'}
                        </span>
                      </div>
                      <div className="text-sm text-[#1B1B1F] tabular-nums">
                        <strong>{lang === 'fr' ? 'Vitesse :' : 'Speed:'}</strong>{' '}
                        {lang === 'fr'
                          ? comparison.lightning.timeLabelFr
                          : comparison.lightning.timeLabelEn}
                      </div>
                      <div className="text-sm text-[#1B1B1F] tabular-nums">
                        <strong>{lang === 'fr' ? 'Frais :' : 'Fee:'}</strong>{' '}
                        {comparison.lightning.feeSats} sat
                      </div>
                    </div>

                    {/* On-Chain Box */}
                    <div className="bg-white border-2 border-[#D9582B] rounded-2xl p-3.5 space-y-1.5">
                      <div className="font-display font-bold text-base text-[#D9582B]">
                        {lang === 'fr'
                          ? 'Chaîne Bitcoin (Lent & Cher ✕)'
                          : 'On-Chain Bitcoin (Slow & Costly ✕)'}
                      </div>
                      <div className="text-sm text-[#1B1B1F] tabular-nums">
                        <strong>
                          {lang === 'fr' ? 'Confirmation :' : 'Confirmation:'}
                        </strong>{' '}
                        {lang === 'fr'
                          ? comparison.onChain.timeLabelFr
                          : comparison.onChain.timeLabelEn}
                      </div>
                      <div className="text-sm text-[#1B1B1F] tabular-nums">
                        <strong>{lang === 'fr' ? 'Frais :' : 'Fee:'}</strong>{' '}
                        {comparison.onChain.feeSats} sats
                      </div>
                    </div>
                  </div>

                  {/* Two visual bars comparing Time and Fee */}
                  <Suspense fallback={null}>
                    <LazyLesson3ComparisonBars comparison={comparison} lang={lang} />
                  </Suspense>

                  {!onChainTested ? (
                    <button
                      type="button"
                      onClick={() => setOnChainTested(true)}
                      className="w-full min-h-[48px] px-4 py-2 rounded-xl bg-white hover:bg-[#FFFDF9] border-2 border-[#D9582B] text-[#D9582B] font-bold text-sm cursor-pointer"
                    >
                      {lang === 'fr'
                        ? 'Tester ce qui se passerait sur la chaîne principale (On-Chain)'
                        : 'See what would happen on the main chain (On-Chain)'}
                    </button>
                  ) : (
                    <div className="bg-[#D9582B]/15 border border-[#D9582B] rounded-xl p-3 text-sm font-semibold text-[#1B1B1F]">
                      {lang === 'fr'
                        ? `⏱ Sur la chaîne : Fatou devrait payer ${comparison.onChain.feeSats} sats de frais de minage (presque 3 fois le prix des plantains !) et attendre ~30 minutes la confirmation d’un bloc.`
                        : `⏱ On-chain: Fatou would have to pay ${comparison.onChain.feeSats} sats in mining fees (nearly 3× the price of the item!) and wait ~30 minutes for a block confirmation.`}
                    </div>
                  )}
                </div>
              )}

              {/* Active Invoice Display */}
              {currentInvoice && (
                <div
                  data-testid="active-invoice-card"
                  className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-4 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1B1B1F]/15">
                    <div>
                      <span className="text-sm font-bold text-[#1F2A6B]">
                        {lang === 'fr' ? 'Facture Lightning' : 'Lightning Invoice'}
                      </span>
                      <div className="font-display font-extrabold text-xl text-[#1B1B1F] tabular-nums">
                        {currentInvoice.amountSats} sats ·{' '}
                        {localizeQuotes(sanitizeUntrustedDisplayText(currentInvoice.memo), lang)}
                      </div>
                    </div>

                    {/* Accessible Status Badge (Icon + Text, never color alone) */}
                    <div
                      data-testid="invoice-status-badge"
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-sm border-2 inline-flex items-center gap-1.5 ${
                        currentInvoice.status === 'PAID'
                          ? 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]'
                          : currentInvoice.status === 'EXPIRED'
                          ? 'bg-[#D9582B] text-[#FFF6E5] border-[#1B1B1F]'
                          : 'bg-[#F2B01E] text-[#1B1B1F] border-[#1B1B1F]'
                      }`}
                    >
                      {currentInvoice.status === 'PAID' && (
                        <>
                          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{lang === 'fr' ? 'PAYÉE ✓' : 'PAID ✓'}</span>
                        </>
                      )}
                      {currentInvoice.status === 'EXPIRED' && (
                        <>
                          <AlertTriangle
                            className="w-4 h-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{lang === 'fr' ? 'EXPIRÉE ✕' : 'EXPIRED ✕'}</span>
                        </>
                      )}
                      {currentInvoice.status === 'PENDING' && (
                        <>
                          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>
                            {lang === 'fr'
                              ? 'EN ATTENTE (Active)'
                              : 'PENDING (Active)'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* QR Code + Payment Request String */}
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <LazyInvoiceQrSvg
                      paymentRequest={currentInvoice.paymentRequest}
                      expired={currentInvoice.status === 'EXPIRED'}
                      paid={currentInvoice.status === 'PAID'}
                    />

                    <div className="flex-1 w-full space-y-2.5">
                      <div className="text-sm font-bold text-[#1F2A6B]">
                        {lang === 'fr'
                          ? 'Code texte de la facture (BOLT11) :'
                          : 'Invoice text string (BOLT11):'}
                      </div>
                      <div className="bg-white border border-[#1B1B1F]/40 rounded-xl p-2.5 font-mono text-sm break-all text-[#1B1B1F]">
                        {sanitizeUntrustedDisplayText(
                          currentInvoice.paymentRequest
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleCopyInvoice}
                          className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFFDF9] border-2 border-[#1F2A6B] text-[#1F2A6B] font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>
                            {copied
                              ? lang === 'fr'
                                ? 'Copié ✓'
                                : 'Copied ✓'
                              : lang === 'fr'
                              ? 'Copier le code'
                              : 'Copy string'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleLookupInvoice}
                          className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFFDF9] border-2 border-[#1F2A6B] text-[#1F2A6B] font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>
                            {lang === 'fr'
                              ? 'Vérifier la facture'
                              : 'Lookup invoice'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons per lesson */}
                  {activeLesson === 1 &&
                    currentInvoice.status === 'PENDING' &&
                    !isRealModeLesson1 && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleCustomerPay(false)}
                        className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#2E7D4F] hover:bg-[#24663f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                      >
                        <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'fr'
                            ? '2. Montrer la facture à Amina (Elle paie)'
                            : '2. Show invoice to Amina (She pays)'}
                        </span>
                      </button>
                    )}

                  {activeLesson === 1 &&
                    currentInvoice.status === 'PENDING' &&
                    isRealModeLesson1 && (
                      <div
                        data-testid="real-mode-polling-card"
                        className="bg-white border-2 border-[#1F2A6B] rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex items-center gap-2.5 text-[#1F2A6B] font-display font-extrabold text-base">
                          <RefreshCw
                            className="w-5 h-5 shrink-0 animate-spin text-[#D9582B]"
                            aria-hidden="true"
                          />
                          <span>
                            {lang === 'fr'
                              ? 'En attente de votre paiement depuis un 2e portefeuille de test (lookup_invoice toutes les 3 s)...'
                              : 'Waiting for payment from your 2nd test wallet (polling lookup_invoice every 3s)...'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[#1B1B1F]">
                          {lang === 'fr'
                            ? 'Scannez le QR code ci-dessus ou copiez le code BOLT11 avec un second portefeuille sur un réseau de test pour payer cette facture.'
                            : 'Scan the QR code above or copy the BOLT11 string into a second test-network wallet to pay this invoice.'}
                        </p>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={handleLookupInvoice}
                          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#1F2A6B] hover:bg-[#151d4d] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>
                            {lang === 'fr'
                              ? 'Vérifier maintenant (lookup_invoice)'
                              : 'Check now (lookup_invoice)'}
                          </span>
                        </button>
                      </div>
                    )}

                  {activeLesson === 2 && currentInvoice.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleSimulateExpiry}
                      className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#D9582B] hover:bg-[#c0481f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Clock className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span>
                        {lang === 'fr'
                          ? '2. Moussa attend trop longtemps → Faire expirer'
                          : '2. Moussa waits too long → Expire invoice'}
                      </span>
                    </button>
                  )}

                  {activeLesson === 2 &&
                    currentInvoice.status === 'EXPIRED' &&
                    !latePaymentAttempted && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleCustomerPay(false)}
                        className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#1F2A6B] hover:bg-[#151d4d] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                      >
                        <RefreshCw className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'fr'
                            ? '3. Moussa essaie de payer la facture expirée'
                            : '3. Moussa tries to pay the expired invoice'}
                        </span>
                      </button>
                    )}

                  {activeLesson === 3 && currentInvoice.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleCustomerPay(false)}
                      className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#2E7D4F] hover:bg-[#24663f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <LightningBoltSvg className="w-5 h-5" />
                      <span>
                        {lang === 'fr'
                          ? '2. Encaisser Fatou par Lightning (1 seconde · 1 sat de frais)'
                          : '2. Get paid by Fatou via Lightning (1 second · 1 sat fee)'}
                      </span>
                    </button>
                  )}

                  {activeLesson === 4 &&
                    currentInvoice.status === 'PENDING' &&
                    !capacityFailedOnce && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleCustomerPay(false)}
                        className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#D9582B] hover:bg-[#c0481f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                      >
                        <span>
                          {lang === 'fr'
                            ? `2. Ibrahim essaie de payer ${currentInvoice.amountSats} sats`
                            : `2. Ibrahim tries to pay ${currentInvoice.amountSats} sats`}
                        </span>
                      </button>
                    )}

                  {/* Lesson 4 Two Fix Choices after capacity failure */}
                  {activeLesson === 4 &&
                    capacityFailedOnce &&
                    currentInvoice.status === 'PENDING' && (
                      <div className="space-y-2.5 pt-2 border-t border-[#1B1B1F]/15">
                        <div className="text-sm font-bold text-[#1F2A6B]">
                          {lang === 'fr'
                            ? '3. Choisissez comment régler le manque de liquidité :'
                            : '3. Choose how to fix the channel liquidity limit:'}
                        </div>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={handleFixByTopUpChannel}
                          className="w-full min-h-[52px] px-4 py-3 rounded-2xl bg-[#2E7D4F] hover:bg-[#24663f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <PlusCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                          <span>
                            {lang === 'fr'
                              ? 'Option A : Recharger le canal (+500 sats) et encaisser 600 sats'
                              : 'Option A: Top up channel (+500 sats) and receive 600 sats'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={handleFixBySmallerInvoice}
                          className="w-full min-h-[52px] px-4 py-3 rounded-2xl bg-[#1F2A6B] hover:bg-[#151d4d] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
                          <span>
                            {lang === 'fr'
                              ? 'Option B : Demander à Ibrahim un montant plus petit (300 sats)'
                              : 'Option B: Ask Ibrahim to pay a smaller amount (300 sats)'}
                          </span>
                        </button>
                      </div>
                    )}

                  {activeLesson === 5 && currentInvoice.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleCustomerPay(true)}
                      className="w-full min-h-[52px] px-5 py-3 rounded-2xl bg-[#2E7D4F] hover:bg-[#24663f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <LightningBoltSvg className="w-5 h-5" />
                      <span>
                        {lang === 'fr'
                          ? '2. Lancer le paiement routé de Koffi (2 sauts)'
                          : '2. Run Koffi’s routed payment (2 hops)'}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Lesson 5 Animated Multi-Hop Path Diagram with Fee Labels */}
              {activeLesson === 5 && (
                <div
                  data-testid="lesson5-routing-diagram"
                  className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-4 space-y-3"
                >
                  <div className="font-display font-bold text-base text-[#1F2A6B]">
                    {lang === 'fr'
                      ? 'Trajet animé du routage à travers 2 autres nœuds (avec frais par saut) :'
                      : 'Animated routing path across 2 other nodes (with hop fee labels):'}
                  </div>
                  <LazyRoutingPathSvg
                    activeStep={routeStep}
                    amountSats={currentInvoice?.amountSats ?? defaultItem.amountSats}
                    lang={lang}
                  />
                </div>
              )}

              {/* Status Banner */}
              {statusBanner && (
                <div
                  role="status"
                  className={`rounded-2xl p-4 border-2 font-bold text-[17px] ${
                    statusBanner.type === 'success'
                      ? 'bg-[#2E7D4F]/15 border-[#2E7D4F] text-[#1B1B1F]'
                      : statusBanner.type === 'expired'
                      ? 'bg-[#D9582B]/15 border-[#D9582B] text-[#1B1B1F]'
                      : 'bg-[#F2B01E]/25 border-[#1F2A6B] text-[#1B1B1F]'
                  }`}
                >
                  {localizeQuotes(statusBanner.text, lang)}
                </div>
              )}
            </div>
          ) : (
            /* LESSON 6: Three Short Scam Scenes (code-split) */
            <Suspense
              fallback={
                <div
                  role="status"
                  className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-6 text-center font-display font-bold text-[#1F2A6B]"
                >
                  {lang === 'fr'
                    ? 'Chargement des 3 scènes de sécurité...'
                    : 'Loading the 3 safety scenes...'}
                </div>
              }
            >
              <LazyLesson6ScamPanel
                lang={lang}
                soundEnabled={soundEnabled}
                scamChoices={scamChoices}
                onSelectScamChoice={(sceneId, optionId) => {
                  setScamChoices((prev) => ({
                    ...prev,
                    [sceneId]: optionId,
                  }));
                }}
              />
            </Suspense>
          )}

          {/* Complete Lesson CTA -> Opens 2-Question Check & What You Learned Card */}
          {isLessonReadyToFinish && (
            <div className="pt-4 border-t-2 border-[#1F2A6B]/20">
              <button
                type="button"
                onClick={() => {
                  playLessonFanfareSound(soundEnabled);
                  onOpenLessonCard(activeLesson);
                }}
                className="w-full min-h-[54px] px-6 py-3.5 rounded-2xl bg-[#F2B01E] hover:bg-[#e0a012] text-[#1B1B1F] border-2 border-[#1B1B1F] font-display font-extrabold text-lg inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>
                  {lang === 'fr'
                    ? `Continuer : 2 Questions & Carte Leçon ${activeLesson}`
                    : `Continue: 2-Question Check & Lesson ${activeLesson} Card`}
                </span>
                <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3-Node Simulated Network Visualizer */}
      <NetworkVisualizer lang={lang} network={network} />

      {/* Plain-word Glossary Bar for terms in this lesson */}
      <GlossaryBar lang={lang} termKeys={lesson.termsTaught} />
    </div>
  );
}
