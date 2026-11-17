import { useId } from 'react';

/** Símbolo do Planeja-se: um "P" com uma moeda laranja que aponta para cima (o próximo passo). */
export function BrandMark({ size = 30 }: { size?: number }) {
  const gradient = useId();
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#23915f" />
          <stop offset="1" stopColor="#0f4c35" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gradient})`} />
      <rect x="16" y="12" width="8" height="40" rx="4" fill="#fff" />
      <path
        d="M20 16h17a12 12 0 0 1 0 24H20"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="47" cy="48" r="8" fill="#e6974f" stroke="#12563b" strokeWidth="3" />
      <path
        d="M43.9 50.2l3.1-3.1 3.1 3.1"
        fill="none"
        stroke="#fff7ea"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
