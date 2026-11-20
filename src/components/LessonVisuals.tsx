import React from 'react';
import { Check, AlertTriangle, Zap, Clock } from 'lucide-react';
import { Language, StallId } from '../data/content';
import { PaymentComparison } from '../shared/simWallet';
import { CustomerMoodState } from '../shared/gameMechanics';
import { LazyStallIllustration } from './LazyIllustrations';

interface AnimatedMarketStageProps {
  stallId: StallId;
  customerName: string;
  customerRole: string;
  mood: CustomerMoodState;
  lang: Language;
}

/**
 * Full-body SVG customer character who walks in via CSS transform when a scene starts,
 * and leaves happy (smiling, raised arm, ✓) or confused (puzzled, tilted, ?) depending on the outcome.
 */
function WalkingCustomerCharacterSvg({
  customerName,
  mood,
}: {
  customerName: string;
  mood: CustomerMoodState;
}) {
  const isFemale = customerName === 'Amina' || customerName === 'Fatou';
  const tunicMap: Record<string, string> = {
    Amina: '#1F2A6B',
    Moussa: '#D9582B',
    Fatou: '#2E7D4F',
    Ibrahim: '#F2B01E',
    Koffi: '#D9582B',
    'Inspecteur Sékou': '#1F2A6B',
  };
  const accentMap: Record<string, string> = {
    Amina: '#F2B01E',
    Moussa: '#2E7D4F',
    Fatou: '#D9582B',
    Ibrahim: '#1F2A6B',
    Koffi: '#F2B01E',
    'Inspecteur Sékou': '#2E7D4F',
  };

  const tunicColor = tunicMap[customerName] ?? '#1F2A6B';
  const accentColor = accentMap[customerName] ?? '#F2B01E';
  const isHappy = mood === 'happy-leaving';
  const isConfused = mood === 'confused-leaving';

  return (
    <svg
      viewBox="0 0 120 148"
      fill="none"
      className="w-28 h-36 sm:w-32 sm:h-40 shrink-0"
      role="img"
      aria-label={`${customerName} (${mood})`}
    >
      {/* Ground shadow */}
      <ellipse cx="60" cy="140" rx="32" ry="5" fill="#1B1B1F" fillOpacity="0.18" />

      {/* Walking Legs */}
      <path
        d={
          mood === 'entering'
            ? 'M48 106L38 136M72 106L82 136'
            : isHappy
            ? 'M48 106L42 136M72 106L80 136'
            : 'M50 106L48 136M70 106L72 136'
        }
        stroke="#1B1B1F"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Sandals */}
      <path
        d="M34 136H48M72 136H86"
        stroke="#D9582B"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Tunic / Robe Body */}
      <path
        d="M34 58C34 50 86 50 86 58L92 108H28L34 58Z"
        fill={tunicColor}
        stroke="#1B1B1F"
        strokeWidth="2.5"
      />
      {/* Woven Collar Trim */}
      <path
        d="M46 54L60 68L74 54"
        stroke={accentColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Arms (Raised in joy when happy, scratching head when confused, holding phone when waiting) */}
      {isHappy ? (
        <>
          <path
            d="M34 64L16 40"
            stroke="#8C4A27"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M86 64L104 38"
            stroke="#8C4A27"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </>
      ) : isConfused ? (
        <>
          <path
            d="M34 64L22 86"
            stroke="#8C4A27"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M86 64L96 42L78 30"
            stroke="#8C4A27"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="M34 64L24 88"
            stroke="#8C4A27"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M86 64L98 76"
            stroke="#8C4A27"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          {/* Smartphone in hand */}
          <rect
            x="94"
            y="64"
            width="14"
            height="22"
            rx="3"
            fill="#FFF6E5"
            stroke="#1B1B1F"
            strokeWidth="2"
          />
          <path d="M101 70L98 76H101L100 80L104 74H101L101 70Z" fill="#F2B01E" />
        </>
      )}

      {/* Headwrap or Market Cap */}
      {isFemale ? (
        <path
          d="M38 30C38 12 82 12 82 30C82 23 38 23 38 30Z"
          fill={accentColor}
          stroke="#1B1B1F"
          strokeWidth="2.2"
        />
      ) : (
        <path
          d="M41 26L44 13H76L79 26H41Z"
          fill={accentColor}
          stroke="#1B1B1F"
          strokeWidth="2.2"
        />
      )}

      {/* Head & Face */}
      <circle
        cx="60"
        cy="36"
        r="16"
        fill="#8C4A27"
        stroke="#1B1B1F"
        strokeWidth="2.5"
      />

      {/* Eyes */}
      {isHappy ? (
        <>
          <path
            d="M51 34Q54 30 57 34"
            stroke="#1B1B1F"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M63 34Q66 30 69 34"
            stroke="#1B1B1F"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="54" cy="34" r="2.2" fill="#1B1B1F" />
          <circle cx="66" cy="34" r="2.2" fill="#1B1B1F" />
        </>
      )}

      {/* Mouth: Big Smile (happy), Wavy Puzzled (confused), Friendly Smile (waiting/entering) */}
      {isHappy ? (
        <path
          d="M52 41Q60 50 68 41Z"
          fill="#FFF6E5"
          stroke="#1B1B1F"
          strokeWidth="2"
        />
      ) : isConfused ? (
        <path
          d="M53 44Q57 40 60 44T67 43"
          stroke="#1B1B1F"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M54 42Q60 47 66 42"
          stroke="#1B1B1F"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}

      {/* Outcome Floating Symbol above Customer */}
      {isHappy && (
        <g>
          <circle
            cx="24"
            cy="20"
            r="12"
            fill="#2E7D4F"
            stroke="#1B1B1F"
            strokeWidth="2"
          />
          <path
            d="M19 20L22.5 23.5L29.5 16.5"
            stroke="#FFF6E5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {isConfused && (
        <g>
          <circle
            cx="24"
            cy="20"
            r="12"
            fill="#D9582B"
            stroke="#1B1B1F"
            strokeWidth="2"
          />
          <text
            x="24"
            y="25"
            textAnchor="middle"
            fill="#FFF6E5"
            fontSize="15"
            fontWeight="900"
          >
            ?
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * Top-of-Market Stall Scene: SVG Stall + Customer character who walks in via CSS transform
 * and leaves happy or confused depending on the outcome.
 */
export function AnimatedMarketStage({
  stallId,
  customerName,
  customerRole,
  mood,
  lang,
}: AnimatedMarketStageProps) {
  const moodBadge =
    mood === 'happy-leaving'
      ? {
          bg: 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]',
          text:
            lang === 'fr'
              ? `${customerName} repart ravi(e) ✓`
              : `${customerName} leaves happy ✓`,
        }
      : mood === 'confused-leaving'
      ? {
          bg: 'bg-[#D9582B] text-[#FFF6E5] border-[#1B1B1F]',
          text:
            lang === 'fr'
              ? `${customerName} est perplexe ?`
              : `${customerName} looks confused ?`,
        }
      : mood === 'entering'
      ? {
          bg: 'bg-[#F2B01E] text-[#1B1B1F] border-[#1B1B1F]',
          text:
            lang === 'fr'
              ? `${customerName} arrive à l’étal →`
              : `${customerName} walks up to the stall →`,
        }
      : {
          bg: 'bg-[#FFF6E5] text-[#1F2A6B] border-[#1F2A6B]',
          text:
            lang === 'fr'
              ? `${customerName} attend au comptoir`
              : `${customerName} is at your counter`,
        };

  return (
    <div
      data-testid="animated-market-stage"
      data-customer-mood={mood}
      className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-3.5 sm:p-4 overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-xs font-extrabold uppercase tracking-wide text-[#1F2A6B]">
          {lang === 'fr'
            ? 'Scène en direct devant votre étal'
            : 'Live scene in front of your stall'}
        </span>
        <span
          data-testid="customer-mood-badge"
          className={`px-3 py-1 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 ${moodBadge.bg}`}
        >
          <span>{moodBadge.text}</span>
        </span>
      </div>

      {/* Stage Floor with Stall on Left and Walking Customer on Right */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-[#FFFDF9] border-2 border-[#1B1B1F]/25 rounded-2xl p-3">
        <div className="sm:col-span-7">
          <LazyStallIllustration stallId={stallId} className="w-full h-36 sm:h-40" />
        </div>

        <div className="sm:col-span-5 flex flex-col items-center justify-end">
          <div
            data-testid="walking-customer-actor"
            className={`customer-stage-actor customer-stage-actor--${mood} flex flex-col items-center`}
          >
            <WalkingCustomerCharacterSvg
              customerName={customerName}
              mood={mood}
            />
            <div className="mt-1 px-2.5 py-0.5 rounded-lg bg-[#FFF6E5] border border-[#1B1B1F] text-xs font-extrabold text-[#1F2A6B] text-center">
              {customerName} · <span className="font-normal">{customerRole}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Lesson 3 Visual: Two horizontal bars comparing Time (Confirmation) and Fee (Lightning vs On-Chain).
 */
export function Lesson3ComparisonBars({
  comparison,
  lang,
}: {
  comparison: PaymentComparison;
  lang: Language;
}) {
  return (
    <div
      data-testid="lesson3-comparison-bars"
      className="bg-white border-2 border-[#1F2A6B] rounded-2xl p-3.5 space-y-4"
    >
      {/* Bar 1: Time / Speed Comparison */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs sm:text-sm font-extrabold text-[#1F2A6B]">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#1F2A6B]" aria-hidden="true" />
            <span>
              {lang === 'fr'
                ? '1. Barre du Temps d’attente (Vitesse)'
                : '1. Waiting Time Bar (Speed)'}
            </span>
          </span>
          <span className="text-[#2E7D4F]">
            {lang === 'fr' ? '1 sec vs ~30 min' : '1 sec vs ~30 min'}
          </span>
        </div>

        {/* Lightning Time Bar (tiny 4% width = instant) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#2E7D4F] tabular-nums">
            <span>⚡ Lightning ({comparison.lightning.timeLabelFr})</span>
            <span>1 s ✓</span>
          </div>
          <div className="w-full h-4 bg-[#FFF6E5] border border-[#1B1B1F] rounded-lg overflow-hidden p-0.5">
            <div
              data-testid="bar-time-lightning"
              className="h-full bg-[#2E7D4F] rounded-sm transition-all duration-500 w-[4%] min-w-[14px]"
            />
          </div>
        </div>

        {/* On-Chain Time Bar (100% width = ~30 minutes) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#D9582B] tabular-nums">
            <span>
              ⛓️ {lang === 'fr' ? 'Chaîne Bitcoin' : 'On-Chain'} (~
              {comparison.onChain.timeMinutes} min)
            </span>
            <span>~1 800 s ✕</span>
          </div>
          <div className="w-full h-4 bg-[#FFF6E5] border border-[#1B1B1F] rounded-lg overflow-hidden p-0.5">
            <div
              data-testid="bar-time-onchain"
              className="h-full bg-[#D9582B] rounded-sm transition-all duration-500 w-full"
            />
          </div>
        </div>
      </div>

      {/* Bar 2: Fee Comparison */}
      <div className="space-y-2 pt-3 border-t border-[#1B1B1F]/15">
        <div className="flex items-center justify-between text-xs sm:text-sm font-extrabold text-[#1F2A6B]">
          <span className="inline-flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#F2B01E]" aria-hidden="true" />
            <span>
              {lang === 'fr'
                ? '2. Barre des Frais de réseau (Coût)'
                : '2. Network Fee Bar (Cost)'}
            </span>
          </span>
          <span className="text-[#2E7D4F]">
            {comparison.lightning.feeSats} sat vs {comparison.onChain.feeSats} sats
          </span>
        </div>

        {/* Lightning Fee Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#2E7D4F] tabular-nums">
            <span>⚡ Lightning</span>
            <span>{comparison.lightning.feeSats} sat ✓</span>
          </div>
          <div className="w-full h-4 bg-[#FFF6E5] border border-[#1B1B1F] rounded-lg overflow-hidden p-0.5">
            <div
              data-testid="bar-fee-lightning"
              className="h-full bg-[#2E7D4F] rounded-sm transition-all duration-500 w-[4%] min-w-[14px]"
            />
          </div>
        </div>

        {/* On-Chain Fee Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[#D9582B] tabular-nums">
            <span>⛓️ {lang === 'fr' ? 'Chaîne Bitcoin' : 'On-Chain'}</span>
            <span>{comparison.onChain.feeSats} sats ✕</span>
          </div>
          <div className="w-full h-4 bg-[#FFF6E5] border border-[#1B1B1F] rounded-lg overflow-hidden p-0.5">
            <div
              data-testid="bar-fee-onchain"
              className="h-full bg-[#D9582B] rounded-sm transition-all duration-500 w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Lesson 4 Visual: Interactive Channel Capacity & Inbound Liquidity Bar.
 * Shows current receiving room (300 sats initially, 800 sats after recharge) vs requested invoice amount.
 */
export function Lesson4ChannelCapacityBar({
  inboundLiquiditySats,
  invoiceAmountSats,
  lang,
}: {
  inboundLiquiditySats: number;
  invoiceAmountSats: number;
  lang: Language;
}) {
  const maxScaleSats = 1000;
  const capacityPct = Math.min(
    100,
    Math.round((inboundLiquiditySats / maxScaleSats) * 100)
  );
  const invoicePct = Math.min(
    100,
    Math.round((invoiceAmountSats / maxScaleSats) * 100)
  );
  const fitsInChannel = invoiceAmountSats <= inboundLiquiditySats;

  return (
    <div
      data-testid="lesson4-capacity-bar"
      className="bg-[#FFF6E5] border-2 border-[#1F2A6B] rounded-2xl p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-display font-bold text-base text-[#1F2A6B]">
          {lang === 'fr'
            ? 'Jauge de Capacité du Canal (Liquidité entrante)'
            : 'Channel Receiving Capacity Bar (Inbound Liquidity)'}
        </div>
        <span
          className={`px-2.5 py-1 rounded-xl text-xs font-bold border inline-flex items-center gap-1 tabular-nums ${
            fitsInChannel
              ? 'bg-[#2E7D4F] text-[#FFF6E5] border-[#1B1B1F]'
              : 'bg-[#D9582B] text-[#FFF6E5] border-[#1B1B1F]'
          }`}
        >
          {fitsInChannel ? (
            <>
              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'fr'
                  ? `Passe (${invoiceAmountSats} ≤ ${inboundLiquiditySats} sats) ✓`
                  : `Fits (${invoiceAmountSats} ≤ ${inboundLiquiditySats} sats) ✓`}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {lang === 'fr'
                  ? `Trop grand (${invoiceAmountSats} > ${inboundLiquiditySats} sats) ✕`
                  : `Too large (${invoiceAmountSats} > ${inboundLiquiditySats} sats) ✕`}
              </span>
            </>
          )}
        </span>
      </div>

      {/* Bar 1: Available Inbound Receiving Capacity */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-bold text-[#1F2A6B] tabular-nums">
          <span>
            {lang === 'fr'
              ? 'Place libre dans votre canal pour recevoir :'
              : 'Open receiving room in your channel:'}
          </span>
          <span className="text-[#2E7D4F] font-extrabold">
            {inboundLiquiditySats} sats
          </span>
        </div>
        <div className="w-full h-5 bg-white border-2 border-[#1B1B1F] rounded-xl overflow-hidden p-0.5">
          <div
            data-testid="channel-inbound-fill"
            style={{ width: `${capacityPct}%` }}
            className="h-full bg-[#2E7D4F] rounded-lg transition-all duration-500"
          />
        </div>
      </div>

      {/* Bar 2: Customer Payment Amount vs Capacity */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-bold text-[#1B1B1F] tabular-nums">
          <span>
            {lang === 'fr'
              ? 'Montant que le client essaie d’envoyer :'
              : 'Amount the customer is trying to send:'}
          </span>
          <span
            className={
              fitsInChannel
                ? 'text-[#2E7D4F] font-extrabold'
                : 'text-[#D9582B] font-extrabold'
            }
          >
            {invoiceAmountSats} sats
          </span>
        </div>
        <div className="relative w-full h-5 bg-white border-2 border-[#1B1B1F] rounded-xl overflow-hidden p-0.5">
          <div
            data-testid="channel-invoice-fill"
            style={{ width: `${invoicePct}%` }}
            className={`h-full rounded-lg transition-all duration-500 ${
              fitsInChannel ? 'bg-[#F2B01E]' : 'bg-[#D9582B]'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
