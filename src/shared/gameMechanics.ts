import { ALL_LESSON_IDS, LessonId } from '../data/content';

export type StallNodeState = 'completed' | 'unlocked' | 'locked';

export type CustomerMoodState =
  | 'entering'
  | 'waiting'
  | 'happy-leaving'
  | 'confused-leaving';

export interface MarketStreetNode {
  lessonId: LessonId;
  state: StallNodeState;
  stars: 0 | 1 | 2 | 3;
  quizScore: number;
  hintsUsed: number;
}

export interface GameExtrasState {
  hintsUsedByLesson: Record<number, number>;
  soundEnabled: boolean;
}

export const GAME_EXTRAS_STORAGE_KEY = 'marche_eclair_game_extras_v1';

export const DEFAULT_GAME_EXTRAS: GameExtrasState = {
  hintsUsedByLesson: {},
  soundEnabled: false, // Off by default per specification
};

/**
 * Pure calculation of 1 to 3 stars for a completed lesson based on
 * 2-question quiz score (0..2) and hints used (coach questions / extra hints).
 * - Not completed: 0 stars
 * - Completed with 2/2 quiz answers and 0 hints used: 3 stars
 * - Completed with 2/2 quiz answers and >=1 hints used, OR 1/2 quiz answers and 0 hints used: 2 stars
 * - Completed otherwise: 1 star
 */
export function computeLessonStars(
  quizScore: number | undefined,
  hintsUsed: number,
  isCompleted: boolean
): 0 | 1 | 2 | 3 {
  if (!isCompleted) {
    return 0;
  }
  const score = quizScore ?? 0;
  const safeHints = Math.max(0, hintsUsed);

  if (score >= 2 && safeHints === 0) {
    return 3;
  }
  if (score >= 2 || (score === 1 && safeHints === 0)) {
    return 2;
  }
  return 1;
}

/**
 * Computes the 6 stall nodes for the "Market Street" progress map:
 * - completed: in completedLessons
 * - unlocked: lesson 1, or the lesson immediately following a completed lesson
 * - locked: subsequent lessons not yet unlocked
 */
export function computeMarketStreetNodes(
  completedLessons: LessonId[],
  quizScores: Record<number, number>,
  hintsUsedByLesson: Record<number, number> = {}
): MarketStreetNode[] {
  return ALL_LESSON_IDS.map((lessonId) => {
    const isCompleted = completedLessons.includes(lessonId);
    const prevLessonId = (lessonId - 1) as LessonId;
    const isUnlocked =
      lessonId === 1 ||
      isCompleted ||
      completedLessons.includes(prevLessonId);

    const state: StallNodeState = isCompleted
      ? 'completed'
      : isUnlocked
      ? 'unlocked'
      : 'locked';

    const quizScore = quizScores[lessonId] ?? 0;
    const hintsUsed = hintsUsedByLesson[lessonId] ?? 0;
    const stars = computeLessonStars(quizScore, hintsUsed, isCompleted);

    return {
      lessonId,
      state,
      stars,
      quizScore,
      hintsUsed,
    };
  });
}

/**
 * Pure derivation of the customer character's animation & mood state at the stall.
 */
export function deriveCustomerSceneMood(params: {
  isEntering: boolean;
  invoiceStatus?: 'PENDING' | 'PAID' | 'EXPIRED';
  capacityFailedOnce: boolean;
  allScamsSpotted: boolean;
  hasUnsafeScamChoice: boolean;
}): CustomerMoodState {
  if (params.invoiceStatus === 'PAID' || params.allScamsSpotted) {
    return 'happy-leaving';
  }
  if (
    params.invoiceStatus === 'EXPIRED' ||
    params.capacityFailedOnce ||
    params.hasUnsafeScamChoice
  ) {
    return 'confused-leaving';
  }
  if (params.isEntering) {
    return 'entering';
  }
  return 'waiting';
}

export function loadGameExtras(): GameExtrasState {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_GAME_EXTRAS };
  }
  try {
    const raw = window.localStorage.getItem(GAME_EXTRAS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GAME_EXTRAS };
    const parsed = JSON.parse(raw);
    return {
      hintsUsedByLesson:
        parsed.hintsUsedByLesson && typeof parsed.hintsUsedByLesson === 'object'
          ? parsed.hintsUsedByLesson
          : {},
      soundEnabled: Boolean(parsed.soundEnabled),
    };
  } catch {
    return { ...DEFAULT_GAME_EXTRAS };
  }
}

export function saveGameExtras(state: GameExtrasState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GAME_EXTRAS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordHintUsed(
  current: GameExtrasState,
  lessonId: LessonId
): GameExtrasState {
  const prevCount = current.hintsUsedByLesson[lessonId] ?? 0;
  return {
    ...current,
    hintsUsedByLesson: {
      ...current.hintsUsedByLesson,
      [lessonId]: prevCount + 1,
    },
  };
}
