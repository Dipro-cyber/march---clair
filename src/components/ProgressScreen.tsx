import React from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Language,
  LessonId,
  STALLS,
  StallId,
  TERMS,
} from '../data/content';
import { NetworkState } from '../shared/simWallet';
import { LazyStallIllustration } from './LazyIllustrations';
import { MarketStreetMap } from './MarketStreetMap';
import { SatsPurseJar } from './SatsPurseJar';

interface ProgressScreenProps {
  lang: Language;
  selectedStall: StallId;
  completedLessons: LessonId[];
  quizScores: Record<number, number>;
  hintsUsedByLesson: Record<number, number>;
  seenTerms: string[];
  balanceSats: number;
  network: NetworkState | null;
  onStartLesson: (lessonId: LessonId) => void;
  onOpenLessonCard: (lessonId: LessonId) => void;
  onResetAll: () => void;
}

export function ProgressScreen({
  lang,
  selectedStall,
  completedLessons,
  quizScores,
  hintsUsedByLesson,
  seenTerms,
  balanceSats,
  onStartLesson,
  onOpenLessonCard,
  onResetAll,
}: ProgressScreenProps) {
  const stall = STALLS[selectedStall];
  const allTerms = Object.values(TERMS);

  return (
    <div className="space-y-6">
      {/* Summary Header Card */}
      <section className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-[#1B1B1F]/15">
          <div className="space-y-1">
            <div className="text-sm font-bold text-[#D9582B]">
              {lang === 'fr'
                ? 'Carnet de route · Sauvegardé sur votre téléphone'
                : 'Market passbook · Saved on your phone'}
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1F2A6B]">
              {lang === 'fr'
                ? 'Vos Progrès au Marché Éclair'
                : 'Your Progress at Marché Éclair'}
            </h1>
          </div>

          <button
            type="button"
            onClick={onResetAll}
            className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#FFF6E5] hover:bg-white text-[#D9582B] border-2 border-[#D9582B] font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {lang === 'fr'
                ? 'Réinitialiser l’entraînement'
                : 'Reset practice progress'}
            </span>
          </button>
        </div>

        {/* 3 Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-4 space-y-1">
            <div className="text-sm font-bold text-[#1F2A6B]">
              {lang === 'fr' ? 'Leçons terminées' : 'Lessons completed'}
            </div>
            <div
              data-testid="progress-lessons-count"
              className="font-display font-extrabold text-3xl text-[#1F2A6B] tabular-nums"
            >
              {completedLessons.length} / 6
            </div>
            <p className="text-sm text-[#1B1B1F]/80">
              {completedLessons.length === 6
                ? lang === 'fr'
                  ? '✓ Les 6 leçons du marché sont validées !'
                  : '✓ All 6 market lessons completed!'
                : lang === 'fr'
                ? 'Complétez les 6 leçons et leurs quiz.'
                : 'Complete all 6 lessons and their quizzes.'}
            </p>
          </div>

          <div className="bg-[#FFF6E5] border-2 border-[#2E7D4F] rounded-2xl p-4 flex flex-col justify-between gap-2">
            <div className="text-sm font-bold text-[#2E7D4F]">
              {lang === 'fr' ? 'Votre Bourse SimWallet' : 'Your SimWallet Purse'}
            </div>
            <SatsPurseJar balanceSats={balanceSats} lang={lang} />
          </div>

          <div className="bg-[#FFF6E5] border-2 border-[#D9582B] rounded-2xl p-4 space-y-1">
            <div className="text-sm font-bold text-[#D9582B]">
              {lang === 'fr' ? 'Votre étal actif' : 'Your active stall'}
            </div>
            <div className="font-display font-extrabold text-2xl text-[#1B1B1F]">
              {stall.name[lang]}
            </div>
            <p className="text-sm text-[#1B1B1F]/80">{stall.vendorTitle[lang]}</p>
          </div>
        </div>
      </section>

      {/* Market Street Progress Map (6 Stall Nodes: locked, unlocked, completed, 1-3 stars) */}
      <section className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 sm:p-6">
        <MarketStreetMap
          lang={lang}
          completedLessons={completedLessons}
          quizScores={quizScores}
          hintsUsedByLesson={hintsUsedByLesson}
          onSelectLesson={onStartLesson}
          onOpenLessonCard={onOpenLessonCard}
        />
      </section>

      {/* Mastered Glossary Words */}
      <section className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-xl text-[#1F2A6B]">
              {lang === 'fr'
                ? 'Lexique du Marché Éclair (Mots simples)'
                : 'Marché Éclair Glossary (Plain words)'}
            </h2>
            <p className="text-[17px] text-[#1B1B1F]">
              {lang === 'fr'
                ? 'Tous les mots techniques expliqués sans jargon.'
                : 'Every technical term explained without jargon.'}
            </p>
          </div>
          <LazyStallIllustration
            stallId={selectedStall}
            className="w-36 h-20 shrink-0"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allTerms.map((item) => {
            const isSeen = seenTerms.includes(item.key);
            return (
              <div
                key={item.key}
                className="bg-[#FFF6E5] border-2 border-[#1F2A6B]/30 rounded-2xl p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-lg text-[#1F2A6B]">
                    {item.term[lang]}
                  </h3>
                  {isSeen && (
                    <span className="text-xs font-bold text-[#2E7D4F]">
                      {lang === 'fr' ? '✓ Vu en leçon' : '✓ Seen in lesson'}
                    </span>
                  )}
                </div>
                <p className="text-[17px] text-[#1B1B1F]">{item.plainMeaning[lang]}</p>
                <p className="text-sm font-semibold text-[#D9582B]">
                  {item.marketAnalogy[lang]}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

