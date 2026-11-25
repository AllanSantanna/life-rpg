import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../../app/playerState';
import { projectCharacter } from '../../profile/character';
import { selectOption } from '../../../test/selectOption';
import {
  testDate as today,
  testSession,
  testSet,
  testState,
} from './testFixtures';
import type { WorkoutPlan } from './types';
afterEach(cleanup);
function open(state?: PlayerState) {
  if (state)
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
    );
  window.history.replaceState(null, '', '/treinos');
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
function saved(): PlayerState {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
}
const advanced = () => saved().records.advancedWorkouts!;
const toggle = () =>
  fireEvent.click(screen.getByRole('switch', { name: 'Modo Avançado' }));
const tab = (name: string) =>
  fireEvent.click(screen.getByRole('tab', { name }));
const button = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));
/** Finalização em duas etapas: revisão, confirmação e aviso após gravar. */
async function finish(trigger = 'Concluir sessão') {
  button(trigger);
  const review = screen.getByRole('dialog', { name: 'Finalizar treino?' });
  fireEvent.click(
    within(review).getByRole('button', { name: 'Finalizar treino' }),
  );
  const done = await screen.findByRole('dialog', {
    name: 'Treino finalizado!',
  });
  fireEvent.click(within(done).getByRole('button', { name: 'Entendi' }));
  expect(screen.queryByRole('dialog')).toBeNull();
}
function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), {
    target: { value },
  });
}
function nav(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
function plan(): WorkoutPlan {
  return {
    id: 'plan',
    name: 'Peito',
    description: 'Livre',
    notes: 'Cuidado pessoal',
    exercises: [
      { id: 'bench', exerciseId: 'bench', sets: 3, reps: 10, notes: '' },
    ],
  };
}
function seeded() {
  const state = createInitialPlayerState();
  state.records.advancedWorkouts = {
    ...testState(),
    sessions: [],
    plans: [plan()],
  };
  return state;
}

describe('musculação opcional na aplicação real', () => {
  it('marca o dia pelo registro simples e corrige uma série sem alterar o XP diário', async () => {
    const state = seeded();
    state.records.advancedWorkouts!.plans[0]!.exercises[0]!.sets = 1;
    open(state);
    button('Iniciar Peito');
    change('Carga (kg) · exercício 1, série 1', '20.5');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Concluída' }));
    await finish();
    expect(saved().records.workouts).toEqual([{ date: today, trained: true }]);
    expect(
      within(screen.getByRole('form', { name: 'Treinou hoje?' })).getByRole(
        'button',
        { name: 'Sim' },
      ),
    ).toHaveAttribute('aria-pressed', 'true');
    change('Carga (kg) · exercício 1, série 1', '');
    expect(advanced().sessions[0]!.status).toBe('in_progress');
    expect(advanced().sessions[0]!.exercises[0]!.sets[0]!.completed).toBe(
      false,
    );
    expect(saved().records.workouts).toHaveLength(1);
    tab('Recordes pessoais');
    expect(
      screen.getByText(/Seus recordes aparecerão após a primeira série válida/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('form', { name: 'Treinou hoje?' })).getByRole(
        'button',
        { name: 'Sim' },
      ),
    );
    nav('Início');
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '150');
  });
  it('começa desativado, preserva o registro simples, alterna e salva a preferência após recarga', () => {
    const app = open();
    expect(
      screen.getByRole('switch', { name: 'Modo Avançado' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('form', { name: 'Treinou hoje?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Calendário de treinos' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tablist', { name: 'Musculação' }),
    ).not.toBeInTheDocument();
    toggle();
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    expect(
      screen.getByRole('form', { name: 'Treinou hoje?' }),
    ).toBeInTheDocument();
    expect(saved().records.workouts).toEqual([]);
    const plansTab = screen.getByRole('tab', { name: 'Minhas fichas' });
    fireEvent.keyDown(plansTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Registrar treino' })).toHaveFocus();
    expect(
      screen.getByRole('tab', { name: 'Registrar treino' }),
    ).toHaveAttribute('aria-selected', 'true');
    app.unmount();
    open();
    expect(screen.getByRole('switch', { name: 'Modo Avançado' })).toBeChecked();
    toggle();
    expect(advanced().enabled).toBe(false);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    nav('Início');
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });

  // Fluxo completo de interface; com a suíte inteira em paralelo excede 5 s.
  it('cria exercício personalizado e ficha, reordena, edita, duplica e exige confirmação para excluir', () => {
    open();
    toggle();
    fireEvent.click(screen.getByText('Catálogo de exercícios'));
    button('Novo exercício');
    change('Nome do exercício', 'Puxada pessoal');
    selectOption(
      screen.getByRole('combobox', { name: 'Grupo muscular principal' }),
      'Costas',
    );
    fireEvent.click(screen.getByLabelText('Bíceps', { exact: true }));
    change('Equipamento (opcional)', 'Polia');
    button('Salvar exercício');
    expect(advanced().exercises[0]).toMatchObject({
      name: 'Puxada pessoal',
      primary: 'back',
      secondary: ['biceps'],
      equipment: 'Polia',
    });
    button('Nova ficha');
    fireEvent.click(screen.getByRole('radio', { name: /A — Treino único/ }));
    button('Avançar');
    change('Nome da ficha A', 'Treino A');
    button('Avançar');
    button('Adicionar exercícios');
    change('Pesquisar exercícios', 'supino reto');
    button('Selecionar Supino reto');
    change('Pesquisar exercícios', 'puxada pessoal');
    button('Selecionar Puxada pessoal');
    button('Adicionar (2)');
    change('Séries planejadas · exercício 1', '4');
    change('Repetições planejadas · exercício 1', '8');
    button('Subir exercício 2');
    button('Salvar fichas');
    expect(advanced().plans[0]!.exercises.map((e) => e.exerciseId)).toEqual([
      advanced().exercises[0]!.id,
      'bench',
    ]);
    button('Abrir ficha Treino A');
    button('Editar ficha');
    change('Nome da ficha', 'Meu treino A');
    button('Salvar ficha');
    button('Duplicar ficha');
    expect(advanced().plans.map((p) => p.name)).toEqual([
      'Meu treino A',
      'Meu treino A (cópia)',
    ]);
    button('Minhas fichas');
    button('Abrir ficha Meu treino A (cópia)');
    button('Excluir ficha');
    expect(advanced().plans).toHaveLength(2);
    button('Cancelar');
    button('Excluir ficha');
    button('Confirmar exclusão');
    expect(advanced().plans).toHaveLength(1);
  }, 15_000);

  it('registra cargas diferentes, aquecimento e RIR, conclui sem XP duplicado e recupera os dados ao reativar', async () => {
    const state = seeded();
    state.records.workouts = [{ date: today, trained: true }];
    const baseline = projectCharacter(state, today);
    const app = open(state);
    button('Iniciar Peito');
    expect(
      screen.getByRole('heading', { name: 'Registrar treino' }),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Tipo · exercício 1, série 1' }),
      { target: { value: 'warmup' } },
    );
    change('Carga (kg) · exercício 1, série 1', '10');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Concluída' })[0]!);
    change('Carga (kg) · exercício 1, série 2', '40');
    change('Repetições · exercício 1, série 2', '8');
    change('RIR · exercício 1, série 2', '0');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Concluída' })[1]!);
    change('Carga (kg) · exercício 1, série 3', '45');
    change('Repetições · exercício 1, série 3', '6');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Concluída' })[2]!);
    expect(
      screen.getByText('Volume da sessão: 590 kg·rep'),
    ).toBeInTheDocument();
    button('Adicionar série');
    button('Remover série 4 de Supino reto');
    await finish();
    await finish('Confirmar sessão');
    expect(advanced().sessions[0]!.status).toBe('completed');
    expect(
      advanced().sessions[0]!.exercises[0]!.sets.map((s) => s.rir),
    ).toEqual([null, 0, null]);
    expect(saved().records.workouts).toHaveLength(1);
    const facts = projectCharacter(saved(), today);
    expect(facts.progress).toEqual(baseline.progress);
    expect(facts.dedication).toEqual(baseline.dedication);
    expect(facts.classification).toEqual(baseline.classification);
    expect(saved().goals).toEqual(state.goals);
    const sessions = advanced().sessions;
    toggle();
    expect(advanced().sessions).toEqual(sessions);
    app.unmount();
    open();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    toggle();
    tab('Histórico');
    fireEvent.click(screen.getByText('Exercícios, séries e RIR'));
    expect(screen.getByText(/RIR 0/)).toBeInTheDocument();
    expect(advanced().sessions).toEqual(sessions);
    nav('Início');
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '150');
  });

  it('permite concluir sem marcar o dia e mantém sessão em andamento após recarregar', async () => {
    const app = open(seeded());
    button('Iniciar Peito');
    change('Carga (kg) · exercício 1, série 1', '0');
    change('RIR · exercício 1, série 1', '0');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Concluída' })[0]!);
    const id = advanced().sessions[0]!.id;
    app.unmount();
    open();
    expect(
      screen.getByRole('tab', { name: 'Registrar treino' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('RIR · exercício 1, série 1')).toHaveValue(0);
    expect(advanced().sessions[0]!.id).toBe(id);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Marcar o dia como treinado ao concluir',
      }),
    );
    await finish();
    expect(saved().records.workouts).toEqual([]);
    expect(advanced().sessions[0]!.status).toBe('completed');
    nav('Início');
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });

  it('mostra somente pontos reais, permite consultar valores por toque/teclado e filtra RIR e repetições por carga', () => {
    const state = seeded();
    state.records.advancedWorkouts!.sessions = [
      testSession('one', today, [testSet('s', 20, 10, 'working', 0)]),
    ];
    open(state);
    tab('Evolução de cargas');
    expect(
      screen.getByRole('group', { name: 'Maior carga: 1 ponto registrado' }),
    ).toBeInTheDocument();
    const point = screen.getByRole('button', {
      name: '13/11/2026 · Treino A: 20 kg',
    });
    fireEvent.click(point);
    expect(screen.getByRole('tooltip')).toHaveTextContent('20 kg');
    fireEvent.focus(point);
    expect(screen.getByRole('tooltip')).toHaveTextContent('13/11/2026');
    selectOption(
      screen.getByRole('combobox', { name: 'Indicador de evolução' }),
      'RIR médio',
    );
    fireEvent.click(
      screen.getByRole('button', { name: '13/11/2026 · Treino A: 0 RIR' }),
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('0 RIR');
    selectOption(
      screen.getByRole('combobox', { name: 'Indicador de evolução' }),
      'Repetições com a mesma carga',
    );
    expect(
      screen.getByRole('combobox', { name: 'Carga para comparar repetições' }),
    ).toHaveTextContent('20 kg');
    expect(
      screen.getByRole('button', { name: '13/11/2026 · Treino A: 10 rep' }),
    ).toBeInTheDocument();
    button('Semanal');
    selectOption(
      screen.getByRole('combobox', { name: 'Exercício para análise' }),
      'Remada curvada',
    );
    expect(
      screen.getByText(/Nenhum registro para este exercício e período/),
    ).toBeInTheDocument();
  });

  it('corrige e exclui sessões anteriores recalculando recordes, volumes e mapa sem apagar o registro diário', () => {
    const state = seeded();
    state.records.workouts = [{ date: today, trained: true }];
    state.records.advancedWorkouts!.sessions = [
      {
        ...testSession('old', '2026-10-01', [testSet('s', 10, 5)]),
        planName: 'Treino antigo',
      },
      testSession('new', today, [
        testSet('warmup', 5, 10, 'warmup'),
        testSet('s', 30, 10),
      ]),
    ];
    open(state);
    tab('Recordes pessoais');
    expect(screen.getByText('30 kg')).toBeInTheDocument();
    tab('Histórico');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Corrigir sessão' })[0]!,
    );
    change('Carga (kg) · exercício 1, série 2', '20');
    tab('Recordes pessoais');
    expect(screen.getByText('20 kg')).toBeInTheDocument();
    tab('Volume de treinamento');
    expect(screen.getAllByText('200 kg·rep')).toHaveLength(3);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Incluir aquecimento no volume' }),
    );
    expect(screen.getAllByText('250 kg·rep')).toHaveLength(3);
    tab('Mapa muscular');
    expect(
      screen.getByRole('group', { name: 'Mapa muscular · visão frontal' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Mapa muscular · visão traseira' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Peito 1' })).toBeInTheDocument();
    button('Peito 1');
    expect(
      screen.getByText('Peito: 1 série válida no período.'),
    ).toBeInTheDocument();
    selectOption(
      screen.getByRole('combobox', { name: 'Período do mapa' }),
      'Últimos 365 dias',
    );
    expect(screen.getByRole('button', { name: 'Peito 2' })).toBeInTheDocument();
    tab('Histórico');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Excluir sessão' })[0]!,
    );
    button('Confirmar exclusão');
    tab('Recordes pessoais');
    expect(screen.getByText('10 kg')).toBeInTheDocument();
    expect(saved().records.workouts).toEqual(state.records.workouts);
  });

  it('mantém os controles operantes em telas pequenas e informa falha de persistência sem apagar a sessão', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 375,
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    open();
    toggle();
    tab('Registrar treino');
    button('Iniciar sessão');
    expect(screen.getByText(/Em andamento/)).toBeInTheDocument();
    expect(
      screen.getByText(/Salvamento local indisponível/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'Treinou hoje?' }),
    ).toBeInTheDocument();
    tab('Mapa muscular');
    expect(
      screen.getByText('Nenhuma série válida concluída neste período.'),
    ).toBeInTheDocument();
  });
  it('guia a divisão A/B/C/D, seleciona vários exercícios e preserva a rotação após recarga', async () => {
    const app = open();
    toggle();
    button('Criar minha primeira ficha');
    fireEvent.click(
      screen.getByRole('radio', { name: /A\/B\/C\/D — Quatro treinos/ }),
    );
    change('Sequência de utilização', 'A → B → A → D → C');
    button('Avançar');
    change('Nome da ficha A', 'Empurrar');
    change('Músculos ou descrição da ficha A', 'Peito e tríceps');
    change('Nome da ficha C', 'Quadríceps');
    button('Avançar');
    button('Adicionar exercícios');
    change('Pesquisar exercícios', 'SUPINO');
    button('Selecionar Supino reto');
    button('Selecionar Supino inclinado');
    expect(screen.getByText('2 selecionados')).toBeInTheDocument();
    button('Adicionar (2)');
    button('Salvar fichas');
    expect(advanced().plans.map((p) => p.name)).toEqual([
      'Empurrar',
      'Treino B',
      'Quadríceps',
      'Treino D',
    ]);
    expect(advanced().plans[0]!.exercises.map((e) => e.exerciseId)).toEqual([
      'bench',
      'incline',
    ]);
    const ids = advanced().plans.map((p) => p.id);
    expect(advanced().rotation).toEqual({
      sequence: [ids[0], ids[1], ids[0], ids[3], ids[2]],
      cursor: 0,
    });
    app.unmount();
    open();
    expect(advanced().plans).toHaveLength(4);
    button('Iniciar Empurrar');
    change('Carga (kg) · exercício 1, série 1', '20');
    change('Repetições · exercício 1, série 1', '10');
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Concluída' })[0]!);
    await finish();
    tab('Minhas fichas');
    expect(advanced().rotation?.cursor).toBe(1);
    expect(
      screen.getByText('PRÓXIMO NA SEQUÊNCIA').parentElement,
    ).toHaveTextContent('Treino B');
  });

  it('copia as séries anteriores, mantém aquecimento e recupera valores ao navegar e recarregar', () => {
    const state = seeded();
    state.records.advancedWorkouts!.plans[0]!.exercises.push({
      id: 'row-plan',
      exerciseId: 'row',
      sets: 1,
      reps: 8,
      notes: '',
    });
    state.records.advancedWorkouts!.sessions = [
      testSession('old', '2026-11-10', [
        testSet('warm', 5, 15, 'warmup'),
        testSet('first', 40, 8, 'working', 0),
        testSet('second', 45, 6),
      ]),
    ];
    const app = open(state);
    button('Iniciar Peito');
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Tipo · exercício 1, série 1' }),
      { target: { value: 'warmup' } },
    );
    change('Carga (kg) · exercício 1, série 1', '5');
    button('Copiar último treino');
    expect(
      screen.getByLabelText('Carga (kg) · exercício 1, série 1'),
    ).toHaveValue(5);
    expect(
      screen.getByLabelText('Carga (kg) · exercício 1, série 2'),
    ).toHaveValue(40);
    expect(screen.getByLabelText('RIR · exercício 1, série 2')).toHaveValue(0);
    expect(
      screen.getByLabelText('Carga (kg) · exercício 1, série 3'),
    ).toHaveValue(45);
    expect(
      screen
        .getAllByRole('checkbox', { name: 'Concluída' })
        .every((input) => !(input as HTMLInputElement).checked),
    ).toBe(true);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Concluída' })[1]!);
    expect(
      screen.getByRole('progressbar', { name: 'Progresso das séries' }),
    ).toHaveAttribute('value', '1');
    button('Próximo ›');
    change('Carga (kg) · exercício 2, série 1', '25');
    button('‹ Anterior');
    expect(
      screen.getByLabelText('Carga (kg) · exercício 1, série 2'),
    ).toHaveValue(40);
    tab('Histórico');
    tab('Registrar treino');
    expect(
      screen.getByLabelText('Carga (kg) · exercício 1, série 2'),
    ).toHaveValue(40);
    tab('Minhas fichas');
    button('Iniciar Peito');
    expect(advanced().sessions).toHaveLength(2);
    app.unmount();
    open();
    expect(
      screen.getByLabelText('Carga (kg) · exercício 1, série 2'),
    ).toHaveValue(40);
    button('Próximo ›');
    expect(
      screen.getByLabelText('Carga (kg) · exercício 2, série 1'),
    ).toHaveValue(25);
  });
});
