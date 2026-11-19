import type { InvestmentCategory, InvestmentEntry } from './types';

export type InvestmentActionId =
  'contribute' | 'withdraw' | 'balance' | 'quote' | 'edit';
export interface InvestmentAction {
  id: InvestmentActionId;
  /** Texto visível; o nome acessível acrescenta o investimento. */
  label: string;
  /** Preposição usada no nome acessível ("Aportar em Reserva"). */
  connector: string;
  /** Operação pré-selecionada no formulário existente de aportes/retiradas. */
  kind?: InvestmentEntry['kind'];
}

const contribute = (label: string, connector = 'em'): InvestmentAction => ({
  id: 'contribute',
  label,
  connector,
  kind: 'contribution',
});
const withdraw = (label: string, connector = 'de'): InvestmentAction => ({
  id: 'withdraw',
  label,
  connector,
  kind: 'withdrawal',
});
const edit: InvestmentAction = { id: 'edit', label: 'Editar', connector: '' };
const quote: InvestmentAction = {
  id: 'quote',
  label: 'Atualizar cotação',
  connector: 'de',
};

/**
 * Ações contextuais de cada categoria. Todas reutilizam os mesmos comandos de
 * aporte/retirada, avaliação ou cotação; os nomes apenas descrevem a operação.
 */
export function investmentActions(
  category: InvestmentCategory,
  { ticker }: { ticker?: string | undefined } = {},
): InvestmentAction[] {
  switch (category) {
    case 'Caixinhas bancárias':
      return [
        contribute('Aportar'),
        withdraw('Retirar'),
        { id: 'balance', label: 'Atualizar saldo', connector: 'de' },
        edit,
      ];
    case 'Bitcoin':
      return [
        contribute('Comprar mais', ''),
        withdraw('Vender', ''),
        quote,
        edit,
      ];
    case 'Dólar (USD)':
      return [contribute('Comprar', ''), withdraw('Vender', ''), quote, edit];
    case 'Ações':
    case 'Fundos imobiliários':
      // A cotação de mercado só existe para ativos com ticker vinculado.
      return [
        contribute('Comprar mais', ''),
        withdraw('Vender', ''),
        ...(ticker ? [quote] : []),
        edit,
      ];
    case 'Renda fixa':
      return [contribute('Aportar'), withdraw('Resgatar', ''), edit];
    case 'Outros':
      return [contribute('Aportar'), withdraw('Retirar'), edit];
  }
}

export function actionAccessibleName(action: InvestmentAction, name: string) {
  if (action.id === 'edit') return `Editar investimento ${name}`;
  return [action.label, action.connector, name].filter(Boolean).join(' ');
}

export const categoryLabel = (category: InvestmentCategory) =>
  category === 'Outros' ? 'Outros investimentos' : category;
