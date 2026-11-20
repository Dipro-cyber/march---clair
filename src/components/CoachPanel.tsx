import React, { useState, useEffect } from 'react';
import { HelpCircle, MessageCircle, Send, Sparkles, WifiOff } from 'lucide-react';
import { Language, LessonId } from '../data/content';
import {
  COACH_PRESET_QUESTIONS,
  getScriptedCoachAnswer,
  sanitizeCoachAnswer,
  sanitizeUntrustedDisplayText,
} from '../shared/aiCharacters';
import { localizeQuotes } from '../shared/localizeQuotes';
import {
  CoachAnswerResponse,
  CoachAnswerResponseSchema,
} from '../shared/validation';
import { CustomerAvatarSvg } from './MarketIllustrations';

interface CoachPanelProps {
  lang: Language;
  lessonId: LessonId;
  dataSaver: boolean;
  recentEvent: string;
  onHintUsed?: () => void;
}

export function CoachPanel({
  lang,
  lessonId,
  dataSaver,
  recentEvent,
  onHintUsed,
}: CoachPanelProps) {
  const presets = COACH_PRESET_QUESTIONS[lessonId][lang];
  const [questionInput, setQuestionInput] = useState('');
  const [activeQuestion, setActiveQuestion] = useState<string>('');
  const [coachAnswer, setCoachAnswer] = useState<CoachAnswerResponse | null>(
    null
  );
  const [answerSource, setAnswerSource] = useState<
    'ai' | 'scripted-fallback' | 'data-saver'
  >('scripted-fallback');
  const [isAsking, setIsAsking] = useState(false);

  // Reset coach answer when switching lessons or language
  useEffect(() => {
    setCoachAnswer(null);
    setActiveQuestion('');
    setQuestionInput('');
  }, [lessonId, lang]);

  async function askCoach(rawQuestion: string) {
    const cleanQuestion = sanitizeUntrustedDisplayText(rawQuestion).slice(0, 220);
    if (cleanQuestion.length < 2) return;

    if (onHintUsed) {
      onHintUsed();
    }
    setActiveQuestion(cleanQuestion);

    const localFallback = sanitizeCoachAnswer(
      getScriptedCoachAnswer({
        lessonId,
        language: lang,
        question: cleanQuestion,
        recentEvent,
      })
    );

    // If Data Saver is ON, skip network call and show scripted explanation immediately
    if (dataSaver) {
      setCoachAnswer(localFallback);
      setAnswerSource('data-saver');
      return;
    }

    // Show instant scripted answer while AI refines it, or keep scripted if AI fails/is slow
    setIsAsking(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          language: lang,
          question: cleanQuestion,
          recentEvent: sanitizeUntrustedDisplayText(recentEvent).slice(0, 160),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        setCoachAnswer(localFallback);
        setAnswerSource('scripted-fallback');
        return;
      }

      const payload = await res.json();
      const parsed = CoachAnswerResponseSchema.safeParse(payload?.answer);
      if (parsed.success) {
        setCoachAnswer(sanitizeCoachAnswer(parsed.data));
        setAnswerSource(
          payload?.source === 'ai' ? 'ai' : 'scripted-fallback'
        );
      } else {
        setCoachAnswer(localFallback);
        setAnswerSource('scripted-fallback');
      }
    } catch {
      clearTimeout(timeoutId);
      setCoachAnswer(localFallback);
      setAnswerSource('scripted-fallback');
    } finally {
      setIsAsking(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!questionInput.trim()) return;
    askCoach(questionInput);
  }

  return (
    <section
      data-testid="friendly-coach-panel"
      aria-label={
        lang === 'fr'
          ? 'Coach du Marché : Pourquoi cela s’est-il passé ?'
          : 'Market Coach: Why did that happen?'
      }
      className="bg-[#FFF6E5] border-2 border-[#2E7D4F] rounded-2xl p-4 space-y-3.5"
    >
      {/* Coach Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <CustomerAvatarSvg
            customer="Tantie Awa"
            className="w-12 h-12 shrink-0"
          />
          <div>
            <div className="font-display font-extrabold text-base sm:text-lg text-[#1F2A6B] flex items-center gap-1.5">
              <span>
                {lang === 'fr'
                  ? 'Tantie Awa · Coach du Marché'
                  : 'Auntie Awa · Market Coach'}
              </span>
            </div>
            <div className="text-sm font-semibold text-[#1B1B1F]/80">
              {localizeQuotes(
                lang === 'fr'
                  ? 'Explique « Pourquoi cela s’est-il passé ? » avec des mots simples'
                  : 'Answers "Why did that happen?" in simple words',
                lang
              )}
            </div>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-white border border-[#2E7D4F] text-xs font-bold text-[#2E7D4F] inline-flex items-center gap-1">
          {dataSaver ? (
            <>
              <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'fr' ? 'Mode Économie (Local)' : 'Data Saver (Local)'}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{lang === 'fr' ? 'Coach IA actif' : 'AI Coach active'}</span>
            </>
          )}
        </span>
      </div>

      {/* Quick-tap "Why did that happen?" buttons */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide text-[#1F2A6B]">
          {localizeQuotes(
            lang === 'fr'
              ? 'Touchez une question « Pourquoi cela s’est-il passé ? » :'
              : 'Tap a "Why did that happen?" question:',
            lang
          )}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {presets.map((presetQuestion, idx) => (
            <button
              key={idx}
              type="button"
              data-testid={`coach-preset-${idx}`}
              onClick={() => askCoach(presetQuestion)}
              className="w-full min-h-[48px] px-3.5 py-2 rounded-xl bg-white hover:bg-[#FFFDF9] border-2 border-[#1F2A6B]/40 hover:border-[#1F2A6B] text-left text-sm sm:text-base font-bold text-[#1F2A6B] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <HelpCircle
                className="w-4 h-4 text-[#D9582B] shrink-0"
                aria-hidden="true"
              />
              <span>{localizeQuotes(sanitizeUntrustedDisplayText(presetQuestion), lang)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom question input */}
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="coach-question-input" className="sr-only">
          {lang === 'fr'
            ? 'Poser une question au Coach sur cette leçon'
            : 'Ask the Coach a question about this lesson'}
        </label>
        <input
          id="coach-question-input"
          data-testid="coach-question-input"
          type="text"
          maxLength={200}
          value={questionInput}
          onChange={(e) => setQuestionInput(e.target.value)}
          placeholder={localizeQuotes(
            lang === 'fr'
              ? 'Ou posez votre question : « Pourquoi… ? »'
              : 'Or ask your own: "Why did that happen?"',
            lang
          )}
          className="flex-1 min-h-[48px] px-3.5 py-2 rounded-xl bg-white border-2 border-[#1B1B1F]/40 text-base text-[#1B1B1F] focus:outline-2 focus:outline-[#1F2A6B]"
        />
        <button
          type="submit"
          data-testid="coach-ask-button"
          disabled={isAsking || !questionInput.trim()}
          className="min-h-[48px] px-4 py-2 rounded-xl bg-[#2E7D4F] hover:bg-[#24663f] text-[#FFF6E5] border-2 border-[#1B1B1F] font-display font-bold text-sm sm:text-base inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{lang === 'fr' ? 'Demander' : 'Ask Coach'}</span>
        </button>
      </form>

      {/* Loading indicator */}
      {isAsking && (
        <div
          role="status"
          className="bg-white border border-[#2E7D4F] rounded-xl p-3 text-sm font-bold text-[#2E7D4F] flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4 shrink-0 animate-pulse" aria-hidden="true" />
          <span>
            {lang === 'fr'
              ? 'Tantie Awa réfléchit à votre question…'
              : 'Auntie Awa is preparing a simple explanation…'}
          </span>
        </div>
      )}

      {/* Coach Answer Display (Untrusted text escaped before rendering, never triggers wallet actions) */}
      {coachAnswer && (
        <div
          data-testid="coach-answer-box"
          role="region"
          aria-live="polite"
          className="bg-white border-2 border-[#2E7D4F] rounded-2xl p-3.5 space-y-2.5"
        >
          {activeQuestion && (
            <div className="text-xs font-bold text-[#1F2A6B]">
              {lang === 'fr' ? 'Votre question :' : 'Your question:'}{' '}
              {localizeQuotes(sanitizeUntrustedDisplayText(activeQuestion), lang, true)}
            </div>
          )}

          <div className="space-y-1.5 text-[17px] text-[#1B1B1F]">
            {coachAnswer.answerLines.map((line, i) => (
              <p key={i}>{localizeQuotes(sanitizeUntrustedDisplayText(line), lang)}</p>
            ))}
          </div>

          <div className="bg-[#2E7D4F]/10 border border-[#2E7D4F] rounded-xl p-2.5 text-sm font-bold text-[#1F2A6B]">
            💡 {localizeQuotes(sanitizeUntrustedDisplayText(coachAnswer.keyTakeaway), lang)}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#1B1B1F]/10 text-xs font-semibold text-[#1B1B1F]/75">
            <span>
              {localizeQuotes(
                sanitizeUntrustedDisplayText(coachAnswer.noFinancialAdviceDisclaimer),
                lang
              )}
            </span>
            <span className="font-bold text-[#2E7D4F]">
              {answerSource === 'ai'
                ? lang === 'fr'
                  ? '✓ Réponse IA (Gemini)'
                  : '✓ AI Answer (Gemini)'
                : lang === 'fr'
                ? '✓ Réponse locale instantanée'
                : '✓ Instant local answer'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
