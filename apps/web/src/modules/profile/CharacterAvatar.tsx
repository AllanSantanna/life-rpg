/** Retratos SVG originais do Life RPG, sem imagens ou fontes externas. */
export function CharacterAvatar({
  avatar,
  name,
  className = '',
}: {
  avatar: string;
  name?: string;
  className?: string;
}) {
  const mage = avatar === 'mage',
    knight = avatar === 'knight',
    ranger = avatar === 'ranger';
  const accent = mage
    ? '#ba9fe9'
    : ranger
      ? '#9ebfa3'
      : knight
        ? '#dbb782'
        : '#e58e83';
  return (
    <div
      role={name ? 'img' : undefined}
      aria-label={name ? `Avatar de ${name}` : undefined}
      aria-hidden={name ? undefined : true}
      className={`character-avatar ${className}`}
      data-avatar={avatar}
    >
      <svg viewBox="0 0 120 140" fill="none" aria-hidden="true">
        <path fill="#170e15" d="M0 0h120v140H0z" />
        <circle
          cx="60"
          cy="53"
          r="43"
          fill={mage ? '#33203f' : ranger ? '#20342e' : '#462028'}
        />
        <path
          d="m12 140 9-35 28-17h22l28 17 9 35"
          fill={mage ? '#41314e' : ranger ? '#33463a' : '#35343f'}
          stroke={accent}
          strokeWidth="2"
        />
        <path d="m48 83 1 16 11 10 12-10-2-19" fill="#b87d62" />
        <path
          d="M39 48q0-27 21-27t22 27l-3 28-19 18-18-18Z"
          fill={knight || ranger ? '#c79170' : '#e3b58b'}
        />
        <path
          d="m39 61-7-15 7-23L58 9l26 14 6 24-9 16-3-24-17-10-17 13Z"
          fill={knight ? '#d4c1ac' : mage ? '#d4c7c3' : '#211a22'}
        />
        <path
          d="m47 58 7-1m13 0 7 1m-19 19h11"
          stroke="#402932"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {mage && (
          <>
            <path
              d="m25 42 15-19L56 1l16 21 22 20-34-6Z"
              fill="#493552"
              stroke={accent}
              strokeWidth="2"
            />
            <path d="m48 79 12 35 15-36-15 11Z" fill="#d4c7c3" />
            <path d="m59 10 3 7-4 5-3-5Z" fill={accent} />
          </>
        )}
        {knight && (
          <>
            <path
              d="m26 105 23-12 11 18 13-18 22 12-9 29H35Z"
              fill="#626273"
              stroke={accent}
              strokeWidth="2"
            />
            <path d="m57 22 4-14 5 14-5 11Z" fill="#c25666" />
            <path
              d="m22 108 15-7 7 19-21 6m74-18-14-7-7 19 21 6"
              fill="#87828b"
              stroke={accent}
              strokeWidth="2"
            />
          </>
        )}
        {ranger && (
          <>
            <path
              d="m30 60 4-33L60 6l26 21 4 33-13-23-17-13-17 13Z"
              fill="#35513d"
              stroke={accent}
              strokeWidth="2"
            />
            <path d="m25 107 26-17 9 27 11-27 25 17-17 33H43Z" fill="#3c5140" />
            <path
              d="m86 100 12-48m-8 16 10-5m-12 13 10-5"
              stroke="#bfa27a"
              strokeWidth="3"
            />
          </>
        )}
        {!mage && !knight && !ranger && (
          <>
            <path
              d="m18 109 29-20 13 25 13-25 29 20-25 31H40Z"
              fill="#612935"
              stroke={accent}
              strokeWidth="2"
            />
            <path
              d="m33 108 42 32m-32 0 42-32"
              stroke="#bf9767"
              strokeWidth="5"
            />
          </>
        )}
        <path d="m60 114 5 8-5 8-5-8Z" fill={accent} />
      </svg>
    </div>
  );
}
