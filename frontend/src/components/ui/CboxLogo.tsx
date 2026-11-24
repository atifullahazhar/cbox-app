import React from 'react';

interface CboxLogoProps {
  size?: number;
  showWordmark?: boolean;
}

export const CboxLogo: React.FC<CboxLogoProps> = ({ size = 34, showWordmark = true }) => (
  <div className="inline-flex items-center gap-2.5 select-none">
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="12"
        className="fill-cbox-surface stroke-cbox-accent"
        strokeWidth="2.5"
      />
      <path
        d="M31.5 16.5C29.3 14.3 26.3 13 23 13C16.9 13 12 17.9 12 24C12 30.1 16.9 35 23 35C26.3 35 29.3 33.7 31.5 31.5"
        className="stroke-cbox-accent"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <circle cx="33" cy="24" r="3.6" className="fill-cbox-violet" />
    </svg>
    {showWordmark && (
      <span className="text-xl font-bold tracking-tight text-cbox-text">
        Cbox
      </span>
    )}
  </div>
);
