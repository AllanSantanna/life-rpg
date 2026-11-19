import { fireEvent, screen, within } from '@testing-library/react';

/**
 * Navegação da página Finanças nos testes de interface. Os formulários e
 * históricos abrem sob demanda; estes atalhos reproduzem os cliques do usuário.
 */
export function financeTab(name: 'Movimentações' | 'Investimentos') {
  const tab = screen.getByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') fireEvent.click(tab);
}

export function newMovementForm() {
  financeTab('Movimentações');
  fireEvent.click(screen.getByRole('button', { name: 'Nova movimentação' }));
  return screen.getByRole('form', { name: 'Nova movimentação' });
}

export function newInvestmentForm() {
  financeTab('Investimentos');
  fireEvent.click(screen.getByRole('button', { name: 'Novo investimento' }));
  return screen.getByRole('form', { name: 'Cadastrar investimento' });
}

function expand(name: string) {
  const button = screen.getByRole('button', { name });
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button);
  return screen.getByRole('region', { name });
}

export function movementHistory() {
  financeTab('Movimentações');
  return expand('Histórico de movimentações');
}

export function investmentHistory() {
  financeTab('Investimentos');
  return expand('Histórico de investimentos');
}

export function wallet() {
  financeTab('Investimentos');
  return screen.getByRole('region', { name: 'Carteira cadastrada' });
}

/** Cartão da carteira: `Caixinha Nome` ou `Investimento Nome`. */
export function investmentCard(name: string) {
  return within(wallet()).getByRole('group', { name });
}

/** Abre “Mais ações” do cartão e escolhe uma opção do menu. */
export function cardMenuAction(card: string, action: string) {
  const element = investmentCard(card);
  fireEvent.click(
    within(element).getByRole('button', { name: /^Mais ações de / }),
  );
  fireEvent.click(
    within(screen.getByRole('menu')).getByRole('menuitem', { name: action }),
  );
  return element;
}

/**
 * Executa uma ação do cartão (principal ou do menu “Mais ações”) e devolve o
 * formulário aberto nele.
 */
export function cardAction(card: string, action: string) {
  const element = investmentCard(card);
  const primary = within(element).queryByRole('button', { name: action });
  if (primary) fireEvent.click(primary);
  else cardMenuAction(card, action);
  return within(element).getByRole('form');
}

export function cardDetails(card: string, investmentName: string) {
  const element = investmentCard(card);
  const button = within(element).getByRole('button', {
    name: `Ver detalhes de ${investmentName}`,
  });
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button);
  return element;
}

export function confirmDeletion() {
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Confirmar exclusão',
    }),
  );
}
