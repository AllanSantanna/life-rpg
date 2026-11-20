import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Seção recolhível oficial: botão com `aria-expanded`/`aria-controls` dentro do
 * título e seta que gira. O conteúdo só é montado quando aberto, evitando listas
 * longas na página. Para reiniciar o estado (ex.: outro item selecionado),
 * troque a `key` no componente pai.
 */
export function Disclosure({
  title,
  label,
  level = 2,
  defaultOpen = false,
  className = 'panel record-section',
  variant = 'section',
  count,
  hint,
  animated = false,
  children,
}: {
  title: string;
  /** Nome acessível quando o título visível se repete (ex.: em cartões). */
  label?: string;
  level?: 2 | 3 | 4 | 5 | 6;
  defaultOpen?: boolean;
  className?: string;
  /** `text`: ação textual oficial (`.text-action`), usada dentro de cartões. */
  variant?: 'section' | 'text';
  /** Quantidade exibida no título, como “Título (6)”. */
  count?: number;
  /** Texto visual ao lado da seta; o estado já é anunciado por `aria-expanded`. */
  hint?: { open: string; closed: string };
  /** Entrada discreta do conteúdo; desligada com movimento reduzido. */
  animated?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const Heading = (['h2', 'h3', 'h4', 'h5', 'h6'] as const)[level - 2]!;
  const chevron = (
    <Icon name="chevron" size={18} className="disclosure__chevron" />
  );
  return (
    <section
      className={`${className} disclosure`}
      aria-labelledby={`${id}-title`}
    >
      <Heading className="disclosure__heading">
        <button
          type="button"
          className={variant === 'text' ? 'text-action' : undefined}
          id={`${id}-title`}
          aria-expanded={open}
          aria-label={label}
          aria-controls={`${id}-content`}
          onClick={() => setOpen((value) => !value)}
        >
          <span>
            {title}
            {count !== undefined && ` (${count})`}
          </span>
          {hint ? (
            <span className="disclosure__toggle">
              <span className="disclosure__hint" aria-hidden="true">
                {open ? hint.open : hint.closed}
              </span>
              {chevron}
            </span>
          ) : (
            chevron
          )}
        </button>
      </Heading>
      <div
        id={`${id}-content`}
        className={animated ? 'disclosure__content' : undefined}
        hidden={!open}
      >
        {open && children}
      </div>
    </section>
  );
}
