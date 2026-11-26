import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../app/playerState';
import { cardAction, financeTab, newMovementForm } from '../../test/finances';
import { selectOption } from '../../test/selectOption';

/** Ajuda contextual em Finanças. Dados sintéticos; data dos testes 13/11/2026. */
afterEach(cleanup);
const raw = () => localStorage.getItem(PLAYER_STORAGE_KEY);
function open() {
  const state: PlayerState = createInitialPlayerState();
  state.records.movements = [
    {
      id: 'm1',
      kind: 'income',
      description: 'Salário',
      amountCents: 100000,
      category: 'Salário',
      date: '2026-11-05',
    },
  ];
  state.records.investments = [
    { id: 'cdb', name: 'CDB', category: 'Renda fixa' },
  ];
  state.records.investmentEntries = [
    {
      id: 'e1',
      investmentId: 'cdb',
      kind: 'contribution',
      amountCents: 50000,
      date: '2026-10-01',
      positionInitial: true,
    },
  ];
  state.records.finance = {
    accounts: [],
    transfers: [],
    valuations: [],
    quotes: [],
    recurrences: [
      {
        id: 'r1',
        kind: 'expense',
        description: 'Internet',
        amountCents: 12000,
        category: 'Contas',
        frequency: 'monthly',
        startDate: '2026-11-05',
        status: 'active',
      },
    ],
  };
  localStorage.setItem(
    PLAYER_STORAGE_KEY,
    JSON.stringify({ version: PLAYER_STORAGE_VERSION, data: state }),
  );
  window.history.replaceState(null, '', '/financas');
  return render(<App />);
}
/** Abre a ajuda, confere título e trecho e fecha por Esc com foco de volta. */
function expectHelp(name: string, title: string, excerpt: RegExp) {
  const trigger = screen.getByRole('button', { name });
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: title });
  expect(dialog).toHaveTextContent(excerpt);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: title })).toBeNull();
  expect(trigger).toHaveFocus();
}

describe('Ajuda contextual em Finanças', () => {
  it('oferece ajuda nas seções da Carteira, com o conteúdo de cada uma', () => {
    open();
    const before = raw();
    financeTab('Carteira');
    expectHelp(
      'Ajuda sobre saldo disponível',
      'Saldo disponível',
      /afetam o saldo/,
    );
    expectHelp(
      'Ajuda sobre receitas do mês',
      'Receitas do mês',
      /mês selecionado/,
    );
    expectHelp(
      'Ajuda sobre despesas do mês',
      'Despesas do mês',
      /não contam como despesa de consumo/,
    );
    expectHelp(
      'Ajuda sobre resultado mensal',
      'Resultado mensal',
      /Diferença entre as receitas e as despesas/,
    );
    expectHelp(
      'Ajuda sobre evolução financeira',
      'Evolução financeira',
      /7, 30 e 365 dias/,
    );
    expectHelp(
      'Ajuda sobre próximas movimentações',
      'Próximas movimentações',
      /Dispensar ignora/,
    );
    expectHelp(
      'Ajuda sobre orçamento mensal',
      'Orçamento mensal',
      /A partir de 80%/,
    );
    expectHelp(
      'Ajuda sobre histórico de movimentações',
      'Histórico de movimentações',
      /Repetir abre/,
    );
    expectHelp(
      'Ajuda sobre configurações financeiras',
      'Configurações financeiras',
      /redefinir/,
    );
    // Abrir ajudas não altera dados.
    expect(raw()).toBe(before);
  });

  it('oferece ajuda nas seções de Investimentos e nos interruptores', () => {
    open();
    const before = raw();
    financeTab('Investimentos');
    expectHelp(
      'Ajuda sobre valor dos investimentos',
      'Valor dos investimentos',
      /última avaliação manual/,
    );
    expectHelp(
      'Ajuda sobre patrimônio financeiro total',
      'Patrimônio financeiro total',
      /nada é contado duas vezes/,
    );
    expectHelp(
      'Ajuda sobre custo de aquisição atual',
      'Custo de aquisição atual',
      /posições que você ainda mantém/,
    );
    expectHelp(
      'Ajuda sobre total aportado conhecido',
      'Total aportado conhecido',
      /sem as posições iniciais/,
    );
    expectHelp(
      'Ajuda sobre resgates e retiradas',
      'Resgates e retiradas',
      /vendas, resgates e retiradas/,
    );
    expectHelp(
      'Ajuda sobre gráficos de investimentos',
      'Gráficos de investimentos',
      /Distribuição/,
    );
    expectHelp(
      'Ajuda sobre meus investimentos',
      'Meus investimentos',
      /Mais ações/,
    );
    expectHelp(
      'Ajuda sobre histórico de investimentos',
      'Histórico de investimentos',
      /Filtre por investimento/,
    );
    expectHelp(
      'Ajuda sobre avaliações manuais',
      'Avaliações manuais',
      /não uma cotação automática ou em tempo real/,
    );
    const form = cardAction('Investimento CDB', 'Aportar em CDB');
    expectHelp(
      'Ajuda sobre utilizar saldo da carteira',
      'Utilizar saldo da Carteira',
      /Desligado: dinheiro de fora/,
    );
    expectHelp(
      'Ajuda sobre aportes e retiradas',
      'Aportes e retiradas',
      /custo de aquisição da parcela/,
    );
    // A ajuda não alterou o interruptor nem o formulário.
    expect(
      within(form).getByRole('switch', { name: 'Utilizar saldo da Carteira' }),
    ).toBeChecked();
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(raw()).toBe(before);
  });

  it('mantém gráficos, ações e avisos operacionais visíveis sem abrir ajudas', () => {
    open();
    financeTab('Carteira');
    expect(
      screen.getByRole('region', { name: 'Evolução financeira' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Adicionar receita' }),
    ).toBeInTheDocument();
    // Vencimento e contagem de pendências continuam visíveis.
    const upcoming = screen.getByRole('region', {
      name: 'Próximas movimentações',
    });
    expect(upcoming).toHaveTextContent(/venceu em 05\/11/);
    expect(upcoming).toHaveTextContent('1 ocorrência pendente vencida.');
    // A pesquisa fica dentro do histórico, aberto por um clique.
    fireEvent.click(
      screen.getByRole('button', { name: 'Histórico de movimentações' }),
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Histórico de movimentações' }),
      ).getByRole('searchbox', { name: 'Pesquisar no histórico' }),
    ).toBeInTheDocument();
    // Textos conceituais saíram da página principal.
    expect(screen.queryByText(/O período define receitas/)).toBeNull();
    expect(
      screen.queryByText(/Considera somente despesas registradas/),
    ).toBeNull();
    financeTab('Investimentos');
    expect(
      screen.queryByText(/Patrimônio total = saldo disponível/),
    ).toBeNull();
    expect(
      screen.getByText(/Há investimentos sem avaliação atual/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Novo investimento' }),
    ).toBeInTheDocument();
  });

  it('formulários: ajuda só onde é necessária; saldo insuficiente visível', () => {
    open();
    const form = newMovementForm('expense');
    const helps = () =>
      within(form)
        .getAllByRole('button', { name: /^Ajuda sobre/ })
        .map((item) => item.getAttribute('aria-label'));
    // Sem despesas anteriores não há atalhos de categoria nem sua ajuda.
    expect(helps()).toEqual(['Ajuda sobre repetir periodicamente']);
    selectOption(
      within(form).getByRole('combobox', { name: 'Tipo de movimentação' }),
      'Receita',
    );
    expect(helps()).toEqual([
      'Ajuda sobre categorias recentes',
      'Ajuda sobre repetir periodicamente',
    ]);
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
    financeTab('Investimentos');
    const operation = cardAction('Investimento CDB', 'Aportar em CDB');
    fireEvent.change(
      within(operation).getByLabelText('Valor da operação (R$)'),
      { target: { value: '500000' } },
    );
    fireEvent.click(
      within(operation).getByRole('button', { name: 'Registrar operação' }),
    );
    expect(within(operation).getByRole('alert')).toHaveTextContent(
      'Saldo insuficiente na Carteira',
    );
  });

  it('abre pelo teclado e foca a janela de ajuda', () => {
    open();
    financeTab('Carteira');
    const trigger = screen.getByRole('button', {
      name: 'Ajuda sobre saldo disponível',
    });
    trigger.focus();
    // Botões nativos convertem Enter/Espaço em clique (validado no Chromium
    // pela auditoria; o jsdom não sintetiza o clique).
    fireEvent.click(trigger);
    expect(
      screen.getByRole('dialog', { name: 'Saldo disponível' }),
    ).toHaveFocus();
  });
});
