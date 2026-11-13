/** Ilustrações vetoriais originais; sem dependências ou imagens externas. */
export function JourneyLandscape() {
  return (
    <svg
      className="journey-landscape"
      viewBox="0 0 900 260"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="blood-moon">
          <stop stopColor="#fa5546" />
          <stop offset="1" stopColor="#8c111b" />
        </radialGradient>
        <linearGradient id="night-sky" x2="0" y2="1">
          <stop stopColor="#210b10" />
          <stop offset="1" stopColor="#7f1d1d" />
        </linearGradient>
      </defs>
      <path fill="url(#night-sky)" d="M0 0h900v260H0z" />
      <circle cx="716" cy="100" r="78" fill="url(#blood-moon)" />
      <path
        fill="#45131c"
        d="m0 215 100-88 55 40 92-81 91 94 92-42 87 38 85-69 86 75 70-38 142 60v56H0Z"
      />
      <path
        fill="#1a1015"
        d="m0 245 132-69 78 52 145-98 103 91 98-45 101 51 104-73 139 64v42H0Z"
      />
      <path
        fill="#090909"
        d="m0 260 178-40 99 23 122-46 143 52 108-33 81 18 75-25 94 18v33Z M753 209v-65h12v-35l8-26 8 26v35h13v-60l7-25 7 25v60h13v-34l9-25 9 25v34h12v65Z"
      />
      <path fill="#dc2626" d="M800 60V35l27 8-27 9" />
    </svg>
  );
}
export function HeroPortrait() {
  return (
    <svg viewBox="0 0 120 145" aria-hidden="true" className="hero-portrait">
      <defs>
        <linearGradient id="hero-bg" x2="1" y2="1">
          <stop stopColor="#7f1d1d" />
          <stop offset="1" stopColor="#160c10" />
        </linearGradient>
      </defs>
      <path
        d="m60 3 53 28v80l-53 31-53-31V31Z"
        fill="url(#hero-bg)"
        stroke="#ff6655"
        strokeWidth="3"
      />
      <path d="m60 10 46 25v72l-46 27-46-27V35Z" fill="none" stroke="#dca15d" />
      <path
        d="m20 112 8-23 22-10 30 2 20 25-40 27Z"
        fill="#191c23"
        stroke="#ba7b3c"
        strokeWidth="2"
      />
      <path d="m47 85 4-23 26-5 2 29-15 17Z" fill="#bb7751" />
      <path
        d="m42 43 36-7 6 18 10 11-12 5-3 12-15 5-20-19Z"
        fill="#edb982"
        stroke="#29191a"
        strokeWidth="2"
      />
      <path
        d="m29 66 6-27 12-9 3-13 13 9 18-6-2 13 12 10-11 7-17-8-5 13-12-2-1 20Z"
        fill="#211b1c"
        stroke="#b67b49"
        strokeWidth="2"
      />
      <path
        d="m70 55 9-1m-6 20 8-2"
        fill="none"
        stroke="#3b2220"
        strokeWidth="2"
      />
      <path
        d="m25 94 22 9 15 27-31-20m48-21-15 15"
        fill="none"
        stroke="#dba94f"
        strokeWidth="3"
      />
      <path d="m33 100 8 5-3 9-7-5Z" fill="#dc2626" />
    </svg>
  );
}
