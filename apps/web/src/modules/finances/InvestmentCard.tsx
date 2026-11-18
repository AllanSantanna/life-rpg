import type { ReactNode } from 'react';
import { displayDate } from '../records/dates';
import type { RecordPageProps } from '../records/types';
import { money } from './calculations';
import { CategoryIcon } from './CategoryIcon';
import { Disclosure } from './FinanceLayout';
import { isInitialPosition } from './initialPosition';
import {
  actionAccessibleName,
  categoryLabel,
  investmentActions,
  type InvestmentAction,
} from './investmentActions';
import { investmentValue } from './ledger';
import { formatCurrency } from './monetary';
import { SavingsBoxDetails, SavingsBoxSummary } from './SavingsBoxCard';
import type { Investment } from './types';
import { useQuoteRefresh } from './useQuoteRefresh';

export interface QuoteStatus {
  error: string;
  stale: boolean;
}
const fullTime = (value: number) => new Date(value).toLocaleString('pt-BR');

/**
 * Cartão único da carteira. Somente apresenta projeções de `ledger.ts` e
 * delega as ações aos formulários e comandos existentes.
 */
export function InvestmentCard({
  investment,
  records,
  today,
  onCommand,
  onAction,
  onDelete,
  form,
  message,
  btcStatus,
  usdStatus,
}: RecordPageProps & {
  investment: Investment;
  onAction: (action: InvestmentAction) => void;
  onDelete: () => void;
  /** Formulário aberto por uma ação deste cartão. */
  form?: ReactNode;
  message?: string | undefined;
  btcStatus: QuoteStatus;
  usdStatus: QuoteStatus;
}) {
  const value = investmentValue(records, investment.id, today);
  const box = investment.category === 'Caixinhas bancárias';
  const bitcoin = investment.category === 'Bitcoin';
  const usd = investment.category === 'Dólar (USD)';
  const btcQuote = records.finance?.quotes.at(-1);
  const usdQuote = records.finance?.usdQuotes?.at(-1);
  const refresh = useQuoteRefresh(
    usd ? 'USD' : 'BTC',
    usd ? usdQuote : btcQuote,
    onCommand,
  );
  const status = usd ? usdStatus : btcStatus;
  const quote = usd ? usdQuote : btcQuote;
  const recent = records.investmentEntries
    .filter((item) => item.investmentId === investment.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const averagePrice =
    value.units && value.costKnown
      ? money(Math.round((value.cost * (usd ? 100 : 1e8)) / value.units))
      : '—';
  return (
    <article
      role="group"
      aria-label={`${box ? 'Caixinha' : 'Investimento'} ${investment.name}`}
      className={`investment-card${form ? ' investment-card--active' : ''}`}
    >
      <header className="investment-card__heading">
        <h3>
          <CategoryIcon category={investment.category} />
          <span>{investment.name}</span>
        </h3>
        <span>
          {categoryLabel(investment.category)}
          {box && ` · ${investment.institution ?? 'Instituição não informada'}`}
        </span>
      </header>
      {box ? (
        <SavingsBoxSummary value={value} />
      ) : (
        <>
          <p className="investment-card__value">
            <span>
              {value.known
                ? 'Valor atual conhecido/estimado'
                : 'Sem avaliação atual; referência pelo custo'}
            </span>
            <strong>
              {value.unpriced ? 'Aguardando cotação' : money(value.current)}
            </strong>
          </p>
          <dl className="investment-card__metrics">
            {(bitcoin || usd) && (
              <div>
                <dt>Quantidade</dt>
                <dd>
                  {usd
                    ? formatCurrency(value.units, 'USD')
                    : (value.units / 1e8).toFixed(8) + ' BTC'}
                </dd>
              </div>
            )}
            <div>
              <dt>Custo da posição</dt>
              <dd>{value.costKnown ? money(value.cost) : 'Desconhecido'}</dd>
            </div>
            <div>
              <dt>Resultado não realizado</dt>
              <dd>
                {value.known && value.costKnown
                  ? `${money(value.gain)}${value.cost ? ` · ${((value.gain / value.cost) * 100).toFixed(2)}%` : ''}`
                  : 'Pendente'}
              </dd>
            </div>
          </dl>
          {(bitcoin || usd) && (
            <p className="record-hint">
              {quote
                ? `${bitcoin ? 'Cotação BTC/BRL' : 'PTAX USD/BRL'}: ${
                    bitcoin
                      ? money(btcQuote!.priceCents)
                      : (usdQuote!.rateUnits / 10000).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                          minimumFractionDigits: 4,
                        })
                  } · Atualização: ${fullTime(quote.updatedAt)} · ${
                    status.stale
                      ? 'Desatualizada'
                      : bitcoin
                        ? 'Última cotação conhecida'
                        : 'Última referência conhecida'
                  }`
                : bitcoin
                  ? 'Cotação ainda indisponível; valores usam custo de aquisição.'
                  : 'PTAX indisponível. Não há conversão estimada sem referência.'}
            </p>
          )}
          {(bitcoin || usd) && status.error && (
            <p className="record-hint" role="status">
              {status.error}
            </p>
          )}
        </>
      )}
      <div className="record-actions investment-card__actions">
        {investmentActions(investment.category).map((action) => (
          <button
            key={action.id}
            type="button"
            aria-label={actionAccessibleName(action, investment.name)}
            disabled={action.id === 'quote' && refresh.busy}
            onClick={() =>
              action.id === 'quote' ? void refresh.refresh() : onAction(action)
            }
          >
            {action.id === 'quote' && refresh.busy
              ? 'Consultando…'
              : action.label}
          </button>
        ))}
      </div>
      <p className="record-feedback" role="status">
        {(bitcoin || usd ? refresh.message : '') || message}
      </p>
      {form}
      <Disclosure
        title="Ver detalhes"
        label={`Ver detalhes de ${investment.name}`}
        level={4}
        className="investment-card__details"
      >
        {box ? (
          <SavingsBoxDetails investment={investment} value={value} />
        ) : (
          <div className="record-hint">
            {(bitcoin || usd) && <p>Preço médio: {averagePrice}</p>}
            <p>
              Posição inicial (custo conhecido): {money(value.initialCost)} ·
              Aportado conhecido: {money(value.contributed)} · Resgatado:{' '}
              {money(value.withdrawn)} · Custo restante:{' '}
              {value.costKnown ? money(value.cost) : 'Desconhecido'}
            </p>
            {!value.costKnown && (
              <p>
                Custo de aquisição desconhecido; preço médio e valorização não
                estão disponíveis.
              </p>
            )}
            {!bitcoin && !usd && (
              <p>
                Última avaliação:{' '}
                {value.valuation
                  ? `${displayDate(value.valuation.date)} · ${money(value.valuation.amountCents)}`
                  : 'Nenhuma'}
                . Operações posteriores exigem nova avaliação.
              </p>
            )}
            {bitcoin && (
              <p>
                Fonte: CoinGecko. Consulta automática a cada 60 minutos, sem
                negociação.
              </p>
            )}
            {usd && (
              <p>
                Banco Central · PTAX de venda, referência do dólar comercial.
                Não é dólar turismo nem preço de negociação em tempo real; pode
                refletir o último dia útil. Atualização consultada a cada 60
                minutos, sem taxas ou spread.
              </p>
            )}
          </div>
        )}
        <p className="investment-card__subtitle">Operações recentes</p>
        <ul className="investment-card__recent">
          {recent.map((item) => (
            <li key={item.id}>
              {displayDate(item.date)} ·{' '}
              {isInitialPosition(item)
                ? `Posição inicial · ${item.costUnknown ? 'custo desconhecido' : money(item.amountCents)}`
                : `${item.kind === 'contribution' ? 'Aporte/compra' : 'Retirada/venda'} de ${money(item.amountCents)}`}
            </li>
          ))}
          {!recent.length && <li>Nenhuma operação registrada.</li>}
        </ul>
        <div className="record-actions">
          <button
            type="button"
            className="financial-danger"
            onClick={onDelete}
            aria-label={`Excluir investimento e operações de ${investment.name}`}
          >
            Excluir investimento
          </button>
        </div>
      </Disclosure>
    </article>
  );
}
