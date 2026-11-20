import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useAnchoredPopover } from './useAnchoredPopover';
import {
  currentTime,
  hours,
  isTimeValue,
  maskTimeText,
  minutes,
  parseTimeText,
} from '../dates/time';

interface Props {
  label: string;
  /** "HH:mm" ou vazio quando o horário é desconhecido. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  describedBy?: string;
}
type Column = 'hour' | 'minute';
const pageStep = 5;
/** Altura aproximada do painel completo; abaixo disso, o campo sobe antes de abrir. */
const panelHeight = 440;

/** Seletor de horário de 24 horas no padrão visual do CustomDatePicker. */
export function CustomTimePicker({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  describedBy,
}: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const hideDialog = useCallback(() => {
    const element = dialog.current;
    if (element?.open && typeof element.close === 'function') element.close();
    else element?.removeAttribute('open');
  }, []);
  const popover = useAnchoredPopover<HTMLDialogElement>({
    panelRef: dialog,
    minimumWidth: 264,
    maximumWidth: 300,
    preferredHeight: panelHeight,
    maximumHeight: 480,
    beforeClose: hideDialog,
  });
  const initial = () => (isTimeValue(value) ? value : currentTime());
  const [draft, setDraft] = useState(initial);
  const [focusColumn, setFocusColumn] = useState<Column>('hour');
  const [text, setText] = useState(value);
  const [error, setError] = useState('');
  // showModal() foca o primeiro botão; na abertura o foco deve ir à hora.
  const focusOnOpen = useRef(false);
  const hour = draft.slice(0, 2),
    minute = draft.slice(3, 5);
  const close = (restore = true) => popover.close(restore);
  function begin() {
    if (disabled) return;
    setDraft(initial());
    setText(value);
    setError('');
    setFocusColumn('hour');
    // Campo no meio de uma tela baixa (celular): nenhum lado comporta o painel.
    // Rola só o próprio campo para o topo, evitando um painel espremido.
    const trigger = popover.anchor.current;
    const rect = trigger?.getBoundingClientRect();
    const viewport = window.visualViewport?.height ?? window.innerHeight;
    if (
      rect &&
      rect.height > 0 &&
      Math.max(rect.top, viewport - rect.bottom) < panelHeight
    )
      trigger?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
    focusOnOpen.current = true;
    popover.show();
  }
  function commit(next: string) {
    if (next && !isTimeValue(next)) {
      setError('Informe um horário válido no formato HH:mm (00:00 a 23:59).');
      return;
    }
    if (!next && required) {
      setError('Escolha um horário.');
      return;
    }
    setError('');
    if (next !== value) onChange(next);
    close();
  }
  function applyText() {
    const parsed = parseTimeText(text);
    if (!text.trim()) commit('');
    else if (parsed === null)
      setError('Informe um horário válido no formato HH:mm (00:00 a 23:59).');
    else commit(parsed);
  }
  function pick(column: Column, unit: string) {
    setDraft(column === 'hour' ? `${unit}:${minute}` : `${hour}:${unit}`);
    setError('');
  }
  function columnKey(column: Column, event: KeyboardEvent<HTMLDivElement>) {
    const list = column === 'hour' ? hours : minutes;
    const index = list.indexOf(column === 'hour' ? hour : minute);
    const last = list.length - 1;
    const target: Record<string, number> = {
      ArrowUp: Math.max(0, index - 1),
      ArrowDown: Math.min(last, index + 1),
      PageUp: Math.max(0, index - pageStep),
      PageDown: Math.min(last, index + pageStep),
      Home: 0,
      End: last,
    };
    if (event.key in target) {
      event.preventDefault();
      pick(column, list[target[event.key]!]!);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (column === 'hour') setFocusColumn('minute');
      else commit(draft);
    } else if (event.key === 'ArrowRight' && column === 'hour') {
      event.preventDefault();
      setFocusColumn('minute');
    } else if (event.key === 'ArrowLeft' && column === 'minute') {
      event.preventDefault();
      setFocusColumn('hour');
    }
  }
  function backdrop(event: {
    target: EventTarget;
    currentTarget: HTMLDialogElement;
    clientX: number;
    clientY: number;
  }) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      close();
  }
  function dialogKey(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key === 'Tab') {
      const focusable = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [role="option"][tabindex="0"]',
        ) ?? []),
      ];
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  useLayoutEffect(() => {
    if (!popover.open || !dialog.current) return;
    const element = dialog.current;
    if (!element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
    }
    return hideDialog;
  }, [popover.open, hideDialog]);
  // Mantém a opção ativa centralizada na coluna sem rolar a página.
  useLayoutEffect(() => {
    if (!popover.open || !dialog.current) return;
    for (const option of dialog.current.querySelectorAll<HTMLElement>(
      '[role="option"][tabindex="0"]',
    )) {
      const list = option.parentElement;
      if (list)
        list.scrollTop =
          option.offsetTop - list.clientHeight / 2 + option.offsetHeight / 2;
    }
  }, [popover.open, draft]);
  useLayoutEffect(() => {
    if (!popover.open) return;
    const active = document.activeElement;
    // Depois da abertura, não rouba o foco da digitação nem do rodapé.
    if (
      !focusOnOpen.current &&
      active instanceof HTMLElement &&
      dialog.current?.contains(active) &&
      active.getAttribute('role') !== 'option'
    )
      return;
    dialog.current
      ?.querySelector<HTMLElement>(
        `[data-column="${focusColumn}"] [role="option"][tabindex="0"]`,
      )
      ?.focus({ preventScroll: true });
    focusOnOpen.current = false;
  }, [popover.open, focusColumn, draft]);
  const shown = isTimeValue(value) ? value : '';
  const columns: { key: Column; title: string; list: string[] }[] = [
    { key: 'hour', title: 'Hora', list: hours },
    { key: 'minute', title: 'Min', list: minutes },
  ];
  return (
    <span className="custom-date-picker custom-time-picker">
      <button
        ref={popover.anchor}
        type="button"
        role="combobox"
        aria-label={label}
        aria-describedby={
          [`${id}-value`, describedBy].filter(Boolean).join(' ') || undefined
        }
        aria-haspopup="dialog"
        aria-controls={popover.mounted ? `${id}-time` : undefined}
        aria-expanded={popover.open}
        aria-required={required || undefined}
        disabled={disabled}
        className="custom-select__trigger custom-date-picker__trigger"
        onClick={() => (popover.open ? close() : begin())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            begin();
          }
        }}
      >
        <Icon name="clock" size={17} className="custom-select__icon" />
        <span
          id={`${id}-value`}
          className={
            shown
              ? 'custom-time-picker__value'
              : 'custom-date-picker__placeholder'
          }
        >
          {shown || 'Não informado'}
        </span>
        <Icon name="chevron" size={14} className="custom-select__chevron" />
      </button>
      {popover.mounted &&
        createPortal(
          <dialog
            ref={dialog}
            id={`${id}-time`}
            aria-modal="true"
            aria-label={`Selecionar horário: ${label}`}
            aria-hidden={!popover.open || undefined}
            inert={!popover.open}
            className="custom-calendar custom-time-picker__panel"
            data-state={popover.open ? 'open' : 'closing'}
            style={popover.position}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onKeyDown={dialogKey}
            onPointerDown={backdrop}
            onClick={backdrop}
          >
            <div className="custom-calendar__heading">
              <span>
                <Icon name="clock" size={15} />
                {label}
              </span>
              <button
                type="button"
                aria-label="Fechar seletor de horário"
                onClick={() => close()}
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <p className="custom-time-picker__preview" aria-live="polite">
              {hour}
              <span aria-hidden="true">:</span>
              {minute}
            </p>
            <div className="custom-time-picker__columns">
              {columns.map(({ key, title, list }) => {
                const selected = key === 'hour' ? hour : minute;
                return (
                  <div
                    key={key}
                    className="custom-time-picker__column"
                    data-column={key}
                  >
                    <span aria-hidden="true">{title}</span>
                    <div
                      role="listbox"
                      aria-label={key === 'hour' ? 'Horas' : 'Minutos'}
                      onKeyDown={(event) => columnKey(key, event)}
                    >
                      {list.map((unit) => (
                        <div
                          role="option"
                          key={unit}
                          aria-selected={unit === selected}
                          aria-label={`${unit} ${key === 'hour' ? 'horas' : 'minutos'}`}
                          tabIndex={unit === selected ? 0 : -1}
                          data-selected={unit === selected}
                          onClick={() => {
                            pick(key, unit);
                            if (key === 'hour') setFocusColumn('minute');
                            else commit(`${hour}:${unit}`);
                          }}
                        >
                          {unit}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="custom-calendar__manual">
              <label htmlFor={`${id}-typed`}>Digitar horário</label>
              <div>
                <input
                  id={`${id}-typed`}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={5}
                  placeholder="HH:mm"
                  value={text}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => {
                    setText(maskTimeText(event.target.value));
                    setError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyText();
                    }
                  }}
                />
                <button type="button" onClick={applyText}>
                  Aplicar
                </button>
              </div>
              {error && (
                <p id={`${id}-error`} role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="custom-calendar__footer">
              <button type="button" onClick={() => commit(currentTime())}>
                Agora
              </button>
              {!required && (
                <button type="button" onClick={() => commit('')}>
                  Limpar
                </button>
              )}
              <button
                type="button"
                className="custom-time-picker__confirm"
                onClick={() => commit(draft)}
              >
                Confirmar
              </button>
            </div>
          </dialog>,
          document.body,
        )}
    </span>
  );
}
