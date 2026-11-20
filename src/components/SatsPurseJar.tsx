import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../data/content';

interface SatsPurseJarProps {
  balanceSats: number;
  lang: Language;
  lastAddedSats?: number | null;
  burstTrigger?: number;
}

/**
 * Displays the stall's sats balance as a terracotta/woven market calabash jar & coin purse.
 * When a payment lands, golden sat coins animate into the jar in < 600ms (respecting prefers-reduced-motion).
 */
export function SatsPurseJar({
  balanceSats,
  lang,
  lastAddedSats = null,
  burstTrigger = 0,
}: SatsPurseJarProps) {
  const prevBalanceRef = useRef<number>(balanceSats);
  const [animatingBurst, setAnimatingBurst] = useState<number>(0);
  const [recentDelta, setRecentDelta] = useState<number | null>(null);

  useEffect(() => {
    const diff = balanceSats - prevBalanceRef.current;
    prevBalanceRef.current = balanceSats;

    if (diff > 0 || burstTrigger > 0) {
      setRecentDelta(diff > 0 ? diff : lastAddedSats);
      setAnimatingBurst((c) => c + 1);
      const timer = setTimeout(() => {
        setAnimatingBurst(0);
      }, 580);
      return () => clearTimeout(timer);
    }
  }, [balanceSats, burstTrigger, lastAddedSats]);

  // Visual coin fill ratio inside the jar (between 20% and 95%)
  const fillRatio = Math.min(0.95, Math.max(0.22, balanceSats / 2500));
  const coinStackHeight = Math.round(fillRatio * 24);

  return (
    <div
      data-testid="stall-live-balance"
      className={`relative bg-[#FFF6E5] border-2 border-[#2E7D4F] rounded-2xl px-3.5 py-1.5 inline-flex items-center gap-2.5 shadow-xs ${
        animatingBurst > 0 ? 'animate-purse-bounce ring-2 ring-[#F2B01E]' : ''
      }`}
    >
      {/*Purse / Jar SVG with animated dropping coins */}
      <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
        {animatingBurst > 0 && (
          <div
            key={animatingBurst}
            data-testid="coin-drop-animation"
            aria-hidden="true"
            className="pointer-events-none absolute -top-3 inset-x-0 flex items-center justify-center gap-0.5 z-10"
          >
            <svg
              viewBox="0 0 20 20"
              className="w-4 h-4 animate-coin-drop-1"
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="#F2B01E"
                stroke="#1B1B1F"
                strokeWidth="2"
              />
              <path d="M11 5L7 11H10L9 15L13 9H10L11 5Z" fill="#1B1B1F" />
            </svg>
            <svg
              viewBox="0 0 20 20"
              className="w-4 h-4 animate-coin-drop-2"
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="#F2B01E"
                stroke="#1B1B1F"
                strokeWidth="2"
              />
              <path d="M11 5L7 11H10L9 15L13 9H10L11 5Z" fill="#1B1B1F" />
            </svg>
            <svg
              viewBox="0 0 20 20"
              className="w-4 h-4 animate-coin-drop-3"
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="#F2B01E"
                stroke="#1B1B1F"
                strokeWidth="2"
              />
              <path d="M11 5L7 11H10L9 15L13 9H10L11 5Z" fill="#1B1B1F" />
            </svg>
          </div>
        )}

        <svg
          viewBox="0 0 56 56"
          fill="none"
          className="w-11 h-11"
          role="img"
          aria-label={
            lang === 'fr'
              ? `Bourse à sats contenant ${balanceSats} sats`
              : `Sats jar purse holding ${balanceSats} sats`
          }
        >
          {/* Jar Rim / Mouth */}
          <ellipse
            cx="28"
            cy="14"
            rx="14"
            ry="4.5"
            fill="#1F2A6B"
            stroke="#1B1B1F"
            strokeWidth="2"
          />

          {/* Calabash / Purse Body */}
          <path
            d="M14 15C8 24 8 42 17 48C22 51 34 51 39 48C48 42 48 24 42 15H14Z"
            fill="#D9582B"
            stroke="#1B1B1F"
            strokeWidth="2.2"
          />

          {/* Cutout Window Inside Jar Showing Golden Sat Coins */}
          <rect
            x="16"
            y="22"
            width="24"
            height="24"
            rx="8"
            fill="#FFF6E5"
            stroke="#1B1B1F"
            strokeWidth="1.8"
          />

          {/* Rising Gold Coin Stack Inside Window */}
          <rect
            x="18"
            y={44 - coinStackHeight}
            width="20"
            height={coinStackHeight}
            rx="5"
            fill="#F2B01E"
          />

          {/* Individual Coin Circles Inside Purse Window */}
          <circle
            cx="23"
            cy="40"
            r="4"
            fill="#F2B01E"
            stroke="#1B1B1F"
            strokeWidth="1.4"
          />
          <circle
            cx="33"
            cy="40"
            r="4"
            fill="#F2B01E"
            stroke="#1B1B1F"
            strokeWidth="1.4"
          />
          <circle
            cx="28"
            cy="35"
            r="4.2"
            fill="#F2B01E"
            stroke="#1B1B1F"
            strokeWidth="1.4"
          />

          {/* Drawstring Cord & Lightning Emblem */}
          <path
            d="M13 17H43"
            stroke="#F2B01E"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M29 24L25 30H28.5L27 35L32 28.5H28.5L29 24Z"
            fill="#1F2A6B"
          />
        </svg>
      </div>

      {/* Text Label + Numeric Sats Balance */}
      <div className="leading-tight">
        <div className="text-xs font-bold text-[#1F2A6B] flex items-center gap-1.5">
          <span>
            {lang === 'fr' ? 'Bourse à Sats' : 'Sats Jar Purse'}
          </span>
          {animatingBurst > 0 && recentDelta && recentDelta > 0 && (
            <span
              data-testid="purse-delta-badge"
              className="px-1.5 py-0.5 rounded-lg bg-[#2E7D4F] text-[#FFF6E5] text-[11px] font-extrabold tabular-nums"
            >
              +{recentDelta}
            </span>
          )}
        </div>
        <div className="font-display font-extrabold text-base sm:text-lg text-[#2E7D4F] tabular-nums">
          {lang === 'fr' ? 'Caisse :' : 'Balance:'} {balanceSats} sats
        </div>
      </div>
    </div>
  );
}
