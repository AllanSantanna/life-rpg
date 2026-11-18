import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from '../../shared/components/Icon';

/**
 * Seção recolhível: botão com `aria-expanded` dentro do título e seta que gira.
 * O conteúdo só é montado quando aberto, evitando listas longas na página.
 */
export function Disclosure({
  title,
  label,
  level = 2,
  defaultOpen = false,
  className = 'panel record-section',
  children,
}: {
  title: string;
  /** Nome acessível quando o título visível se repete (ex.: em cartões). */
  label?: string;
  level?: 2 | 3 | 4;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const Heading = (['h2', 'h3', 'h4'] as const)[level - 2]!;
  return (
    <section
      className={`${className} finance-disclosure`}
      aria-labelledby={`${id}-title`}
    >
      <Heading className="finance-disclosure__heading">
        <button
          type="button"
          id={`${id}-title`}
          aria-expanded={open}
          aria-label={label}
          aria-controls={`${id}-content`}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{title}</span>
          <Icon
            name="chevron"
            size={18}
            className="finance-disclosure__chevron"
          />
        </button>
      </Heading>
      <div id={`${id}-content`} hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}

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
