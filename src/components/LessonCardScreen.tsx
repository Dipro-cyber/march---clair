import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle, ArrowRight, Award, Sparkles } from 'lucide-react';
import {
  ALL_LESSON_IDS,
  Language,
  LessonId,
  LESSONS,
  TERMS,
} from '../data/content';
import { LightningBoltSvg } from './LightningBoltIcon';

interface LessonCardScreenProps {
  lang: Language;
  lessonId: LessonId;
  completedLessons: LessonId[];
  quizScores: Record<number, number>;
  onSelectLesson: (lessonId: LessonId) => void;
  onCompleteLesson: (lessonId: LessonId, score: number, terms: string[]) => void;
  onStartNextLesson: (nextLessonId: LessonId) => void;
  onGoToProgress: () => void;
}

export function LessonCardScreen({
  lang,
  lessonId,
  completedLessons,
  quizScores,
  onSelectLesson,
  onCompleteLesson,
  onStartNextLesson,
  onGoToProgress,
}: LessonCardScreenProps) {
  const lesson = LESSONS[lessonId];
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedAnswers({});
  }, [lessonId]);

  const q1 = lesson.questions[0];
  const q2 = lesson.questions[1];

  const ans1 = q1.options.find((o) => o.id === selectedAnswers[q1.id]);
  const ans2 = q2.options.find((o) => o.id === selectedAnswers[q2.id]);

  const bothAnswered = Boolean(ans1 && ans2);
  const currentScore = (ans1?.isCorrect ? 1 : 0) + (ans2?.isCorrect ? 1 : 0);
  const isLessonSaved = completedLessons.includes(lessonId);
  const nextLessonId: LessonId = lessonId < 6 ? ((lessonId + 1) as LessonId) : 1;

  function handleSelectOption(questionId: string, optionId: string) {
    const next = { ...selectedAnswers, [questionId]: optionId };
    setSelectedAnswers(next);

    const nextAns1 = q1.options.find((o) => o.id === next[q1.id]);
    const nextAns2 = q2.options.find((o) => o.id === next[q2.id]);
    if (nextAns1 && nextAns2) {
      const score = (nextAns1.isCorrect ? 1 : 0) + (nextAns2.isCorrect ? 1 : 0);
      onCompleteLesson(lessonId, score, lesson.termsTaught);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Lesson Selector */}
      <div className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-[#D9582B]">
            {lesson.badge[lang]}
          </div>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#1F2A6B]">
            {lang === 'fr'
              ? `Vérification (2 questions) & Carte Leçon ${lessonId}`
              : `2-Question Check & Lesson ${lessonId} Card`}
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {ALL_LESSON_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectLesson(id)}
              aria-pressed={lessonId === id}
              className={`min-h-[48px] px-3.5 py-2 rounded-2xl font-bold text-sm sm:text-base border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                lessonId === id
                  ? 'bg-[#1F2A6B] text-[#FFF6E5] border-[#1B1B1F]'
                  : 'bg-[#FFF6E5] text-[#1B1B1F] border-[#1F2A6B]/40 hover:border-[#1F2A6B]'
              }`}
            >
              {lang === 'fr' ? `Carte ${id}` : `Card ${id}`}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: 2-Question Check */}
      <section
        aria-labelledby="quiz-heading"
        className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 sm:p-6 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#1B1B1F]/15">
          <div>
            <h2
              id="quiz-heading"
              className="font-display font-bold text-xl text-[#1F2A6B]"
            >
              {lang === 'fr'
                ? 'Petite vérification en 2 questions'
                : 'Quick 2-Question Check'}
            </h2>
            <p className="text-[17px] text-[#1B1B1F]">
              {lang === 'fr'
                ? 'Répondez aux 2 questions pour enregistrer vos progrès sur ce téléphone.'
                : 'Answer both questions to save your progress on this phone.'}
            </p>
          </div>
          {(bothAnswered || isLessonSaved) && (
            <div
              data-testid="lesson-quiz-score"
              className="bg-[#2E7D4F] text-[#FFF6E5] border-2 border-[#1B1B1F] rounded-2xl px-4 py-2 font-display font-bold text-base inline-flex items-center gap-2 tabular-nums"
            >
              <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'fr'
                  ? `Score : ${bothAnswered ? currentScore : quizScores[lessonId] ?? 2}/2 · Enregistré ✓`
                  : `Score: ${bothAnswered ? currentScore : quizScores[lessonId] ?? 2}/2 · Saved ✓`}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {lesson.questions.map((q) => {
            const chosenId = selectedAnswers[q.id];
            const chosenOption = q.options.find((o) => o.id === chosenId);

            return (
              <div
                key={q.id}
                className="bg-[#FFF6E5] border-2 border-[#1F2A6B]/40 rounded-2xl p-4 sm:p-5 space-y-3.5"
              >
                <h3 className="font-display font-bold text-lg text-[#1F2A6B]">
                  {q.prompt[lang]}
                </h3>

                <div className="space-y-2.5">
                  {q.options.map((opt) => {
                    const isSelected = chosenId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(q.id, opt.id)}
                        aria-pressed={isSelected}
                        className={`w-full min-h-[52px] p-3.5 rounded-2xl border-2 text-left text-[17px] font-semibold transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? opt.isCorrect
                              ? 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]'
                              : 'bg-[#D9582B] text-[#FFF6E5] border-[#1B1B1F]'
                            : 'bg-white hover:bg-[#FFFDF9] text-[#1B1B1F] border-[#1B1B1F]/30'
                        }`}
                      >
                        <span>{opt.text[lang]}</span>
                        {isSelected && (
                          <span className="font-bold text-sm shrink-0 inline-flex items-center gap-1">
                            {opt.isCorrect ? (
                              <>
                                <Check className="w-5 h-5" aria-hidden="true" />
                                <span>{lang === 'fr' ? 'Exact ✓' : 'Correct ✓'}</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                                <span>{lang === 'fr' ? 'À revoir ✕' : 'Try again ✕'}</span>
                              </>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {chosenOption && (
                  <div
                    role="status"
                    className={`rounded-2xl p-3.5 border-2 font-semibold text-[17px] ${
                      chosenOption.isCorrect
                        ? 'bg-[#2E7D4F]/15 border-[#2E7D4F] text-[#1B1B1F]'
                        : 'bg-[#D9582B]/15 border-[#D9582B] text-[#1B1B1F]'
                    }`}
                  >
                    {chosenOption.feedback[lang]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: "What You Just Learned" Lesson Card */}
      <section
        aria-labelledby="what-you-learned-heading"
        data-testid="what-you-learned-card"
        className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-5 sm:p-7 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F2B01E] border-2 border-[#1B1B1F] flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-[#1B1B1F]" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#D9582B]">
              {lang === 'fr' ? 'Carte mémo du marché' : 'Market lesson card'}
            </div>
            <h2
              id="what-you-learned-heading"
              className="font-display font-extrabold text-xl sm:text-2xl text-[#1F2A6B]"
            >
              {lesson.whatYouLearnedTitle[lang]}
            </h2>
          </div>
        </div>

        <ul className="space-y-3">
          {lesson.whatYouLearnedPoints[lang].map((point, index) => (
            <li
              key={index}
              className="bg-[#FFF6E5] border border-[#1F2A6B]/30 rounded-2xl p-4 flex items-start gap-3 text-[17px] text-[#1B1B1F]"
            >
              <span className="w-7 h-7 rounded-xl bg-[#2E7D4F] text-[#FFF6E5] font-display font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                ✓
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>

        {/* Terms Mastered in this lesson */}
        <div className="space-y-3 pt-2">
          <h3 className="font-display font-bold text-lg text-[#1F2A6B]">
            {lang === 'fr'
              ? 'Mots expliqués dans cette leçon :'
              : 'Words explained in this lesson:'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lesson.termsTaught.map((key) => {
              const t = TERMS[key];
              if (!t) return null;
              return (
                <div
                  key={key}
                  className="bg-[#FFF6E5] border border-[#1B1B1F]/25 rounded-2xl p-3.5 space-y-1"
                >
                  <div className="font-display font-bold text-base text-[#1F2A6B] flex items-center gap-1.5">
                    <LightningBoltSvg className="w-4 h-4" />
                    <span>{t.term[lang]}</span>
                  </div>
                  <p className="text-base text-[#1B1B1F]">{t.plainMeaning[lang]}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-world market tip */}
        <div className="bg-[#F2B01E]/25 border-2 border-[#1F2A6B] rounded-2xl p-4 text-[17px] font-bold text-[#1B1B1F]">
          {lesson.realWorldTip[lang]}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {lessonId < 6 ? (
            <button
              type="button"
              onClick={() => onStartNextLesson(nextLessonId)}
              className="min-h-[52px] px-6 py-3 rounded-2xl bg-[#D9582B] hover:bg-[#c0481f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'fr'
                  ? `Lancer la Leçon ${nextLessonId} : ${LESSONS[nextLessonId].shortNavTitle.fr}`
                  : `Start Lesson ${nextLessonId}: ${LESSONS[nextLessonId].shortNavTitle.en}`}
              </span>
              <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStartNextLesson(1)}
              className="min-h-[52px] px-6 py-3 rounded-2xl bg-[#FFF6E5] hover:bg-white text-[#1F2A6B] border-2 border-[#1F2A6B] font-display font-bold text-lg inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {lang === 'fr'
                  ? 'Revoir la Leçon 1 au marché'
                  : 'Replay Lesson 1 at the market'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onGoToProgress}
            className="min-h-[52px] px-6 py-3 rounded-2xl bg-[#1F2A6B] hover:bg-[#151d4d] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-lg inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {lang === 'fr'
                ? 'Voir mes progrès enregistrés'
                : 'View my saved progress'}
            </span>
            <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
