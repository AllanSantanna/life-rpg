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
import { localDate, monthDates } from '../dates/calendar';
import {
  clampDate,
  dateForMonth,
  fullDateLabel,
  maskPickerText,
  months,
  parsePickerText,
  pickerBounds,
  pickerCursor,
  pickerDisplay,
  pickerError,
  shiftMonth,
  weekdays,
  type DateMode,
} from '../dates/picker';
interface Props {
  label: string;
  mode?: DateMode;
  name?: string;
  value?: string | undefined;
  defaultValue?: string | undefined;
  onChange?: (value: string) => void;
  min?: string | undefined;
  max?: string | undefined;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
}
type View = 'days' | 'months' | 'years';

export function CustomDatePicker({
  label,
  mode = 'date',
  name,
  value: controlledValue,
  defaultValue = '',
  onChange,
  min,
  max,
  required = false,
  readOnly = false,
  disabled = false,
}: Props) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const value = controlledValue ?? localValue;
  const bounds = pickerBounds(mode, min, max);
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const validation = useRef<HTMLInputElement>(null);
  const hideDialog = useCallback(() => {
    const element = dialog.current;
    if (element?.open && typeof element.close === 'function') element.close();
    else element?.removeAttribute('open');
  }, []);
  const popover = useAnchoredPopover<HTMLDialogElement>({
    panelRef: dialog,
    minimumWidth: 308,
    maximumWidth: 348,
    preferredHeight: mode === 'date' ? 500 : 420,
    maximumHeight: 540,
    beforeClose: hideDialog,
  });
  const [cursor, setCursor] = useState(() => pickerCursor(value, mode, bounds));
  const [view, setView] = useState<View>(mode === 'date' ? 'days' : 'months');
  const [text, setText] = useState(pickerDisplay(value, mode));
  const [error, setError] = useState('');
  const today = localDate();
  const month = cursor.slice(0, 7),
    year = Number(cursor.slice(0, 4));
  const yearStart = Math.floor((year - 1) / 12) * 12 + 1;
  const dates = monthDates(month);
  const offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const cells = Array.from(
    { length: 42 },
    (_, index) => dates[index - offset] ?? null,
  );
  const issue = pickerError(value, mode, required, min, max);
  const close = (restore = true) => popover.close(restore);
  function begin(invalid = false) {
    if (disabled || readOnly) return;
    setCursor(pickerCursor(value, mode, bounds));
    setView(mode === 'date' ? 'days' : 'months');
    setText(pickerDisplay(value, mode));
    setError(invalid ? issue : '');
    popover.show();
  }
  function commit(next: string) {
    const message = pickerError(next, mode, required, min, max);
    if (message) {
      setError(message);
      return;
    }
    setError('');
    if (controlledValue === undefined) setLocalValue(next);
    if (next !== value) onChange?.(next);
    close();
  }
  function applyText() {
    const parsed = text.trim() ? parsePickerText(text, mode) : '';
    if (parsed === null)
      setError(
        mode === 'date'
          ? 'Informe uma data válida no formato DD/MM/AAAA.'
          : 'Informe um mês válido no formato MM/AAAA.',
      );
    else commit(parsed);
  }
  function cursorMonth(next: string) {
    setCursor(clampDate(dateForMonth(cursor, next), bounds));
  }
  function moveDays(amount: number) {
    const time = Math.max(
      Date.parse(`${bounds.lower}T12:00:00Z`),
      Math.min(
        Date.parse(`${bounds.upper}T12:00:00Z`),
        Date.parse(`${cursor}T12:00:00Z`) + amount * 86400000,
      ),
    );
    setCursor(new Date(time).toISOString().slice(0, 10));
  }
  function navTarget(direction: number) {
    return clampDate(
      dateForMonth(
        cursor,
        shiftMonth(
          month,
          direction * (view === 'days' ? 1 : view === 'months' ? 12 : 144),
        ),
      ),
      bounds,
    );
  }
  function pageKey(date: string) {
    return view === 'days'
      ? date.slice(0, 7)
      : view === 'months'
        ? date.slice(0, 4)
        : String(Math.floor((Number(date.slice(0, 4)) - 1) / 12));
  }
  function allowedMonth(candidate: string) {
    return (
      candidate >= bounds.lower.slice(0, 7) &&
      candidate <= bounds.upper.slice(0, 7)
    );
  }
  function chooseMonth(candidate: string) {
    if (mode === 'month') commit(candidate);
    else {
      cursorMonth(candidate);
      setView('days');
    }
  }
  function chooseYear(candidate: number) {
    cursorMonth(`${String(candidate).padStart(4, '0')}-${month.slice(5)}`);
    setView('months');
  }
  function gridKey(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (
      ![
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ].includes(key)
    )
      return;
    event.preventDefault();
    if (key === 'PageUp' || key === 'PageDown') {
      const direction = key === 'PageDown' ? 1 : -1;
      cursorMonth(
        shiftMonth(
          month,
          direction *
            (view === 'days'
              ? event.shiftKey
                ? 12
                : 1
              : view === 'months'
                ? 12
                : 144),
        ),
      );
    } else if (view === 'days') {
      const weekday = new Date(`${cursor}T12:00:00Z`).getUTCDay();
      moveDays(
        key === 'Home'
          ? -weekday
          : key === 'End'
            ? 6 - weekday
            : key === 'ArrowLeft'
              ? -1
              : key === 'ArrowRight'
                ? 1
                : key === 'ArrowUp'
                  ? -7
                  : 7,
      );
    } else {
      const index =
        view === 'months' ? Number(month.slice(5)) - 1 : year - yearStart;
      const amount =
        key === 'Home'
          ? -(index % 3)
          : key === 'End'
            ? 2 - (index % 3)
            : key === 'ArrowLeft'
              ? -1
              : key === 'ArrowRight'
                ? 1
                : key === 'ArrowUp'
                  ? -3
                  : 3;
      cursorMonth(shiftMonth(month, amount * (view === 'years' ? 12 : 1)));
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
          'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)',
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
    validation.current?.setCustomValidity(disabled || readOnly ? '' : issue);
  }, [issue, disabled, readOnly]);
  useLayoutEffect(() => {
    if (!popover.open || !dialog.current) return;
    const element = dialog.current;
    if (!element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
    }
    return hideDialog;
  }, [popover.open, hideDialog]);
  useLayoutEffect(() => {
    if (popover.open)
      (
        dialog.current?.querySelector<HTMLElement>(
          '[data-calendar-active="true"]:not(:disabled)',
        ) ?? dialog.current?.querySelector<HTMLElement>('button:not(:disabled)')
      )?.focus({ preventScroll: true });
  }, [popover.open, cursor, view]);
  useLayoutEffect(() => {
    if (
      popover.open &&
      document.activeElement instanceof HTMLElement &&
      dialog.current?.contains(document.activeElement)
    )
      document.activeElement.scrollIntoView?.({
        block: 'nearest',
        behavior: 'auto',
      });
  }, [popover.open, popover.position]);
  const current = mode === 'month' ? today.slice(0, 7) : today;
  const header =
    view === 'years'
      ? `${yearStart} – ${Math.min(9999, yearStart + 11)}`
      : `${months[Number(month.slice(5)) - 1]} de ${year}`;
  return (
    <span className="custom-date-picker">
      <button
        ref={popover.anchor}
        type="button"
        role="combobox"
        aria-label={label}
        aria-describedby={`${id}-value${error && !popover.open ? ` ${id}-field-error` : ''}`}
        aria-haspopup="dialog"
        aria-controls={popover.mounted ? `${id}-calendar` : undefined}
        aria-expanded={popover.open}
        aria-readonly={readOnly || undefined}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        disabled={disabled}
        className="custom-select__trigger custom-date-picker__trigger"
        onClick={() => (popover.open ? close() : begin())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'Enter', ' '].includes(event.key) && !readOnly) {
            event.preventDefault();
            begin();
          }
        }}
      >
        <Icon name="calendar" size={17} className="custom-select__icon" />
        <span
          id={`${id}-value`}
          className={value ? '' : 'custom-date-picker__placeholder'}
        >
          {pickerDisplay(value, mode) ||
            (mode === 'month' ? 'Selecionar mês' : 'Selecionar data')}
        </span>
        <Icon name="chevron" size={14} className="custom-select__chevron" />
      </button>
      {name && (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      )}
      <input
        ref={validation}
        type="text"
        className="custom-date-picker__validation"
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        onChange={() => {}}
        required={required}
        disabled={disabled || readOnly}
        onInvalid={(event) => {
          event.preventDefault();
          begin(true);
        }}
      />
      {error && !popover.open && (
        <span id={`${id}-field-error`} role="alert" className="record-error">
          {error}
        </span>
      )}
      {popover.mounted &&
        createPortal(
          <dialog
            ref={dialog}
            id={`${id}-calendar`}
            aria-modal="true"
            aria-label={`${mode === 'month' ? 'Selecionar mês' : 'Calendário'}: ${label}`}
            aria-hidden={!popover.open || undefined}
            inert={!popover.open}
            className="custom-calendar"
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
                <Icon name="calendar" size={15} />
                {label}
              </span>
              <button
                type="button"
                aria-label="Fechar calendário"
                onClick={() => close()}
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <div className="custom-calendar__nav">
              <button
                type="button"
                aria-label={
                  view === 'days'
                    ? 'Mês anterior'
                    : view === 'months'
                      ? 'Ano anterior'
                      : 'Anos anteriores'
                }
                disabled={pageKey(navTarget(-1)) === pageKey(cursor)}
                onClick={() => setCursor(navTarget(-1))}
              >
                <Icon
                  name="chevron"
                  size={17}
                  className="custom-calendar__previous"
                />
              </button>
              <div>
                {view === 'years' ? (
                  <span>{header}</span>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="Escolher mês"
                      onClick={() => setView('months')}
                    >
                      {months[Number(month.slice(5)) - 1]}
                    </button>
                    <button
                      type="button"
                      aria-label="Escolher ano"
                      onClick={() => setView('years')}
                    >
                      {year}
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                aria-label={
                  view === 'days'
                    ? 'Próximo mês'
                    : view === 'months'
                      ? 'Próximo ano'
                      : 'Próximos anos'
                }
                disabled={pageKey(navTarget(1)) === pageKey(cursor)}
                onClick={() => setCursor(navTarget(1))}
              >
                <Icon name="chevron" size={17} />
              </button>
            </div>
            <p className="sr-only" aria-live="polite">
              {header}
            </p>
            {view === 'days' ? (
              <div
                role="grid"
                aria-label={header}
                className="custom-calendar__days"
                onKeyDown={gridKey}
              >
                <div role="row" className="custom-calendar__weekdays">
                  {weekdays.map((day) => (
                    <span role="columnheader" key={day}>
                      {day}
                    </span>
                  ))}
                </div>
                {Array.from({ length: 6 }, (_, week) => (
                  <div role="row" className="custom-calendar__week" key={week}>
                    {cells.slice(week * 7, week * 7 + 7).map((date, index) => (
                      <div
                        role="gridcell"
                        key={date ?? `empty-${index}`}
                        aria-selected={date ? value === date : undefined}
                      >
                        {date && (
                          <button
                            type="button"
                            data-calendar-active={cursor === date}
                            tabIndex={cursor === date ? 0 : -1}
                            aria-label={fullDateLabel(date)}
                            aria-current={date === today ? 'date' : undefined}
                            data-selected={value === date}
                            disabled={
                              date < bounds.lower || date > bounds.upper
                            }
                            onClick={() => commit(date)}
                          >
                            {Number(date.slice(8))}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div
                role="grid"
                aria-label={
                  view === 'months'
                    ? `Meses de ${year}`
                    : `Anos de ${yearStart} a ${Math.min(9999, yearStart + 11)}`
                }
                className="custom-calendar__choices"
                onKeyDown={gridKey}
              >
                {Array.from({ length: 4 }, (_, row) => (
                  <div role="row" key={row}>
                    {Array.from({ length: 3 }, (_, column) => {
                      const index = row * 3 + column;
                      const candidate =
                        view === 'months'
                          ? `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`
                          : String(yearStart + index).padStart(4, '0');
                      const active =
                        view === 'months'
                          ? month === candidate
                          : year === yearStart + index;
                      const unavailable =
                        view === 'months'
                          ? !allowedMonth(candidate)
                          : yearStart + index > 9999 ||
                            candidate < bounds.lower.slice(0, 4) ||
                            candidate > bounds.upper.slice(0, 4);
                      return (
                        <div
                          role="gridcell"
                          key={candidate}
                          aria-selected={
                            view === 'months'
                              ? value.slice(0, 7) === candidate
                              : value.slice(0, 4) === candidate
                          }
                        >
                          <button
                            type="button"
                            data-calendar-active={active}
                            tabIndex={active ? 0 : -1}
                            disabled={unavailable}
                            aria-label={
                              view === 'months'
                                ? `${months[index]} de ${year}`
                                : `Ano ${yearStart + index}`
                            }
                            data-selected={
                              view === 'months'
                                ? value.slice(0, 7) === candidate
                                : value.slice(0, 4) === candidate
                            }
                            onClick={() =>
                              view === 'months'
                                ? chooseMonth(candidate)
                                : chooseYear(yearStart + index)
                            }
                          >
                            {view === 'months'
                              ? months[index]!.slice(0, 3)
                              : yearStart + index}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            <div className="custom-calendar__manual">
              <label htmlFor={`${id}-typed`}>
                {mode === 'date' ? 'Digitar data' : 'Digitar mês'}
              </label>
              <div>
                <input
                  id={`${id}-typed`}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={mode === 'date' ? 10 : 7}
                  placeholder={mode === 'date' ? 'DD/MM/AAAA' : 'MM/AAAA'}
                  value={text}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(event) => {
                    setText(maskPickerText(event.target.value, mode));
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
              <button
                type="button"
                disabled={!!pickerError(current, mode, false, min, max)}
                onClick={() => commit(current)}
              >
                {mode === 'month' ? 'Mês atual' : 'Hoje'}
              </button>
              {!required && (
                <button type="button" onClick={() => commit('')}>
                  Limpar
                </button>
              )}
            </div>
          </dialog>,
          document.body,
        )}
    </span>
  );
}
