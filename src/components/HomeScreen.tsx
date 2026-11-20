import React from 'react';
import { Check, ArrowRight, Globe, Sparkles } from 'lucide-react';
import {
  ALL_LESSON_IDS,
  Language,
  LessonId,
  STALLS,
  StallId,
  TERMS,
} from '../data/content';
import { localizeQuotes } from '../shared/localizeQuotes';
import { LazyStallIllustration } from './LazyIllustrations';
import { LightningBoltSvg } from './LightningBoltIcon';
import { MarketStreetMap } from './MarketStreetMap';
import { SatsPurseJar } from './SatsPurseJar';

interface HomeScreenProps {
  lang: Language;
  selectedStall: StallId;
  completedLessons: LessonId[];
  quizScores: Record<number, number>;
  hintsUsedByLesson: Record<number, number>;
  balanceSats: number;
  onSelectLanguage: (lang: Language) => void;
  onSelectStall: (stall: StallId) => void;
  onStartLesson: (lessonId: LessonId) => void;
}

export function HomeScreen({
  lang,
  selectedStall,
  completedLessons,
  quizScores,
  hintsUsedByLesson,
  balanceSats,
  onSelectLanguage,
  onSelectStall,
  onStartLesson,
}: HomeScreenProps) {
  const stallList = Object.values(STALLS);
  const currentStall = STALLS[selectedStall];
  const nextLessonId: LessonId =
    ALL_LESSON_IDS.find((id) => !completedLessons.includes(id)) ?? 1;

  return (
    <div className="space-y-8">
      {/* Hero Banner with Language Switcher & Intro */}
      <section className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 sm:p-7 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#1F2A6B]/15">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-[#D9582B]">
              <LightningBoltSvg className="w-5 h-5" />
              <span>
                {lang === 'fr'
                  ? 'Jeu d’apprentissage pratique · Afrique de l’Ouest'
                  : 'Hands-on market learning game · West Africa'}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-4xl text-[#1F2A6B] leading-tight">
              {lang === 'fr'
                ? 'Bienvenue au Marché Éclair : apprenez Bitcoin Lightning derrière votre étal'
                : 'Welcome to Marché Éclair: learn Bitcoin Lightning behind your market stall'}
            </h1>
            <p className="text-[17px] text-[#1B1B1F] leading-relaxed">
              {localizeQuotes(
                lang === 'fr'
                  ? 'Vous n’avez jamais utilisé Bitcoin ? Aucun problème. Ici, tout est expliqué avec les mots simples du marché, avec des « sats » d’entraînement gratuits.'
                  : 'Never used Bitcoin before? No problem. Here, everything is explained in plain everyday market words using free practice "sats".',
                lang
              )}
            </p>
          </div>

          {/* Language Selector (48px+ touch targets) */}
          <div
            role="group"
            aria-label={lang === 'fr' ? 'Choisir la langue' : 'Choose language'}
            className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0"
          >
            <div className="flex items-center gap-1.5 px-2 text-sm font-bold text-[#1F2A6B]">
              <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{lang === 'fr' ? 'Langue :' : 'Language:'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSelectLanguage('fr')}
                aria-pressed={lang === 'fr'}
                className={`min-h-[48px] px-4 py-2 rounded-2xl font-bold text-base inline-flex items-center justify-center gap-1.5 border-2 transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'fr'
                    ? 'bg-[#1F2A6B] text-[#FFF6E5] border-[#1B1B1F]'
                    : 'bg-white text-[#1B1B1F] border-transparent hover:border-[#1F2A6B]'
                }`}
              >
                {lang === 'fr' && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                <span>Français</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectLanguage('en')}
                aria-pressed={lang === 'en'}
                className={`min-h-[48px] px-4 py-2 rounded-2xl font-bold text-base inline-flex items-center justify-center gap-1.5 border-2 transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'en'
                    ? 'bg-[#1F2A6B] text-[#FFF6E5] border-[#1B1B1F]'
                    : 'bg-white text-[#1B1B1F] border-transparent hover:border-[#1F2A6B]'
                }`}
              >
                {lang === 'en' && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                <span>English</span>
              </button>
            </div>
          </div>
        </div>

        {/* First-time Plain-Word Introduction to the 3 Key Terms */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['sats', 'lightning', 'invoice'] as const).map((termKey, idx) => {
            const term = TERMS[termKey];
            return (
              <div
                key={termKey}
                className="bg-[#FFF6E5] border border-[#1F2A6B]/30 rounded-2xl p-4 space-y-1.5"
              >
                <div className="text-sm font-bold text-[#D9582B]">
                  {lang === 'fr' ? `Mot clé 0${idx + 1}` : `Key word 0${idx + 1}`}
                </div>
                <h2 className="font-display font-bold text-lg text-[#1F2A6B]">
                  {term.term[lang]}
                </h2>
                <p className="text-[17px] text-[#1B1B1F] leading-snug">
                  {term.plainMeaning[lang]}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Step 1: Choose Your Market Stall */}
      <section aria-labelledby="choose-stall-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="choose-stall-heading"
              className="font-display font-extrabold text-xl sm:text-2xl text-[#1F2A6B]"
            >
              {lang === 'fr'
                ? '1. Choisissez votre étal au marché'
                : '1. Choose your market stall'}
            </h2>
            <p className="text-[17px] text-[#1B1B1F]">
              {lang === 'fr'
                ? 'Quel commerce voulez-vous tenir aujourd’hui ? Les clients achèteront vos produits en sats.'
                : 'Which stall would you like to run today? Customers will buy your goods using sats.'}
            </p>
          </div>
          <SatsPurseJar balanceSats={balanceSats} lang={lang} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {stallList.map((stall) => {
            const isSelected = stall.id === selectedStall;
            return (
              <button
                key={stall.id}
                type="button"
                onClick={() => onSelectStall(stall.id)}
                aria-pressed={isSelected}
                className={`text-left rounded-2xl p-4 sm:p-5 border-2 transition-all flex flex-col justify-between gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F2A6B] ${
                  isSelected
                    ? 'bg-[#FFFDF9] border-[#1F2A6B] shadow-md ring-2 ring-[#F2B01E]'
                    : 'bg-[#FFFDF9]/80 border-[#1B1B1F]/25 hover:border-[#1F2A6B]'
                }`}
              >
                <div className="space-y-3 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-extrabold text-xl text-[#1F2A6B]">
                      {stall.name[lang]}
                    </span>
                    <span
                      className={`min-h-[36px] px-3 py-1 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]'
                          : 'bg-[#FFF6E5] text-[#1B1B1F] border-[#1B1B1F]/30'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{lang === 'fr' ? 'Choisie' : 'Selected'}</span>
                        </>
                      ) : (
                        <span>{lang === 'fr' ? 'Choisir' : 'Choose'}</span>
                      )}
                    </span>
                  </div>

                  <LazyStallIllustration
                    stallId={stall.id}
                    className="w-full h-36"
                  />

                  <p className="text-[17px] text-[#1B1B1F] leading-snug">
                    {stall.subtitle[lang]}
                  </p>
                </div>

                <div className="w-full pt-3 border-t border-[#1B1B1F]/15 flex items-center justify-between text-sm text-[#1F2A6B] font-bold tabular-nums">
                  <span>{stall.lesson1Item.name[lang]}</span>
                  <span>{stall.lesson1Item.amountSats} sats</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Market Street Progress Map (6 Stall Nodes: locked, unlocked, completed, 1-3 stars) */}
      <section
        aria-labelledby="choose-lesson-heading"
        className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 sm:p-7 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2
              id="choose-lesson-heading"
              className="font-display font-extrabold text-xl sm:text-2xl text-[#1F2A6B]"
            >
              {lang === 'fr'
                ? `2. Allée du Marché : ouvrez votre ${currentStall.name.fr}`
                : `2. Market Street: open your ${currentStall.name.en}`}
            </h2>
            <p className="text-[17px] text-[#1B1B1F]">
              {lang === 'fr'
                ? '6 étals le long de l’allée : débloquez chaque étape et gagnez 1 à 3 étoiles.'
                : '6 stalls along the street: unlock each stop and earn 1 to 3 stars.'}
            </p>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={() => onStartLesson(nextLessonId)}
            className="min-h-[52px] px-6 py-3 rounded-2xl bg-[#D9582B] hover:bg-[#c0481f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2.5 shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>
              {lang === 'fr'
                ? `Ouvrir l’étal · Leçon ${nextLessonId}`
                : `Open Stall · Start Lesson ${nextLessonId}`}
            </span>
            <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
          </button>
        </div>

        <MarketStreetMap
          lang={lang}
          completedLessons={completedLessons}
          quizScores={quizScores}
          hintsUsedByLesson={hintsUsedByLesson}
          onSelectLesson={onStartLesson}
        />
      </section>
    </div>
  );
}

