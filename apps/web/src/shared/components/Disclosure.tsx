import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Seção recolhível: botão com `aria-expanded` dentro do título e seta que gira.
 * O conteúdo só é montado quando aberto, evitando listas longas na página.
 * Para reiniciar o estado (ex.: outro item selecionado), troque a `key`.
 * Reutiliza as classes `.finance-disclosure*` da versão local de Finanças, para
 * não duplicar estilos; a migração daquela cópia para este componente é pendente.
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
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const Heading = (['h2', 'h3', 'h4', 'h5', 'h6'] as const)[level - 2]!;
  return (
    <section
      className={`${className} finance-disclosure`}
      aria-labelledby={`${id}-title`}
    >
      <Heading className="finance-disclosure__heading">
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
          <span className="disclosure__toggle">
            {hint && (
              <span className="disclosure__hint" aria-hidden="true">
                {open ? hint.open : hint.closed}
              </span>
            )}
            <Icon
              name="chevron"
              size={18}
              className="finance-disclosure__chevron"
            />
          </span>
        </button>
      </Heading>
      <div id={`${id}-content`} className="disclosure__content" hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}
