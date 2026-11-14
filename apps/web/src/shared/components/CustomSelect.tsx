import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { useAnchoredPopover } from './useAnchoredPopover';

export interface SelectOption<Value extends string> {
  value: Value;
  label: string;
  disabled?: boolean;
  icon?: IconName;
  area?: string;
}
interface Props<Value extends string> {
  label: string;
  value?: Value | undefined;
  defaultValue?: Value | undefined;
  options: readonly SelectOption<Value>[];
  onChange?: (value: Value) => void;
  name?: string;
  disabled?: boolean;
  compact?: boolean;
  icon?: IconName;
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

/** Select-only combobox: foco no botão, opções ativas via aria-activedescendant. */
export function CustomSelect<Value extends string>({
  label,
  value: controlledValue,
  defaultValue,
  options,
  onChange,
  name,
  disabled = false,
  compact = false,
  icon,
}: Props<Value>) {
  const [localValue, setLocalValue] = useState<Value>(
    () =>
      defaultValue ??
      options.find((option) => !option.disabled)?.value ??
      ('' as Value),
  );
  const fallback =
    options.find((option) => !option.disabled)?.value ?? ('' as Value);
  const value =
    controlledValue ??
    (options.some((option) => option.value === localValue)
      ? localValue
      : fallback);
  const id = useId();
  const listId = `${id}-options`;
  const typed = useRef({ text: '', time: 0 });
  const resetTypeahead = useCallback(() => {
    typed.current = { text: '', time: 0 };
  }, []);
  const [active, setActive] = useState(-1);
  const {
    anchor: trigger,
    panel: popup,
    open,
    mounted,
    position,
    show: showPopover,
    close: closePopover,
  } = useAnchoredPopover({
    minimumWidth: compact ? 220 : 0,
    preferredHeight: Math.min(180, options.length * 44 + 12),
    beforeClose: resetTypeahead,
  });
  const selected = options.find((option) => option.value === value);
  const enabled = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index !== -1);
  const unavailable = disabled || enabled.length === 0;

  function close(restoreFocus = false) {
    typed.current = { text: '', time: 0 };
    closePopover(restoreFocus);
  }
  function show(index?: number) {
    if (unavailable) return;
    showPopover();
    const selectedIndex = options.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    setActive(index ?? (selectedIndex >= 0 ? selectedIndex : enabled[0]!));
  }
  function choose(index: number) {
    const option = options[index];
    if (unavailable || !option || option.disabled) return;
    close(true);
    if (option.value !== value) {
      if (controlledValue === undefined) setLocalValue(option.value);
      onChange?.(option.value);
    }
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (unavailable) return;
    const key = event.key;
    if (key === 'Tab') {
      if (open) close();
      return;
    }
    if (key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (open) choose(active);
      else show();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      if (key === 'Home' || key === 'End') {
        const index = key === 'Home' ? enabled[0]! : enabled.at(-1)!;
        if (open) setActive(index);
        else show(index);
      } else if (!open) show();
      else {
        const offset = enabled.indexOf(active);
        setActive(
          enabled[
            (offset + (key === 'ArrowDown' ? 1 : -1) + enabled.length) %
              enabled.length
          ]!,
        );
      }
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const letter = normalize(key);
      const prefix =
        Date.now() - typed.current.time < 700 ? typed.current.text : '';
      let term = prefix + letter;
      if ([...term].every((character) => character === letter)) term = letter;
      typed.current = { text: term, time: Date.now() };
      const start = open
        ? Math.max(0, enabled.indexOf(active) + (term.length === 1 ? 1 : 0))
        : 0;
      for (let offset = 0; offset < enabled.length; offset++) {
        const index = enabled[(start + offset) % enabled.length]!;
        if (normalize(options[index]!.label).startsWith(term)) {
          if (open) setActive(index);
          else show(index);
          break;
        }
      }
    }
  }

  useLayoutEffect(() => {
    if (open)
      popup.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
  }, [open, active, popup]);

  useEffect(() => {
    if (controlledValue === undefined && localValue !== value)
      setLocalValue(value);
  }, [controlledValue, localValue, value]);

  useEffect(() => {
    if (open && unavailable) closePopover();
  }, [open, unavailable, closePopover]);

  return (
    <span
      className={`custom-select${compact ? ' custom-select--compact' : ''}`}
    >
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-describedby={`${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={mounted ? listId : undefined}
        aria-activedescendant={
          open && active >= 0 ? `${id}-option-${active}` : undefined
        }
        disabled={unavailable}
        className="custom-select__trigger"
        data-area={selected?.area}
        onClick={() => (open ? close(true) : show())}
        onKeyDown={keyDown}
      >
        {(selected?.icon || icon) && (
          <Icon
            name={selected?.icon ?? icon!}
            size={17}
            className="custom-select__icon"
          />
        )}
        <span id={`${id}-value`}>{selected?.label ?? value}</span>
        <Icon name="chevron" size={14} className="custom-select__chevron" />
      </button>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          disabled={disabled || !selected || selected.disabled}
        />
      )}
      {mounted &&
        createPortal(
          <div
            ref={popup}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-hidden={!open || undefined}
            inert={!open}
            className="custom-select__popup"
            data-state={open ? 'open' : 'closing'}
            style={position}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                data-index={index}
                data-highlighted={open && index === active}
                data-area={option.area}
                className="custom-select__option"
                onPointerMove={() => {
                  if (!option.disabled && active !== index) setActive(index);
                }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                {option.icon && (
                  <Icon
                    name={option.icon}
                    size={16}
                    className="custom-select__icon"
                  />
                )}
                <span>{option.label}</span>
                {option.value === value && (
                  <Icon
                    name="check"
                    size={16}
                    className="custom-select__check"
                  />
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}
