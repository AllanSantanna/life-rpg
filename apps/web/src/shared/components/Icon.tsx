import type { CSSProperties } from 'react';

const paths = {
  mountain: 'm2 20 6-8 3 3 5-9 6 14-6-5-3 3-4-3-7 5M16 6V2l5 1-5 2',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  sword: 'm14 3 7 0 0 7-12 12-7-7Zm0 0 7 7M4 16l-2 2m4 0-3 3m-1-9 10 10',
  chart: 'M4 3v17h17M8 15v-4m5 4V7m5 8V4',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  flame:
    'M12 3c2 5 7 6 7 11a7 7 0 0 1-14 0c0-3 2-6 4-7 0 3 1 4 2 4 2-2 1-5 1-8Z',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7Z',
  book: 'M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2Z',
  wallet: 'M20 8V5H5a2 2 0 0 1 0-4h13M3 3v16a2 2 0 0 0 2 2h15V8Zm17 4h-5v5h5',
  dumbbell: 'm6 6 12 12M3 8l5-5M2 5l3-3m11 19 5-5m-2 6 3-3M4 12l8-8m0 16 8-8',
  moon: 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z',
  trophy:
    'M8 3h8v7a4 4 0 0 1-8 0Zm0 2H3v3a4 4 0 0 0 5 4m8-7h5v3a4 4 0 0 1-5 4m-4 2v6m-4 1h8',
  shield: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Zm-4 10 3 3 5-6',
  target:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-4 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-5-1v2',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  check: 'm5 12 4 4L19 6',
  chevron: 'm9 5 7 7-7 7',
  sparkle: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
  lock: 'M6 10h12v11H6Zm3 0V6a3 3 0 0 1 6 0v4',
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  className = '',
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
