import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { useAnchoredPopover } from './useAnchoredPopover';

export interface ActionMenuItem {
  id: string;
  label: string;
  /** Nome acessível completo, iniciado pelo texto visível. */
  accessibleLabel?: string;
  icon: IconName;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * Menu de ações secundárias. Reutiliza `useAnchoredPopover` (portal, posição
 * dentro da viewport, clique fora e movimento reduzido) e o visual do popup de
 * `CustomSelect` (`.custom-select__popup` / `.custom-select__option`). O
 * gatilho é a ação textual oficial `.text-action`.
 */
export function ActionMenu({
  label,
  accessibleLabel,
  items,
}: {
  label: ReactNode;
  accessibleLabel: string;
  items: readonly ActionMenuItem[];
}) {
  const id = useId();
  const [active, setActive] = useState(0);
  const { anchor, panel, open, mounted, position, show, close } =
    useAnchoredPopover({
      minimumWidth: 220,
      maximumWidth: 280,
      preferredHeight: Math.min(240, items.length * 44 + 12),
      maximumHeight: 320,
    });
  const enabled = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index !== -1);

  function openAt(index: number) {
    if (!enabled.length) return;
    setActive(index);
    show();
  }
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.focus({ preventScroll: true });
  }, [open, active, panel]);

  function triggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      openAt(enabled[0]!);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(enabled.at(-1)!);
    }
  }
  function itemKey(event: KeyboardEvent<HTMLButtonElement>) {
    const offset = enabled.indexOf(active);
    const next =
      event.key === 'ArrowDown'
        ? enabled[(offset + 1) % enabled.length]
        : event.key === 'ArrowUp'
          ? enabled[(offset - 1 + enabled.length) % enabled.length]
          : event.key === 'Home'
            ? enabled[0]
            : event.key === 'End'
              ? enabled.at(-1)
              : undefined;
    if (next !== undefined) {
      event.preventDefault();
      setActive(next);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      close();
    }
  }
  function choose(item: ActionMenuItem) {
    if (item.disabled) return;
    close(true);
    item.onSelect();
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="text-action"
        aria-label={accessibleLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={mounted ? `${id}-menu` : undefined}
        onClick={() => (open ? close(true) : openAt(enabled[0] ?? 0))}
        onKeyDown={triggerKey}
      >
        {label}
        <Icon name="chevron" size={16} className="action-menu__chevron" />
      </button>
      {mounted &&
        createPortal(
          <div
            ref={panel}
            id={`${id}-menu`}
            role="menu"
            aria-label={accessibleLabel}
            aria-hidden={!open || undefined}
            inert={!open}
            className="custom-select__popup action-menu"
            data-state={open ? 'open' : 'closing'}
            style={position}
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={index === active ? 0 : -1}
                data-index={index}
                data-highlighted={open && index === active}
                aria-label={item.accessibleLabel}
                aria-disabled={item.disabled || undefined}
                className="custom-select__option"
                onPointerMove={() => {
                  if (!item.disabled && active !== index) setActive(index);
                }}
                onKeyDown={itemKey}
                onClick={() => choose(item)}
              >
                <Icon
                  name={item.icon}
                  size={16}
                  className="custom-select__icon"
                />
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
