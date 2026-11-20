import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  CoachAnswerResponse,
  CoachAnswerResponseSchema,
  CoachQuestionRequest,
  CustomerDialogueRequest,
  CustomerDialogueResponse,
  CustomerDialogueResponseSchema,
} from '../shared/validation';
import {
  executeWithResilience,
  getScriptedCoachAnswer,
  getScriptedCustomerDialogue,
  ResilientResult,
  sanitizeCoachAnswer,
  sanitizeCustomerDialogue,
  sanitizeUntrustedDisplayText,
} from '../shared/aiCharacters';
import { LESSONS, LessonId } from '../data/content';

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const LESSON_SCENARIO_BRIEF: Record<
  LessonId,
  { behaviour: string; concepts: string }
> = {
  1: {
    behaviour:
      'Customer Amina is in a hurry before the rain, asks for a Lightning invoice, scans the QR code, and pays immediately.',
    concepts: 'sats (tiny units of Bitcoin) and Lightning invoice (a payment request with the amount already inside).',
  },
  2: {
    behaviour:
      'Customer Moussa gets distracted helping a neighbor lift a sack, comes back too late after the invoice expires, sees his late payment rejected safely without losing sats.',
    concepts: 'invoice expiry (built-in countdown timer on a Lightning invoice that rejects late payments safely).',
  },
  3: {
    behaviour:
      'Customer Fatou compares paying on the main Bitcoin chain (~30 minutes wait, 850 sats fee) vs paying over Lightning (1 second, 1 sat fee) and chooses Lightning.',
    concepts: 'network fees and block confirmation waiting time vs instant Lightning payments.',
  },
  4: {
    behaviour:
      'Customer Ibrahim tries to pay 600 sats, which fails because the vendor channel only has 300 sats of inbound receiving capacity (liquidity); fixed by topping up channel capacity or paying a smaller 300-sat invoice.',
    concepts: 'payment channels and inbound liquidity (available receiving capacity in a channel).',
  },
  5: {
    behaviour:
      'Customer Koffi visits from another neighborhood with no direct channel to the vendor; his 500-sat payment hops across 2 intermediate nodes (Co-op Node taking 2 sats fee, Wholesale Relay taking 1 sat fee).',
    concepts: 'multi-hop routing across connected nodes and small forwarding hop fees.',
  },
  6: {
    behaviour:
      'Market Safety Inspector Sékou helps the vendor spot 3 classic counter scams: a fake screenshot with the wrong amount (50 vs 500 sats), a pay-first-to-receive trick, and a phishing link asking for 12 secret recovery words.',
    concepts: 'wallet safety (always check your own screen) and private recovery keys (never share the 12 secret words).',
  },
};

export async function generateCustomerDialogue(
  req: CustomerDialogueRequest
): Promise<ResilientResult<CustomerDialogueResponse>> {
  const lessonId = (req.lessonId as LessonId) || 1;
  const lesson = LESSONS[lessonId] ?? LESSONS[1];
  const scenario = LESSON_SCENARIO_BRIEF[lessonId] ?? LESSON_SCENARIO_BRIEF[1];
  const safeItem = sanitizeUntrustedDisplayText(req.itemName);

  return executeWithResilience<CustomerDialogueResponse>(
    async () => {
      const ai = getGenAIClient();
      if (!ai) {
        throw new Error('NO_API_KEY');
      }

      const langLabel =
        req.language === 'fr'
          ? 'French (West African market warmth, plain everyday words, no jargon)'
          : 'English (West African market warmth, plain everyday words, no jargon)';

      const prompt = [
        `Generate a short, natural market customer dialogue for Lesson ${lessonId} of "Marché Éclair".`,
        `Language: ${langLabel}.`,
        `Character name: "${lesson.customerName}" (${lesson.customerRole[req.language]}).`,
        `Market stall type: ${req.stallId}.`,
        `Item being sold: "${safeItem}" for ${req.amountSats} sats.`,
        `Current scene stage: "${req.stage}".`,
        `Lesson behaviour & scenario: ${scenario.behaviour}`,
        `Concepts taught in this lesson: ${scenario.concepts}`,
        'Return JSON with customerName, 3 or 4 short natural spoken lines (each under 140 characters, plain words, no HTML, no URLs), and a 1-sentence conceptHint explaining the technical term simply.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You roleplay a friendly West African market customer or market inspector in an educational game teaching Bitcoin Lightning to beginners. Use plain everyday words, avoid stereotypes, never include HTML tags or links, never ask for personal data, and keep lines to 3 or 4 short sentences.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customerName: {
                type: Type.STRING,
                description: 'The name of the customer character.',
              },
              lines: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '3 or 4 short spoken dialogue lines from the customer in the requested language.',
              },
              conceptHint: {
                type: Type.STRING,
                description:
                  'One short plain-language sentence explaining the Lightning concept in this scene.',
              },
            },
            required: ['customerName', 'lines', 'conceptHint'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      return JSON.parse(rawText);
    },
    CustomerDialogueResponseSchema,
    sanitizeCustomerDialogue,
    () => getScriptedCustomerDialogue(req),
    { timeoutMs: 8000, maxRetries: 2, baseBackoffMs: 250 }
  );
}

export async function generateCoachAnswer(
  req: CoachQuestionRequest
): Promise<ResilientResult<CoachAnswerResponse>> {
  const lessonId = (req.lessonId as LessonId) || 1;
  const lesson = LESSONS[lessonId] ?? LESSONS[1];
  const scenario = LESSON_SCENARIO_BRIEF[lessonId] ?? LESSON_SCENARIO_BRIEF[1];
  const safeQuestion = sanitizeUntrustedDisplayText(req.question);
  const safeRecentEvent = sanitizeUntrustedDisplayText(req.recentEvent ?? '');

  // If the question asks for financial/investment advice, short-circuit deterministically
  if (
    /invest|acheter du bitcoin|buy bitcoin|prix|price|rich|riche|trading|specul|conseil financier|financial advice/i.test(
      safeQuestion
    )
  ) {
    return {
      data: getScriptedCoachAnswer(req),
      source: 'scripted-fallback',
      attempts: 0,
    };
  }

  return executeWithResilience<CoachAnswerResponse>(
    async () => {
      const ai = getGenAIClient();
      if (!ai) {
        throw new Error('NO_API_KEY');
      }

      const langLabel =
        req.language === 'fr'
          ? 'French (simple everyday words, warm and encouraging)'
          : 'English (simple everyday words, warm and encouraging)';

      const prompt = [
        `Current lesson: Lesson ${lessonId} — "${lesson.title[req.language]}".`,
        `Lesson scenario: ${scenario.behaviour}`,
        `Only explain these Lightning concepts from Lesson ${lessonId}: ${scenario.concepts}`,
        safeRecentEvent ? `Recent scene event: ${safeRecentEvent}` : '',
        `Learner's "why did that happen?" question: "${safeQuestion}"`,
        `Language: ${langLabel}.`,
        'Return JSON with answerLines (2 to 4 short sentences in simple words), keyTakeaway (1 short sentence), and noFinancialAdviceDisclaimer (1 short sentence stating this is educational only and never financial advice).',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are Tantie Awa (Auntie Awa), a warm, neutral, encouraging market coach in West Africa. You answer "why did that happen?" questions about the current Lightning lesson using simple everyday market analogies. CRITICAL RULES: (1) NEVER give financial, investment, price, or trading advice. (2) ONLY explain the Lightning payment concepts in the current lesson. (3) Never output HTML tags, URLs, or wallet commands.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answerLines: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '2 to 4 short plain-language sentences answering why that happened in the current lesson.',
              },
              keyTakeaway: {
                type: Type.STRING,
                description: 'One short summary sentence of the concept.',
              },
              noFinancialAdviceDisclaimer: {
                type: Type.STRING,
                description:
                  'Short reminder that the coach only explains Lightning mechanics and never gives financial advice.',
              },
            },
            required: [
              'answerLines',
              'keyTakeaway',
              'noFinancialAdviceDisclaimer',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      return JSON.parse(rawText);
    },
    CoachAnswerResponseSchema,
    sanitizeCoachAnswer,
    () => getScriptedCoachAnswer(req),
    { timeoutMs: 8000, maxRetries: 2, baseBackoffMs: 250 }
  );
}
