import React from 'react';
import {
  Award,
  Check,
  Lock,
  ArrowRight,
  Sparkles,
  Store,
} from 'lucide-react';
import {
  Language,
  LessonId,
  LESSONS,
} from '../data/content';
import {
  computeMarketStreetNodes,
  MarketStreetNode,
} from '../shared/gameMechanics';

interface MarketStreetMapProps {
  lang: Language;
  completedLessons: LessonId[];
  quizScores: Record<number, number>;
  hintsUsedByLesson: Record<number, number>;
  activeLesson?: LessonId;
  compact?: boolean;
  onSelectLesson: (lessonId: LessonId) => void;
  onOpenLessonCard?: (lessonId: LessonId) => void;
}

function StarRow({
  stars,
  isCompleted,
  lang,
}: {
  stars: 0 | 1 | 2 | 3;
  isCompleted: boolean;
  lang: Language;
}) {
  const label = isCompleted
    ? lang === 'fr'
      ? `${stars} sur 3 étoiles`
      : `${stars} of 3 stars`
    : lang === 'fr'
    ? '0 sur 3 étoiles (non terminée)'
    : '0 of 3 stars (not completed)';

  return (
    <div
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-0.5"
    >
      {[1, 2, 3].map((idx) => {
        const filled = idx <= stars;
        return (
          <svg
            key={idx}
            viewBox="0 0 20 20"
            className="w-4 h-4 shrink-0"
            aria-hidden="true"
          >
            <path
              d="M10 1.8L12.5 6.9L18.1 7.7L14 11.7L15 17.3L10 14.6L5 17.3L6 11.7L1.9 7.7L7.5 6.9L10 1.8Z"
              fill={filled ? '#F2B01E' : '#FFF6E5'}
              stroke="#1B1B1F"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
}

function NodeStateBadge({
  node,
  lang,
}: {
  node: MarketStreetNode;
  lang: Language;
}) {
  if (node.state === 'completed') {
    return (
      <span className="px-2.5 py-0.5 rounded-xl bg-[#2E7D4F] text-[#FFF6E5] border border-[#1B1B1F] text-xs font-bold inline-flex items-center gap-1">
        <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{lang === 'fr' ? 'Terminé ✓' : 'Completed ✓'}</span>
      </span>
    );
  }
  if (node.state === 'unlocked') {
    return (
      <span className="px-2.5 py-0.5 rounded-xl bg-[#F2B01E] text-[#1B1B1F] border border-[#1B1B1F] text-xs font-bold inline-flex items-center gap-1">
        <Store className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{lang === 'fr' ? 'Ouvert' : 'Unlocked'}</span>
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-xl bg-[#FFF6E5] text-[#1B1B1F]/80 border border-[#1B1B1F]/40 text-xs font-bold inline-flex items-center gap-1">
      <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{lang === 'fr' ? 'Verrouillé' : 'Locked'}</span>
    </span>
  );
}

/**
 * "Market Street" (Allée du Marché) Progress Map with 6 Stall Nodes (locked, unlocked, completed)
 * and 1 to 3 stars per stall based on quiz answers and hints used.
 */
export function MarketStreetMap({
  lang,
  completedLessons,
  quizScores,
  hintsUsedByLesson,
  activeLesson,
  compact = false,
  onSelectLesson,
  onOpenLessonCard,
}: MarketStreetMapProps) {
  const nodes = computeMarketStreetNodes(
    completedLessons,
    quizScores,
    hintsUsedByLesson
  );
  const totalStars = nodes.reduce((acc, n) => acc + n.stars, 0);

  if (compact) {
    return (
      <div
        data-testid="market-street-map-compact"
        role="group"
        aria-label={
          lang === 'fr'
            ? 'Carte de l’Allée du Marché : Choisir un étal (Leçons 1 à 6)'
            : 'Market Street Progress Map: Select a stall (Lessons 1 to 6)'
        }
        className="space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#1F2A6B]">
          <span>
            {lang === 'fr'
              ? '🗺️ Allée du Marché (6 étals · 1 à 3 ★ selon quiz et indices) :'
              : '🗺️ Market Street Map (6 stalls · 1 to 3 ★ from quiz & hints):'}
          </span>
          <span
            data-testid="market-street-total-stars"
            className="px-2.5 py-0.5 rounded-xl bg-[#FFF6E5] border border-[#1B1B1F] text-[#1B1B1F] tabular-nums"
          >
            ★ {totalStars} / 18
          </span>
        </div>

        {/* 6 Connected Stall Nodes along Market Street */}
        <div className="relative">
          {/* Connecting Market Street Path Line on Desktop */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-1/2 left-6 right-6 h-1.5 -translate-y-1/2 bg-[#D9582B]/35 border-y border-[#1B1B1F]/30 z-0"
          />

          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {nodes.map((node) => {
              const lesson = LESSONS[node.lessonId];
              const isActive = activeLesson === node.lessonId;

              return (
                <button
                  key={node.lessonId}
                  type="button"
                  data-testid={`street-node-${node.lessonId}`}
                  data-node-state={node.state}
                  data-node-stars={node.stars}
                  onClick={() => onSelectLesson(node.lessonId)}
                  aria-pressed={isActive}
                  className={`min-h-[64px] p-2.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#1F2A6B] text-[#FFF6E5] border-[#1B1B1F] ring-2 ring-[#F2B01E]'
                      : node.state === 'completed'
                      ? 'bg-[#FFFDF9] text-[#1B1B1F] border-[#2E7D4F] hover:border-[#1F2A6B]'
                      : node.state === 'unlocked'
                      ? 'bg-[#FFF6E5] text-[#1B1B1F] border-[#1F2A6B] hover:bg-[#FFFDF9]'
                      : 'bg-[#FFF6E5]/70 text-[#1B1B1F]/80 border-[#1B1B1F]/30 hover:border-[#1F2A6B]'
                  }`}
                >
                  {/* Top Row: State Icon + Stars */}
                  <div className="w-full flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-tight">
                      {node.state === 'completed' && (
                        <>
                          <Check className="w-3.5 h-3.5 shrink-0 text-[#2E7D4F] bg-white rounded-full p-0.5" aria-hidden="true" />
                          <span>{lang === 'fr' ? 'Fait' : 'Done'}</span>
                        </>
                      )}
                      {node.state === 'unlocked' && (
                        <>
                          <Store className="w-3.5 h-3.5 shrink-0 text-[#F2B01E]" aria-hidden="true" />
                          <span>{lang === 'fr' ? 'Ouvert' : 'Open'}</span>
                        </>
                      )}
                      {node.state === 'locked' && (
                        <>
                          <Lock className="w-3.5 h-3.5 shrink-0 opacity-75" aria-hidden="true" />
                          <span>{lang === 'fr' ? 'Verrou' : 'Locked'}</span>
                        </>
                      )}
                    </span>

                    <StarRow
                      stars={node.stars}
                      isCompleted={node.state === 'completed'}
                      lang={lang}
                    />
                  </div>

                  {/* Bottom Row: Exact Lesson Short Title */}
                  <div className="font-display font-bold text-sm sm:text-base leading-tight truncate w-full">
                    {lesson.shortNavTitle[lang]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Full Market Street Map for HomeScreen and ProgressScreen
  return (
    <div
      data-testid="market-street-map"
      className="space-y-4"
    >
      {/* Street Map Header Banner with SVG Path Illustration & Star Legend */}
      <div className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="font-display font-extrabold text-lg text-[#1F2A6B] flex items-center gap-2">
            <span>
              {lang === 'fr'
                ? '🗺️ Carte de l’Allée du Marché (6 Étals)'
                : '🗺️ Market Street Progress Map (6 Stalls)'}
            </span>
          </div>
          <p className="text-sm font-semibold text-[#1B1B1F]/85">
            {lang === 'fr'
              ? 'Gagnez jusqu’à 3 étoiles (★★★) par étal : 2/2 au quiz sans indice = 3★ · avec indice = 2★ · leçon terminée = 1★.'
              : 'Earn up to 3 stars (★★★) per stall: 2/2 quiz with 0 hints = 3★ · with hint = 2★ · completed = 1★.'}
          </p>
        </div>

        <div
          data-testid="market-street-total-stars"
          className="px-4 py-2 rounded-2xl bg-[#FFFDF9] border-2 border-[#1B1B1F] font-display font-extrabold text-lg text-[#1F2A6B] inline-flex items-center gap-2 shrink-0 tabular-nums"
        >
          <span className="text-[#F2B01E] text-xl" aria-hidden="true">
            ★
          </span>
          <span>
            {totalStars} / 18 {lang === 'fr' ? 'Étoiles' : 'Stars'}
          </span>
        </div>
      </div>

      {/* Winding Market Path SVG Header */}
      <svg
        viewBox="0 0 900 54"
        fill="none"
        className="w-full h-10 hidden md:block"
        aria-hidden="true"
      >
        <path
          d="M30 27 Q 180 6, 310 27 T 590 27 T 870 27"
          stroke="#D9582B"
          strokeWidth="6"
          strokeDasharray="12 8"
          strokeLinecap="round"
        />
        {nodes.map((node, i) => {
          const cx = 75 + i * 150;
          const fill =
            node.state === 'completed'
              ? '#2E7D4F'
              : node.state === 'unlocked'
              ? '#F2B01E'
              : '#FFF6E5';
          const textFill =
            node.state === 'completed' ? '#FFF6E5' : '#1B1B1F';
          return (
            <g key={node.lessonId}>
              <circle
                cx={cx}
                cy="27"
                r="18"
                fill={fill}
                stroke="#1B1B1F"
                strokeWidth="2.5"
              />
              <text
                x={cx}
                y="32"
                textAnchor="middle"
                fill={textFill}
                fontSize="14"
                fontWeight="800"
              >
                {node.lessonId}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 6 Stall Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodes.map((node) => {
          const lesson = LESSONS[node.lessonId];
          const isCompleted = node.state === 'completed';

          return (
            <div
              key={node.lessonId}
              data-testid={`street-node-card-${node.lessonId}`}
              data-node-state={node.state}
              data-node-stars={node.stars}
              className={`rounded-2xl overflow-hidden border-2 flex flex-col justify-between transition-all ${
                isCompleted
                  ? 'bg-[#FFFDF9] border-[#2E7D4F]'
                  : node.state === 'unlocked'
                  ? 'bg-[#FFFDF9] border-[#1F2A6B] ring-2 ring-[#F2B01E]/60'
                  : 'bg-[#FFF6E5]/80 border-[#1B1B1F]/35'
              }`}
            >
              {/* Mini Striped Stall Awning Roof */}
              <div
                aria-hidden="true"
                className={`h-3 w-full border-b border-[#1B1B1F] ${
                  isCompleted
                    ? 'bg-[#2E7D4F]'
                    : node.state === 'unlocked'
                    ? 'awning-stripes'
                    : 'bg-[#1F2A6B]/30'
                }`}
              />

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  {/* Top Status & Star Rating Row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <NodeStateBadge node={node} lang={lang} />
                    <StarRow
                      stars={node.stars}
                      isCompleted={isCompleted}
                      lang={lang}
                    />
                  </div>

                  <div className="text-xs font-bold text-[#D9582B] flex items-center justify-between gap-2">
                    <span>{lesson.badge[lang]}</span>
                    {isCompleted && (
                      <span className="text-[#1F2A6B] tabular-nums">
                        {lang === 'fr'
                          ? `Quiz ${node.quizScore}/2 · Indices : ${node.hintsUsed}`
                          : `Quiz ${node.quizScore}/2 · Hints: ${node.hintsUsed}`}
                      </span>
                    )}
                  </div>

                  <h3 className="font-display font-bold text-xl text-[#1F2A6B]">
                    {lesson.title[lang]}
                  </h3>

                  <p className="text-[17px] text-[#1B1B1F] leading-snug">
                    {lesson.subtitle[lang]}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#1B1B1F]/15 space-y-2.5">
                  <div className="text-sm font-semibold text-[#1B1B1F]/80 flex items-center justify-between">
                    <span>
                      {lang === 'fr'
                        ? `Client : ${lesson.customerName}`
                        : `Customer: ${lesson.customerName}`}
                    </span>
                    <span className="font-bold text-[#1F2A6B]">
                      {node.stars}/3 ★
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectLesson(node.lessonId)}
                      className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#1F2A6B] hover:bg-[#161e52] text-[#FFF6E5] font-bold text-base inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        {isCompleted
                          ? lang === 'fr'
                            ? `Rejouer n°${node.lessonId}`
                            : `Replay #${node.lessonId}`
                          : lang === 'fr'
                          ? `Jouer la Leçon ${node.lessonId}`
                          : `Play Lesson ${node.lessonId}`}
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                    </button>

                    {onOpenLessonCard && (
                      <button
                        type="button"
                        onClick={() => onOpenLessonCard(node.lessonId)}
                        className="min-h-[48px] px-3.5 py-2.5 rounded-2xl bg-[#FFF6E5] hover:bg-white text-[#1F2A6B] border-2 border-[#1F2A6B] font-bold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'fr' ? 'Carte & Quiz' : 'Card & Quiz'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
