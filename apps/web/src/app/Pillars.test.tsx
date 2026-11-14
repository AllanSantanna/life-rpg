import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { PLAYER_STORAGE_KEY } from './playerState';

afterEach(cleanup);
function open(path: string) {
  window.history.replaceState(null, '', path);
  return render(<App />);
}
function input(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label), {
    target: {
      value:
        /Valor|Saldo inicial|Preço|Custo/.test(label) && /^-?\d+$/.test(value)
          ? value + ',00'
          : value,
    },
  });
}
function click(form: HTMLElement, name: string) {
  fireEvent.click(within(form).getByRole('button', { name }));
}
function stored() {
  return JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).data;
}
function home() {
  fireEvent.click(
    within(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).getByRole('button', { name: 'Início' }),
  );
}

describe('Fluxos reais dos quatro pilares', () => {
  it('cadastra, corrige, filtra meses e exclui movimentações financeiras', () => {
    const app = open('/financas');
    let form = screen.getByRole('form', { name: 'Receitas e despesas' });
    input(form, 'Tipo de movimentação', 'income');
    input(form, 'Descrição', 'Salário real');
    input(form, 'Valor (R$)', '1500,50');
    click(form, 'Adicionar movimentação');
    expect(stored().records.movements).toHaveLength(1);
    expect(
      screen.getByRole('region', { name: 'Histórico financeiro' }),
    ).toHaveTextContent('Salário real');
    form = screen.getByRole('form', { name: 'Receitas e despesas' });
    input(form, 'Descrição', 'Mercado');
    input(form, 'Valor (R$)', '100,25');
    click(form, 'Adicionar movimentação');
    expect(stored().records.movements).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Mercado' }));
    form = screen.getByRole('form', { name: 'Editar movimentação' });
    input(form, 'Valor (R$)', '90,25');
    click(form, 'Salvar movimentação');
    expect(
      stored().records.movements.find(
        (item: { description: string }) => item.description === 'Mercado',
      ).amountCents,
    ).toBe(9025);
    fireEvent.change(screen.getByLabelText('Mês financeiro'), {
      target: { value: '2026-10' },
    });
    expect(
      screen.getByRole('region', { name: 'Histórico financeiro' }),
    ).toHaveTextContent('Nenhuma movimentação');
    fireEvent.change(screen.getByLabelText('Mês financeiro'), {
      target: { value: '2026-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Mercado' }));
    expect(stored().records.movements).toHaveLength(1);
    app.unmount();
    render(<App />);
    expect(
      screen.getByRole('region', { name: 'Histórico financeiro' }),
    ).toHaveTextContent('Salário real');
    home();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '80');
  });
  it('registra investimentos por quantidade/preço, aportes e retiradas sem duplicar consumo', () => {
    open('/financas');
    let form = screen.getByRole('form', { name: 'Cadastrar investimento' });
    input(form, 'Nome do investimento', 'Carteira pessoal');
    input(form, 'Tipo de registro do investimento', 'purchase');
    input(form, 'Quantidade (opcional)', '3');
    input(form, 'Preço de compra por unidade (R$, opcional)', '100,50');
    click(form, 'Adicionar investimento');
    expect(stored().records.investmentEntries[0].amountCents).toBe(30150);
    expect(stored().records.movements).toEqual([]);
    form = screen.getByRole('form', { name: 'Aportes e retiradas' });
    input(form, 'Valor da operação (R$)', '100');
    click(form, 'Registrar operação');
    form = screen.getByRole('form', { name: 'Aportes e retiradas' });
    input(form, 'Operação', 'withdrawal');
    input(form, 'Valor da operação (R$)', '50');
    click(form, 'Registrar operação');
    expect(stored().records.investmentEntries).toHaveLength(3);
    expect(
      screen.getByRole('region', { name: 'Carteira cadastrada' }),
    ).toHaveTextContent('351,50');
    form = screen.getByRole('form', { name: 'Aportes e retiradas' });
    input(form, 'Operação', 'withdrawal');
    input(form, 'Valor da operação (R$)', '9999');
    click(form, 'Registrar operação');
    expect(within(form).getByRole('alert')).toBeInTheDocument();
    expect(stored().records.investmentEntries).toHaveLength(3);
    home();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '80');
  });
  it('mantém treino único e sincroniza XP/radar, recarga e reversão sem missões fixas', () => {
    let app = open('/treinos');
    click(screen.getByRole('form', { name: 'Treinou hoje?' }), 'Sim');
    click(screen.getByRole('form', { name: 'Treinou hoje?' }), 'Sim');
    expect(stored().records.workouts).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: '13/11/2026: treinou' }),
    ).toBeInTheDocument();
    home();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '150');
    const score = screen
      .getByRole('progressbar', { name: 'Treinos: Dedicação · 7 dias' })
      .getAttribute('aria-valuenow');
    expect(
      screen.queryByRole('checkbox', { name: /Concluir missão/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver Radar de Evolução em Estatísticas',
      }),
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Radar de Evolução' }),
      ).getByRole('img'),
    ).toHaveAccessibleDescription(
      expect.stringContaining(`Treinos: ${score} de 100`),
    );
    fireEvent.click(screen.getByRole('button', { name: '90 dias' }));
    home();
    app.unmount();
    app = render(<App />);
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '150');
    expect(
      screen.getByRole('progressbar', { name: 'Treinos: Dedicação · 7 dias' }),
    ).toHaveAttribute('aria-valuenow', score);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Treinos' }));
    click(screen.getByRole('form', { name: 'Treinou hoje?' }), 'Não');
    home();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '0');
  });
  it('aceita sono decimal, corrige dias anteriores e recalcula a meta com persistência', () => {
    const app = open('/descanso');
    let form = screen.getByRole('form', { name: 'Registrar sono' });
    input(form, 'Data', '2026-11-12');
    input(form, 'Horas dormidas', '7,5');
    click(form, 'Salvar registro');
    expect(stored().records.sleep[0].hours).toBe(7.5);
    fireEvent.click(
      screen.getByRole('button', { name: 'Editar sono de 12/11/2026' }),
    );
    form = screen.getByRole('form', { name: 'Editar sono' });
    input(form, 'Horas dormidas', '8,5');
    click(form, 'Salvar registro');
    expect(stored().records.sleep).toHaveLength(1);
    expect(stored().records.sleep[0].hours).toBe(8.5);
    form = screen.getByRole('form', { name: 'Meta de sono' });
    input(form, 'Meta diária em horas', '9');
    click(form, 'Salvar meta');
    expect(stored().records.sleepGoalHours).toBe(9);
    app.unmount();
    render(<App />);
    expect(screen.getByLabelText('Meta diária em horas')).toHaveValue('9');
    expect(
      screen.getByRole('region', { name: 'Histórico de sono' }),
    ).toHaveTextContent('8,5 h');
    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir sono de 12/11/2026' }),
    );
    expect(stored().records.sleep).toEqual([]);
  });
  it('cadastra vários livros, impede excesso de leitura e preserva livros finalizados após recarga', () => {
    const app = open('/conhecimento');
    let form = screen.getByRole('form', { name: 'Cadastrar livro' });
    input(form, 'Título do livro', 'Minha jornada');
    input(form, 'Total de páginas', '100');
    click(form, 'Adicionar livro');
    form = screen.getByRole('form', { name: 'Cadastrar livro' });
    input(form, 'Título do livro', 'Próximo livro');
    input(form, 'Total de páginas', '50');
    click(form, 'Adicionar livro');
    form = screen.getByRole('form', { name: 'Registrar leitura' });
    input(form, 'Páginas lidas neste registro', '30');
    click(form, 'Adicionar leitura');
    expect(
      screen.getByRole('progressbar', { name: 'Leitura de Minha jornada' }),
    ).toHaveAttribute('aria-valuenow', '30');
    form = screen.getByRole('form', { name: 'Registrar leitura' });
    input(form, 'Páginas lidas neste registro', '71');
    click(form, 'Adicionar leitura');
    expect(within(form).getByRole('alert')).toHaveTextContent('ultrapassa');
    expect(stored().records.readings).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Concluir Minha jornada' }),
    );
    expect(
      screen.getByRole('region', { name: 'Livros concluídos' }),
    ).toHaveTextContent('Minha jornada');
    app.unmount();
    render(<App />);
    expect(
      screen.getByRole('region', { name: 'Livros concluídos' }),
    ).toHaveTextContent('Minha jornada');
    const history = within(
      screen.getByRole('region', { name: 'Histórico de leitura' }),
    );
    fireEvent.click(
      history.getAllByRole('button', { name: /Editar leitura/ })[0]!,
    );
    form = screen.getByRole('form', { name: 'Corrigir leitura' });
    input(form, 'Páginas lidas neste registro', '20');
    click(form, 'Salvar leitura');
    expect(stored().records.readings).toHaveLength(2);
    home();
    expect(
      screen.getByRole('progressbar', { name: 'Experiência do jogador' }),
    ).toHaveAttribute('aria-valuenow', '100');
  });
  it('acessa os pilares pela navegação inferior/lateral e pelo dashboard com URLs próprias', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Finanças' }));
    expect(window.location.pathname).toBe('/financas');
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Navegação principal' }),
      ).getByRole('button', { name: 'Pilares' }),
    );
    expect(window.location.pathname).toBe('/pilares');
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Quatro pilares' }),
      ).getByRole('button', { name: /Conhecimento/ }),
    );
    expect(window.location.pathname).toBe('/conhecimento');
  });
});
