import React from 'react';
import { StallId } from '../data/content';

export function LightningBoltSvg({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M13.5 2L4.5 13.5H11.5L10.5 22L19.5 10.5H12.5L13.5 2Z"
        fill="#F2B01E"
        stroke="#1B1B1F"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StallIllustration({
  stallId,
  className = 'w-full h-44',
}: {
  stallId: StallId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 360 180"
      fill="none"
      className={className}
      role="img"
      aria-label={
        stallId === 'fruit'
          ? 'Illustration étal de fruits avec balance et paniers'
          : stallId === 'fabric'
          ? 'Illustration étal de tissus avec rouleaux et règle'
          : 'Illustration kiosque crédit téléphone et panneau solaire'
      }
    >
      {/* Background warm market arch */}
      <rect x="8" y="8" width="344" height="164" rx="14" fill="#FFF6E5" stroke="#1F2A6B" strokeWidth="2" />

      {/* Wooden stall poles */}
      <rect x="34" y="34" width="8" height="110" fill="#8C4A27" />
      <rect x="318" y="34" width="8" height="110" fill="#8C4A27" />

      {/* Striped stall awning at top */}
      <g>
        <path d="M20 16H340L350 42H10L20 16Z" fill="#1F2A6B" stroke="#1B1B1F" strokeWidth="1.5" />
        <path d="M20 16H60L55 42H10L20 16Z" fill="#D9582B" />
        <path d="M100 16H140L138 42H96L100 16Z" fill="#D9582B" />
        <path d="M180 16H220L222 42H180L180 16Z" fill="#D9582B" />
        <path d="M260 16H300L305 42H262L260 16Z" fill="#D9582B" />
        {/* Scallop valance */}
        <path
          d="M10 42 Q27 52 45 42 Q62 52 80 42 Q97 52 115 42 Q132 52 150 42 Q167 52 185 42 Q202 52 220 42 Q237 52 255 42 Q272 52 290 42 Q307 52 325 42 Q338 52 350 42"
          fill="#F2B01E"
          stroke="#1B1B1F"
          strokeWidth="1.5"
        />
      </g>

      {stallId === 'fruit' && (
        <g>
          {/* Classic market balance scale on left */}
          <rect x="64" y="106" width="44" height="12" rx="3" fill="#1F2A6B" stroke="#1B1B1F" strokeWidth="1.5" />
          <path d="M86 78V106" stroke="#1B1B1F" strokeWidth="2.5" />
          <path d="M62 84H110" stroke="#1B1B1F" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="86" cy="84" r="5" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
          {/* Left pan with mango */}
          <path d="M52 88Q62 98 72 88Z" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
          <ellipse cx="62" cy="84" rx="7" ry="5" fill="#D9582B" />
          {/* Right pan with weight */}
          <path d="M100 88Q110 98 120 88Z" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
          <rect x="106" y="80" width="8" height="8" rx="1" fill="#1F2A6B" />

          {/* Woven Basket 1: Ripe Mangoes */}
          <path d="M142 94H214L204 118H152L142 94Z" fill="#D98A3C" stroke="#1B1B1F" strokeWidth="1.5" />
          <path d="M146 102H210M150 110H206" stroke="#1B1B1F" strokeWidth="1.2" strokeDasharray="4 3" />
          <ellipse cx="162" cy="89" rx="11" ry="8" fill="#D9582B" stroke="#1B1B1F" strokeWidth="1.5" />
          <ellipse cx="178" cy="86" rx="12" ry="9" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
          <ellipse cx="195" cy="89" rx="11" ry="8" fill="#2E7D4F" stroke="#1B1B1F" strokeWidth="1.5" />

          {/* Woven Basket 2: Papayas & Plantains */}
          <path d="M232 94H300L292 118H240L232 94Z" fill="#D98A3C" stroke="#1B1B1F" strokeWidth="1.5" />
          <path d="M236 102H296M239 110H293" stroke="#1B1B1F" strokeWidth="1.2" strokeDasharray="4 3" />
          <ellipse cx="254" cy="87" rx="13" ry="9" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
          <ellipse cx="278" cy="88" rx="12" ry="8" fill="#2E7D4F" stroke="#1B1B1F" strokeWidth="1.5" />
        </g>
      )}

      {stallId === 'fabric' && (
        <g>
          {/* Stacked fabric bolts on left */}
          <rect x="54" y="98" width="66" height="18" rx="9" fill="#1F2A6B" stroke="#1B1B1F" strokeWidth="1.5" />
          <circle cx="111" cy="107" r="5" fill="#FFF6E5" stroke="#1B1B1F" strokeWidth="1.2" />
          <rect x="58" y="80" width="62" height="18" rx="9" fill="#D9582B" stroke="#1B1B1F" strokeWidth="1.5" />
          <circle cx="111" cy="89" r="5" fill="#FFF6E5" stroke="#1B1B1F" strokeWidth="1.2" />
          <rect x="62" y="62" width="58" height="18" rx="9" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
          <circle cx="111" cy="71" r="5" fill="#FFF6E5" stroke="#1B1B1F" strokeWidth="1.2" />

          {/* Hanging patterned textiles in middle */}
          <rect x="148" y="54" width="34" height="54" rx="4" fill="#D9582B" stroke="#1B1B1F" strokeWidth="1.5" />
          <path d="M155 66L165 76L175 66M155 84L165 94L175 84" stroke="#F2B01E" strokeWidth="2" strokeLinecap="round" />
          <rect x="190" y="54" width="34" height="54" rx="4" fill="#1F2A6B" stroke="#1B1B1F" strokeWidth="1.5" />
          <circle cx="207" cy="72" r="6" fill="#F2B01E" />
          <circle cx="207" cy="92" r="6" fill="#FFF6E5" />

          {/* Woven basket of folded cloth + measuring stick */}
          <path d="M238 94H304L296 118H246L238 94Z" fill="#D98A3C" stroke="#1B1B1F" strokeWidth="1.5" />
          <rect x="248" y="82" width="22" height="12" rx="3" fill="#2E7D4F" stroke="#1B1B1F" strokeWidth="1.5" />
          <rect x="272" y="80" width="22" height="14" rx="3" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
          {/* Wooden meter rule on counter */}
          <rect x="140" y="110" width="86" height="8" rx="2" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
        </g>
      )}

      {stallId === 'credit' && (
        <g>
          {/* Small solar panel tilted on left stand */}
          <path d="M56 64L112 56L118 88L62 96L56 64Z" fill="#1F2A6B" stroke="#1B1B1F" strokeWidth="1.5" />
          <path d="M75 61L81 93M94 59L100 90M59 79L115 71" stroke="#FFF6E5" strokeWidth="1" />
          <rect x="82" y="94" width="10" height="24" fill="#1B1B1F" />

          {/* Phone credit top-up display board */}
          <rect x="142" y="58" width="76" height="58" rx="8" fill="#F2B01E" stroke="#1B1B1F" strokeWidth="1.5" />
          <rect x="152" y="66" width="56" height="16" rx="3" fill="#FFF6E5" stroke="#1B1B1F" strokeWidth="1.2" />
          <path d="M177 70L172 76H178L176 80" stroke="#D9582B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="152" y="88" width="24" height="18" rx="3" fill="#2E7D4F" stroke="#1B1B1F" strokeWidth="1.2" />
          <rect x="184" y="88" width="24" height="18" rx="3" fill="#D9582B" stroke="#1B1B1F" strokeWidth="1.2" />

          {/* Woven basket with charging phones & vouchers */}
          <path d="M236 94H302L294 118H244L236 94Z" fill="#D98A3C" stroke="#1B1B1F" strokeWidth="1.5" />
          <rect x="250" y="72" width="16" height="22" rx="3" fill="#1F2A6B" stroke="#1B1B1F" strokeWidth="1.5" />
          <rect x="272" y="75" width="16" height="19" rx="3" fill="#D9582B" stroke="#1B1B1F" strokeWidth="1.5" />
        </g>
      )}

      {/* Wooden Market Counter Table across bottom */}
      <rect x="24" y="118" width="312" height="14" rx="4" fill="#D9582B" stroke="#1B1B1F" strokeWidth="1.5" />
      <rect x="34" y="132" width="292" height="32" rx="4" fill="#1F2A6B" stroke="#1B1B1F" strokeWidth="1.5" />
      {/* Woven geometric diamond frieze on counter front */}
      <path
        d="M54 148 L66 138 L78 148 L66 158 Z M98 148 L110 138 L122 148 L110 158 Z M142 148 L154 138 L166 148 L154 158 Z M186 148 L198 138 L210 148 L198 158 Z M230 148 L242 138 L254 148 L242 158 Z M274 148 L286 138 L298 148 L286 158 Z"
        fill="#F2B01E"
      />
    </svg>
  );
}

export function CustomerAvatarSvg({
  customer,
  className = 'w-16 h-16',
}: {
  customer: string;
  className?: string;
}) {
  const isFemale =
    customer === 'Amina' ||
    customer === 'Fatou' ||
    customer === 'Tantie Awa';
  const bgMap: Record<string, string> = {
    Amina: '#F2B01E',
    Moussa: '#2E7D4F',
    Fatou: '#D9582B',
    Ibrahim: '#1F2A6B',
    Koffi: '#F2B01E',
    'Inspecteur Sékou': '#2E7D4F',
    'Tantie Awa': '#2E7D4F',
  };
  const shirtMap: Record<string, string> = {
    Amina: '#1F2A6B',
    Moussa: '#D9582B',
    Fatou: '#2E7D4F',
    Ibrahim: '#F2B01E',
    Koffi: '#D9582B',
    'Inspecteur Sékou': '#1F2A6B',
    'Tantie Awa': '#F2B01E',
  };
  const bgColor = bgMap[customer] ?? '#F2B01E';
  const shirtColor = shirtMap[customer] ?? '#1F2A6B';

  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      className={className}
      role="img"
      aria-label={customer}
    >
      <rect
        x="2"
        y="2"
        width="76"
        height="76"
        rx="16"
        fill={bgColor}
        stroke="#1B1B1F"
        strokeWidth="2"
      />
      {/* Shoulders */}
      <path
        d="M16 76C16 58 64 58 64 76"
        fill={shirtColor}
        stroke="#1B1B1F"
        strokeWidth="2"
      />
      {/* Headwrap or cap */}
      {isFemale ? (
        <path
          d="M22 32C22 16 58 16 58 32C58 26 22 26 22 32Z"
          fill={customer === 'Fatou' ? '#1F2A6B' : '#D9582B'}
          stroke="#1B1B1F"
          strokeWidth="2"
        />
      ) : (
        <path
          d="M25 28L28 16H52L55 28H25Z"
          fill={customer === 'Ibrahim' ? '#D9582B' : '#1F2A6B'}
          stroke="#1B1B1F"
          strokeWidth="2"
        />
      )}
      {/* Face */}
      <circle cx="40" cy="38" r="14" fill="#8C4A27" stroke="#1B1B1F" strokeWidth="2" />
      {/* Friendly eyes & smile */}
      <circle cx="35" cy="36" r="2" fill="#1B1B1F" />
      <circle cx="45" cy="36" r="2" fill="#1B1B1F" />
      <path
        d="M35 43Q40 47 45 43"
        stroke="#1B1B1F"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Simple animated SVG path showing a payment hopping across two intermediate nodes (Lesson 5)
 */
export function RoutingPathSvg({
  activeStep,
  amountSats,
  lang,
}: {
  activeStep: number; // 0 = idle, 1 = hop 1, 2 = hop 2, 3 = arrived at stall
  amountSats: number;
  lang: 'fr' | 'en';
}) {
  const hop1Sats = amountSats + 3;
  const hop2Sats = amountSats + 1;

  return (
    <svg
      viewBox="0 0 680 165"
      fill="none"
      className="w-full h-auto"
      role="img"
      aria-label={
        lang === 'fr'
          ? 'Chemin de routage à travers deux nœuds intermédiaires'
          : 'Routing path across two intermediate nodes'
      }
    >
      <rect
        x="4"
        y="4"
        width="672"
        height="157"
        rx="14"
        fill="#FFF6E5"
        stroke="#1F2A6B"
        strokeWidth="2"
      />

      {/* Connecting lines between the 4 nodes */}
      <line
        x1="125"
        y1="76"
        x2="245"
        y2="76"
        stroke={activeStep >= 1 ? '#2E7D4F' : '#1F2A6B'}
        strokeWidth="4"
        strokeDasharray={activeStep >= 1 ? 'none' : '6 4'}
      />
      <line
        x1="315"
        y1="76"
        x2="435"
        y2="76"
        stroke={activeStep >= 2 ? '#2E7D4F' : '#1F2A6B'}
        strokeWidth="4"
        strokeDasharray={activeStep >= 2 ? 'none' : '6 4'}
      />
      <line
        x1="505"
        y1="76"
        x2="585"
        y2="76"
        stroke={activeStep >= 3 ? '#2E7D4F' : '#1F2A6B'}
        strokeWidth="4"
        strokeDasharray={activeStep >= 3 ? 'none' : '6 4'}
      />

      {/* Hop Packet Badges */}
      <g>
        <rect
          x="140"
          y="24"
          width="92"
          height="28"
          rx="8"
          fill={activeStep >= 1 ? '#F2B01E' : '#FFFDF9'}
          stroke="#1B1B1F"
          strokeWidth="1.5"
        />
        <text
          x="186"
          y="42"
          textAnchor="middle"
          fill="#1B1B1F"
          fontSize="12"
          fontWeight="bold"
        >
          {hop1Sats} sats →
        </text>
      </g>

      <g>
        <rect
          x="330"
          y="24"
          width="92"
          height="28"
          rx="8"
          fill={activeStep >= 2 ? '#F2B01E' : '#FFFDF9'}
          stroke="#1B1B1F"
          strokeWidth="1.5"
        />
        <text
          x="376"
          y="42"
          textAnchor="middle"
          fill="#1B1B1F"
          fontSize="12"
          fontWeight="bold"
        >
          {hop2Sats} sats →
        </text>
      </g>

      <g>
        <rect
          x="502"
          y="24"
          width="88"
          height="28"
          rx="8"
          fill={activeStep >= 3 ? '#2E7D4F' : '#FFFDF9'}
          stroke="#1B1B1F"
          strokeWidth="1.5"
        />
        <text
          x="546"
          y="42"
          textAnchor="middle"
          fill={activeStep >= 3 ? '#FFF6E5' : '#1B1B1F'}
          fontSize="12"
          fontWeight="bold"
        >
          {amountSats} sats ✓
        </text>
      </g>

      {/* Node 1: Customer Koffi */}
      <g>
        <rect
          x="22"
          y="52"
          width="105"
          height="50"
          rx="12"
          fill="#FFFDF9"
          stroke="#1B1B1F"
          strokeWidth="2"
        />
        <text x="74" y="74" textAnchor="middle" fill="#1F2A6B" fontSize="13" fontWeight="bold">
          Koffi
        </text>
        <text x="74" y="91" textAnchor="middle" fill="#D9582B" fontSize="11" fontWeight="bold">
          {lang === 'fr' ? 'Départ' : 'Sender'}
        </text>
      </g>

      {/* Intermediate Hop 1: Coopérative */}
      <g>
        <rect
          x="232"
          y="52"
          width="96"
          height="50"
          rx="12"
          fill={activeStep >= 1 ? '#1F2A6B' : '#FFFDF9'}
          stroke="#1B1B1F"
          strokeWidth="2"
        />
        <text
          x="280"
          y="74"
          textAnchor="middle"
          fill={activeStep >= 1 ? '#FFF6E5' : '#1F2A6B'}
          fontSize="12"
          fontWeight="bold"
        >
          {lang === 'fr' ? 'Saut 1 : Coop' : 'Hop 1: Co-op'}
        </text>
        <text
          x="280"
          y="91"
          textAnchor="middle"
          fill={activeStep >= 1 ? '#F2B01E' : '#D9582B'}
          fontSize="11"
          fontWeight="bold"
        >
          {lang === 'fr' ? 'Frais : 2 sats' : 'Fee: 2 sats'}
        </text>
      </g>

      {/* Intermediate Hop 2: Grossiste */}
      <g>
        <rect
          x="416"
          y="52"
          width="96"
          height="50"
          rx="12"
          fill={activeStep >= 2 ? '#1F2A6B' : '#FFFDF9'}
          stroke="#1B1B1F"
          strokeWidth="2"
        />
        <text
          x="464"
          y="74"
          textAnchor="middle"
          fill={activeStep >= 2 ? '#FFF6E5' : '#1F2A6B'}
          fontSize="12"
          fontWeight="bold"
        >
          {lang === 'fr' ? 'Saut 2 : Relais' : 'Hop 2: Relay'}
        </text>
        <text
          x="464"
          y="91"
          textAnchor="middle"
          fill={activeStep >= 2 ? '#F2B01E' : '#D9582B'}
          fontSize="11"
          fontWeight="bold"
        >
          {lang === 'fr' ? 'Frais : 1 sat' : 'Fee: 1 sat'}
        </text>
      </g>

      {/* Node 4: Your Stall */}
      <g>
        <rect
          x="566"
          y="52"
          width="94"
          height="50"
          rx="12"
          fill={activeStep >= 3 ? '#2E7D4F' : '#FFFDF9'}
          stroke="#1B1B1F"
          strokeWidth="2"
        />
        <text
          x="613"
          y="74"
          textAnchor="middle"
          fill={activeStep >= 3 ? '#FFF6E5' : '#1F2A6B'}
          fontSize="12"
          fontWeight="bold"
        >
          {lang === 'fr' ? 'Votre Étal' : 'Your Stall'}
        </text>
        <text
          x="613"
          y="91"
          textAnchor="middle"
          fill={activeStep >= 3 ? '#FFF6E5' : '#2E7D4F'}
          fontSize="11"
          fontWeight="bold"
        >
          +{amountSats} sats ✓
        </text>
      </g>

      {/* Bottom Caption */}
      <text x="340" y="138" textAnchor="middle" fill="#1B1B1F" fontSize="13" fontWeight="bold">
        {lang === 'fr'
          ? `Koffi envoie ${hop1Sats} sats → Saut 1 garde 2 sats → Saut 2 garde 1 sat → Vous recevez ${amountSats} sats !`
          : `Koffi sends ${hop1Sats} sats → Hop 1 takes 2 sats → Hop 2 takes 1 sat → You receive ${amountSats} sats!`}
      </text>
    </svg>
  );
}

/**
 * Deterministic flat SVG QR code generator from an invoice string
 * Zero external dependencies, <2KB, instant render.
 */
export function InvoiceQrSvg({
  paymentRequest,
  expired = false,
  paid = false,
}: {
  paymentRequest: string;
  expired?: boolean;
  paid?: boolean;
}) {
  const size = 15;
  const cells: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const isFinderArea = (r: number, c: number) => {
    const topLeft = r < 4 && c < 4;
    const topRight = r < 4 && c >= size - 4;
    const bottomLeft = r >= size - 4 && c < 4;
    const centerIcon = r >= 6 && r <= 8 && c >= 6 && c <= 8;
    return topLeft || topRight || bottomLeft || centerIcon;
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinderArea(r, c)) continue;
      const charIdx = (r * size + c) % paymentRequest.length;
      const code = paymentRequest.charCodeAt(charIdx) + r * 7 + c * 13;
      cells[r][c] = code % 2 === 0;
    }
  }

  return (
    <div className="relative inline-flex items-center justify-center p-3 bg-white rounded-2xl border-2 border-[#1B1B1F]">
      <svg
        viewBox="0 0 170 170"
        className={`w-40 h-40 ${expired ? 'opacity-35' : 'opacity-100'}`}
        role="img"
        aria-label="Code QR de la facture Lightning"
      >
        <rect x="0" y="0" width="170" height="170" rx="8" fill="#FFFFFF" />
        {/* 3 Finder squares */}
        {[
          [10, 10],
          [120, 10],
          [10, 120],
        ].map(([fx, fy], idx) => (
          <g key={idx}>
            <rect
              x={fx}
              y={fy}
              width="36"
              height="36"
              rx="4"
              fill="none"
              stroke="#1F2A6B"
              strokeWidth="6"
            />
            <rect x={fx + 10} y={fy + 10} width="16" height="16" rx="2" fill="#1B1B1F" />
          </g>
        ))}

        {/* Data dots */}
        {cells.map((row, rIdx) =>
          row.map((active, cIdx) =>
            active ? (
              <rect
                key={`${rIdx}-${cIdx}`}
                x={10 + cIdx * 10}
                y={10 + rIdx * 10}
                width="8"
                height="8"
                rx="1.5"
                fill="#1B1B1F"
              />
            ) : null
          )
        )}

        {/* Center Saffron Lightning Badge */}
        <rect
          x="68"
          y="68"
          width="34"
          height="34"
          rx="8"
          fill="#FFF6E5"
          stroke="#1B1B1F"
          strokeWidth="2"
        />
        <path
          d="M87 73L77 86H85L83 97L93 84H85L87 73Z"
          fill="#F2B01E"
          stroke="#1B1B1F"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {paid && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#2E7D4F]/90 rounded-2xl p-3 text-center">
          <div className="bg-[#FFF6E5] border-2 border-[#1B1B1F] rounded-2xl px-4 py-2 font-display font-bold text-[#2E7D4F] text-lg shadow-sm">
            ✓ PAYÉE / PAID
          </div>
        </div>
      )}

      {expired && !paid && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#D9582B]/90 rounded-2xl p-3 text-center">
          <div className="bg-[#FFF6E5] border-2 border-[#1B1B1F] rounded-2xl px-4 py-2 font-display font-bold text-[#D9582B] text-lg shadow-sm">
            ✕ EXPIRÉE / EXPIRED
          </div>
        </div>
      )}
    </div>
  );
}
