import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon, type IconName } from '../../shared/components/Icon';
import type { StateStorage } from '../../shared/storage/localStateStorage';
import { MovementForm } from '../../modules/finances/MovementsPanel';
import { bookProgress } from '../../modules/knowledge/calculations';
import { BookForm, ReadingForm } from '../../modules/knowledge/KnowledgeForms';
import { displayDate } from '../../modules/records/dates';
import type {
  LifeRecords,
  RecordCommand,
  SaveOutcome,
} from '../../modules/records/types';
import { SleepForm } from '../../modules/rest/SleepForm';
import { suggestedPlan } from '../../modules/workouts/advanced/rotation';
import {
  planStart,
  sessionsInProgress,
} from '../../modules/workouts/advanced/startSession';
import {
  emptyAdvancedWorkouts,
  type AdvancedWorkoutCommand,
} from '../../modules/workouts/advanced/types';
import type { View } from '../views';
import {
  useQuickActionsIntro,
  type QuickActionsPreference,
} from './quickActionsPreference';
import './quickActions.css';

type Step = 'root' | 'workout' | 'finance';
type QuickForm =
  | { type: 'sleep' }
  | { type: 'reading'; bookId?: string }
  | { type: 'book' }
  | { type: 'movement'; kind: 'income' | 'expense' };

const formTitles: Record<QuickForm['type'], string> = {
  sleep: 'Registrar sono',
  reading: 'Registrar leitura',
  book: 'Cadastrar livro',
  movement: 'Nova movimentação',
};
const saveErrors: Record<Exclude<SaveOutcome, 'saved'>, string> = {
  failed:
    'A gravação não foi confirmada neste navegador. O registro não foi salvo com segurança: confira o aviso de armazenamento antes de registrar de novo.',
  conflict:
    'Os registros foram alterados em outra aba e esta alteração não foi salva. Recarregue os registros antes de registrar de novo.',
};

/** Mensagem de sucesso conforme o comando efetivamente aplicado. */
function successMessage(command: RecordCommand) {
  switch (command.type) {
    case 'saveSleep':
      return 'Sono registrado.';
    case 'saveReading':
      return 'Leitura registrada.';
    case 'saveBook':
      return 'Livro cadastrado. Registre a primeira leitura.';
    case 'saveMovement':
      return command.value.kind === 'income'
        ? 'Receita registrada.'
        : 'Despesa registrada.';
    case 'saveRecurrence':
      return command.rule.kind === 'income'
        ? 'Receita recorrente registrada.'
        : 'Despesa recorrente registrada.';
    default:
      return 'Registro salvo.';
  }
}

/**
 * Ações rápidas globais: o botão “+” (flutuante acima da navegação inferior no
 * celular; “Ação rápida” na navegação lateral no computador) abre um menu
 * compacto com Treino, Sono, Leitura e Finanças.
 *
 * Não há regras próprias de registro: os formulários são os mesmos das páginas
 * (`SleepForm`, `ReadingForm`, `BookForm`, `MovementForm`) e os comandos passam
 * pelo mesmo `onCommand` do App, com as mesmas validações, persistência, XP e
 * Radar. O sucesso só é anunciado depois da confirmação da gravação.
 */
export function QuickActions({
  records,
  today,
  onCommand,
  whenSaved,
  onNavigate,
  onOpenSession,
  introStorage,
}: {
  records: LifeRecords;
  today: string;
  onCommand: (command: RecordCommand) => string | null;
  whenSaved?: (() => Promise<SaveOutcome>) | undefined;
  onNavigate: (view: View) => void;
  /** Abre a página Treinos na sessão indicada. */
  onOpenSession: (sessionId: string) => void;
  introStorage?: StateStorage<QuickActionsPreference>;
}) {
  const id = useId();
  const panelId = `${id}-panel`;
  const titleId = `${id}-title`;
  const introId = `${id}-intro`;
  const trigger = useRef<HTMLButtonElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('root');
  const [form, setForm] = useState<QuickForm | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [toast, setToast] = useState('');
  const [workoutError, setWorkoutError] = useState('');
  const [introSeen, dismissIntro] = useQuickActionsIntro(introStorage);
  /** Trava contra cliques repetidos: um comando aceito por formulário aberto. */
  const committed = useRef<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  // Remarca na montagem: o StrictMode desmonta e remonta os efeitos.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const advanced = records.advancedWorkouts ?? emptyAdvancedWorkouts();
  const running = sessionsInProgress(advanced);
  const suggested = suggestedPlan(advanced);
  const plans = suggested
    ? [suggested, ...advanced.plans.filter((plan) => plan !== suggested)]
    : advanced.plans;
  const readingBooks = records.books.filter(
    (book) => !bookProgress(book, records.readings).completed,
  );
  // Não interrompe um treino em andamento nem disputa espaço com o menu.
  const showIntro = !introSeen && !open && !form && running.length === 0;

  function closeMenu(restoreFocus: boolean) {
    setOpen(false);
    setStep('root');
    setWorkoutError('');
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }
  function toggle() {
    if (open) return closeMenu(true);
    if (!introSeen) dismissIntro();
    setStep('root');
    setOpen(true);
  }

  // Foco no primeiro item ao abrir e a cada etapa.
  useEffect(() => {
    if (!open) return;
    panel.current
      ?.querySelector<HTMLElement>('[data-quick-item]')
      ?.focus({ preventScroll: true });
  }, [open, step]);

  // Clique ou foco fora fecha o menu, sem roubar o foco do destino.
  useEffect(() => {
    if (!open) return;
    function outside(event: Event) {
      if (
        event.target instanceof Node &&
        !wrapper.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      ) {
        setOpen(false);
        setStep('root');
        setWorkoutError('');
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);

  // No computador o painel abre ao lado do botão e sobe se passar da janela.
  useLayoutEffect(() => {
    const element = panel.current;
    if (!open || !element) return;
    function place() {
      if (!element) return;
      element.style.marginTop = '';
      const rect = element.getBoundingClientRect();
      const overflow = rect.bottom - (window.innerHeight - 8);
      if (overflow > 0)
        element.style.marginTop = `${-Math.min(overflow, Math.max(0, rect.top - 8))}px`;
    }
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, step]);

  // Mensagem de sucesso some sozinha; o leitor de tela já a anunciou.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function panelKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (step !== 'root') return backToRoot();
      return closeMenu(true);
    }
    const items = [
      ...(panel.current?.querySelectorAll<HTMLElement>('[data-quick-item]') ??
        []),
    ];
    const current = items.indexOf(document.activeElement as HTMLElement);
    const target =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? items[(current + 1) % items.length]
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? items[(current - 1 + items.length) % items.length]
          : event.key === 'Home'
            ? items[0]
            : event.key === 'End'
              ? items.at(-1)
              : undefined;
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }
  function backToRoot() {
    setWorkoutError('');
    setStep('root');
  }

  function openForm(next: QuickForm) {
    closeMenu(false);
    committed.current = null;
    setSaveError('');
    setFormNotice('');
    setSaving(false);
    setForm(next);
    setFormRevision((n) => n + 1);
  }
  function closeForm() {
    if (saving) return;
    setForm(null);
    committed.current = null;
    setSaveError('');
    setFormNotice('');
    requestAnimationFrame(() =>
      trigger.current?.focus({ preventScroll: true }),
    );
  }
  /** `run` dos formulários reaproveitados: mesmo comando do App. */
  function run(command: RecordCommand) {
    if (committed.current !== null)
      return saveError || 'Este registro já está sendo salvo.';
    const error = onCommand(command);
    if (!error) committed.current = successMessage(command);
    return error;
  }
  async function confirmSaved(next?: QuickForm) {
    const message = committed.current;
    if (message === null) return;
    setSaving(true);
    setSaveError('');
    const outcome = whenSaved ? await whenSaved() : 'saved';
    if (!mounted.current) return;
    setSaving(false);
    if (outcome !== 'saved') {
      // O formulário continua aberto com os dados; nada de sucesso.
      setSaveError(saveErrors[outcome]);
      return;
    }
    committed.current = null;
    if (next) {
      setForm(next);
      setFormRevision((n) => n + 1);
      setFormNotice(message);
      return;
    }
    setForm(null);
    setToast(message);
    requestAnimationFrame(() =>
      trigger.current?.focus({ preventScroll: true }),
    );
  }

  /** Treino: mesmos comandos do módulo, sem criar sessão duplicada. */
  function workout(command: AdvancedWorkoutCommand) {
    return onCommand({ type: 'advancedWorkout', command });
  }
  function enableAdvanced() {
    return advanced.enabled
      ? null
      : workout({ type: 'setEnabled', enabled: true });
  }
  function continueSession(sessionId: string) {
    if (busy.current) return;
    busy.current = true;
    const error = enableAdvanced();
    busy.current = false;
    if (error) return setWorkoutError(error);
    closeMenu(false);
    onOpenSession(sessionId);
  }
  function startPlan(planId: string) {
    if (busy.current) return;
    busy.current = true;
    const { sessionId, command } = planStart(advanced, planId, today);
    const error = enableAdvanced() ?? (command ? workout(command) : null);
    busy.current = false;
    if (error) return setWorkoutError(error);
    closeMenu(false);
    onOpenSession(sessionId);
  }
  function createPlan() {
    const error = enableAdvanced();
    if (error) return setWorkoutError(error);
    closeMenu(false);
    onNavigate('workouts');
  }
  function chooseWorkout() {
    if (running.length === 1) return continueSession(running[0]!.id);
    setStep('workout');
  }

  const rootItems: {
    area: string;
    icon: IconName;
    label: string;
    detail: string;
    onSelect: () => void;
  }[] = [
    {
      area: 'Treinos',
      icon: 'dumbbell',
      label: 'Treino',
      detail: running.length
        ? 'Continuar treino'
        : plans.length
          ? 'Iniciar treino'
          : 'Criar primeira ficha',
      onSelect: chooseWorkout,
    },
    {
      area: 'Descanso',
      icon: 'moon',
      label: 'Sono',
      detail: 'Horas dormidas',
      onSelect: () => openForm({ type: 'sleep' }),
    },
    {
      area: 'Conhecimento',
      icon: 'book',
      label: 'Leitura',
      detail: readingBooks.length ? 'Páginas lidas' : 'Cadastrar livro',
      onSelect: () =>
        openForm(readingBooks.length ? { type: 'reading' } : { type: 'book' }),
    },
    {
      area: 'Finanças',
      icon: 'wallet',
      label: 'Finanças',
      detail: 'Receita ou despesa',
      onSelect: () => setStep('finance'),
    },
  ];

  let content: ReactNode;
  if (step === 'root')
    content = (
      <ul className="quick-actions__grid" aria-labelledby={titleId}>
        {rootItems.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              data-quick-item
              data-area={item.area}
              className="quick-actions__item"
              onClick={item.onSelect}
            >
              <span className="quick-actions__glyph" aria-hidden="true">
                <Icon name={item.icon} size={20} />
              </span>
              <span className="quick-actions__text">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  else if (step === 'finance')
    content = (
      <ul className="quick-actions__list" aria-label="Finanças">
        {(['income', 'expense'] as const).map((kind) => (
          <li key={kind}>
            <button
              type="button"
              data-quick-item
              data-area="Finanças"
              className="quick-actions__item"
              onClick={() => openForm({ type: 'movement', kind })}
            >
              <span className="quick-actions__glyph" aria-hidden="true">
                <Icon name={kind === 'income' ? 'plus' : 'wallet'} size={20} />
              </span>
              <span className="quick-actions__text">
                <strong>
                  {kind === 'income'
                    ? 'Adicionar receita'
                    : 'Adicionar despesa'}
                </strong>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  else
    content = (
      <ul className="quick-actions__list" aria-label="Treino">
        {running.length > 0
          ? running.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  data-quick-item
                  data-area="Treinos"
                  className="quick-actions__item"
                  onClick={() => continueSession(session.id)}
                >
                  <span className="quick-actions__glyph" aria-hidden="true">
                    <Icon name="play" size={18} />
                  </span>
                  <span className="quick-actions__text">
                    <strong>Continuar treino</strong>
                    <small>
                      {session.planName} · {displayDate(session.date)}
                    </small>
                  </span>
                </button>
              </li>
            ))
          : plans.length > 0
            ? plans.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    data-quick-item
                    data-area="Treinos"
                    className="quick-actions__item"
                    onClick={() => startPlan(plan.id)}
                  >
                    <span className="quick-actions__glyph" aria-hidden="true">
                      <Icon name="play" size={18} />
                    </span>
                    <span className="quick-actions__text">
                      <strong>Iniciar {plan.name}</strong>
                      {plan === suggested && plans.length > 1 && (
                        <small>Próximo na sequência</small>
                      )}
                    </span>
                  </button>
                </li>
              ))
            : [
                <li key="create">
                  <button
                    type="button"
                    data-quick-item
                    data-area="Treinos"
                    className="quick-actions__item"
                    onClick={createPlan}
                  >
                    <span className="quick-actions__glyph" aria-hidden="true">
                      <Icon name="plus" size={18} />
                    </span>
                    <span className="quick-actions__text">
                      <strong>Criar primeira ficha</strong>
                      <small>Abre Minhas fichas em Treinos</small>
                    </span>
                  </button>
                </li>,
              ]}
      </ul>
    );

  return (
    <div ref={wrapper} className="quick-actions" data-open={open || undefined}>
      <button
        ref={trigger}
        type="button"
        className="quick-actions__trigger"
        aria-label={open ? 'Fechar ações rápidas' : 'Abrir ações rápidas'}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        aria-describedby={showIntro ? introId : undefined}
        title="Ações rápidas"
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            closeMenu(true);
          }
        }}
      >
        <span className="quick-actions__icon" aria-hidden="true">
          <Icon name="plus" size={22} />
        </span>
        <span className="quick-actions__label" aria-hidden="true">
          Ação rápida
        </span>
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          className="quick-actions__panel"
          data-step={step}
          onKeyDown={panelKey}
        >
          <h2 id={titleId} className="quick-actions__title">
            Ações rápidas
          </h2>
          {step !== 'root' && (
            <div className="quick-actions__heading">
              <button
                type="button"
                className="quick-actions__back"
                aria-label="Voltar às ações rápidas"
                onClick={backToRoot}
              >
                <Icon name="back" size={16} />
              </button>
              <h3>{step === 'workout' ? 'Treino' : 'Finanças'}</h3>
            </div>
          )}
          {content}
          {workoutError && (
            <p role="alert" className="record-error">
              {workoutError}
            </p>
          )}
        </div>
      )}
      {showIntro && (
        <section
          className="quick-actions__intro"
          aria-labelledby={`${introId}-title`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              dismissIntro();
            }
          }}
        >
          <h2 id={`${introId}-title`}>Ações rápidas</h2>
          <p id={introId}>
            Registre treinos, sono, leituras e movimentações financeiras sem
            navegar por várias telas.
          </p>
          <button
            type="button"
            className="quick-actions__intro-ok"
            onClick={dismissIntro}
          >
            Entendi
          </button>
        </section>
      )}
      <p
        className="quick-actions__toast"
        aria-live="polite"
        data-shown={!!toast}
      >
        {toast}
      </p>
      {form && (
        <QuickDialog
          key={formRevision}
          title={formTitles[form.type]}
          busy={saving}
          onClose={closeForm}
        >
          {formNotice && (
            <p className="quick-dialog__notice" role="status">
              {formNotice}
            </p>
          )}
          <div inert={saving} className="quick-dialog__body">
            {form.type === 'sleep' && (
              <SleepForm
                records={records}
                today={today}
                run={run}
                onSaved={() => void confirmSaved()}
                onCancel={closeForm}
                cancelLabel="Cancelar"
              />
            )}
            {form.type === 'reading' && (
              <ReadingForm
                books={readingBooks}
                readings={records.readings}
                defaultBookId={form.bookId}
                today={today}
                run={run}
                singleAsText
                onSaved={() => void confirmSaved()}
                onCancel={closeForm}
                cancelLabel="Cancelar"
              />
            )}
            {form.type === 'book' && (
              <BookForm
                run={run}
                onSaved={(bookId) =>
                  void confirmSaved({ type: 'reading', bookId })
                }
                onCancel={closeForm}
                cancelLabel="Cancelar"
              />
            )}
            {form.type === 'movement' && (
              <MovementForm
                records={records}
                today={today}
                draft={{ id: null, kind: form.kind }}
                run={run}
                onClose={() =>
                  committed.current !== null ? void confirmSaved() : closeForm()
                }
              />
            )}
          </div>
          {saving && (
            <p className="record-hint" role="status">
              Salvando…
            </p>
          )}
          {saveError && (
            <p className="record-error" role="alert">
              {saveError}
            </p>
          )}
        </QuickDialog>
      )}
    </div>
  );
}

/**
 * Diálogo modal (top layer) dos formulários rápidos: fica acima da navegação
 * e de qualquer elemento fixo, sem disputar `z-index`. Escape e o botão
 * Fechar encerram, exceto durante a gravação.
 */
function QuickDialog({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') {
      if (!element.open) element.showModal();
    } else element.setAttribute('open', '');
    // Foco no primeiro campo a preencher (as horas, as páginas, a descrição).
    const frame = requestAnimationFrame(() =>
      element
        .querySelector<HTMLElement>(
          'input[name="hours"], input[name="pages"], input[name="title"], input[name="description"]',
        )
        ?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      if (typeof element.close === 'function' && element.open) element.close();
      else element.removeAttribute('open');
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="quick-dialog"
      aria-label={title}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
      <button
        type="button"
        className="quick-dialog__close"
        aria-label="Fechar"
        disabled={busy}
        onClick={onClose}
      >
        <Icon name="close" size={18} />
      </button>
    </dialog>
  );
}
