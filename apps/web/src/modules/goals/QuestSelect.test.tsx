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
afterEach(cleanup);
function choose(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}
const stored = () => JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
function nav(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
describe('Dropdowns integrados em Quests', () => {
  it('cria e recupera uma quest com campos customizados, respeitando restrições e valores enviados', () => {
    window.history.replaceState(null, '', '/quests');
    let app = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha quest' }));
    expect(document.querySelector('select')).toBeNull();
    choose('Acompanhamento', 'Automático por registros');
    expect(
      screen.getByRole('combobox', { name: 'Acompanhamento' }),
    ).toHaveTextContent('Manual');
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Acompanhamento' }),
      { key: 'Escape' },
    );
    fireEvent.change(screen.getByLabelText('Título da quest'), {
      target: { value: 'Minha reserva financeira' },
    });
    choose('Pilar da quest', 'Finanças');
    choose('Acompanhamento', 'Automático por registros');
    choose('Indicador automático', 'Patrimônio financeiro total');
    choose('Frequência', 'Mensal');
    choose('Dificuldade e XP potencial', 'Alta · até 50 XP');
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar criação da quest' }),
    );
    expect(stored().goals.items[0]).toMatchObject({
      pillar: 'Finanças',
      tracking: 'automatic',
      metric: 'wealth',
      cadence: 'monthly',
      difficulty: 'hard',
      unit: 'reais',
      target: 10000,
    });
    expect(stored().records).toEqual(createInitialPlayerState().records);
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    app.unmount();
    app = render(<App />);
    expect(
      screen.getByRole('article', { name: 'Quest Minha reserva financeira' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });
  it('abre e cancela a edição sem perder busca, chips, ordenação ou os dados existentes', () => {
    const state = createInitialPlayerState();
    state.goals = applyGoalCommand(
      state.goals,
      {
        type: 'save',
        id: 'g',
        definition: {
          ...blankGoal('2026-11-13'),
          title: 'Ler no jardim',
          pillar: 'Conhecimento',
        },
      },
      '2026-11-13',
    );
    const raw = JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: state,
    });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    window.history.replaceState(null, '', '/metas');
    render(<App />);
    const group = within(
      screen.getByRole('group', { name: 'Filtrar quests por pilar' }),
    );
    fireEvent.click(group.getByRole('button', { name: 'Conhecimento' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar quest...'), {
      target: { value: 'jardim' },
    });
    choose('Ordenar quests', 'Maior progresso');
    fireEvent.click(screen.getByRole('button', { name: 'Editar quest' }));
    choose('Pilar da quest', 'Geral');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edição' }));
    expect(group.getByRole('button', { name: 'Conhecimento' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('searchbox')).toHaveValue('jardim');
    expect(
      screen.getByRole('combobox', { name: 'Ordenar quests' }),
    ).toHaveTextContent('Maior progresso');
    expect(
      screen.getByRole('article', { name: 'Quest Ler no jardim' }),
    ).toHaveTextContent('Conhecimento');
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });
  it('envia a opção de conclusão manual e reinicia corretamente a escolha ao reabrir', () => {
    const state = createInitialPlayerState();
    state.goals = applyGoalCommand(
      state.goals,
      {
        type: 'save',
        id: 'g',
        definition: {
          ...blankGoal('2026-11-13'),
          title: 'Meu projeto',
          kind: 'completion',
          target: 1000,
        },
      },
      '2026-11-13',
    );
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
    );
    window.history.replaceState(null, '', '/quests');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Concluir quest' }));
    choose('Conclusão manual', 'Ainda não concluí / desfazer');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar progresso' }));
    expect(stored().goals.updates[0].value).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Concluir quest' }));
    expect(
      screen.getByRole('combobox', { name: 'Conclusão manual' }),
    ).toHaveTextContent('Concluí esta quest');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar progresso' }));
    expect(stored().goals.updates).toHaveLength(1);
    expect(stored().goals.updates[0].value).toBe(1000);
    nav('Início');
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '25');
    nav('Quests');
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer conclusão' }));
    expect(
      screen.getByRole('combobox', { name: 'Conclusão manual' }),
    ).toHaveTextContent('Ainda não concluí / desfazer');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar progresso' }));
    nav('Início');
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });
});
