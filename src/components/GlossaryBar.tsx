import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Language, TERMS } from '../data/content';

interface GlossaryBarProps {
  lang: Language;
  termKeys: string[];
}

export function GlossaryBar({ lang, termKeys }: GlossaryBarProps) {
  const [selectedKey, setSelectedKey] = useState<string>(termKeys[0] ?? 'sats');
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const activeTerm = TERMS[selectedKey] ?? TERMS.sats;

  return (
    <section
      aria-label={
        lang === 'fr'
          ? 'Explication des mots techniques en langage simple'
          : 'Plain-language explanation of technical terms'
      }
      className="bg-[#FFFDF9] border-2 border-[#1F2A6B] rounded-2xl p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#F2B01E] text-[#1B1B1F] border border-[#1B1B1F]">
            <BookOpen className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display font-bold text-lg text-[#1F2A6B]">
              {lang === 'fr'
                ? 'Mots nouveaux expliqués simplement'
                : 'New words explained in plain language'}
            </h2>
            <p className="text-sm text-[#1B1B1F]/80">
              {lang === 'fr'
                ? 'Touchez un mot pour lire son explication avec un exemple du marché.'
                : 'Tap any word to read its plain meaning with a market example.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          className="min-h-[48px] px-4 py-2 rounded-2xl border-2 border-[#1F2A6B] text-[#1F2A6B] font-semibold text-base inline-flex items-center gap-2 hover:bg-[#1F2A6B]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F2A6B] whitespace-nowrap shrink-0"
        >
          <span>
            {isOpen
              ? lang === 'fr'
                ? 'Masquer l’aide'
                : 'Hide help'
              : lang === 'fr'
              ? 'Voir les mots'
              : 'Show words'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-5 h-5" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4">
          <div
            role="tablist"
            aria-label={lang === 'fr' ? 'Choisir un mot' : 'Choose a word'}
            className="flex flex-wrap gap-2"
          >
            {termKeys.map((key) => {
              const item = TERMS[key];
              if (!item) return null;
              const isSelected = key === selectedKey;
              return (
                <button
                  key={key}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  onClick={() => setSelectedKey(key)}
                  className={`min-h-[48px] px-4 py-2 rounded-2xl font-bold text-base transition-colors border-2 whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[#1F2A6B] text-[#FFF6E5] border-[#1B1B1F]'
                      : 'bg-[#FFF6E5] text-[#1B1B1F] border-[#1F2A6B]/40 hover:border-[#1F2A6B]'
                  }`}
                >
                  {isSelected ? `● ${item.term[lang]}` : item.term[lang]}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            className="bg-[#FFF6E5] border border-[#1F2A6B]/30 rounded-2xl p-4 space-y-2"
          >
            <p className="font-display font-bold text-lg text-[#1F2A6B]">
              {activeTerm.term[lang]}
            </p>
            <p className="text-[17px] leading-relaxed text-[#1B1B1F]">
              {activeTerm.plainMeaning[lang]}
            </p>
            <p className="text-[17px] leading-relaxed text-[#1F2A6B] font-semibold">
              {lang === 'fr' ? 'Au marché : ' : 'At the market: '}
              <span className="font-normal text-[#1B1B1F]">
                {activeTerm.marketAnalogy[lang]}
              </span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
