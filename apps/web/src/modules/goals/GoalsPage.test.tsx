import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { App } from '../../app/App';
import {
  PLAYER_STORAGE_KEY,
  createInitialPlayerState,
} from '../../app/playerState';
afterEach(cleanup);
function open() {
  window.history.replaceState(null, '', '/quests');
  return render(<App />);
}
function input(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), { target: { value } });
}
function select(form: HTMLElement, label: string, option: string) {
  fireEvent.click(within(form).getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: option }));
}
function create(title = 'Meu projeto livre') {
  fireEvent.click(screen.getByRole('button', { name: 'Criar minha quest' }));
  const form = screen.getByRole('form', { name: 'Criar minha quest' });
  input(form, 'Título da quest', title);
  select(form, 'Tipo de quest', 'Conclusão simples');
  fireEvent.click(
    within(form).getByRole('button', { name: 'Confirmar criação da quest' }),
  );
  return screen.getByRole('article', { name: `Quest ${title}` });
}
function stored() {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
}
function nav(name: string) {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name }),
  );
}
describe('Quests personalizadas na aplicação', () => {
  it('abre pela URL, cria livremente, conclui sem alterar Radar e conserva após recarga', () => {
    const app = open();
    expect(screen.getByRole('heading', { name: 'Quests' })).toBeInTheDocument();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBeNull();
    let card = create();
    fireEvent.click(
      within(card).getByRole('button', { name: 'Concluir quest' }),
    );
    fireEvent.click(
      within(card).getByRole('button', { name: 'Salvar progresso' }),
    );
    expect(within(card).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(stored().goals.updates).toHaveLength(1);
    nav('Início');
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByRole('progressbar', { name: 'Força' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    app.unmount();
    open();
    card = screen.getByRole('article', { name: 'Quest Meu projeto livre' });
    expect(within(card).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    fireEvent.click(
      within(card).getByRole('button', { name: 'Desfazer conclusão' }),
    );
    fireEvent.click(
      within(card).getByRole('button', { name: 'Salvar progresso' }),
    );
    nav('Início');
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });
  it('usa sugestões apenas como rascunho e permite mudar todos os campos antes de confirmar', () => {
    open();
    fireEvent.click(screen.getByText('Quests sugeridas'));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Usar modelo: Treinar quatro vezes por semana',
      }),
    );
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBeNull();
    const form = screen.getByRole('form', { name: 'Criar minha quest' });
    input(form, 'Título da quest', 'Minha habilidade de desenho');
    select(form, 'Pilar da quest', 'Geral');
    select(form, 'Unidade da quest', 'Outra unidade');
    input(form, 'Unidade personalizada', 'rascunhos');
    input(form, 'Alvo (rascunhos)', '10');
    select(form, 'Frequência', 'Personalizada');
    input(form, 'Dias por ciclo', '5');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Confirmar criação da quest' }),
    );
    expect(stored().goals.items[0]).toMatchObject({
      title: 'Minha habilidade de desenho',
      pillar: 'Geral',
      unit: 'rascunhos',
      cadence: 'custom',
      customDays: 5,
      tracking: 'manual',
      target: 10000,
    });
  });
  it('acompanha registros reais, filtra por status/pilar, pausa e retoma sem apagar os pilares', () => {
    const state = createInitialPlayerState();
    state.records.workouts = [{ date: '2026-11-13', trained: true }];
    localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ version: 4, data: state }),
    );
    open();
    fireEvent.click(screen.getByText('Quests sugeridas'));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Usar modelo: Treinar quatro vezes por semana',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('form', { name: 'Criar minha quest' })).getByRole(
        'button',
        { name: 'Confirmar criação da quest' },
      ),
    );
    const card = screen.getByRole('article', {
      name: 'Quest Treinar quatro vezes por semana',
    });
    expect(within(card).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    fireEvent.click(within(card).getByRole('button', { name: 'Pausar' }));
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Filtrar quests por status' }),
      ).getByRole('button', { name: 'Pausadas' }),
    );
    expect(card).toHaveTextContent('Pausada');
    fireEvent.click(within(card).getByRole('button', { name: 'Retomar' }));
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Filtrar quests por status' }),
      ).getByRole('button', { name: 'Todas' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Filtrar quests por pilar' }),
      ).getByRole('button', { name: 'Finanças' }),
    );
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(stored().records).toEqual(state.records);
  });
  it('permite editar, atualizar número manual e excluir com confirmação mantendo histórico', () => {
    open();
    let card = create();
    fireEvent.click(within(card).getByRole('button', { name: 'Editar quest' }));
    let form = screen.getByRole('form', { name: 'Editar minha quest' });
    input(form, 'Título da quest', 'Dez etapas');
    select(form, 'Tipo de quest', 'Quantitativa · atingir um alvo');
    input(form, 'Alvo (vezes)', '10');
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar quest' }));
    card = screen.getByRole('article', { name: 'Quest Dez etapas' });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Atualizar progresso' }),
    );
    form = within(card).getByRole('form', {
      name: 'Atualizar progresso de Dez etapas',
    });
    input(form, 'Progresso total do ciclo (vezes)', '3');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Salvar progresso' }),
    );
    expect(within(card).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '30',
    );
    fireEvent.click(
      within(card).getByRole('button', { name: 'Excluir quest' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );
    expect(stored().goals.items[0].deletedOn).toBeNull();
    fireEvent.click(
      within(card).getByRole('button', { name: 'Excluir quest' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirmar exclusão da quest',
      }),
    );
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Ver quests excluídas/ }),
    );
    expect(
      screen.getByRole('article', { name: 'Quest Dez etapas' }),
    ).toHaveTextContent('Excluída');
    expect(stored().goals.updates).toHaveLength(1);
  });
  it('mostra resumo compacto das quests ativas e mantém navegação acessível', () => {
    open();
    create('Meu objetivo');
    nav('Início');
    const summary = screen.getByRole('region', { name: 'Minhas Quests' });
    expect(summary).toHaveTextContent('Meu objetivo');
    expect(within(summary).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    fireEvent.click(within(summary).getByRole('button', { name: 'Ver todas' }));
    expect(window.location.pathname).toBe('/quests');
    expect(
      within(
        screen.getByRole('navigation', { name: 'Navegação principal' }),
      ).getByRole('button', { name: 'Quests' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});
