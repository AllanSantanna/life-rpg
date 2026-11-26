import { useEffect, useId, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useAnchoredPopover } from './useAnchoredPopover';

/**
 * Ajuda contextual: botão circular “?” ao lado de um título ou rótulo que abre
 * uma janela compacta, não modal, com a explicação daquele conceito.
 *
 * Reutiliza `useAnchoredPopover` (portal, posição dentro da viewport, acima da
 * navegação inferior, clique fora e movimento reduzido), como `ActionMenu` e
 * `CustomSelect`. Enter/Espaço abrem; Esc ou “Fechar ajuda” fecham e devolvem
 * o foco ao “?”; levar o foco para fora também fecha. Abrir não altera o
 * layout da página nem dados: o texto só é montado enquanto a ajuda está aberta.
 */
export function ContextHelp({
  title,
  label,
  children,
}: {
  /** Título exibido na janela de ajuda. */
  title: string;
  /** Nome acessível do botão; padrão “Ajuda sobre {título}”. */
  label?: string;
  /** Texto explicativo (parágrafos curtos ou listas). */
  children: ReactNode;
}) {
  const id = useId();
  const { anchor, panel, open, mounted, position, show, close } =
    useAnchoredPopover({
      minimumWidth: 260,
      maximumWidth: 340,
      preferredHeight: 220,
      maximumHeight: 420,
      bottomInset: fixedBottomBar,
    });
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true });
  }, [open, panel]);
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    // Não fecha outros diálogos (ex.: formulário de confirmação) ao mesmo tempo.
    event.stopPropagation();
    close(true);
  }
  const name = label ?? `Ajuda sobre ${title.toLocaleLowerCase('pt-BR')}`;
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="context-help__trigger"
        aria-label={name}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={mounted ? `${id}-help` : undefined}
        onClick={() => (open ? close(true) : show())}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') onKeyDown(event);
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {mounted &&
        createPortal(
          <div
            ref={panel}
            id={`${id}-help`}
            role="dialog"
            aria-labelledby={`${id}-title`}
            aria-hidden={!open || undefined}
            inert={!open}
            tabIndex={-1}
            className="context-help__panel"
            data-state={open ? 'open' : 'closing'}
            style={position}
            onKeyDown={onKeyDown}
          >
            <div className="context-help__head">
              <h2 id={`${id}-title`}>{title}</h2>
              <button
                type="button"
                className="context-help__close"
                aria-label="Fechar ajuda"
                onClick={() => close(true)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="context-help__body">{children}</div>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Altura de uma barra fixa na base da tela (a navegação inferior no celular e
 * tablet), para a ajuda não ficar sobre ela. Elementos marcados com
 * `data-bottom-bar` ou a navegação lateral quando posicionada embaixo.
 */
function fixedBottomBar() {
  const bar = document.querySelector<HTMLElement>(
    '[data-bottom-bar], .sidebar',
  );
  if (!bar || getComputedStyle(bar).position !== 'fixed') return 0;
  const rect = bar.getBoundingClientRect();
  return rect.top > window.innerHeight / 2 ? window.innerHeight - rect.top : 0;
}

/** Título de seção com ajuda contextual ao lado. */
export function HelpHeading({
  as: Heading = 'h2',
  id,
  title,
  help,
  className,
}: {
  as?: 'h2' | 'h3';
  id?: string;
  title: ReactNode;
  help: ReactNode;
  className?: string;
}) {
  return (
    <div className={`help-heading${className ? ` ${className}` : ''}`}>
      <Heading id={id}>{title}</Heading>
      {help}
    </div>
  );
}
