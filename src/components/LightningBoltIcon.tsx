import React from 'react';

export function LightningBoltSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M13 2L4 14H12L11 22L20 10H12L13 2Z"
        fill="#F2B01E"
        stroke="#1B1B1F"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
