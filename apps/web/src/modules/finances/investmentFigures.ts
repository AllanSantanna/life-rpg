import { money } from './calculations';
import type { investmentValue } from './ledger';
import { formatCurrency } from './monetary';
import type { BitcoinQuote, Investment, UsdQuote } from './types';

type HoldingValue = ReturnType<typeof investmentValue>;
export interface CardFigures {
  label: string;
  value: string;
  metrics: { label: string; value: string }[];
  notes: string[];
}

const fullTime = (value: number) => new Date(value).toLocaleString('pt-BR');

/**
 * Textos exibidos no cartão da carteira, com a mesma estrutura para todas as
 * categorias. Apenas formata as projeções de `ledger.ts`; não calcula saldos.
 */
export function cardFigures(
  investment: Investment,
  value: HoldingValue,
  quotes: {
    btc: BitcoinQuote | undefined;
    usd: UsdQuote | undefined;
    stale: boolean;
  },
): CardFigures {
  const cost = value.costKnown ? money(value.cost) : 'Desconhecido';
  if (investment.category === 'Caixinhas bancárias') {
    const valid = value.boxBalanceValid;
    const confirmed = !!(
      valid &&
      value.valuation?.movementsComplete &&
      value.costKnown
    );
    return {
      label: valid
        ? value.balanceEstimated
          ? 'Saldo após movimentações registradas'
          : 'Saldo atual informado'
        : 'Referência pelo custo · atualize o saldo',
      value: value.unpriced ? 'Saldo pendente' : money(value.current),
      metrics: [
        {
          label: 'Total aplicado conhecido',
          value: money(value.initialCost + value.contributed),
        },
        { label: 'Total retirado', value: money(value.withdrawn) },
        { label: 'Custo da posição', value: cost },
        {
          label: confirmed ? 'Rendimento acumulado' : 'Diferença saldo/custo',
          value: valid && value.costKnown ? money(value.gain) : 'Pendente',
        },
      ],
      notes: confirmed
        ? []
        : [
            'A diferença não comprova rendimento: confira se existem aportes ou retiradas não registrados.',
          ],
    };
  }
  const bitcoin = investment.category === 'Bitcoin';
  const usd = investment.category === 'Dólar (USD)';
  const quote = bitcoin ? quotes.btc : usd ? quotes.usd : undefined;
  return {
    label: value.known
      ? 'Valor atual conhecido/estimado'
      : 'Sem avaliação atual; referência pelo custo',
    value: value.unpriced ? 'Aguardando cotação' : money(value.current),
    metrics: [
      ...(bitcoin || usd
        ? [
            {
              label: 'Quantidade',
              value: usd
                ? formatCurrency(value.units, 'USD')
                : (value.units / 1e8).toFixed(8) + ' BTC',
            },
          ]
        : []),
      { label: 'Custo da posição', value: cost },
      {
        label: 'Resultado não realizado',
        value:
          value.known && value.costKnown
            ? `${money(value.gain)}${value.cost ? ` · ${((value.gain / value.cost) * 100).toFixed(2)}%` : ''}`
            : 'Pendente',
      },
    ],
    notes:
      bitcoin || usd
        ? [
            quote
              ? `${bitcoin ? 'Cotação BTC/BRL' : 'PTAX USD/BRL'}: ${
                  bitcoin
                    ? money(quotes.btc!.priceCents)
                    : (quotes.usd!.rateUnits / 10000).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 4,
                      })
                } · Atualização: ${fullTime(quote.updatedAt)} · ${
                  quotes.stale
                    ? 'Desatualizada'
                    : bitcoin
                      ? 'Última cotação conhecida'
                      : 'Última referência conhecida'
                }`
              : bitcoin
                ? 'Cotação ainda indisponível; valores usam custo de aquisição.'
                : 'PTAX indisponível. Não há conversão estimada sem referência.',
          ]
        : [],
  };
}
