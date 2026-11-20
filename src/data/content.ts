import { localizeQuotes } from '../shared/localizeQuotes';

export type Language = 'fr' | 'en';
export type StallId = 'fruit' | 'fabric' | 'credit';
export type ScreenId = 'home' | 'market' | 'lesson-card' | 'progress';
export type LessonId = 1 | 2 | 3 | 4 | 5 | 6;

export const ALL_LESSON_IDS: LessonId[] = [1, 2, 3, 4, 5, 6];

export interface TermExplanation {
  key: string;
  term: Record<Language, string>;
  plainMeaning: Record<Language, string>;
  marketAnalogy: Record<Language, string>;
}

export interface StallItem {
  name: Record<Language, string>;
  amountSats: number;
  memo: Record<Language, string>;
}

export interface StallConfig {
  id: StallId;
  name: Record<Language, string>;
  subtitle: Record<Language, string>;
  vendorTitle: Record<Language, string>;
  lesson1Item: StallItem;
  lesson2Item: StallItem;
  lesson3Item: StallItem;
  lesson4Item: StallItem;
  lesson4SmallItem: StallItem;
  lesson5Item: StallItem;
}

export interface ScamSceneConfig {
  id: 1 | 2 | 3;
  title: Record<Language, string>;
  customerLine: Record<Language, string>;
  clueBox: Record<Language, string>;
  options: {
    id: string;
    label: Record<Language, string>;
    isSafe: boolean;
    explanation: Record<Language, string>;
  }[];
  redFlagSummary: Record<Language, string>;
}

export interface QuizQuestion {
  id: string;
  prompt: Record<Language, string>;
  options: {
    id: string;
    text: Record<Language, string>;
    isCorrect: boolean;
    feedback: Record<Language, string>;
  }[];
}

export interface LessonConfig {
  id: LessonId;
  badge: Record<Language, string>;
  shortNavTitle: Record<Language, string>;
  title: Record<Language, string>;
  subtitle: Record<Language, string>;
  customerName: string;
  customerRole: Record<Language, string>;
  termsTaught: string[];
  whatYouLearnedTitle: Record<Language, string>;
  whatYouLearnedPoints: Record<Language, string[]>;
  realWorldTip: Record<Language, string>;
  questions: [QuizQuestion, QuizQuestion];
}

export interface UserProgress {
  language: Language;
  selectedStall: StallId;
  completedLessons: LessonId[];
  quizScores: Record<number, number>;
  seenTerms: string[];
  dataSaver: boolean;
}

export const DEFAULT_PROGRESS: UserProgress = {
  language: 'fr',
  selectedStall: 'fruit',
  completedLessons: [],
  quizScores: {},
  seenTerms: ['sats', 'lightning', 'invoice'],
  dataSaver: false,
};

export const PROGRESS_STORAGE_KEY = 'marche_eclair_progress_v1';

export function isLessonId(val: unknown): val is LessonId {
  return (
    val === 1 ||
    val === 2 ||
    val === 3 ||
    val === 4 ||
    val === 5 ||
    val === 6
  );
}

export function loadProgress(): UserProgress {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PROGRESS };
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw);
    return {
      language: parsed.language === 'en' ? 'en' : 'fr',
      selectedStall:
        parsed.selectedStall === 'fabric' || parsed.selectedStall === 'credit'
          ? parsed.selectedStall
          : 'fruit',
      completedLessons: Array.isArray(parsed.completedLessons)
        ? parsed.completedLessons.filter(isLessonId)
        : [],
      quizScores:
        parsed.quizScores && typeof parsed.quizScores === 'object'
          ? parsed.quizScores
          : {},
      seenTerms: Array.isArray(parsed.seenTerms)
        ? parsed.seenTerms
        : [...DEFAULT_PROGRESS.seenTerms],
      dataSaver: Boolean(parsed.dataSaver),
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors on low-storage phones
  }
}

export function recordLessonCompletion(
  current: UserProgress,
  lessonId: LessonId,
  score: number,
  newTerms: string[]
): UserProgress {
  const completedLessons = current.completedLessons.includes(lessonId)
    ? current.completedLessons
    : [...current.completedLessons, lessonId];
  const seenTerms = Array.from(new Set([...current.seenTerms, ...newTerms]));
  return {
    ...current,
    completedLessons,
    quizScores: {
      ...current.quizScores,
      [lessonId]: Math.max(current.quizScores[lessonId] ?? 0, score),
    },
    seenTerms,
  };
}

export const TERMS: Record<string, TermExplanation> = {
  sats: {
    key: 'sats',
    term: {
      fr: 'Sats (Satoshis)',
      en: 'Sats (Satoshis)',
    },
    plainMeaning: {
      fr: localizeQuotes('Les plus petites pièces de Bitcoin. Pas besoin d’acheter un Bitcoin entier : on compte en petits « sats » pour les achats de tous les jours.', 'fr'),
      en: localizeQuotes('The smallest coins of a Bitcoin. You never need to buy a whole Bitcoin—everyday items are priced in small "sats".', 'en'),
    },
    marketAnalogy: {
      fr: 'Comme les pièces de monnaie dans votre caisse pour rendre la monnaie exacte.',
      en: 'Like small coins in your cash box used for everyday market prices.',
    },
  },
  lightning: {
    key: 'lightning',
    term: {
      fr: 'Réseau Lightning (Éclair)',
      en: 'Lightning Network',
    },
    plainMeaning: {
      fr: 'Un chemin rapide construit sur Bitcoin qui permet d’envoyer des sats en une seconde, presque sans frais.',
      en: 'A fast payment highway built on Bitcoin that sends sats in one second with near-zero fees.',
    },
    marketAnalogy: {
      fr: 'Au lieu d’attendre un virement lent, l’argent passe de main en main instantanément au comptoir.',
      en: 'Instead of waiting for a slow transfer, the money passes hand-to-hand right across the counter.',
    },
  },
  invoice: {
    key: 'invoice',
    term: {
      fr: 'Facture Lightning',
      en: 'Lightning Invoice',
    },
    plainMeaning: {
      fr: 'Une demande de paiement unique qui contient déjà le montant exact en sats et une petite note (mémo).',
      en: 'A one-time payment request that already locks in the exact amount in sats and a short note (memo).',
    },
    marketAnalogy: {
      fr: 'Comme un bon de caisse écrit pour un seul client : il ne peut pas se tromper de montant.',
      en: 'Like a single-use market slip written for one customer—they cannot type the wrong price.',
    },
  },
  qr: {
    key: 'qr',
    term: {
      fr: 'Code QR / Texte de facture',
      en: 'QR Code / Invoice Text',
    },
    plainMeaning: {
      fr: localizeQuotes('Un dessin carré (ou un texte commençant par « lnbc ») que le téléphone du client lit avec sa caméra pour payer sans rien taper.', 'fr'),
      en: localizeQuotes('A square pattern (or text starting with "lnbc") that the customer’s phone camera scans so they pay without typing numbers.', 'en'),
    },
    marketAnalogy: {
      fr: 'Montrez l’écran de votre téléphone au client : un bip et c’est réglé.',
      en: 'Just hold up your phone screen for the customer: one quick scan and it is done.',
    },
  },
  expiry: {
    key: 'expiry',
    term: {
      fr: 'Expiration (Temps limite)',
      en: 'Expiry (Time Limit)',
    },
    plainMeaning: {
      fr: 'Chaque facture Lightning a une durée de vie limitée. Si le client attend trop longtemps, la facture se ferme toute seule.',
      en: 'Every Lightning invoice has a countdown timer. If the customer waits too long, the invoice closes automatically.',
    },
    marketAnalogy: {
      fr: 'Cela vous protège : un client ne peut pas payer le prix d’hier trois heures plus tard. Il suffit de créer une nouvelle facture.',
      en: 'This protects you: a buyer cannot pay an old price hours later. You simply create a fresh invoice.',
    },
  },
  channel: {
    key: 'channel',
    term: {
      fr: 'Canal & Nœuds',
      en: 'Channel & Nodes',
    },
    plainMeaning: {
      fr: localizeQuotes('Les téléphones et relais (« nœuds ») sont reliés par des ponts de paiement (« canaux ») où les sats glissent d’un côté à l’autre.', 'fr'),
      en: localizeQuotes('Phones and market relays ("nodes") are linked by payment bridges ("channels") where sats slide back and forth.', 'en'),
    },
    marketAnalogy: {
      fr: 'Dans ce mode pratique, les nœuds relient le client à votre étal via des canaux du marché.',
      en: 'In this practice mode, nodes connect the customer to your stall through market channels.',
    },
  },
  fees: {
    key: 'fees',
    term: {
      fr: 'Frais de réseau',
      en: 'Network Fees',
    },
    plainMeaning: {
      fr: 'Le petit coût payé pour faire passer un paiement. Sur Lightning, c’est 1 ou 2 sats (presque zéro) ; sur la chaîne principale Bitcoin, c’est beaucoup plus cher.',
      en: 'The tiny cost paid to send a payment. On Lightning, it is just 1 or 2 sats (nearly zero); on the main Bitcoin chain, it costs much more.',
    },
    marketAnalogy: {
      fr: 'On ne loue pas un gros camion blindé (la chaîne principale) juste pour livrer trois mangues au voisin : on les passe à la main (Lightning).',
      en: 'You do not hire a heavy armored truck (on-chain) just to hand three mangoes across the counter (Lightning).',
    },
  },
  confirmation: {
    key: 'confirmation',
    term: {
      fr: 'Confirmation (Sur la chaîne)',
      en: 'Confirmation (On-Chain)',
    },
    plainMeaning: {
      fr: localizeQuotes('Sur le réseau Bitcoin principal (« on-chain »), il faut attendre 10 à 60 minutes qu’un bloc soit inscrit et « confirmé ». Avec Lightning, c’est réglé en 1 seconde.', 'fr'),
      en: localizeQuotes('On the main Bitcoin network ("on-chain"), you wait 10 to 60 minutes for a block "confirmation". With Lightning, payment settles in 1 second.', 'en'),
    },
    marketAnalogy: {
      fr: 'Au marché, le client ne peut pas attendre 30 minutes debout devant votre étal : Lightning règle la vente tout de suite.',
      en: 'At a busy market, a shopper cannot stand waiting 30 minutes at your stall—Lightning settles the sale right away.',
    },
  },
  liquidity: {
    key: 'liquidity',
    term: {
      fr: 'Liquidité (Capacité à recevoir)',
      en: 'Liquidity (Receiving Capacity)',
    },
    plainMeaning: {
      fr: 'La place disponible dans votre canal pour recevoir de nouveaux sats. Si votre côté du canal est presque plein, un gros paiement ne peut pas entrer.',
      en: 'The open space available in your channel to receive new sats. If the incoming side of your channel is too small, a large payment cannot fit.',
    },
    marketAnalogy: {
      fr: 'Comme un panier qui n’a plus de place que pour 3 mangues : pour en recevoir 6 d’un coup, il faut agrandir le panier ou vendre en deux petits paniers.',
      en: 'Like a basket with room left for only 3 mangoes: to take 6 at once, you either get a bigger basket or split into a smaller order.',
    },
  },
  routing: {
    key: 'routing',
    term: {
      fr: 'Routage (Chemin en plusieurs sauts)',
      en: 'Routing (Multi-hop Path)',
    },
    plainMeaning: {
      fr: localizeQuotes('Même si vous n’avez pas de canal direct avec un client, Lightning trouve automatiquement un chemin à travers d’autres nœuds (« sauts ») pour vous livrer les sats.', 'fr'),
      en: localizeQuotes('Even without a direct channel to a customer, Lightning automatically finds a path across other relay nodes ("hops") to deliver your sats.', 'en'),
    },
    marketAnalogy: {
      fr: 'Comme faire passer un panier de main en main à travers deux voisins du marché : chacun prend 1 sat de service et vous recevez votre prix exact.',
      en: 'Like passing a parcel hand-to-hand through two market neighbors: each takes 1 sat for helping, and you still receive your exact price.',
    },
  },
  safety: {
    key: 'safety',
    term: {
      fr: 'Vigilance & Anti-Arnaques',
      en: 'Safety & Scam Red Flags',
    },
    plainMeaning: {
      fr: 'Trois règles d’or : 1) Vérifiez toujours le montant sur VOTRE écran, 2) On ne paie jamais pour recevoir des sats, 3) Méfiez-vous des faux liens.',
      en: 'Three golden rules: 1) Always check the amount on YOUR screen, 2) Never pay sats in order to receive sats, 3) Never trust suspicious links.',
    },
    marketAnalogy: {
      fr: 'Comme vérifier les billets dans sa propre main avant de donner le sac au client.',
      en: 'Just like counting cash in your own hand before handing over the market bag.',
    },
  },
  keys: {
    key: 'keys',
    term: {
      fr: 'Clés secrètes (12 ou 24 mots)',
      en: 'Secret Keys (12 or 24 Seed Words)',
    },
    plainMeaning: {
      fr: 'La liste secrète de 12 ou 24 mots qui donne un accès total à votre portefeuille Bitcoin. Personne d’honnête ne vous la demandera jamais.',
      en: 'The secret list of 12 or 24 recovery words that controls all the money in your wallet. No honest person or support agent will ever ask for them.',
    },
    marketAnalogy: {
      fr: 'C’est la clé du cadenas de votre caisse : si vous la donnez à un inconnu, il vide toute la caisse.',
      en: 'It is the physical key to your cashbox padlock: if you hand it to a stranger, they can empty everything.',
    },
  },
};

export const STALLS: Record<StallId, StallConfig> = {
  fruit: {
    id: 'fruit',
    name: {
      fr: 'Étal de Fruits',
      en: 'Fruit Stall',
    },
    subtitle: {
      fr: 'Mangues sucrées, papayes et plantains pesés à la balance',
      en: 'Sweet mangoes, papayas, and plantains weighed on the scale',
    },
    vendorTitle: {
      fr: 'Vendeur de Fruits Frais',
      en: 'Fresh Fruit Vendor',
    },
    lesson1Item: {
      name: {
        fr: 'Panier de 3 mangues mûres',
        en: 'Basket of 3 ripe mangoes',
      },
      amountSats: 250,
      memo: {
        fr: 'Panier de 3 mangues',
        en: 'Basket of 3 mangoes',
      },
    },
    lesson2Item: {
      name: {
        fr: 'Caisse de papayes dorées',
        en: 'Crate of golden papayas',
      },
      amountSats: 400,
      memo: {
        fr: 'Caisse de papayes',
        en: 'Crate of papayas',
      },
    },
    lesson3Item: {
      name: {
        fr: 'Régime de plantains mûrs',
        en: 'Bunch of ripe plantains',
      },
      amountSats: 300,
      memo: {
        fr: 'Régime de plantains',
        en: 'Bunch of plantains',
      },
    },
    lesson4Item: {
      name: {
        fr: 'Grand panier familial de fruits',
        en: 'Large family fruit basket',
      },
      amountSats: 600,
      memo: {
        fr: 'Grand panier familial',
        en: 'Large family basket',
      },
    },
    lesson4SmallItem: {
      name: {
        fr: 'Demi-panier de fruits',
        en: 'Half basket of fruit',
      },
      amountSats: 300,
      memo: {
        fr: 'Demi-panier de fruits',
        en: 'Half fruit basket',
      },
    },
    lesson5Item: {
      name: {
        fr: 'Lot d’ananas et mangues',
        en: 'Pineapple & mango bundle',
      },
      amountSats: 500,
      memo: {
        fr: 'Lot ananas et mangues',
        en: 'Pineapple mango bundle',
      },
    },
  },
  fabric: {
    id: 'fabric',
    name: {
      fr: 'Étal de Tissus',
      en: 'Fabric Stall',
    },
    subtitle: {
      fr: 'Cotonnades tissées, indigo et coupons mesurés au mètre',
      en: 'Woven cotton, indigo cloth, and colorful fabric measured by the meter',
    },
    vendorTitle: {
      fr: 'Marchand de Tissus & Pagnes',
      en: 'Woven Fabric Merchant',
    },
    lesson1Item: {
      name: {
        fr: 'Coupon de tissu indigo (2 m)',
        en: 'Indigo fabric cut (2 m)',
      },
      amountSats: 300,
      memo: {
        fr: 'Tissu indigo 2m',
        en: 'Indigo fabric 2m',
      },
    },
    lesson2Item: {
      name: {
        fr: 'Grand rouleau de coton tissé',
        en: 'Large woven cotton roll',
      },
      amountSats: 450,
      memo: {
        fr: 'Rouleau coton tissé',
        en: 'Woven cotton roll',
      },
    },
    lesson3Item: {
      name: {
        fr: 'Écharpe tissée main',
        en: 'Hand-woven scarf',
      },
      amountSats: 300,
      memo: {
        fr: 'Écharpe tissée main',
        en: 'Hand-woven scarf',
      },
    },
    lesson4Item: {
      name: {
        fr: 'Lot complet 6 mètres de pagne',
        en: 'Full 6-yard fabric bundle',
      },
      amountSats: 600,
      memo: {
        fr: 'Lot 6m de pagne',
        en: 'Full 6m fabric bundle',
      },
    },
    lesson4SmallItem: {
      name: {
        fr: 'Demi-coupon 3 mètres de pagne',
        en: 'Half cut 3-meter fabric',
      },
      amountSats: 300,
      memo: {
        fr: 'Demi-coupon 3m',
        en: 'Half cut 3m fabric',
      },
    },
    lesson5Item: {
      name: {
        fr: 'Ensemble couture cérémoniel',
        en: 'Ceremonial tailoring set',
      },
      amountSats: 500,
      memo: {
        fr: 'Ensemble couture',
        en: 'Tailoring fabric set',
      },
    },
  },
  credit: {
    id: 'credit',
    name: {
      fr: 'Crédit Téléphone',
      en: 'Phone Credit',
    },
    subtitle: {
      fr: 'Forfaits d’appels, données mobiles et recharge solaire rapide',
      en: 'Call bundles, mobile data packages, and quick solar phone charging',
    },
    vendorTitle: {
      fr: 'Kiosque Crédit & Recharge',
      en: 'Airtime & Charging Kiosk',
    },
    lesson1Item: {
      name: {
        fr: 'Forfait appels + données 500 Mo',
        en: 'Call bundle + 500 MB data',
      },
      amountSats: 200,
      memo: {
        fr: 'Forfait 500 Mo',
        en: '500 MB data bundle',
      },
    },
    lesson2Item: {
      name: {
        fr: 'Forfait semaine + charge batterie',
        en: 'Weekly bundle + battery charge',
      },
      amountSats: 350,
      memo: {
        fr: 'Forfait semaine complet',
        en: 'Full weekly bundle',
      },
    },
    lesson3Item: {
      name: {
        fr: 'Recharge appels + charge solaire',
        en: 'Call top-up + solar charge',
      },
      amountSats: 300,
      memo: {
        fr: 'Recharge + solaire',
        en: 'Top-up + solar charge',
      },
    },
    lesson4Item: {
      name: {
        fr: 'Pack mensuel Internet famille',
        en: 'Monthly family data pack',
      },
      amountSats: 600,
      memo: {
        fr: 'Pack mensuel famille',
        en: 'Monthly family data pack',
      },
    },
    lesson4SmallItem: {
      name: {
        fr: 'Demi-pack données 15 jours',
        en: 'Half data pack (15 days)',
      },
      amountSats: 300,
      memo: {
        fr: 'Demi-pack 15 jours',
        en: '15-day data pack',
      },
    },
    lesson5Item: {
      name: {
        fr: 'Forfait pro multi-réseaux',
        en: 'Multi-network business bundle',
      },
      amountSats: 500,
      memo: {
        fr: 'Forfait pro',
        en: 'Pro airtime bundle',
      },
    },
  },
};

export const SCAM_SCENES: ScamSceneConfig[] = [
  {
    id: 1,
    title: {
      fr: 'Scène 1 sur 3 : La fausse facture au mauvais montant',
      en: 'Scene 1 of 3: The fake invoice with the wrong amount',
    },
    customerLine: {
      fr: localizeQuotes('« Vendeur, ton article coûte 500 sats, mais laisse-moi créer la demande moi-même… Tiens, voici un reçu qui dit "Payé : 50 sats (500 CFA)". Donne-moi vite la marchandise, je suis pressé ! »', 'fr'),
      en: localizeQuotes('"Vendor, your item costs 500 sats, but let me generate the slip myself… Look, here is a screen that says “Paid: 50 sats”. Hand me the goods quickly, I am in a hurry!"', 'en'),
    },
    clueBox: {
      fr: 'Indice à observer : Le prix convenu est de 500 sats, mais l’écran montré par l’inconnu indique seulement 50 sats — et VOTRE propre portefeuille SimWallet n’affiche aucun paiement reçu.',
      en: 'Clue to spot: The agreed price is 500 sats, but the screen shown by the stranger says only 50 sats—and YOUR own SimWallet shows zero payment received.',
    },
    options: [
      {
        id: 'refuse-and-create-own',
        label: {
          fr: localizeQuotes('Refuser : C’est toujours le vendeur qui crée la facture de 500 sats et vérifie « PAYÉE ✓ » sur son propre téléphone', 'fr'),
          en: localizeQuotes('Refuse: The seller always creates the 500-sat invoice and checks "PAID ✓" on their own phone', 'en'),
        },
        isSafe: true,
        explanation: {
          fr: 'Bravo ! Vous avez repéré le piège : il manquait un zéro (50 sats au lieu de 500 sats) et seul VOTRE téléphone fait foi.',
          en: 'Well spotted! A zero was missing (50 sats instead of 500 sats), and only YOUR own wallet screen counts as proof.',
        },
      },
      {
        id: 'trust-stranger-screen',
        label: {
          fr: 'Donner la marchandise sans vérifier votre téléphone parce qu’il est pressé',
          en: 'Hand over the goods without checking your phone because he is in a hurry',
        },
        isSafe: false,
        explanation: {
          fr: 'Attention au piège ! Un escroc joue souvent la précipitation pour cacher un montant 10 fois trop petit ou une fausse capture d’écran.',
          en: 'Watch out! Scammers pretend to be in a rush to hide a 10x smaller amount or a fake screenshot.',
        },
      },
    ],
    redFlagSummary: {
      fr: 'Drapeau rouge n°1 : Montant modifié (50 au lieu de 500 sats) ou capture d’écran douteuse. Créez toujours la facture vous-même.',
      en: 'Red flag #1: Wrong amount (50 instead of 500 sats) or fake screenshot. Always create the invoice yourself.',
    },
  },
  {
    id: 2,
    title: {
      fr: localizeQuotes('Scène 2 sur 3 : Le piège « Payez d’abord pour recevoir »', 'fr'),
      en: localizeQuotes('Scene 2 of 3: The "Pay first to receive" trick', 'en'),
    },
    customerLine: {
      fr: localizeQuotes('« Félicitations ! Votre étal a gagné une prime de 5 000 sats du marché ! Scannez vite ma facture et envoyez-moi d’abord 200 sats de frais d’activation pour débloquer vos 5 000 sats ! »', 'fr'),
      en: localizeQuotes('"Congratulations! Your stall won a 5,000-sat market bonus! Quickly scan my invoice and send me 200 sats first as an activation fee to unlock your 5,000 sats!"', 'en'),
    },
    clueBox: {
      fr: 'Indice à observer : Cet inconnu vous demande de scanner SA facture (donc d’envoyer VOS sats) en promettant que vous recevrez plus d’argent après.',
      en: 'Clue to spot: This stranger asks you to scan THEIR invoice (sending YOUR sats out) with a promise that you will receive more money back.',
    },
    options: [
      {
        id: 'refuse-pay-to-receive',
        label: {
          fr: 'Refuser net : Sur Lightning, on ne paie JAMAIS de sats pour recevoir un paiement',
          en: 'Refuse immediately: On Lightning, you NEVER pay sats in order to receive a payment',
        },
        isSafe: true,
        explanation: {
          fr: 'Exactement ! Pour recevoir des sats, vous montrez votre facture. Si quelqu’un vous demande de payer d’abord pour recevoir, c’est 100 % une arnaque.',
          en: 'Spot on! To receive sats, you show your own invoice. Anyone asking you to pay first to receive money is 100% a scammer.',
        },
      },
      {
        id: 'pay-200-sats',
        label: {
          fr: 'Envoyer les 200 sats pour essayer de gagner les 5 000 sats',
          en: 'Send the 200 sats to try to unlock the 5,000 sats',
        },
        isSafe: false,
        explanation: {
          fr: localizeQuotes('Danger ! Dès que vous payez une facture Lightning, vos 200 sats partent définitivement et le faux « bonus » n’existe pas.', 'fr'),
          en: localizeQuotes('Danger! Once you pay a Lightning invoice, your 200 sats are gone for good and the fake "bonus" never existed.', 'en'),
        },
      },
    ],
    redFlagSummary: {
      fr: localizeQuotes('Drapeau rouge n°2 : « Envoyez des sats pour en recevoir plus ». Sur Bitcoin et Lightning, on ne paie jamais pour encaisser.', 'fr'),
      en: localizeQuotes('Red flag #2: "Send sats first to receive more." On Bitcoin and Lightning, you never pay money to receive money.', 'en'),
    },
  },
  {
    id: 3,
    title: {
      fr: 'Scène 3 sur 3 : Le lien de phishing qui demande vos clés secrètes',
      en: 'Scene 3 of 3: The phishing link asking for your secret keys',
    },
    customerLine: {
      fr: localizeQuotes('« Bonjour, je suis le faux "Support Technique". Vous avez reçu un SMS avec le lien "marche-eclair-verif.com" : tapez vos 12 mots secrets (clés privées) sur cette page pour éviter la fermeture de votre caisse ! »', 'fr'),
      en: localizeQuotes('"Hello, I am from fake “Technical Support”. We sent you a link to “marche-eclair-verif.com”: type your 12 secret recovery words (private keys) on that page or your wallet will be closed!"', 'en'),
    },
    clueBox: {
      fr: localizeQuotes('Indice à observer : Un lien extérieur vous menace d’urgence et vous demande vos « 12 mots secrets / clés privées ».', 'fr'),
      en: localizeQuotes('Clue to spot: An external link uses urgent threats and asks for your "12 secret recovery words / private keys".', 'en'),
    },
    options: [
      {
        id: 'protect-secret-keys',
        label: {
          fr: 'Fermer le lien : Ne JAMAIS taper ni donner ses 12 mots secrets (clés) à qui que ce soit',
          en: 'Close the link: NEVER type or share your 12 secret words (keys) with anyone or any website',
        },
        isSafe: true,
        explanation: {
          fr: 'Parfait ! Vos 12 mots secrets sont la clé du cadenas de votre caisse. Aucun vrai service ne vous les demandera jamais.',
          en: 'Perfect! Your 12 secret words are the master key to your cashbox. No real service will ever ask for them.',
        },
      },
      {
        id: 'type-seed-words',
        label: {
          fr: 'Cliquer sur le lien et entrer les 12 mots secrets',
          en: 'Click the link and type the 12 secret words',
        },
        isSafe: false,
        explanation: {
          fr: localizeQuotes('Surtout pas ! Donner vos 12 mots secrets (« phishing ») permet au voleur de vider tout votre portefeuille à distance.', 'fr'),
          en: 'Never do this! Typing your 12 secret words into a phishing link lets the thief empty your entire wallet remotely.',
        },
      },
    ],
    redFlagSummary: {
      fr: localizeQuotes('Drapeau rouge n°3 : Lien suspect (« phishing ») demandant vos 12/24 mots secrets. Gardez vos clés secrètes uniquement sur papier chez vous.', 'fr'),
      en: 'Red flag #3: Suspicious phishing link asking for your 12/24 recovery words. Keep your secret keys offline and private.',
    },
  },
];

export const LESSONS: Record<LessonId, LessonConfig> = {
  1: {
    id: 1,
    badge: {
      fr: 'Leçon 1 sur 6 · Encaisser',
      en: 'Lesson 1 of 6 · Getting Paid',
    },
    shortNavTitle: {
      fr: '1. Encaisser',
      en: '1. Get Paid',
    },
    title: {
      fr: 'Encaisser votre premier paiement en sats',
      en: 'Receive your first payment in sats',
    },
    subtitle: {
      fr: 'Créez une facture Lightning, montrez le code QR au client et voyez votre solde monter.',
      en: 'Create a Lightning invoice, show the QR code to the customer, and watch your balance grow.',
    },
    customerName: 'Amina',
    customerRole: {
      fr: 'Cliente régulière du quartier',
      en: 'Regular neighborhood shopper',
    },
    termsTaught: ['sats', 'invoice', 'qr', 'lightning'],
    whatYouLearnedTitle: {
      fr: 'Ce que vous venez d’apprendre : Encaisser avec une facture',
      en: 'What you just learned: Getting paid with an invoice',
    },
    whatYouLearnedPoints: {
      fr: [
        localizeQuotes('Les « sats » (satoshis) sont les petites pièces de Bitcoin utilisées pour les achats du quotidien.', 'fr'),
        localizeQuotes('Pour être payé sur Lightning, le vendeur crée une « facture » qui fixe le montant exact et le motif.', 'fr'),
        'Le client scanne le code QR (ou copie le code lnbc…) et les sats arrivent en une seconde dans votre portefeuille.',
      ],
      en: [
        localizeQuotes('"Sats" (satoshis) are the small units of Bitcoin used for everyday market purchases.', 'en'),
        localizeQuotes('To get paid on Lightning, the seller creates an "invoice" that locks in the exact amount and note.', 'en'),
        'The customer scans the QR code (or copies the lnbc… code) and the sats arrive in your wallet in a second.',
      ],
    },
    realWorldTip: {
      fr: localizeQuotes('Astuce du marché : Vérifiez toujours que la mention « PAYÉE ✓ » s’affiche sur VOTRE téléphone avant de remettre la marchandise.', 'fr'),
      en: localizeQuotes('Market tip: Always check that "PAID ✓" appears on YOUR own phone screen before handing over the goods.', 'en'),
    },
    questions: [
      {
        id: 'l1-q1',
        prompt: {
          fr: '1. Qui prépare la facture Lightning avec le montant exact en sats ?',
          en: '1. Who creates the Lightning invoice with the exact amount in sats?',
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Vous (le vendeur), avant que le client ne scanne le code QR',
              en: 'You (the seller), before the customer scans the QR code',
            },
            isCorrect: true,
            feedback: {
              fr: 'Exact ! Le vendeur crée la facture pour que le montant soit déjà fixé sans erreur.',
              en: 'Correct! The seller creates the invoice so the price is locked in with no typing mistakes.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Le client doit deviner et taper votre numéro de téléphone',
              en: 'The customer has to guess and type your phone number',
            },
            isCorrect: false,
            feedback: {
              fr: 'Pas besoin de numéro de téléphone ! Avec Lightning, c’est votre facture QR qui contient toutes les informations.',
              en: 'No phone number needed! On Lightning, your QR invoice contains everything needed to pay.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Il faut acheter un Bitcoin entier pour payer au marché',
              en: 'You have to buy a whole Bitcoin to pay at the market',
            },
            isCorrect: false,
            feedback: {
              fr: localizeQuotes('Non, on utilise de toutes petites unités appelées « sats » (satoshis) pour les prix du marché.', 'fr'),
              en: localizeQuotes('No, we use tiny units called "sats" (satoshis) for everyday market prices.', 'en'),
            },
          },
        ],
      },
      {
        id: 'l1-q2',
        prompt: {
          fr: localizeQuotes('2. Que sont les « sats » (satoshis) ?', 'fr'),
          en: localizeQuotes('2. What are "sats" (satoshis)?', 'en'),
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Une taxe supplémentaire prélevée par le marché',
              en: 'An extra tax charged by the market',
            },
            isCorrect: false,
            feedback: {
              fr: 'Non ! Les sats ne sont pas une taxe, ce sont les petites unités de Bitcoin.',
              en: 'No! Sats are not a tax—they are the small everyday units of Bitcoin.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Les petites pièces de Bitcoin utilisées pour afficher et payer de petits montants',
              en: 'The small units of Bitcoin used to price and pay everyday amounts',
            },
            isCorrect: true,
            feedback: {
              fr: 'Bravo ! Comme les pièces dans votre caisse, les sats permettent de payer 200 ou 250 sats facilement.',
              en: 'Well done! Just like small coins in your cash box, sats make it easy to pay 200 or 250 sats.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Un mot de passe secret à donner au client',
              en: 'A secret password you give to the customer',
            },
            isCorrect: false,
            feedback: {
              fr: 'Jamais de mot de passe partagé ! Les sats sont simplement l’unité de monnaie.',
              en: 'Never share passwords! Sats are simply the unit of money.',
            },
          },
        ],
      },
    ],
  },
  2: {
    id: 2,
    badge: {
      fr: 'Leçon 2 sur 6 · Expiration',
      en: 'Lesson 2 of 6 · Invoice Expiry',
    },
    shortNavTitle: {
      fr: '2. Expiration',
      en: '2. Expiry',
    },
    title: {
      fr: 'Que se passe-t-il quand une facture expire ?',
      en: 'What happens when an invoice expires?',
    },
    subtitle: {
      fr: 'Un client tarde trop à payer. Voyez comment l’expiration protège votre étal et comment refaire une facture.',
      en: 'A customer takes too long to pay. See how expiry protects your stall and how to issue a fresh invoice.',
    },
    customerName: 'Moussa',
    customerRole: {
      fr: 'Client pressé au marché',
      en: 'Busy market shopper',
    },
    termsTaught: ['expiry', 'invoice', 'channel'],
    whatYouLearnedTitle: {
      fr: 'Ce que vous venez d’apprendre : L’expiration des factures',
      en: 'What you just learned: Invoice expiry',
    },
    whatYouLearnedPoints: {
      fr: [
        localizeQuotes('Chaque facture Lightning a une limite de temps (« expiration »).', 'fr'),
        'Si un client essaie de payer une facture expirée, le réseau bloque le paiement automatiquement : personne ne perd ses sats.',
        'Pour conclure la vente, créez simplement une nouvelle facture toute fraîche et faites-la scanner.',
      ],
      en: [
        localizeQuotes('Every Lightning invoice has a built-in time limit ("expiry").', 'en'),
        'If a customer tries to pay an expired invoice, the network automatically blocks it—nobody loses any sats.',
        'To finish the sale, simply create a fresh invoice and let the customer scan the new one.',
      ],
    },
    realWorldTip: {
      fr: 'Astuce du marché : Une facture expirée ne coûte rien. Vous pouvez en créer une nouvelle en deux touches sans aucun frais.',
      en: 'Market tip: An expired invoice costs nothing. You can create a brand-new one in two taps with zero fees.',
    },
    questions: [
      {
        id: 'l2-q1',
        prompt: {
          fr: '1. Moussa essaie de payer votre facture après la fin du compte à rebours (expirée). Que se passe-t-il ?',
          en: '1. Moussa tries to pay your invoice after the countdown timer has ended (expired). What happens?',
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Le paiement est refusé automatiquement et Moussa garde ses sats en sécurité',
              en: 'The payment is automatically rejected and Moussa safely keeps his sats',
            },
            isCorrect: true,
            feedback: {
              fr: 'Exactement ! Une facture expirée ne peut plus être payée : aucun sat n’est perdu en route.',
              en: 'Exactly! An expired invoice can no longer be paid—no sats get stuck or lost.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Les sats disparaissent pour toujours dans le réseau',
              en: 'The sats disappear forever inside the network',
            },
            isCorrect: false,
            feedback: {
              fr: 'Rassurez-vous, les sats ne disparaissent pas ! Le portefeuille refuse simplement une facture périmée.',
              en: 'Do not worry—sats never vanish! The wallet simply refuses to pay an expired invoice.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Votre compte est bloqué pendant une semaine',
              en: 'Your wallet is locked for a week',
            },
            isCorrect: false,
            feedback: {
              fr: 'Pas du tout ! Votre portefeuille reste prêt à fonctionner immédiatement.',
              en: 'Not at all! Your wallet stays ready to use right away.',
            },
          },
        ],
      },
      {
        id: 'l2-q2',
        prompt: {
          fr: '2. Que devez-vous faire si une facture expire alors que le client veut toujours acheter ?',
          en: '2. What should you do if an invoice expires while the customer still wants to buy?',
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Donner la marchandise gratuitement',
              en: 'Give the item away for free',
            },
            isCorrect: false,
            feedback: {
              fr: 'Surtout pas ! Il suffit de générer une nouvelle facture.',
              en: 'Definitely not! You just need to generate a fresh invoice.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Créer une nouvelle facture Lightning gratuitement et montrer le nouveau code QR',
              en: 'Create a new Lightning invoice for free and show the new QR code',
            },
            isCorrect: true,
            feedback: {
              fr: 'Parfait ! Créer une nouvelle facture est gratuit et prend quelques secondes.',
              en: 'Spot on! Creating a new invoice is free and takes just a few seconds.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Redémarrer votre téléphone trois fois',
              en: 'Restart your phone three times',
            },
            isCorrect: false,
            feedback: {
              fr: localizeQuotes('Inutile de redémarrer : appuyez simplement sur « Nouvelle facture ».', 'fr'),
              en: localizeQuotes('No need to restart—simply tap "Create a new invoice".', 'en'),
            },
          },
        ],
      },
    ],
  },
  3: {
    id: 3,
    badge: {
      fr: 'Leçon 3 sur 6 · Frais & Vitesse',
      en: 'Lesson 3 of 6 · Fees & Speed',
    },
    shortNavTitle: {
      fr: '3. Frais & Vitesse',
      en: '3. Fees & Speed',
    },
    title: {
      fr: 'Pourquoi Lightning est instantané et presque gratuit',
      en: 'Why Lightning is instant and nearly free',
    },
    subtitle: {
      fr: 'Comparez un paiement Lightning (1 seconde, 1 sat de frais) avec un paiement lent et coûteux sur la chaîne Bitcoin.',
      en: 'Compare a Lightning payment (1 second, 1 sat fee) with a slow, costly on-chain Bitcoin payment for the same sale.',
    },
    customerName: 'Fatou',
    customerRole: {
      fr: 'Acheteuse curieuse des frais',
      en: 'Fee-conscious market buyer',
    },
    termsTaught: ['fees', 'confirmation', 'lightning'],
    whatYouLearnedTitle: {
      fr: 'Ce que vous venez d’apprendre : Frais et Confirmation',
      en: 'What you just learned: Fees and Confirmation',
    },
    whatYouLearnedPoints: {
      fr: [
        localizeQuotes('Un paiement sur la chaîne principale Bitcoin (« on-chain ») demande 10 à 60 minutes de « confirmation » et coûte cher en frais (ex: 850 sats).', 'fr'),
        localizeQuotes('Un paiement Lightning (« éclair ») règle la même vente en 1 seconde pour environ 1 sat de frais.', 'fr'),
        'Au marché, Lightning est idéal pour toutes les ventes du quotidien, tandis que la chaîne principale sert aux gros transferts rares.',
      ],
      en: [
        localizeQuotes('A main-chain Bitcoin payment ("on-chain") takes 10 to 60 minutes for block "confirmation" and has high fees (e.g., 850 sats).', 'en'),
        'A Lightning payment settles the exact same market sale in 1 second for about 1 sat in fees.',
        'At the market, Lightning is built for everyday sales, while on-chain is used for rare, large savings transfers.',
      ],
    },
    realWorldTip: {
      fr: 'Astuce du marché : Pour une vente de 300 sats, utiliser Lightning économise plus de 800 sats de frais et évite 30 minutes d’attente au client !',
      en: 'Market tip: On a 300-sat sale, using Lightning saves over 800 sats in fees and spares your customer a 30-minute wait!',
    },
    questions: [
      {
        id: 'l3-q1',
        prompt: {
          fr: localizeQuotes('1. Fatou achète un article à 300 sats au marché. Pourquoi choisit-elle Lightning plutôt qu’un paiement « sur la chaîne » (on-chain) ?', 'fr'),
          en: localizeQuotes('1. Fatou buys a 300-sat item at the market. Why does she choose Lightning instead of an "on-chain" payment?', 'en'),
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Parce que Lightning arrive en 1 seconde avec environ 1 sat de frais, sans attendre 30 minutes de confirmation',
              en: 'Because Lightning arrives in 1 second with a ~1 sat fee, without waiting 30 minutes for confirmation',
            },
            isCorrect: true,
            feedback: {
              fr: 'Exactement ! Lightning est instantané et coûte une fraction de sat ou 1 sat.',
              en: 'Exactly! Lightning is instant and costs just a tiny 1-sat fee.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Parce que le paiement sur la chaîne est plus rapide que Lightning',
              en: 'Because on-chain payment is faster than Lightning',
            },
            isCorrect: false,
            feedback: {
              fr: 'C’est l’inverse : sur la chaîne il faut attendre 10 à 60 minutes de confirmation.',
              en: 'It is the opposite: on-chain requires waiting 10 to 60 minutes for confirmation.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Parce que Lightning oblige à payer 850 sats de frais supplémentaires',
              en: 'Because Lightning forces you to pay an extra 850-sat fee',
            },
            isCorrect: false,
            feedback: {
              fr: 'Non, 850 sats est le coût élevé de la chaîne principale ; Lightning ne coûte qu’environ 1 sat.',
              en: 'No, 850 sats is the high on-chain fee; Lightning costs only around 1 sat.',
            },
          },
        ],
      },
      {
        id: 'l3-q2',
        prompt: {
          fr: localizeQuotes('2. Qu’appelle-t-on le temps de « confirmation » sur la chaîne principale Bitcoin ?', 'fr'),
          en: localizeQuotes('2. What is "confirmation" time on the main Bitcoin blockchain?', 'en'),
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Le temps (souvent 10 à 60 minutes) nécessaire pour inscrire définitivement un paiement dans un bloc Bitcoin',
              en: 'The time (often 10 to 60 minutes) needed to permanently record an on-chain payment in a Bitcoin block',
            },
            isCorrect: true,
            feedback: {
              fr: 'Bravo ! C’est pour éviter cette longue attente au comptoir qu’on utilise Lightning au marché.',
              en: 'Well done! Avoiding that long wait at the counter is why vendors use Lightning at the market.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Un coup de téléphone à la banque du quartier',
              en: 'A phone call to the neighborhood bank',
            },
            isCorrect: false,
            feedback: {
              fr: 'Il n’y a pas de banque centrale dans Bitcoin : ce sont les ordinateurs du réseau qui valident les blocs.',
              en: 'There is no bank to call in Bitcoin—the network computers validate blocks.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'L’heure de fermeture du marché le soir',
              en: 'The closing hour of the market in the evening',
            },
            isCorrect: false,
            feedback: {
              fr: 'Non, Bitcoin fonctionne 24h/24, mais un bloc sur la chaîne prend environ 10 minutes.',
              en: 'No, Bitcoin runs 24/7, but confirming a block on-chain takes around 10+ minutes.',
            },
          },
        ],
      },
    ],
  },
  4: {
    id: 4,
    badge: {
      fr: 'Leçon 4 sur 6 · Canaux & Liquidité',
      en: 'Lesson 4 of 6 · Channels & Liquidity',
    },
    shortNavTitle: {
      fr: '4. Liquidité',
      en: '4. Liquidity',
    },
    title: {
      fr: 'Quand votre canal manque de place pour recevoir',
      en: 'When your channel lacks room to receive',
    },
    subtitle: {
      fr: 'Le client veut payer 600 sats mais votre canal ne peut recevoir que 300 sats. Réglez le problème de liquidité !',
      en: 'The customer wants to pay 600 sats, but your channel only has 300 sats of receiving capacity. Fix the liquidity!',
    },
    customerName: 'Ibrahim',
    customerRole: {
      fr: 'Acheteur pour toute sa famille',
      en: 'Shopping for his whole family',
    },
    termsTaught: ['liquidity', 'channel', 'sats'],
    whatYouLearnedTitle: {
      fr: 'Ce que vous venez d’apprendre : Canaux et Liquidité',
      en: 'What you just learned: Channels and Liquidity',
    },
    whatYouLearnedPoints: {
      fr: [
        localizeQuotes('Un « canal » Lightning a une taille fixe : pour recevoir des sats, il faut avoir assez de « liquidité entrante » (place libre de l’autre côté du pont).', 'fr'),
        'Si un client essaie d’envoyer 600 sats alors que votre canal n’a que 300 sats de capacité entrante, le paiement ne peut pas passer.',
        'Deux solutions simples : augmenter la capacité de votre canal (recharger/ouvrir) OU encaisser un montant plus petit adapté au canal (300 sats).',
      ],
      en: [
        localizeQuotes('A Lightning "channel" has a fixed capacity: to receive sats, you need enough "inbound liquidity" (available receiving room).', 'en'),
        'If a customer tries to send 600 sats when your channel only has 300 sats of receiving capacity, the payment cannot fit.',
        'Two practical fixes: top up/expand your channel capacity OR ask the customer to pay a smaller amount that fits (300 sats).',
      ],
    },
    realWorldTip: {
      fr: localizeQuotes('Astuce du marché : Avant une grosse journée de marché, vérifiez toujours que votre capacité à recevoir (« liquidité entrante ») est suffisante.', 'fr'),
      en: localizeQuotes('Market tip: Before a busy market day, always check that your receiving capacity ("inbound liquidity") has plenty of room.', 'en'),
    },
    questions: [
      {
        id: 'l4-q1',
        prompt: {
          fr: '1. Pourquoi le paiement de 600 sats d’Ibrahim a-t-il échoué au premier essai ?',
          en: '1. Why did Ibrahim’s 600-sat payment fail on the first try?',
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Parce que votre canal n’avait que 300 sats de capacité à recevoir (liquidité entrante)',
              en: 'Because your channel only had 300 sats of receiving capacity (inbound liquidity)',
            },
            isCorrect: true,
            feedback: {
              fr: 'Exact ! Un paiement de 600 sats ne peut pas passer dans un canal qui n’a que 300 sats de place disponible pour recevoir.',
              en: 'Correct! A 600-sat payment cannot fit through a channel that only has 300 sats of available receiving room.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Parce que le réseau Internet était coupé dans tout le pays',
              en: 'Because the internet was down across the whole country',
            },
            isCorrect: false,
            feedback: {
              fr: 'Non, la connexion fonctionnait : c’était uniquement une limite de capacité du canal.',
              en: 'No, the connection was fine—it was strictly a channel capacity limit.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Parce que la facture était expirée depuis hier',
              en: 'Because the invoice had expired yesterday',
            },
            isCorrect: false,
            feedback: {
              fr: 'Non, la facture était active, mais le montant dépassait la liquidité entrante de 300 sats.',
              en: 'No, the invoice was active, but the amount exceeded the 300-sat inbound liquidity.',
            },
          },
        ],
      },
      {
        id: 'l4-q2',
        prompt: {
          fr: '2. Comment pouvez-vous résoudre un manque de capacité à recevoir dans votre canal ?',
          en: '2. How can you solve a lack of receiving capacity in your channel?',
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Augmenter la capacité du canal (+500 sats) ou demander au client de payer un montant plus petit (300 sats)',
              en: 'Top up the channel capacity (+500 sats) or ask the customer to pay a smaller amount (300 sats)',
            },
            isCorrect: true,
            feedback: {
              fr: 'Parfait ! Ces deux solutions permettent au paiement de passer immédiatement.',
              en: 'Spot on! Either expanding the channel capacity or splitting into a smaller amount lets the payment go through.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Éteindre votre téléphone et abandonner la vente',
              en: 'Turn off your phone and give up on the sale',
            },
            isCorrect: false,
            feedback: {
              fr: 'Pas besoin d’abandonner la vente : ajustez le montant ou rechargez le canal !',
              en: 'No need to lose a sale—just adjust the invoice amount or top up your channel!',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Donner vos 12 mots secrets au client',
              en: 'Give your 12 secret words to the customer',
            },
            isCorrect: false,
            feedback: {
              fr: 'Jamais ! Vos mots secrets ne doivent jamais être partagés.',
              en: 'Never! Your secret words must never be shared.',
            },
          },
        ],
      },
    ],
  },
  5: {
    id: 5,
    badge: {
      fr: 'Leçon 5 sur 6 · Routage',
      en: 'Lesson 5 of 6 · Routing',
    },
    shortNavTitle: {
      fr: '5. Routage',
      en: '5. Routing',
    },
    title: {
      fr: 'Le routage : payer à travers deux autres nœuds',
      en: 'Routing: paying across two other nodes',
    },
    subtitle: {
      fr: 'Suivez le chemin animé d’un paiement qui saute par 2 relais intermédiaires et voyez les petits frais de chaque saut.',
      en: 'Watch the animated path of a payment hopping across 2 relay nodes and see the tiny fee each hop takes.',
    },
    customerName: 'Koffi',
    customerRole: {
      fr: 'Client venu d’un autre quartier',
      en: 'Shopper visiting from another town',
    },
    termsTaught: ['routing', 'channel', 'fees'],
    whatYouLearnedTitle: {
      fr: 'Ce que vous venez d’apprendre : Le Routage multi-sauts',
      en: 'What you just learned: Multi-hop Routing',
    },
    whatYouLearnedPoints: {
      fr: [
        'Vous n’avez pas besoin d’ouvrir un canal direct avec chaque client du marché.',
        localizeQuotes('Grâce au « routage », les sats sautent de nœud en nœud (ex: Client → Coopérative → Grossiste → Votre Étal) en moins d’une seconde.', 'fr'),
        'Chaque nœud intermédiaire garde 1 ou 2 sats de frais de passage payés par l’acheteur, et vous recevez 100 % du montant de votre facture (500 sats).',
      ],
      en: [
        'You do not need a direct channel with every single shopper in the market.',
        localizeQuotes('Through "routing", sats hop from node to node (Customer → Co-op Node → Wholesale Relay → Your Stall) in under a second.', 'en'),
        'Each intermediate node takes 1 or 2 sats as a routing fee paid by the buyer, while you still receive 100% of your invoice amount (500 sats).',
      ],
    },
    realWorldTip: {
      fr: 'Astuce du marché : Il suffit d’être relié à un bon nœud du marché pour pouvoir encaisser des clients du monde entier !',
      en: 'Market tip: Being connected to just one well-connected market node lets you accept payments from customers anywhere!',
    },
    questions: [
      {
        id: 'l5-q1',
        prompt: {
          fr: '1. Koffi n’a pas de canal direct avec votre étal, mais il est relié à la Coopérative qui est reliée à votre Grossiste. Peut-il vous payer ?',
          en: '1. Koffi has no direct channel with your stall, but is linked to the Co-op which connects to your Wholesale Relay. Can he pay you?',
        },
        options: [
          {
            id: 'a',
            text: {
              fr: localizeQuotes('Oui, Lightning fait « sauter » le paiement à travers les deux nœuds intermédiaires automatiquement (routage)', 'fr'),
              en: 'Yes, Lightning automatically hops the payment across the two intermediate nodes (routing)',
            },
            isCorrect: true,
            feedback: {
              fr: 'Exactement ! C’est la magie du réseau : le paiement trouve son chemin en quelques millisecondes.',
              en: 'Exactly! That is the power of a network: the payment finds a path in milliseconds.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Non, il est obligatoire d’avoir un canal direct avec chaque client',
              en: 'No, you must open a separate direct channel with every customer',
            },
            isCorrect: false,
            feedback: {
              fr: 'Heureusement non ! Le routage évite d’avoir à ouvrir un canal avec chaque client.',
              en: 'Thankfully no! Routing means you never need a direct channel with every buyer.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Il doit marcher jusqu’à la Coopérative pour déposer des billets',
              en: 'He has to walk over to the Co-op building to hand over paper cash',
            },
            isCorrect: false,
            feedback: {
              fr: 'Tout se fait instantanément entre les téléphones sur le réseau Lightning.',
              en: 'Everything happens digitally and instantly across the Lightning Network.',
            },
          },
        ],
      },
      {
        id: 'l5-q2',
        prompt: {
          fr: '2. Votre facture est de 500 sats. Le Nœud 1 prend 2 sats de frais et le Nœud 2 prend 1 sat. Combien recevez-vous dans votre caisse ?',
          en: '2. Your invoice is for 500 sats. Hop 1 takes a 2-sat fee and Hop 2 takes 1 sat. How much do you receive in your stall balance?',
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Vous recevez exactement 500 sats (Koffi a envoyé 503 sats au départ pour couvrir les 3 sats de routage)',
              en: 'You receive the full 500 sats (Koffi sent 503 sats at the start to cover the 3 sats of routing fees)',
            },
            isCorrect: true,
            feedback: {
              fr: 'Bravo ! Le vendeur reçoit toujours le montant exact de sa facture ; les petits frais de saut sont ajoutés côté payeur.',
              en: 'Well done! The seller always receives the exact invoice amount; the tiny hop fees are added on the sender’s side.',
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Vous ne recevez que 100 sats',
              en: 'You only receive 100 sats',
            },
            isCorrect: false,
            feedback: {
              fr: 'Non ! Vous recevez l’intégralité des 500 sats demandés sur votre facture.',
              en: 'No! You receive the full 500 sats requested on your invoice.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Les nœuds intermédiaires gardent tout l’argent',
              en: 'The intermediate nodes keep all the money',
            },
            isCorrect: false,
            feedback: {
              fr: 'Impossible sur Lightning : soit le paiement arrive chez vous en entier, soit rien ne bouge.',
              en: 'Impossible on Lightning: either the full payment reaches you, or nothing moves at all.',
            },
          },
        ],
      },
    ],
  },
  6: {
    id: 6,
    badge: {
      fr: 'Leçon 6 sur 6 · Sécurité & Arnaques',
      en: 'Lesson 6 of 6 · Safety & Scams',
    },
    shortNavTitle: {
      fr: '6. Sécurité',
      en: '6. Safety',
    },
    title: {
      fr: 'Repérer les 3 arnaques au marché',
      en: 'Spot the 3 market scams',
    },
    subtitle: {
      fr: localizeQuotes('Trois courtes scènes : une fausse facture, un piège « payez d’abord pour recevoir », et un lien de phishing. Déjouez-les !', 'fr'),
      en: localizeQuotes('Three short scenes: a fake wrong-amount invoice, a "pay first to receive" trick, and a phishing link. Spot every red flag!', 'en'),
    },
    customerName: 'Inspecteur Sékou',
    customerRole: {
      fr: 'Formateur sécurité du marché',
      en: 'Market safety trainer',
    },
    termsTaught: ['safety', 'keys', 'invoice'],
    whatYouLearnedTitle: {
      fr: 'Ce que vous venez d’apprendre : Sécurité et Clés secrètes',
      en: 'What you just learned: Safety and Secret Keys',
    },
    whatYouLearnedPoints: {
      fr: [
        'Arnaque 1 (Fausse facture / mauvais montant) : Créez toujours la facture vous-même et vérifiez le montant exact en sats sur VOTRE propre écran.',
        localizeQuotes('Arnaque 2 (« Payez d’abord pour recevoir ») : On ne paie jamais une facture pour recevoir de l’argent. Payer une facture fait toujours sortir vos sats.', 'fr'),
        localizeQuotes('Arnaque 3 (Lien de phishing) : Ne donnez et ne tapez JAMAIS vos 12 ou 24 mots secrets (« clés privées ») sur un site web ou par message.', 'fr'),
      ],
      en: [
        'Scam 1 (Fake invoice / wrong amount): Always create the invoice yourself and verify the exact sat amount on YOUR own phone screen.',
        localizeQuotes('Scam 2 ("Pay first to receive"): Never pay an invoice to receive money. Paying an invoice always sends your sats out.', 'en'),
        localizeQuotes('Scam 3 (Phishing link): NEVER share or type your 12 or 24 secret recovery words ("private keys") on any website or message.', 'en'),
      ],
    },
    realWorldTip: {
      fr: 'Règle d’or : Vos 12 mots secrets sont la clé du cadenas de votre caisse. Gardez-les écrits sur papier en lieu sûr, jamais sur Internet.',
      en: 'Golden rule: Your 12 secret words are the key to your cashbox padlock. Keep them written on paper in a safe place, never online.',
    },
    questions: [
      {
        id: 'l6-q1',
        prompt: {
          fr: localizeQuotes('1. Un inconnu vous dit : « Scanne ma facture de 200 sats pour débloquer une prime de 5 000 sats ! » Que faites-vous ?', 'fr'),
          en: localizeQuotes('1. A stranger says: "Scan my 200-sat invoice first to unlock a 5,000-sat market grant!" What do you do?', 'en'),
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Vous refusez : sur Lightning, on ne paie jamais pour recevoir de l’argent',
              en: 'You refuse: on Lightning, you never pay an invoice in order to receive money',
            },
            isCorrect: true,
            feedback: {
              fr: localizeQuotes('Bravo ! Scanner et payer une facture fait sortir vos sats : c’est l’arnaque classique du « payez d’abord ».', 'fr'),
              en: localizeQuotes('Well done! Paying an invoice sends your sats out—that is the classic "pay first to receive" scam.', 'en'),
            },
          },
          {
            id: 'b',
            text: {
              fr: 'Vous payez vite les 200 sats avant que l’offre n’expire',
              en: 'You quickly pay the 200 sats before the offer expires',
            },
            isCorrect: false,
            feedback: {
              fr: 'Attention ! La fausse urgence est une ruse pour vous faire perdre 200 sats.',
              en: 'Careful! Fake urgency is a trick to steal your 200 sats.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Vous lui prêtez votre téléphone déverrouillé',
              en: 'You hand him your unlocked phone',
            },
            isCorrect: false,
            feedback: {
              fr: 'Ne confiez jamais votre téléphone déverrouillé à un inconnu.',
              en: 'Never hand your unlocked phone to a stranger.',
            },
          },
        ],
      },
      {
        id: 'l6-q2',
        prompt: {
          fr: '2. Qui a le droit de connaître vos 12 ou 24 mots secrets (vos clés de récupération) ?',
          en: '2. Who should ever know your 12 or 24 secret recovery words (your private keys)?',
        },
        options: [
          {
            id: 'a',
            text: {
              fr: 'Personne d’autre que vous : ne les tapez jamais sur un lien reçu par SMS ou message (phishing)',
              en: 'Nobody but you: never type them into any link sent by SMS or chat (phishing)',
            },
            isCorrect: true,
            feedback: {
              fr: 'Exactement ! Vos 12 mots secrets donnent le contrôle total de vos sats. Gardez-les secrets hors ligne.',
              en: 'Spot on! Your 12 secret words give total control over your sats. Keep them strictly private and offline.',
            },
          },
          {
            id: 'b',
            text: {
              fr: localizeQuotes('Toute personne qui se présente comme le « Support Technique »', 'fr'),
              en: localizeQuotes('Anyone who claims to be "Technical Support"', 'en'),
            },
            isCorrect: false,
            feedback: {
              fr: 'Un vrai support technique ne demande JAMAIS vos 12 mots secrets.',
              en: 'Real technical support will NEVER ask for your 12 secret words.',
            },
          },
          {
            id: 'c',
            text: {
              fr: 'Il faut les afficher sur une pancarte devant votre étal',
              en: 'You should write them on a sign in front of your stall',
            },
            isCorrect: false,
            feedback: {
              fr: 'Surtout pas ! N’importe qui pourrait alors prendre tous vos sats.',
              en: 'Definitely not! Anyone who sees your recovery words can take all your sats.',
            },
          },
        ],
      },
    ],
  },
};

export const UI_TEXT = {
  appName: {
    fr: 'Marché Éclair',
    en: 'Marché Éclair',
  },
  tagline: {
    fr: 'Apprenez les paiements Bitcoin Lightning derrière votre étal de marché',
    en: 'Learn Bitcoin Lightning payments from behind your market stall',
  },
  nav: {
    home: { fr: 'Accueil & Étal', en: 'Home & Stall' },
    market: { fr: 'Marché', en: 'Market' },
    lessonCard: { fr: 'Carte Leçon', en: 'Lesson Card' },
    progress: { fr: 'Progrès', en: 'Progress' },
  },
  practiceBadge: {
    fr: 'Mode Pratique · Sats de jeu (aucun vrai argent)',
    en: 'Practice Mode · Play sats (no real money)',
  },
  walletBalanceLabel: {
    fr: 'Caisse de l’étal',
    en: 'Stall Balance',
  },
};
