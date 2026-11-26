import { useEffect, useId, useRef } from 'react';
import { ActionButton } from '../../shared/components/ActionButton';
import { Icon } from '../../shared/components/Icon';
import { releaseLabel, type Release } from './releases';
import './whatsNew.css';

/**
 * Novidades da versão: modal nativo (top layer), como os demais diálogos do
 * aplicativo. Pode ser fechado imediatamente pelo ×, por “Começar a usar” ou
 * por Escape; nada exige leitura, rolagem ou interação com os cartões. O
 * cabeçalho e o rodapé ficam fixos e só a lista rola, então o × e o botão
 * inferior estão sempre visíveis. O foco inicial vai para “Começar a usar”
 * e, ao fechar, volta ao elemento de origem (ou a `returnFocus`).
 */
export function WhatsNewDialog({
  release,
  onClose,
  returnFocus,
}: {
  release: Release;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const fallback = useRef(returnFocus);
  fallback.current = returnFocus;
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') {
      if (!element.open) element.showModal();
    } else element.setAttribute('open', '');
    primary.current?.focus();
    return () => {
      if (typeof element.close === 'function' && element.open) element.close();
      else element.removeAttribute('open');
      if (
        previous instanceof HTMLElement &&
        previous !== document.body &&
        previous.isConnected
      )
        previous.focus();
      else fallback.current?.()?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="whats-new-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-intro`}
      onCancel={(event) => {
        // Escape: fecha pelo mesmo caminho dos botões (registra a versão).
        event.preventDefault();
        onClose();
      }}
    >
      <div className="panel whats-new">
        <header className="whats-new__header">
          <span className="whats-new__badge" aria-hidden="true">
            <Icon name="sparkle" size={20} />
          </span>
          <div className="whats-new__heading">
            <p className="eyebrow whats-new__eyebrow">
              {releaseLabel(release)}
            </p>
            <h2 id={`${id}-title`}>Novidades da versão</h2>
            <p id={`${id}-intro`} className="whats-new__intro">
              Confira as melhorias que chegaram ao Life RPG.
            </p>
          </div>
          <button
            type="button"
            className="quick-dialog__close whats-new__close"
            aria-label="Fechar novidades da versão"
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="whats-new__body">
          {release.groups.map((group, index) => (
            <section
              key={group.title}
              className="whats-new__group"
              aria-labelledby={`${id}-group-${index}`}
            >
              <h3
                id={`${id}-group-${index}`}
                className="whats-new__group-title"
              >
                {group.title}
              </h3>
              <ul className="whats-new__list">
                {group.items.map((item) => (
                  <li key={item.id} className="whats-new__item">
                    <span className="whats-new__icon" aria-hidden="true">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <div>
                      <p className="whats-new__item-title">{item.title}</p>
                      <p className="whats-new__item-text">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <footer className="whats-new__footer">
          <ActionButton ref={primary} onClick={onClose}>
            Começar a usar
          </ActionButton>
        </footer>
      </div>
    </dialog>
  );
}
