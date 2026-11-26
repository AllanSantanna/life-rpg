import { readFileSync } from 'node:fs';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../playerState';
import { applyRecordCommand } from '../../modules/records/commands';
import { recordReward } from '../../modules/records/progression';
import type { LifeRecords, RecordCommand } from '../../modules/records/types';
import type { WorkoutPlan } from '../../modules/workouts/advanced/types';
import { QUICK_ACTIONS_KEY } from './quickActionsPreference';
import { QuickActions } from './QuickActions';

/**
 * Ações rápidas pela interface. Dados sintéticos; a data dos testes é
 * 13/11/2026 (ver `test/setup.ts`).
 */
afterEach(cleanup);
const today = '2026-11-13';
const stored = (): PlayerState =>
  JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
const apply = (records: LifeRecords, ...commands: RecordCommand[]) =>
  commands.reduce(
    (state, command) => applyRecordCommand(state, command, today),
    records,
  );
const plan = (id: string, name: string): WorkoutPlan => ({
  id,
  name,
  description: '',
  notes: '',
  exercises: [
    { id: `${id}-x`, exerciseId: 'bench', sets: 3, reps: 10, notes: '' },
  ],
});
const advanced = (command: unknown): RecordCommand =>
  ({ type: 'advancedWorkout', command }) as RecordCommand;
/** Ficha A e B cadastradas; `session` inicia uma sessão da ficha B. */
function withPlans(session = false) {
  return apply(
    createInitialPlayerState().records,
    advanced({ type: 'setEnabled', enabled: true }),
    advanced({ type: 'savePlan', value: plan('pa', 'Treino A') }),
    advanced({ type: 'savePlan', value: plan('pb', 'Treino B') }),
    ...(session
      ? [
          advanced({
            type: 'startSession',
            id: 'sessao-b',
            planId: 'pb',
            date: today,
          }),
        ]
      : []),
  );
}
const book = (id: string, title: string, totalPages: number) =>
  ({ type: 'saveBook', value: { id, title, totalPages } }) as RecordCommand;
function seed(records?: LifeRecords, path = '/', introSeen = true) {
  const state = createInitialPlayerState();
  if (records) state.records = records;
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
  if (introSeen)
    localStorage.setItem(
      QUICK_ACTIONS_KEY,
      JSON.stringify({ version: 1, data: { introSeen: true } }),
    );
  window.history.replaceState(null, '', path);
  return render(<App />);
}
const trigger = () =>
  screen.getByRole('button', { name: /^(Abrir|Fechar) ações rápidas$/ });
const menu = () => screen.getByRole('dialog', { name: 'Ações rápidas' });
function openMenu() {
  fireEvent.click(trigger());
  return menu();
}
function choose(label: RegExp | string) {
  fireEvent.click(within(menu()).getByRole('button', { name: label }));
}
const quickForm = (name: string) => screen.getByRole('form', { name });
function fill(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
const dateValue = (form: HTMLElement) =>
  form.querySelector<HTMLInputElement>('input[name="date"]')?.value;
const feedback = () =>
  document.querySelector('.quick-actions__toast')?.textContent ?? '';

describe('botão global de ações rápidas', () => {
  it.each([
    ['/', 'Visão geral'],
    ['/quests', 'Quests'],
    ['/estatisticas', 'Sua evolução'],
    ['/pilares', 'Quatro pilares da vida'],
    ['/perfil', 'Seu personagem'],
    ['/financas', 'Finanças'],
    ['/treinos', 'Treinos'],
  ])('aparece em %s', (path, heading) => {
    seed(undefined, path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Abrir ações rápidas' }),
    ).toBeInTheDocument();
  });

  it('mantém as cinco opções da navegação inferior funcionando', () => {
    seed();
    const nav = within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    );
    const labels = ['Início', 'Quests', 'Estatísticas', 'Pilares', 'Perfil'];
    expect(nav.getAllByRole('button').map((b) => b.textContent)).toEqual(
      labels.map((label, index) => `${label}0${index + 1}`),
    );
    for (const label of labels) {
      fireEvent.click(nav.getByRole('button', { name: label }));
      expect(nav.getByRole('button', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
    // O botão fica fora da lista de navegação (não é uma sexta aba).
    expect(
      nav.queryByRole('button', { name: /ações rápidas/ }),
    ).not.toBeInTheDocument();
  });

  it('abre e fecha pelo botão, com nome acessível e título', () => {
    seed();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    const panel = openMenu();
    expect(trigger()).toHaveAccessibleName('Fechar ações rápidas');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(panel).getByRole('heading', { name: 'Ações rápidas' }),
    ).toBeInTheDocument();
    expect(
      within(panel)
        .getAllByRole('button')
        .map((b) => b.querySelector('strong')?.textContent),
    ).toEqual(['Treino', 'Sono', 'Leitura', 'Finanças']);
    fireEvent.click(trigger());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveAccessibleName('Abrir ações rápidas');
    expect(trigger()).toHaveFocus();
  });

  it('Esc fecha o menu (e volta da etapa interna) devolvendo o foco', () => {
    seed();
    openMenu();
    choose(/^Finanças/);
    expect(menu()).toHaveTextContent('Adicionar receita');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(menu()).toHaveTextContent('Sono');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('clique fora fecha o menu sem registrar nada', () => {
    seed();
    const before = localStorage.getItem(PLAYER_STORAGE_KEY);
    openMenu();
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Visão geral' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(before);
  });

  it('funciona pelo teclado: foco no primeiro item, setas e Enter', () => {
    seed();
    trigger().focus();
    fireEvent.click(trigger());
    const items = within(menu()).getAllByRole('button');
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1]!, { key: 'End' });
    expect(items[3]).toHaveFocus();
    fireEvent.keyDown(items[3]!, { key: 'Home' });
    expect(items[0]).toHaveFocus();
    fireEvent.click(items[1]!);
    expect(quickForm('Registrar sono')).toBeInTheDocument();
  });

  it('apresenta a explicação inicial uma única vez', () => {
    const view = seed(undefined, '/', false);
    const intro = screen.getByRole('region', { name: 'Ações rápidas' });
    expect(intro).toHaveTextContent(
      'Registre treinos, sono, leituras e movimentações financeiras sem navegar por várias telas.',
    );
    // Não rouba o foco nem bloqueia a página.
    expect(intro).not.toContainElement(document.activeElement as HTMLElement);
    fireEvent.click(within(intro).getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('region', { name: 'Ações rápidas' })).toBeNull();
    // Só a preferência de apresentação é gravada; o jogador não muda.
    expect(JSON.parse(localStorage.getItem(QUICK_ACTIONS_KEY)!)).toEqual({
      version: 1,
      data: { introSeen: true },
    });
    view.unmount();
    render(<App />);
    expect(screen.queryByRole('region', { name: 'Ações rápidas' })).toBeNull();
    expect(trigger()).toBeInTheDocument();
  });

  it('não apresenta a explicação durante um treino em andamento', () => {
    seed(withPlans(true), '/', false);
    expect(screen.queryByRole('region', { name: 'Ações rápidas' })).toBeNull();
  });

  it('não interfere em diálogos: formulários usam modal nativo e o botão fica na camada da navegação', () => {
    seed();
    openMenu();
    choose(/^Sono/);
    const dialog = document.querySelector('dialog.quick-dialog');
    expect(dialog).toHaveAttribute('open');
    expect(screen.queryByRole('dialog', { name: 'Ações rápidas' })).toBeNull();
    // Esc fecha só o formulário rápido e o foco volta ao botão.
    fireEvent(dialog!, new Event('cancel', { cancelable: true }));
    expect(document.querySelector('dialog.quick-dialog')).toBeNull();
    // O botão vive dentro da navegação fixa (camada 30): diálogos nativos,
    // ajudas “?” (80) e avisos de conquista (60) ficam acima dele.
    expect(trigger().closest('.sidebar')).not.toBeNull();
  });
});

describe('ação rápida: Treino', () => {
  it('identifica a sessão em andamento e continua sem duplicar', () => {
    seed(withPlans(true));
    openMenu();
    const tile = within(menu()).getByRole('button', { name: /^Treino/ });
    expect(tile).toHaveTextContent('Continuar treino');
    fireEvent.click(tile);
    expect(
      screen.getByRole('heading', { name: 'Treinos', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Registrar treino' }),
    ).toHaveAttribute('aria-selected', 'true');
    const sessions = stored().records.advancedWorkouts!.sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'sessao-b',
      status: 'in_progress',
    });
    // De novo, já em Treinos: continua a mesma sessão.
    openMenu();
    choose(/^Treino/);
    expect(stored().records.advancedWorkouts!.sessions).toHaveLength(1);
  });

  it('lista as fichas reais e inicia uma única sessão', () => {
    seed(withPlans());
    openMenu();
    choose(/^Treino/);
    const options = within(menu())
      .getAllByRole('button')
      .map((b) => b.querySelector('strong')?.textContent)
      .filter(Boolean);
    expect(options).toEqual(['Iniciar Treino A', 'Iniciar Treino B']);
    const start = within(menu()).getByRole('button', {
      name: /Iniciar Treino B/,
    });
    fireEvent.click(start);
    let sessions = stored().records.advancedWorkouts!.sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      planName: 'Treino B',
      status: 'in_progress',
      date: today,
    });
    // Escolher a mesma ficha de novo retoma a sessão, sem criar outra.
    openMenu();
    choose(/^Treino/);
    sessions = stored().records.advancedWorkouts!.sessions;
    expect(sessions).toHaveLength(1);
  });

  it('sem ficha, oferece criar a primeira pelo fluxo existente', () => {
    seed();
    openMenu();
    const tile = within(menu()).getByRole('button', { name: /^Treino/ });
    expect(tile).toHaveTextContent('Criar primeira ficha');
    fireEvent.click(tile);
    choose(/Criar primeira ficha/);
    expect(
      screen.getByRole('button', { name: /Criar minha primeira ficha/ }),
    ).toBeInTheDocument();
    expect(stored().records.advancedWorkouts).toMatchObject({
      enabled: true,
      plans: [],
      sessions: [],
    });
  });
});

describe('ação rápida: Sono e Leitura', () => {
  it('registra o sono de hoje, confirma e mantém após recarregar', async () => {
    const view = seed();
    openMenu();
    choose(/^Sono/);
    const form = quickForm('Registrar sono');
    expect(dateValue(form)).toBe(today);
    fill(form, 'Horas dormidas', '7,5');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar registro' }),
    );
    await waitFor(() => expect(feedback()).toBe('Sono registrado.'));
    expect(document.querySelector('dialog.quick-dialog')).toBeNull();
    expect(stored().records.sleep).toEqual([{ date: today, hours: 7.5 }]);
    view.unmount();
    window.history.replaceState(null, '', '/descanso');
    render(<App />);
    expect(screen.getByLabelText('Histórico de sono')).toHaveTextContent(
      '7,5 h',
    );
  });

  it('confirma o sucesso também em StrictMode (efeitos remontados)', async () => {
    seed();
    cleanup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    openMenu();
    choose(/^Sono/);
    const form = quickForm('Registrar sono');
    fill(form, 'Horas dormidas', '6,5');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar registro' }),
    );
    await waitFor(() => expect(feedback()).toBe('Sono registrado.'));
    expect(document.querySelector('dialog.quick-dialog')).toBeNull();
  });

  it('avisa e corrige o registro existente da data, sem duplicar', async () => {
    seed(
      apply(createInitialPlayerState().records, {
        type: 'saveSleep',
        value: { date: today, hours: 6 },
      }),
    );
    openMenu();
    choose(/^Sono/);
    const form = quickForm('Registrar sono');
    expect(form).toHaveTextContent('Já existe registro de 6 h');
    expect(within(form).getByLabelText('Horas dormidas')).toHaveValue('6');
    fill(form, 'Horas dormidas', '8');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar registro' }),
    );
    await waitFor(() => expect(feedback()).toBe('Sono registrado.'));
    expect(stored().records.sleep).toEqual([{ date: today, hours: 8 }]);
  });

  it('registra leitura do único livro em andamento, já selecionado', async () => {
    seed(
      apply(
        createInitialPlayerState().records,
        book('b1', 'Livro em andamento', 300),
        book('b2', 'Livro concluído', 10),
        {
          type: 'saveReading',
          value: { id: 'r0', bookId: 'b2', pages: 10, date: today },
        },
      ),
    );
    openMenu();
    choose(/^Leitura/);
    const form = quickForm('Registrar leitura');
    expect(form).toHaveTextContent('Livro em andamento');
    expect(form).not.toHaveTextContent('Livro concluído');
    expect(form).toHaveTextContent('Restam 300 páginas');
    fill(form, 'Páginas lidas neste registro', '25');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar leitura' }),
    );
    await waitFor(() => expect(feedback()).toBe('Leitura registrada.'));
    expect(stored().records.readings).toHaveLength(2);
    expect(stored().records.readings.at(-1)).toMatchObject({
      bookId: 'b1',
      pages: 25,
      date: today,
    });
  });

  it('com vários livros, permite escolher; respeita o limite de páginas', () => {
    seed(
      apply(
        createInitialPlayerState().records,
        book('b1', 'Primeiro', 100),
        book('b2', 'Segundo', 50),
      ),
    );
    openMenu();
    choose(/^Leitura/);
    const form = quickForm('Registrar leitura');
    expect(
      within(form).getByRole('combobox', { name: 'Livro da leitura' }),
    ).toBeInTheDocument();
    fill(form, 'Páginas lidas neste registro', '101');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar leitura' }),
    );
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'A leitura ultrapassa o total de páginas do livro.',
    );
    // Falha: nada gravado, dados mantidos, sem sucesso; pode tentar de novo.
    expect(stored().records.readings).toEqual([]);
    expect(
      within(form).getByLabelText('Páginas lidas neste registro'),
    ).toHaveValue(101);
    expect(feedback()).toBe('');
    fill(form, 'Páginas lidas neste registro', '100');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar leitura' }),
    );
    expect(stored().records.readings).toHaveLength(1);
  });

  it('sem livros, abre o cadastro e segue para a primeira leitura', async () => {
    seed();
    openMenu();
    const tile = within(menu()).getByRole('button', { name: /^Leitura/ });
    expect(tile).toHaveTextContent('Cadastrar livro');
    fireEvent.click(tile);
    const form = quickForm('Cadastrar livro');
    fill(form, 'Título do livro', 'Primeiro livro');
    fill(form, 'Total de páginas', '120');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar livro' }),
    );
    const reading = await screen.findByRole('form', {
      name: 'Registrar leitura',
    });
    expect(reading).toHaveTextContent('Primeiro livro');
    expect(screen.getByText(/Livro cadastrado/)).toBeInTheDocument();
    expect(stored().records.books).toHaveLength(1);
  });
});

describe('ação rápida: Finanças', () => {
  it.each([
    ['income', 'Adicionar receita', 'Receita', 'Receita registrada.'],
    ['expense', 'Adicionar despesa', 'Despesa', 'Despesa registrada.'],
  ] as const)(
    '%s: abre o formulário existente com o tipo e a data de hoje',
    async (kind, action, label, message) => {
      seed(
        apply(createInitialPlayerState().records, {
          type: 'saveMovement',
          value: {
            id: 'm0',
            kind,
            description: 'Anterior',
            amountCents: 1000,
            category: kind === 'income' ? 'Trabalho extra' : 'Mercado',
            date: '2026-11-01',
          },
        }),
      );
      openMenu();
      choose(/^Finanças/);
      choose(action);
      const form = quickForm('Nova movimentação');
      expect(
        within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
      ).toHaveTextContent(label);
      expect(dateValue(form)).toBe(today);
      // Categorias recentes continuam disponíveis.
      const recent = within(form).getByRole('group', {
        name: /^Categorias recentes/,
      });
      const category = kind === 'income' ? 'Trabalho extra' : 'Mercado';
      fireEvent.click(within(recent).getByRole('button', { name: category }));
      fill(form, 'Descrição', 'Registro rápido');
      fill(form, 'Valor (R$)', '4590');
      fireEvent.click(
        within(form).getByRole('button', { name: 'Adicionar movimentação' }),
      );
      await waitFor(() => expect(feedback()).toBe(message));
      const created = stored().records.movements.at(-1);
      expect(created).toMatchObject({
        kind,
        description: 'Registro rápido',
        amountCents: 4590,
        category,
        date: today,
      });
      // Carteira única: sem conta escolhida; nenhum investimento muda.
      expect(created).not.toHaveProperty('accountId');
      expect(stored().records.investmentEntries).toEqual([]);
    },
  );

  it('preserva a opção de recorrência do formulário', async () => {
    seed();
    openMenu();
    choose(/^Finanças/);
    choose('Adicionar receita');
    const form = quickForm('Nova movimentação');
    fireEvent.click(
      within(form).getByRole('switch', { name: 'Repetir periodicamente' }),
    );
    fill(form, 'Descrição', 'Salário');
    fill(form, 'Valor (R$)', '300000');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Adicionar movimentação' }),
    );
    await waitFor(() =>
      expect(feedback()).toBe('Receita recorrente registrada.'),
    );
    expect(stored().records.finance?.recurrences).toHaveLength(1);
    expect(stored().records.movements).toHaveLength(1);
  });

  it('cliques repetidos não criam movimentações duplicadas', async () => {
    seed();
    openMenu();
    choose(/^Finanças/);
    choose('Adicionar despesa');
    const form = quickForm('Nova movimentação');
    fill(form, 'Descrição', 'Café');
    fill(form, 'Valor (R$)', '800');
    const submit = within(form).getByRole('button', {
      name: 'Adicionar movimentação',
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.submit(form);
    await waitFor(() => expect(feedback()).toBe('Despesa registrada.'));
    expect(stored().records.movements).toHaveLength(1);
  });
});

describe('confirmação e regras compartilhadas', () => {
  it.each([
    ['failed', 'A gravação não foi confirmada'],
    ['conflict', 'alterados em outra aba'],
  ] as const)(
    'gravação %s: não mostra sucesso, mantém os dados e não duplica',
    async (outcome, message) => {
      const commands: RecordCommand[] = [];
      function Harness() {
        const [records, setRecords] = useState(
          createInitialPlayerState().records,
        );
        return (
          <QuickActions
            records={records}
            today={today}
            onCommand={(command) => {
              commands.push(command);
              setRecords((previous) =>
                applyRecordCommand(previous, command, today),
              );
              return null;
            }}
            whenSaved={() => Promise.resolve(outcome)}
            onNavigate={() => {}}
            onOpenSession={() => {}}
          />
        );
      }
      render(<Harness />);
      fireEvent.click(trigger());
      choose(/^Finanças/);
      choose('Adicionar despesa');
      const form = quickForm('Nova movimentação');
      fill(form, 'Descrição', 'Café');
      fill(form, 'Valor (R$)', '800');
      fireEvent.click(
        within(form).getByRole('button', { name: 'Adicionar movimentação' }),
      );
      const dialog = document.querySelector<HTMLElement>(
        'dialog.quick-dialog',
      )!;
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        message,
      );
      expect(feedback()).toBe('');
      expect(within(form).getByLabelText('Descrição')).toHaveValue('Café');
      // Novo envio não aplica o comando outra vez.
      fireEvent.submit(form);
      expect(commands).toHaveLength(1);
    },
  );

  it('usa os mesmos comandos: registros, XP e Radar idênticos aos da página', async () => {
    seed();
    openMenu();
    choose(/^Sono/);
    const form = quickForm('Registrar sono');
    fill(form, 'Horas dormidas', '8');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar registro' }),
    );
    await waitFor(() => expect(feedback()).toBe('Sono registrado.'));
    const expected = apply(createInitialPlayerState().records, {
      type: 'saveSleep',
      value: { date: today, hours: 8 },
    });
    // Mesmo estado de registros que o comando da página Descanso produz; XP e
    // Radar são projeções desses registros.
    expect(stored().records).toEqual(expected);
    expect(recordReward(stored().records, [], today)).toBe(
      recordReward(expected, [], today),
    );
  });

  it('retorna erro do comando sem anunciar sucesso nem fechar', () => {
    let calls = 0;
    render(
      <QuickActions
        records={createInitialPlayerState().records}
        today={today}
        onCommand={() => {
          calls += 1;
          return 'Falha simulada.';
        }}
        onNavigate={() => {}}
        onOpenSession={() => {}}
      />,
    );
    fireEvent.click(trigger());
    choose(/^Sono/);
    const form = quickForm('Registrar sono');
    fill(form, 'Horas dormidas', '7');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar registro' }),
    );
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Falha simulada.',
    );
    expect(calls).toBe(1);
    expect(feedback()).toBe('');
    expect(quickForm('Registrar sono')).toBeInTheDocument();
  });
});

describe('estilos das ações rápidas', () => {
  const path = './quickActions.css';
  const css = readFileSync(new URL(path, import.meta.url), 'utf8');

  it('respeita prefers-reduced-motion', () => {
    const reduced = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(reduced).toMatch(
      /\.quick-actions__panel,\s*\.quick-actions__intro \{\s*animation: none;/,
    );
    expect(reduced).toMatch(/\.quick-actions__icon,[\s\S]*?transition: none;/);
  });

  it('mantém os cards do menu no mesmo tamanho', () => {
    expect(css).toMatch(
      /\.quick-actions__grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-auto-rows: 1fr;/,
    );
    expect(css).toMatch(
      /\.quick-actions__grid \.quick-actions__item \{\s*height: 100%;/,
    );
  });

  it('posiciona sem depender de uma largura específica de tela', () => {
    // Centralizado pela própria barra fixa, acima dela, com área segura.
    expect(css).toMatch(
      /\.global-actions \{[^}]*position: absolute;[^}]*bottom: calc\(100% \+ var\(--space-3\)\);[^}]*left: 50%;[^}]*transform: translateX\(-50%\);/,
    );
    expect(css).toMatch(/width: min\(340px, calc\(100vw - 32px\)\)/);
    expect(css).toMatch(/@media \(min-width: 1024px\)/);
    // “+” com o mesmo tamanho do botão de voz (48 px).
    expect(css).toMatch(/\.quick-actions \{\s*--quick-size: 48px;/);
  });
});
