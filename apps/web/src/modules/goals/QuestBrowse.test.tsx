import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { App } from '../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';
import { applyGoalCommand } from './commands';
import { blankGoal } from './templates';
const today = '2026-11-13';
afterEach(cleanup);
function seeded() {
  const state = createInitialPlayerState();
  for (const definition of [
    {
      title: 'Ler histórias',
      description: 'Explorar ficção brasileira',
      pillar: 'Conhecimento' as const,
      deadline: '2026-11-20',
    },
    {
      title: 'Álbum de viagens',
      description: 'Organizar minhas fotos',
      pillar: 'Geral' as const,
      deadline: '2026-11-14',
    },
    {
      title: 'Corrida no parque',
      description: 'Treino ao ar livre',
      pillar: 'Treinos' as const,
      deadline: null,
    },
  ])
    state.goals = applyGoalCommand(
      state.goals,
      {
        type: 'save',
        id: definition.title,
        definition: { ...blankGoal(today), ...definition },
      },
      today,
    );
  state.goals = applyGoalCommand(
    state.goals,
    {
      type: 'update',
      value: { id: 'pages', goalId: 'Ler histórias', value: 8000, date: today },
    },
    today,
  );
  state.goals = applyGoalCommand(
    state.goals,
    {
      type: 'update',
      value: {
        id: 'photos',
        goalId: 'Álbum de viagens',
        value: 2000,
        date: today,
      },
    },
    today,
  );
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
  window.history.replaceState(null, '', '/metas');
  return state;
}
function chip(group: 'pilar' | 'status', name: string) {
  return within(
    screen.getByRole('group', { name: `Filtrar quests por ${group}` }),
  ).getByRole('button', { name });
}
const titles = () =>
  screen
    .queryAllByRole('article', { name: /^Quest / })
    .map((card) => card.getAttribute('aria-label')!.replace(/^Quest /, ''));
function search(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Buscar quest...'), {
    target: { value },
  });
}
function order(name: string) {
  const sort = screen.getByRole('combobox', { name: 'Ordenar quests' });
  fireEvent.click(sort);
  fireEvent.click(screen.getByRole('option', { name }));
}
describe('Página organizada de Quests', () => {
  it('oferece chips rotulados e combina filtros com pesquisa por descrição imediatamente', () => {
    seeded();
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Minhas Quests' }),
    ).toBeInTheDocument();
    expect(document.querySelector('select')).toBeNull();
    expect(
      screen.getByRole('combobox', { name: 'Ordenar quests' }),
    ).toBeInTheDocument();
    expect(chip('pilar', 'Todos')).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(
        screen.getByRole('group', { name: 'Filtrar quests por pilar' }),
      ).getAllByRole('button'),
    ).toHaveLength(6);
    expect(
      within(
        screen.getByRole('group', { name: 'Filtrar quests por status' }),
      ).getAllByRole('button'),
    ).toHaveLength(5);
    fireEvent.click(chip('pilar', 'Conhecimento'));
    expect(chip('pilar', 'Conhecimento')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    search('FICCAO');
    expect(titles()).toEqual(['Ler histórias']);
    expect(
      screen.getByRole('status', { name: 'Quantidade de quests encontradas' }),
    ).toHaveTextContent('1 quest encontrada');
    fireEvent.click(chip('status', 'Concluídas'));
    expect(titles()).toEqual([]);
    expect(
      screen.getByRole('heading', { name: 'Nenhuma quest encontrada' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Limpar filtros e busca' }),
    );
    expect(titles()).toHaveLength(3);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });
  it('limpa pesquisa, devolve foco e não mistura sugestões aos resultados', () => {
    seeded();
    render(<App />);
    const suggestions = screen
      .getByText('Quests sugeridas')
      .closest('details')!;
    expect(suggestions.open).toBe(false);
    search('  album  ');
    expect(titles()).toEqual(['Álbum de viagens']);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }));
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(titles()).toHaveLength(3);
    fireEvent.click(screen.getByText('Quests sugeridas'));
    expect(suggestions.open).toBe(true);
    expect(titles()).toHaveLength(3);
    expect(
      screen.getByRole('status', { name: 'Quantidade de quests encontradas' }),
    ).toHaveTextContent('3 quests encontradas');
  });
  it('reordena todos os critérios sem alterar os registros ou quests existentes', () => {
    seeded();
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    render(<App />);
    expect(titles()).toEqual([
      'Álbum de viagens',
      'Ler histórias',
      'Corrida no parque',
    ]);
    const sortControl = screen.getByRole('combobox', {
      name: 'Ordenar quests',
    });
    fireEvent.click(sortControl);
    expect(sortControl).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(sortControl, { key: 'Escape' });
    expect(sortControl).toHaveAttribute('aria-expanded', 'false');
    expect(sortControl).toHaveFocus();
    order('Maior progresso');
    expect(titles()).toEqual([
      'Ler histórias',
      'Álbum de viagens',
      'Corrida no parque',
    ]);
    order('Menor progresso');
    expect(titles()).toEqual([
      'Corrida no parque',
      'Álbum de viagens',
      'Ler histórias',
    ]);
    order('Mais recentes');
    expect(titles()).toEqual([
      'Corrida no parque',
      'Álbum de viagens',
      'Ler histórias',
    ]);
    order('Ordem alfabética');
    expect(titles()).toEqual([
      'Álbum de viagens',
      'Corrida no parque',
      'Ler histórias',
    ]);
    order('Prazo mais próximo');
    expect(titles()).toEqual([
      'Álbum de viagens',
      'Ler histórias',
      'Corrida no parque',
    ]);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });
  it('mostra estado inicial com uma única ação de criação e sugestões apenas como rascunho', () => {
    window.history.replaceState(null, '', '/quests');
    render(<App />);
    expect(
      screen.getByRole('heading', {
        name: 'Sua próxima conquista começa aqui',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Criar minha quest' }),
    ).toHaveLength(1);
    expect(titles()).toHaveLength(0);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByText('Quests sugeridas'));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Usar modelo: Concluir meu projeto pessoal',
      }),
    );
    expect(
      screen.getByRole('form', { name: 'Criar minha quest' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edição' }));
    expect(titles()).toHaveLength(0);
  });
  it('mantém ações e histórico expansível nos cartões, confirma exclusão e permite consultar o arquivo', () => {
    seeded();
    render(<App />);
    let card = screen.getByRole('article', { name: 'Quest Corrida no parque' });
    expect(card).toHaveAttribute('data-area', 'Treinos');
    expect(card).toHaveAttribute('data-status', 'active');
    expect(within(card).getByText('Sem prazo')).toBeInTheDocument();
    expect(within(card).getByText('Até 25 XP / ciclo')).toBeInTheDocument();
    expect(
      within(card)
        .getByText('Histórico de ciclos e atualizações')
        .closest('details')?.open,
    ).toBe(false);
    fireEvent.click(within(card).getByRole('button', { name: 'Pausar' }));
    fireEvent.click(chip('status', 'Pausadas'));
    expect(titles()).toEqual(['Corrida no parque']);
    fireEvent.click(within(card).getByRole('button', { name: 'Retomar' }));
    expect(titles()).toEqual([]);
    fireEvent.click(chip('status', 'Todas'));
    card = screen.getByRole('article', { name: 'Quest Corrida no parque' });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Excluir quest' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(titles()).toHaveLength(3);
    fireEvent.click(
      within(card).getByRole('button', { name: 'Excluir quest' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirmar exclusão da quest',
      }),
    );
    expect(titles()).toHaveLength(2);
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver quests excluídas (1)' }),
    );
    expect(titles()).toEqual(['Corrida no parque']);
    expect(
      screen.getByRole('article', { name: 'Quest Corrida no parque' }),
    ).toHaveTextContent('Excluída');
    fireEvent.click(
      screen.getByRole('button', { name: 'Voltar às minhas quests' }),
    );
    expect(titles()).toHaveLength(2);
  });
});
