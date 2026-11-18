import type { ReactNode } from 'react';
import { ActionButton } from '../../shared/components/ActionButton';
import {
  ActionMenu,
  type ActionMenuItem,
} from '../../shared/components/ActionMenu';
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
import { cardFigures } from './investmentFigures';
import { investmentValue } from './ledger';
import { SavingsBoxDetails } from './SavingsBoxCard';
import type { Investment } from './types';
import { useQuoteRefresh } from './useQuoteRefresh';

const menuIcons: Record<InvestmentAction['id'], ActionMenuItem['icon']> = {
  contribute: 'plus',
  withdraw: 'arrow',
  balance: 'wallet',
  quote: 'chart',
  edit: 'edit',
};

export interface QuoteStatus {
  error: string;
  stale: boolean;
}

/**
 * Cartão único da carteira. Somente apresenta projeções de `ledger.ts` e
 * delega as ações aos formulários e comandos existentes.
 *
 * Ações (docs/design-system/components.md): a principal da categoria usa
 * `ActionButton`; as secundárias, Editar e Excluir (com confirmação) ficam em
 * `ActionMenu` (“Mais ações”); “Ver detalhes” usa `.text-action`.
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
  const figures = cardFigures(investment, value, {
    btc: btcQuote,
    usd: usdQuote,
    stale: status.stale,
  });
  const actions = investmentActions(investment.category);
  const primary = actions.find((action) => action.id === 'contribute')!;
  const secondary = actions.filter(
    (action) => action.id !== 'contribute' && action.id !== 'edit',
  );
  const edit = actions.find((action) => action.id === 'edit')!;
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
      className={`panel investment-card p-5${form ? ' investment-card--active' : ''}`}
    >
      <header className="investment-card__heading">
        <h3>
          {/* Destaque discreto da área; o Bitcoin mantém `--color-bitcoin`. */}
          <span className="investment-card__icon">
            <CategoryIcon category={investment.category} />
          </span>
          <span>{investment.name}</span>
        </h3>
        <p className="record-hint">
          {categoryLabel(investment.category)}
          {box && ` · ${investment.institution ?? 'Instituição não informada'}`}
        </p>
      </header>
      <div className="investment-card__body">
        <p className="text-xs text-muted">{figures.label}</p>
        <p className="investment-card__value">{figures.value}</p>
        <dl className="my-5 space-y-3 border-t border-white/[0.06] pt-5">
          {figures.metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <dt className="text-muted">{metric.label}</dt>
              <dd className="text-right font-medium">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="investment-card__actions">
        <ActionButton
          icon="plus"
          aria-label={actionAccessibleName(primary, investment.name)}
          onClick={() => onAction(primary)}
        >
          {primary.label}
        </ActionButton>
        <ActionMenu
          label="Mais ações"
          accessibleLabel={`Mais ações de ${investment.name}`}
          items={[
            ...secondary.map((action) => ({
              id: action.id,
              label:
                action.id === 'quote' && refresh.busy
                  ? 'Consultando cotação…'
                  : action.label,
              accessibleLabel: actionAccessibleName(action, investment.name),
              icon: menuIcons[action.id],
              disabled: action.id === 'quote' && refresh.busy,
              onSelect: () =>
                action.id === 'quote'
                  ? void refresh.refresh()
                  : onAction(action),
            })),
            {
              id: 'edit',
              label: 'Editar',
              accessibleLabel: actionAccessibleName(edit, investment.name),
              icon: 'edit',
              onSelect: () => onAction(edit),
            },
            {
              id: 'delete',
              label: 'Excluir',
              accessibleLabel: `Excluir investimento e operações de ${investment.name}`,
              icon: 'trash',
              onSelect: onDelete,
            },
          ]}
        />
      </div>
      <div className="investment-card__footer">
        <p className="record-feedback" role="status">
          {(bitcoin || usd ? refresh.message || status.error : '') || message}
        </p>
        {form}
        <Disclosure
          title="Ver detalhes"
          label={`Ver detalhes de ${investment.name}`}
          level={4}
          variant="text"
          className="investment-card__details"
        >
          {figures.notes.map((note) => (
            <p key={note} className="record-hint">
              {note}
            </p>
          ))}
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
                  Não é dólar turismo nem preço de negociação em tempo real;
                  pode refletir o último dia útil. Atualização consultada a cada
                  60 minutos, sem taxas ou spread.
                </p>
              )}
            </div>
          )}
          <p className="record-hint">Operações recentes</p>
          <ul className="record-hint">
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
        </Disclosure>
      </div>
    </article>
  );
}
