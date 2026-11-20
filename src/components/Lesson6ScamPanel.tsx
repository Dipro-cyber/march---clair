import React from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { Language, SCAM_SCENES } from '../data/content';
import {
  playConfusedOutcomeSound,
  playTapSound,
} from '../shared/soundEffects';

interface Lesson6ScamPanelProps {
  lang: Language;
  scamChoices: Record<number, string>;
  soundEnabled: boolean;
  onSelectScamChoice: (sceneId: number, optionId: string) => void;
}

export function Lesson6ScamPanel({
  lang,
  scamChoices,
  soundEnabled,
  onSelectScamChoice,
}: Lesson6ScamPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <ShieldCheck
          className="w-6 h-6 text-[#2E7D4F] shrink-0"
          aria-hidden="true"
        />
        <div>
          <h2 className="font-display font-bold text-xl text-[#1F2A6B]">
            {lang === 'fr'
              ? 'Déjouez les 3 arnaques au comptoir'
              : 'Spot all 3 counter scams'}
          </h2>
          <p className="text-base text-[#1B1B1F]">
            {lang === 'fr'
              ? 'Lisez chaque scène et choisissez la réaction qui protège vos sats.'
              : 'Read each short scene and choose the reaction that keeps your sats safe.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {SCAM_SCENES.map((scene) => {
          const chosenId = scamChoices[scene.id];
          const chosenOpt = scene.options.find((o) => o.id === chosenId);

          return (
            <div
              key={scene.id}
              data-testid={`scam-scene-${scene.id}`}
              className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-lg text-[#1F2A6B]">
                  {scene.title[lang]}
                </h3>
                {chosenOpt?.isSafe && (
                  <span className="px-3 py-1 rounded-xl bg-[#2E7D4F] text-[#FFF6E5] font-bold text-xs inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{lang === 'fr' ? 'Déjouée ✓' : 'Spotted ✓'}</span>
                  </span>
                )}
              </div>

              <p className="bg-white border border-[#1B1B1F]/30 rounded-xl p-3 text-[17px] text-[#1B1B1F]">
                {scene.customerLine[lang]}
              </p>

              <p className="text-sm font-bold text-[#D9582B]">
                {scene.clueBox[lang]}
              </p>

              <div
                role="group"
                aria-label={scene.title[lang]}
                className="space-y-2"
              >
                {scene.options.map((opt) => {
                  const isSelected = chosenId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (opt.isSafe) {
                          playTapSound(soundEnabled);
                        } else {
                          playConfusedOutcomeSound(soundEnabled);
                        }
                        onSelectScamChoice(scene.id, opt.id);
                      }}
                      aria-pressed={isSelected}
                      className={`w-full min-h-[48px] p-3 rounded-xl border-2 text-left text-base font-bold transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? opt.isSafe
                            ? 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]'
                            : 'bg-[#D9582B] text-[#FFF6E5] border-[#1B1B1F]'
                          : 'bg-white hover:bg-[#FFFDF9] text-[#1B1B1F] border-[#1B1B1F]/30'
                      }`}
                    >
                      <span>{opt.label[lang]}</span>
                      {isSelected && (
                        <span className="shrink-0 text-sm" aria-hidden="true">
                          {opt.isSafe ? '✓' : '✕'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {chosenOpt && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`rounded-xl p-3 border-2 text-base font-semibold space-y-1 ${
                    chosenOpt.isSafe
                      ? 'bg-[#2E7D4F]/15 border-[#2E7D4F] text-[#1B1B1F]'
                      : 'bg-[#D9582B]/15 border-[#D9582B] text-[#1B1B1F]'
                  }`}
                >
                  <p>{chosenOpt.explanation[lang]}</p>
                  <p className="text-sm font-bold text-[#1F2A6B]">
                    {scene.redFlagSummary[lang]}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Lesson6ScamPanel;
