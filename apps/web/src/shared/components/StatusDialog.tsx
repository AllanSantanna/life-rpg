import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ActionButton } from './ActionButton';
import { Icon, type IconName } from './Icon';

export interface StatusDialogAction {
  label: string;
  onClick: () => void;
  /** Rótulo exibido enquanto `busy` estiver ativo (ex.: “Finalizando…”). */
  busyLabel?: string;
}

/**
 * Diálogo modal de revisão ou confirmação de uma operação. Sem regras de
 * domínio: quem chama decide quando a operação terminou de verdade.
 * Foco inicial no botão indicado, Escape fecha quando não há operação em
 * andamento e o foco volta ao elemento de origem (ou ao `returnFocus`).
 * Abre uma vez por montagem: troque a `key` para apresentar outra etapa.
 */
export function StatusDialog({
  tone,
  title,
  message,
  summary,
  children,
  error,
  primary,
  secondary,
  busy = false,
  initialFocus = 'primary',
  onClose,
  returnFocus,
}: {
  tone: 'success' | 'review';
  title: string;
  message: string;
  summary?: readonly { label: string; value: ReactNode }[];
  children?: ReactNode;
  error?: string | null;
  primary: StatusDialogAction;
  secondary?: StatusDialogAction;
  busy?: boolean;
  initialFocus?: 'primary' | 'secondary';
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  const secondaryButton = useRef<HTMLButtonElement>(null);
  const fallback = useRef(returnFocus);
  fallback.current = returnFocus;
  const firstFocus = useRef(initialFocus);
  const id = useId();
  const icon: IconName = tone === 'success' ? 'check' : 'clipboard';
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') {
      if (!element.open) element.showModal();
    } else element.setAttribute('open', '');
    (firstFocus.current === 'secondary' && secondaryButton.current
      ? secondaryButton.current
      : primaryButton.current
    )?.focus();
    return () => {
      if (typeof element.close === 'function' && element.open) element.close();
      else element.removeAttribute('open');
      // `body` indica que a origem já saiu da tela (ex.: formulário fechado).
      if (
        previous instanceof HTMLElement &&
        previous !== document.body &&
        previous.isConnected
      )
        previous.focus();
      else fallback.current?.()?.focus();
    };
  }, []);
  // Botões desabilitados perdem o foco; ao terminar, ele volta ao diálogo.
  useEffect(() => {
    if (!busy && !dialog.current?.contains(document.activeElement))
      primaryButton.current?.focus();
  }, [busy]);
  return (
    <dialog
      ref={dialog}
      className="status-dialog"
      data-tone={tone}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <span className="status-dialog__icon" aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <h2 id={`${id}-title`}>{title}</h2>
      <p id={`${id}-message`} className="status-dialog__message">
        {message}
      </p>
      {summary && summary.length > 0 && (
        <dl className="status-dialog__summary">
          {summary.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {error && (
        <p role="alert" className="record-error status-dialog__error">
          {error}
        </p>
      )}
      <div className="status-dialog__actions">
        {secondary && (
          <button
            ref={secondaryButton}
            type="button"
            className="filter-button"
            disabled={busy}
            onClick={secondary.onClick}
          >
            {busy && secondary.busyLabel
              ? secondary.busyLabel
              : secondary.label}
          </button>
        )}
        <ActionButton
          ref={primaryButton}
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={primary.onClick}
        >
          {busy && primary.busyLabel ? primary.busyLabel : primary.label}
        </ActionButton>
      </div>
    </dialog>
  );
}
