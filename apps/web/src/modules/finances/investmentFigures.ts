import { money } from './calculations';
import type { investmentValue } from './ledger';
import { formatCurrency } from './monetary';
import { dailyChange, formatUnits } from './marketChart';
import {
  isMarketCategory,
  type BitcoinQuote,
  type Investment,
  type UsdQuote,
} from './types';

type HoldingValue = ReturnType<typeof investmentValue>;
export interface CardFigures {
  label: string;
  value: string;
  metrics: { label: string; value: string }[];
  /** Explicações longas, exibidas em “Ver detalhes”. */
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
  if (isMarketCategory(investment.category))
    return shareFigures(investment, value, cost);
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
            {
              label: bitcoin ? 'Cotação BTC/BRL' : 'PTAX USD/BRL',
              value: quote
                ? `${
                    bitcoin
                      ? money(quotes.btc!.priceCents)
                      : (quotes.usd!.rateUnits / 10000).toLocaleString(
                          'pt-BR',
                          {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 4,
                          },
                        )
                  }${quotes.stale ? ' · Desatualizada' : ''}`
                : 'Indisponível',
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

const signed = (value: number, text: string) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${text}`;
export function percentText(percent: number) {
  return signed(
    percent,
    `${Math.abs(percent).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`,
  );
}

/**
 * Ações e FIIs: valor pela cotação somente com ticker, quantidade completa e
 * cotação observada. Variação do dia é do ativo, não do investimento.
 */
function shareFigures(
  investment: Investment,
  value: HoldingValue,
  cost: string,
): CardFigures {
  const quote = value.marketQuote;
  const change = dailyChange(quote);
  const notes: string[] = [];
  if (!investment.ticker)
    notes.push(
      'Vincule o ticker da B3 em Editar para acompanhar a cotação deste ativo.',
    );
  else if (!quote)
    notes.push(
      `Cotação de ${investment.ticker} ainda não obtida; o valor usa o custo ou a última avaliação manual.`,
    );
  else
    notes.push(
      `Cotação de ${investment.ticker}: ${money(quote.priceCents)} · horário da fonte ${fullTime(quote.marketTime)}${
        change && quote.previousCloseCents
          ? ` · variação do dia ${signed(change.change, money(Math.abs(change.change)))} (${percentText(change.percent)}) sobre o fechamento anterior de ${money(quote.previousCloseCents)}`
          : ''
      }. A variação diária é do ativo, não a rentabilidade do investimento.`,
    );
  if (!value.unitsKnown)
    notes.push(
      'Quantidade incompleta: informe a quantidade em todas as compras e vendas para estimar o valor de mercado.',
    );
  return {
    label: value.marketPriced
      ? 'Valor estimado pela cotação'
      : value.known
        ? 'Valor atual conhecido/estimado'
        : 'Sem avaliação atual; referência pelo custo',
    value: value.unpriced ? 'Aguardando cotação' : money(value.current),
    metrics: [
      {
        label: 'Quantidade',
        value: value.unitsKnown ? formatUnits(value.units) : 'Incompleta',
      },
      ...(investment.ticker
        ? [
            {
              label: 'Cotação · variação do dia',
              value: quote
                ? `${money(quote.priceCents)}${change ? ` · ${percentText(change.percent)}` : ''}`
                : 'Indisponível',
            },
          ]
        : []),
      { label: 'Custo da posição', value: cost },
      {
        label: 'Resultado não realizado',
        value:
          value.known && value.costKnown
            ? `${money(value.gain)}${value.cost ? ` · ${percentText((value.gain / value.cost) * 100)}` : ''}`
            : 'Pendente',
      },
    ],
    notes,
  };
}
