/** Local SVG shared with the favicon and installable PWA assets. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-logo" role="img" aria-label="Life RPG">
      <img
        src={`${import.meta.env.BASE_URL}icons/icon.svg`}
        width="44"
        height="44"
        alt=""
      />
      {!compact && (
        <span className="brand-logo__name" aria-hidden="true">
          Life <span>RPG</span>
        </span>
      )}
    </span>
  );
}
