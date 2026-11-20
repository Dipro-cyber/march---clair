import {
  CoachAnswerResponse,
  CoachAnswerResponseSchema,
  CoachQuestionRequest,
  CustomerDialogueRequest,
  CustomerDialogueResponse,
  CustomerDialogueResponseSchema,
} from './validation';
import { Language, LessonId, LESSONS } from '../data/content';

/**
 * Escapes raw HTML special characters (&, <, >, ", ') so untrusted text
 * can never be interpreted as HTML markup or executable script.
 */
export function escapeHtmlEntities(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes untrusted AI/customer text into safe display-only plain text.
 * - Strips any HTML/script tags, angle brackets, and control characters
 * - Blocks javascript:/data: URIs or API path references so AI output can never trigger wallet actions
 * - Round-trips through HTML entity escaping to guarantee zero raw markup characters
 */
export function sanitizeUntrustedDisplayText(raw: string): string {
  const withoutTags = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/\/api\/wallet[^\s]*/gi, '')
    .replace(/&(?:quot|#0*34|#x0*22);/gi, '"')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Verify via escapeHtmlEntities that no raw < or > remain, while keeping readable quotes for React text nodes
  const escaped = escapeHtmlEntities(withoutTags);
  return escaped
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '’')
    .replace(/&amp;/g, 'et')
    .replace(/&lt;/g, '')
    .replace(/&gt;/g, '')
    .trim();
}

export function sanitizeCustomerDialogue(
  dialogue: CustomerDialogueResponse
): CustomerDialogueResponse {
  return {
    customerName: sanitizeUntrustedDisplayText(dialogue.customerName).slice(0, 60),
    lines: dialogue.lines
      .slice(0, 4)
      .map((line) => sanitizeUntrustedDisplayText(line).slice(0, 240))
      .filter((line) => line.length > 0),
    conceptHint: sanitizeUntrustedDisplayText(dialogue.conceptHint).slice(0, 220),
  };
}

export function sanitizeCoachAnswer(
  answer: CoachAnswerResponse
): CoachAnswerResponse {
  return {
    answerLines: answer.answerLines
      .slice(0, 4)
      .map((line) => sanitizeUntrustedDisplayText(line).slice(0, 260))
      .filter((line) => line.length > 0),
    keyTakeaway: sanitizeUntrustedDisplayText(answer.keyTakeaway).slice(0, 200),
    noFinancialAdviceDisclaimer: sanitizeUntrustedDisplayText(
      answer.noFinancialAdviceDisclaimer
    ).slice(0, 180),
  };
}

/**
 * Extracts HTTP status code from an unknown error object if present.
 */
export function extractErrorStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const record = err as Record<string, unknown>;
  if (typeof record.status === 'number') return record.status;
  if (typeof record.statusCode === 'number') return record.statusCode;
  if (typeof record.code === 'number') return record.code;
  if (typeof record.message === 'string') {
    const match = record.message.match(/\b(429|50[0-9]|40[0-9])\b/);
    if (match) return Number(match[1]);
  }
  return null;
}

/**
 * Returns true ONLY for HTTP 429 (Too Many Requests) and 5xx (Server Errors).
 */
export function isRetryableAiError(err: unknown): boolean {
  const status = extractErrorStatus(err);
  if (status === null) return false;
  return status === 429 || (status >= 500 && status <= 599);
}

export interface ResilienceOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface ResilientResult<T> {
  data: T;
  source: 'ai' | 'scripted-fallback';
  attempts: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Executes an async AI operation with:
 * - Strict total timeout (default 8,000 ms)
 * - Retry ONLY on 429 and 5xx errors with exponential backoff
 * - Zod schema validation of the AI output
 * - Instant fallback to scripted dialogue/answer on timeout, non-retryable error, or validation failure
 */
export async function executeWithResilience<T>(
  operation: (signal: AbortSignal) => Promise<unknown>,
  schema: { safeParse: (val: unknown) => { success: boolean; data?: T } },
  sanitizeFn: (val: T) => T,
  fallbackFn: () => T,
  options: ResilienceOptions = {}
): Promise<ResilientResult<T>> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxRetries = options.maxRetries ?? 2;
  const baseBackoffMs = options.baseBackoffMs ?? 250;
  const sleep = options.sleepFn ?? defaultSleep;

  const deadline = Date.now() + timeoutMs;
  let attempts = 0;

  while (attempts <= maxRetries) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 20) {
      return {
        data: fallbackFn(),
        source: 'scripted-fallback',
        attempts,
      };
    }

    attempts += 1;
    const controller = new AbortController();
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        controller.abort();
        reject(new Error('AI_TIMEOUT'));
      }, remainingMs);
    });

    try {
      const rawResult = await Promise.race([
        operation(controller.signal),
        timeoutPromise,
      ]);
      if (timerId) clearTimeout(timerId);

      const parsed = schema.safeParse(rawResult);
      if (!parsed.success || !parsed.data) {
        return {
          data: fallbackFn(),
          source: 'scripted-fallback',
          attempts,
        };
      }

      const sanitized = sanitizeFn(parsed.data);
      const revalidated = schema.safeParse(sanitized);
      if (!revalidated.success || !revalidated.data) {
        return {
          data: fallbackFn(),
          source: 'scripted-fallback',
          attempts,
        };
      }

      return {
        data: revalidated.data,
        source: 'ai',
        attempts,
      };
    } catch (err) {
      if (timerId) clearTimeout(timerId);

      // Do not retry if timeout expired or error is not 429/5xx
      const canRetry =
        attempts <= maxRetries &&
        isRetryableAiError(err) &&
        deadline - Date.now() > baseBackoffMs;

      if (!canRetry) {
        return {
          data: fallbackFn(),
          source: 'scripted-fallback',
          attempts,
        };
      }

      const backoffMs = Math.min(
        baseBackoffMs * Math.pow(2, attempts - 1),
        Math.max(10, deadline - Date.now() - 20)
      );
      await sleep(backoffMs);
    }
  }

  return {
    data: fallbackFn(),
    source: 'scripted-fallback',
    attempts,
  };
}

/**
 * Deterministic 3-to-4 line scripted dialogue for every lesson and stage.
 * Used when Data Saver is enabled or when Gemini falls back.
 */
export function getScriptedCustomerDialogue(
  req: CustomerDialogueRequest
): CustomerDialogueResponse {
  const lessonId = (req.lessonId as LessonId) || 1;
  const lesson = LESSONS[lessonId] ?? LESSONS[1];
  const customerName = lesson.customerName;
  const lang = req.language;
  const item = sanitizeUntrustedDisplayText(req.itemName);
  const sats = req.amountSats;

  if (lessonId === 1) {
    if (req.stage === 'pending') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                `Je vois ton code QR pour ${item} à ${sats} sats.`,
                'Le montant et la note sont déjà inscrits dans la facture.',
                'Appuie sur le bouton vert pour me montrer la facture et je paie tout de suite !',
              ]
            : [
                `I see your QR code for ${item} at ${sats} sats.`,
                'The amount and note are already written inside the invoice.',
                'Tap the green button to show me the invoice and I will pay right away!',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Une facture Lightning contient déjà le prix exact en sats.'
            : 'A Lightning invoice already contains the exact price in sats.',
      };
    }
    if (req.stage === 'paid') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                'Bip ! Mon téléphone confirme que le paiement est parti.',
                `Tes ${sats} sats sont arrivés dans ta caisse en moins d’une seconde.`,
                'Merci pour la rapidité, à demain au marché !',
              ]
            : [
                'Beep! My phone confirms the payment went through.',
                `Your ${sats} sats arrived in your stall balance in under a second.`,
                'Thanks for the fast service, see you at the market tomorrow!',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Les paiements Lightning mettent à jour votre caisse instantanément.'
            : 'Lightning payments update your stall balance immediately.',
      };
    }
    return {
      customerName,
      lines:
        lang === 'fr'
          ? [
              `Bonjour ! Je voudrais acheter : ${item} (${sats} sats).`,
              'Je suis pressée avant la pluie, as-tu un portefeuille Lightning ?',
              'Prépare-moi une facture avec le montant et je scanne ton code QR !',
            ]
          : [
              `Hello! I would like to buy: ${item} (${sats} sats).`,
              'I am in a hurry before the rain starts, do you have a Lightning wallet?',
              'Create an invoice with the amount and I will scan your QR code!',
            ],
      conceptHint:
        lang === 'fr'
          ? 'Les « sats » sont de petites pièces de Bitcoin ; la « facture » est la demande de paiement.'
          : '"Sats" are tiny coins of Bitcoin; an "invoice" is a payment request.',
    };
  }

  if (lessonId === 2) {
    if (req.stage === 'pending') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                `Merci pour la facture de ${sats} sats pour ${item}.`,
                'Oh attends ! Mon voisin m’appelle pour décharger un camion au bout de l’allée.',
                'Garde mon article, je reviens payer dans un moment !',
              ]
            : [
                `Thanks for the ${sats}-sat invoice for ${item}.`,
                'Oh wait! My neighbor is calling me to help unload a truck down the aisle.',
                'Hold my item, I will come back to pay in a moment!',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Chaque facture Lightning possède un compte à rebours avant expiration.'
            : 'Every Lightning invoice has a countdown timer before it expires.',
      };
    }
    if (req.stage === 'expired') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                'Pardon pour le retard, l’allée était embouteillée !',
                'Mon téléphone affiche : « Facture expirée — paiement refusé ».',
                'Mes sats n’ont pas bougé : crée-moi une nouvelle facture fraîche ou passe au quiz !',
              ]
            : [
                'Sorry for the delay, the market aisle was jammed!',
                'My phone says: "Invoice expired — payment rejected".',
                'My sats never left my wallet: create a fresh invoice for me or continue to the quiz!',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Une facture expirée refuse automatiquement les paiements en retard : aucun sat n’est perdu.'
            : 'An expired invoice automatically blocks late payments: no sats are lost.',
      };
    }
    if (req.stage === 'paid') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                'Cette fois j’ai scanné la nouvelle facture sans attendre !',
                `Les ${sats} sats sont bien arrivés dans ta caisse.`,
                'C’est rassurant de savoir qu’une vieille facture expirée ne perd jamais l’argent.',
              ]
            : [
                'This time I scanned the fresh invoice without waiting!',
                `The ${sats} sats arrived safely in your stall balance.`,
                'It is reassuring to know an old expired invoice never loses money.',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Quand une facture expire, il suffit d’en créer une nouvelle gratuitement.'
            : 'When an invoice expires, simply create a fresh one for free.',
      };
    }
    return {
      customerName,
      lines:
        lang === 'fr'
          ? [
              `Salut ! Mets-moi de côté : ${item} (${sats} sats).`,
              'Prépare la facture Lightning pendant que je cherche mon téléphone dans mon sac.',
              'Voyons ce qui se passe si je mets trop de temps à payer !',
            ]
          : [
              `Hi there! Please set aside: ${item} (${sats} sats).`,
              'Create the Lightning invoice while I look for my phone in my bag.',
              'Let’s see what happens if I take too long to pay!',
            ],
      conceptHint:
        lang === 'fr'
          ? 'Nouveau mot : « Expiration » — la durée de validité d’une facture Lightning.'
          : 'New word: "Expiry" — the time limit on a Lightning invoice.',
    };
  }

  if (lessonId === 3) {
    if (req.stage === 'pending') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                `Regarde ce comparatif pour ${sats} sats !`,
                'Sur la chaîne principale, je paierais 850 sats de frais et j’attendrais 30 minutes.',
                'Sur Lightning, c’est 1 seconde et 1 seul sat de frais : encaisse-moi par Lightning !',
              ]
            : [
                `Look at this comparison for ${sats} sats!`,
                'On the main chain, I would pay 850 sats in fees and wait 30 minutes.',
                'On Lightning, it takes 1 second and a 1-sat fee: let’s pay via Lightning!',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Lightning évite d’attendre la confirmation d’un bloc sur la chaîne principale.'
            : 'Lightning avoids waiting for a block confirmation on the main chain.',
      };
    }
    if (req.stage === 'paid') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                'Payé en 1 seconde avec seulement 1 sat de frais !',
                'Imagine si on avait dû attendre 30 minutes debout au soleil pour la confirmation.',
                'Pour les achats du marché, Lightning est vraiment imbattable.',
              ]
            : [
                'Paid in 1 second with only a 1-sat fee!',
                'Imagine if we had to stand in the sun for 30 minutes waiting for confirmation.',
                'For everyday market sales, Lightning is unbeatable.',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Frais minuscules (1 sat) et règlement instantané (1 seconde).'
            : 'Tiny fee (1 sat) and instant settlement (1 second).',
      };
    }
    return {
      customerName,
      lines:
        lang === 'fr'
          ? [
              `Bonjour ! Je prends : ${item} (${sats} sats).`,
              'Mon cousin m’a parlé de la chaîne principale Bitcoin, mais tu préfères Lightning.',
              'Crée la facture pour qu’on compare les frais et le temps d’attente !',
            ]
          : [
              `Hello! I will take: ${item} (${sats} sats).`,
              'My cousin told me about main-chain Bitcoin, why do you prefer Lightning?',
              'Create the invoice so we can compare the fees and waiting time!',
            ],
      conceptHint:
        lang === 'fr'
          ? 'Nouveaux mots : « Frais » (coût d’envoi) et « Confirmation » (attente d’un bloc).'
          : 'New words: "Fees" (cost to send) and "Confirmation" (waiting for a block).',
    };
  }

  if (lessonId === 4) {
    if (req.stage === 'failed_capacity') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                `Mon paiement de ${sats} sats est bloqué : ton canal n’a que 300 sats de capacité pour recevoir !`,
                'C’est comme un panier trop petit pour contenir toute ma commande d’un coup.',
                'Tu peux soit recharger la capacité de ton canal (+500 sats), soit me faire une facture de 300 sats.',
              ]
            : [
                `My ${sats}-sat payment is blocked: your channel only has 300 sats of receiving capacity!`,
                'It is like a basket with only enough room for half my order.',
                'You can either top up your channel capacity (+500 sats) or issue me a 300-sat invoice.',
              ],
        conceptHint:
          lang === 'fr'
            ? 'La liquidité entrante est la place libre dans votre canal pour recevoir des sats.'
            : 'Inbound liquidity is the open room in your channel to receive sats.',
      };
    }
    if (req.stage === 'paid') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                'Super, le paiement est passé sans problème maintenant !',
                'Quand la capacité du canal est suffisante, les sats glissent tout seuls.',
                'Merci d’avoir réglé ce souci de liquidité si vite !',
              ]
            : [
                'Great, the payment went right through now!',
                'When your channel has enough receiving capacity, sats flow smoothly.',
                'Thanks for solving that liquidity limit so quickly!',
              ],
        conceptHint:
          lang === 'fr'
            ? 'On résout un manque de liquidité en agrandissant le canal ou en réduisant le montant.'
            : 'Fix a liquidity shortage by topping up channel capacity or splitting the amount.',
      };
    }
    return {
      customerName,
      lines:
        lang === 'fr'
          ? [
              `Bonjour ! Je voudrais : ${item} (${sats} sats).`,
              'Attention, ton canal avec le Relais du Marché n’a plus que 300 sats de place disponible.',
              'Crée la facture de 600 sats et essaie de m’encaisser pour voir ce qui se passe !',
            ]
          : [
              `Hello! I would like: ${item} (${sats} sats).`,
              'Heads up, your channel with the Market Relay only has 300 sats of open receiving room.',
              'Create the 600-sat invoice and try taking my payment to see what happens!',
            ],
      conceptHint:
        lang === 'fr'
          ? 'Nouveau mot : « Liquidité » — la capacité disponible dans un canal pour recevoir.'
          : 'New word: "Liquidity" — the open capacity in a channel to receive.',
    };
  }

  if (lessonId === 5) {
    if (req.stage === 'pending') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                `Ta facture est de ${sats} sats pour ${item}.`,
                'Mon portefeuille a trouvé une route en 2 sauts : Coopérative (2 sats) puis Relais Grossiste (1 sat).',
                'Lance le paiement routé pour voir les sats sauter de nœud en nœud !',
              ]
            : [
                `Your invoice is for ${sats} sats for ${item}.`,
                'My wallet found a 2-hop route: Co-op Node (2 sats) then Wholesale Relay (1 sat).',
                'Run the routed payment to watch the sats hop from node to node!',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Chaque nœud intermédiaire prend un minuscule frais de passage (1 à 2 sats).'
            : 'Each intermediate node takes a tiny forwarding fee (1 to 2 sats).',
      };
    }
    if (req.stage === 'paid') {
      return {
        customerName,
        lines:
          lang === 'fr'
            ? [
                `J’ai envoyé ${sats + 3} sats au total (dont 3 sats de frais de routage).`,
                'La Coopérative a gardé 2 sats, le Relais 1 sat, et tu as reçu tes 500 sats complets !',
                'Pas besoin d’ouvrir un canal avec chaque client du pays.',
              ]
            : [
                `I sent ${sats + 3} sats total (including 3 sats in routing fees).`,
                'The Co-op kept 2 sats, the Relay kept 1 sat, and you received your full 500 sats!',
                'No need to open a direct channel with every customer in the country.',
              ],
        conceptHint:
          lang === 'fr'
            ? 'Le routage relie acheteurs et vendeurs à travers des nœuds relais.'
            : 'Routing connects buyers and sellers across relay nodes.',
      };
    }
    return {
      customerName,
      lines:
        lang === 'fr'
          ? [
              `Bonjour ! Je viens d’un autre quartier pour acheter : ${item} (${sats} sats).`,
              'Je n’ai pas de canal direct avec ton étal, mais je suis relié à la Coopérative.',
              'Crée la facture pour voir comment Lightning trouve un chemin automatiquement !',
            ]
          : [
              `Hello! I am visiting from another neighborhood to buy: ${item} (${sats} sats).`,
              'I have no direct channel with your stall, but I am connected to the Co-op.',
              'Create the invoice to see how Lightning automatically finds a path!',
            ],
      conceptHint:
        lang === 'fr'
          ? 'Nouveau mot : « Routage » — faire sauter un paiement à travers plusieurs nœuds.'
          : 'New word: "Routing" — hopping a payment across multiple nodes.',
    };
  }

  // Lesson 6: Scams & Safety
  return {
    customerName,
    lines:
      lang === 'fr'
        ? [
            'Bonjour ! Je suis l’Inspecteur Sékou, chargé de la sécurité du marché.',
            'Trois escrocs rodant autour des étals essaient de piéger les vendeurs pressés.',
            'Examine les 3 scènes ci-contre et choisis la réaction qui protège ta caisse et tes clés !',
          ]
        : [
            'Hello! I am Inspector Sékou, in charge of market safety.',
            'Three scammers around the stalls are trying to trick busy vendors.',
            'Inspect the 3 scenes on the right and choose the reaction that protects your stall and keys!',
          ],
    conceptHint:
      lang === 'fr'
        ? 'Mots clés : « Sécurité » (vérifier son propre écran) et « Clés secrètes » (12 mots à garder secrets).'
        : 'Key words: "Safety" (check your own screen) and "Secret Keys" (12 words to keep private).',
  };
}

/**
 * Preset "Why did that happen?" questions per lesson so users on mobile phones
 * can tap once to ask the Friendly Coach without typing.
 */
export const COACH_PRESET_QUESTIONS: Record<
  LessonId,
  Record<Language, string[]>
> = {
  1: {
    fr: [
      'Pourquoi ma caisse a-t-elle augmenté dès qu’Amina a scanné la facture ?',
      'Pourquoi le prix est-il déjà écrit dans le code QR de la facture ?',
    ],
    en: [
      'Why did my stall balance go up as soon as Amina scanned the invoice?',
      'Why is the price already written inside the invoice QR code?',
    ],
  },
  2: {
    fr: [
      'Pourquoi le paiement de Moussa a-t-il été refusé après l’expiration ?',
      'Où sont les sats de Moussa quand une facture expire ?',
    ],
    en: [
      'Why was Moussa’s payment rejected after the invoice expired?',
      'Where are Moussa’s sats when an invoice expires?',
    ],
  },
  3: {
    fr: [
      'Pourquoi la chaîne principale Bitcoin prend-elle 30 minutes et 850 sats ?',
      'Pourquoi Lightning ne coûte-t-il qu’un seul sat de frais ?',
    ],
    en: [
      'Why does the main Bitcoin chain take 30 minutes and 850 sats?',
      'Why does Lightning only cost a 1-sat fee?',
    ],
  },
  4: {
    fr: [
      'Pourquoi le paiement de 600 sats d’Ibrahim a-t-il été bloqué ?',
      'Quelle est la différence entre recharger le canal et réduire la facture ?',
    ],
    en: [
      'Why was Ibrahim’s 600-sat payment blocked?',
      'What is the difference between topping up the channel and reducing the invoice?',
    ],
  },
  5: {
    fr: [
      'Comment Koffi a-t-il pu me payer sans canal direct avec mon étal ?',
      'Pourquoi Koffi a-t-il payé 503 sats alors que ma facture était de 500 sats ?',
    ],
    en: [
      'How could Koffi pay me without a direct channel to my stall?',
      'Why did Koffi pay 503 sats when my invoice was for 500 sats?',
    ],
  },
  6: {
    fr: [
      'Pourquoi ne faut-il jamais payer des sats pour débloquer un paiement entrant ?',
      'Que se passe-t-il si je donne mes 12 mots secrets sur un site web ?',
    ],
    en: [
      'Why do you never pay sats first to unlock an incoming payment?',
      'What happens if I type my 12 secret words into a website?',
    ],
  },
};

/**
 * Deterministic Scripted Coach Answer for "Why did that happen?" questions.
 * Used when Data Saver is ON or if Gemini fails/times out.
 */
export function getScriptedCoachAnswer(
  req: CoachQuestionRequest
): CoachAnswerResponse {
  const lessonId = (req.lessonId as LessonId) || 1;
  const lang = req.language;
  const qLower = req.question.toLowerCase();

  const disclaimer =
    lang === 'fr'
      ? 'Note du Coach : J’explique uniquement le fonctionnement technique de Lightning dans cette leçon, sans jamais donner de conseil financier.'
      : 'Coach Note: I only explain how Lightning works in this lesson and never give financial advice.';

  // If user asks about investment/price/trading, politely decline and explain the current lesson concept
  if (
    /invest|acheter du bitcoin|buy bitcoin|prix|price|rich|riche|trading|specul|conseil financier|financial advice/i.test(
      qLower
    )
  ) {
    return {
      answerLines:
        lang === 'fr'
          ? [
              'Je suis Tantie Awa, votre coach de marché : je ne donne jamais de conseils financiers ni de prédictions de prix.',
              `Dans cette Leçon ${lessonId}, nous apprenons uniquement comment fonctionne l’outil de paiement Lightning au comptoir.`,
              'Posez-moi plutôt une question sur ce qui vient de se passer avec votre facture ou votre canal !',
            ]
          : [
              'I am Auntie Awa, your market coach: I never give financial advice or price predictions.',
              `In Lesson ${lessonId}, we only focus on how the Lightning payment tool works at the stall counter.`,
              'Ask me instead about what just happened with your invoice or payment channel!',
            ],
      keyTakeaway:
        lang === 'fr'
          ? 'Marché Éclair enseigne uniquement la mécanique des paiements Lightning, jamais la spéculation.'
          : 'Marché Éclair only teaches Lightning payment mechanics, never financial speculation.',
      noFinancialAdviceDisclaimer: disclaimer,
    };
  }

  switch (lessonId) {
    case 1:
      return {
        answerLines:
          lang === 'fr'
            ? [
                'Quand tu crées une facture Lightning, le prix en sats et le motif sont verrouillés dans le code QR.',
                'Dès qu’Amina scanne et valide sur son téléphone, les sats glissent directement dans votre canal sans intermédiaire lent.',
                'C’est pour cela que ta caisse affiche immédiatement « PAYÉE ✓ » et ajoute les sats !',
              ]
            : [
                'When you create a Lightning invoice, the price in sats and memo are locked inside the QR code.',
                'As soon as Amina scans and confirms on her phone, the sats slide directly through your channel.',
                'That is why your stall balance immediately shows "PAID ✓" and adds the sats!',
              ],
        keyTakeaway:
          lang === 'fr'
            ? 'Une facture Lightning fixe le montant à l’avance et règle le paiement en une seconde.'
            : 'A Lightning invoice locks in the amount upfront and settles the payment in one second.',
        noFinancialAdviceDisclaimer: disclaimer,
      };

    case 2:
      return {
        answerLines:
          lang === 'fr'
            ? [
                'Chaque facture Lightning contient une heure limite (souvent quelques minutes) pour éviter les paiements oubliés.',
                'Comme Moussa a attendu que le compte à rebours tombe à zéro, le réseau a automatiquement fermé cette facture.',
                'Ses sats n’ont jamais quitté son téléphone : il suffit de créer une nouvelle facture gratuite pour encaisser !',
              ]
            : [
                'Every Lightning invoice includes a built-in time limit so old requests do not stay open forever.',
                'Because Moussa waited until the countdown reached zero, the network automatically closed that invoice.',
                'His sats never left his phone: simply create a fresh invoice for free to get paid!',
              ],
        keyTakeaway:
          lang === 'fr'
            ? 'Une facture expirée bloque le paiement en retard : personne ne perd ses sats.'
            : 'An expired invoice blocks late payments safely: nobody loses their sats.',
        noFinancialAdviceDisclaimer: disclaimer,
      };

    case 3:
      return {
        answerLines:
          lang === 'fr'
            ? [
                'La chaîne principale Bitcoin (« on-chain ») enregistre chaque transaction dans le grand livre mondial, ce qui demande ~10 à 30 minutes et des frais élevés.',
                'Lightning utilise un canal déjà ouvert au marché : on met à jour l’ardoise instantanément sans attendre un bloc.',
                'Résultat : Fatou paie en 1 seconde avec seulement 1 sat de frais au lieu de 850 sats !',
              ]
            : [
                'The main Bitcoin chain ("on-chain") records every transaction in the global ledger, taking ~10 to 30 minutes and high fees.',
                'Lightning uses an already-open market channel: it updates the balance sheet right away without waiting for a block.',
                'Result: Fatou pays in 1 second with just a 1-sat fee instead of 850 sats!',
              ],
        keyTakeaway:
          lang === 'fr'
            ? 'Lightning est fait pour les petits achats rapides ; la chaîne principale est pour les gros règlements rares.'
            : 'Lightning is built for fast everyday sales; the main chain is for rare large settlements.',
        noFinancialAdviceDisclaimer: disclaimer,
      };

    case 4:
      return {
        answerLines:
          lang === 'fr'
            ? [
                'Un canal Lightning a une capacité fixe : le côté « capacité à recevoir » (liquidité entrante) indique combien de sats peuvent encore entrer.',
                'Ton canal n’avait que 300 sats de place libre, donc un paiement de 600 sats ne pouvait pas rentrer d’un seul coup.',
                'En rechargeant la capacité (+500 sats) ou en faisant une facture de 300 sats, le paiement passe immédiatement !',
              ]
            : [
                'A Lightning channel has a fixed capacity: your "receiving capacity" (inbound liquidity) shows how many more sats can fit in.',
                'Your channel only had 300 sats of open room, so a 600-sat payment could not fit all at once.',
                'By topping up channel capacity (+500 sats) or issuing a 300-sat invoice, the payment fits right through!',
              ],
        keyTakeaway:
          lang === 'fr'
            ? 'Pour recevoir un paiement, votre canal doit avoir au moins autant de liquidité entrante que le montant de la facture.'
            : 'To receive a payment, your channel needs at least as much inbound liquidity as the invoice amount.',
        noFinancialAdviceDisclaimer: disclaimer,
      };

    case 5:
      return {
        answerLines:
          lang === 'fr'
            ? [
                'Grâce au routage, Koffi n’a pas besoin d’un canal direct avec toi : le réseau cherche un chemin de nœuds connectés.',
                'Le paiement a sauté par la Coopérative (2 sats de frais) puis le Relais Grossiste (1 sat de frais) jusqu’à ton étal.',
                'Koffi a payé 503 sats au total, et ta caisse a reçu exactement les 500 sats demandés sur ta facture !',
              ]
            : [
                'Thanks to routing, Koffi does not need a direct channel with you: the network finds a connected path of nodes.',
                'The payment hopped through the Co-op (2-sat fee) and the Wholesale Relay (1-sat fee) to reach your stall.',
                'Koffi paid 503 sats in total, and your stall received the exact 500 sats requested on your invoice!',
              ],
        keyTakeaway:
          lang === 'fr'
            ? 'Le routage fait sauter les sats à travers plusieurs nœuds contre quelques sats de frais de passage.'
            : 'Routing hops sats across intermediate nodes for a tiny forwarding fee of a few sats.',
        noFinancialAdviceDisclaimer: disclaimer,
      };

    case 6:
    default:
      return {
        answerLines:
          lang === 'fr'
            ? [
                'Sur Lightning, recevoir de l’argent est gratuit : vous créez une facture et vous attendez « PAYÉE ✓ » sur votre propre téléphone.',
                'Un vrai service ne vous demandera jamais de payer d’abord pour débloquer un gain, ni de taper vos 12 mots secrets.',
                'Vos 12 mots secrets (clés privées) donnent accès à toute votre caisse : gardez-les hors ligne sur papier !',
              ]
            : [
                'On Lightning, receiving money is free: you create an invoice and wait for "PAID ✓" on your own phone screen.',
                'A real service will never ask you to send sats first to unlock a payout, or to type in your 12 secret words.',
                'Your 12 secret words (private keys) control your entire wallet: keep them offline on paper!',
              ],
        keyTakeaway:
          lang === 'fr'
            ? 'Vérifiez toujours votre propre écran et ne partagez jamais vos 12 mots secrets.'
            : 'Always verify your own screen and never share your 12 secret recovery words.',
        noFinancialAdviceDisclaimer: disclaimer,
      };
  }
}

export const CustomerDialogueSchemaForResilience = CustomerDialogueResponseSchema;
export const CoachAnswerSchemaForResilience = CoachAnswerResponseSchema;
