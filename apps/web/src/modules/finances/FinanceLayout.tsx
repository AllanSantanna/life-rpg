import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), [role="combobox"]:not([disabled]), textarea, button:not([disabled])';

/**
 * Formulário aberto sob demanda: recebe o foco ao abrir e devolve o foco ao
 * controle que o abriu quando é fechado, como `FinancialConfirmation`.
 */
export function InlineForm({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      if (
        previous instanceof HTMLElement &&
        previous.isConnected &&
        // Não retira o foco de outro controle escolhido pelo usuário.
        (document.activeElement === document.body ||
          document.activeElement === null)
      )
        previous.focus();
    };
  }, []);
  return (
    <div ref={ref} className="finance-inline-form">
      {children}
    </div>
  );
}

export interface FinanceTab<Id extends string> {
  id: Id;
  label: string;
}
/** Abas com roving tabIndex, setas, Home e End, como as abas de treino. */
export function FinanceTabs<Id extends string>({
  label,
  tabs,
  active,
  onChange,
  children,
}: {
  label: string;
  tabs: readonly FinanceTab<Id>[];
  active: Id;
  onChange: (id: Id) => void;
  children: ReactNode;
}) {
  const id = useId();
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index + tabs.length - 1) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next]!.id);
    document.getElementById(`${id}-tab-${tabs[next]!.id}`)?.focus();
  }
  return (
    <div className="finance-tabs">
      <div role="tablist" aria-label={label} className="finance-tabs__list">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.id}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab.id === active}
            tabIndex={tab.id === active ? 0 : -1}
            className={`filter-button${tab.id === active ? ' active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => move(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        className="finance-tabs__panel"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Interruptor liga/desliga de formulários financeiros. Reutiliza o padrão
 * oficial `.strength-switch` (checkbox com `role="switch"`); desligado, o campo
 * não participa do `FormData`.
 */
export function SwitchField({
  label,
  description,
  name,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="strength-switch finance-switch">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true" className="strength-switch-track" />
    </label>
  );
}
