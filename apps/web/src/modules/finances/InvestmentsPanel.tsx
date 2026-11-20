import { useRef, useState } from 'react';
import { ActionButton } from '../../shared/components/ActionButton';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { CustomSelect } from '../../shared/components/CustomSelect';
import { plural } from '../../shared/lib/plural';
import { displayDate } from '../records/dates';
import { formText, newId } from '../records/form';
import { Actions, Empty, Field, RecordForm } from '../records/RecordUI';
import type { RecordCommand, RecordPageProps } from '../records/types';
import { investmentTotals, money } from './calculations';
import { CategoryIcon } from './CategoryIcon';
import type { PendingDeletion } from './DeleteConfirmation';
import { Disclosure } from '../../shared/components/Disclosure';
import { InlineForm } from './FinanceLayout';
import { FinancialConfirmation } from './FinancialConfirmation';
import { entryFromForm, investmentCommand } from './financeForms';
import {
  ALL,
  filterInvestmentEntries,
  HISTORY_PAGE_SIZE,
  type EntryFilters,
} from './historyFilters';
import { isInitialPosition } from './initialPosition';
import { InvestmentCard, type QuoteStatus } from './InvestmentCard';
import type { MarketTracker } from './useMarketQuotes';
import { categoryLabel, type InvestmentAction } from './investmentActions';
import { InvestmentFields } from './InvestmentFields';
import { formatCurrency } from './monetary';
import { SavingsBalanceForm } from './SavingsBoxCard';
import { SavingsBoxFields } from './SavingsBoxFields';
import { TickerField } from './TickerField';
import {
  isMarketCategory,
  investmentCategories,
  type Investment,
  type InvestmentCategory,
  type InvestmentEntry,
} from './types';

type CardForm =
  | { investmentId: string; type: 'operation'; action: InvestmentAction }
  | { investmentId: string; type: 'edit' }
  | { investmentId: string; type: 'balance' };

interface Props extends RecordPageProps {
  run: (command: RecordCommand) => string | null;
  onDelete: (pending: PendingDeletion) => void;
  btcStatus: QuoteStatus;
  usdStatus: QuoteStatus;
  market?: MarketTracker | undefined;
}

/** Carteira, cadastro, operações contextuais e histórico de investimentos. */
export function InvestmentsPanel({
  records,
  today,
  onCommand,
  run,
  onDelete,
  btcStatus,
  usdStatus,
  market,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [cardForm, setCardForm] = useState<CardForm | null>(null);
  const [cardMessage, setCardMessage] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const invested = investmentTotals(
    records.investments,
    records.investmentEntries,
  );
  const openCard = (next: CardForm | null) => {
    setCreating(false);
    setCardMessage(null);
    setCardForm(next);
  };
  return (
    <div className="finance-area">
      <section
        className="panel record-section"
        aria-label="Investimentos por categoria"
      >
        <h2>Investimentos · custo de aquisição conhecido por categoria</h2>
        <dl className="investment-totals">
          {invested.byCategory.map((item) => (
            <div key={item.category}>
              <dt>
                <CategoryIcon category={item.category} />
                {categoryLabel(item.category)}
              </dt>
              <dd>{money(item.amountCents)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="finance-toolbar">
        <p className="record-hint">
          Aportes e compras transferem dinheiro da conta para o investimento;
          retiradas e vendas fazem o caminho inverso.
        </p>
        <ActionButton
          icon="plus"
          onClick={() => {
            setCardForm(null);
            setCreating(true);
          }}
        >
          Novo investimento
        </ActionButton>
      </div>
      {creating && (
        <InlineForm>
          <InvestmentForm
            records={records}
            today={today}
            run={run}
            onClose={() => setCreating(false)}
          />
        </InlineForm>
      )}
      <section
        className="panel record-section"
        aria-labelledby="finance-wallet-title"
      >
        <h2 id="finance-wallet-title">Carteira cadastrada</h2>
        {!records.investments.length && (
          <Empty>
            Nenhum investimento cadastrado. Use “Novo investimento” para
            registrar uma posição que já possui ou uma nova compra.
          </Empty>
        )}
        <div className="investment-grid">
          {records.investments.map((item) => {
            const active = cardForm?.investmentId === item.id ? cardForm : null;
            const close = () => setCardForm(null);
            return (
              <InvestmentCard
                key={item.id}
                investment={item}
                records={records}
                today={today}
                onCommand={onCommand}
                btcStatus={btcStatus}
                usdStatus={usdStatus}
                market={market}
                message={
                  cardMessage?.id === item.id ? cardMessage.text : undefined
                }
                onAction={(action) =>
                  openCard(
                    action.id === 'edit'
                      ? { investmentId: item.id, type: 'edit' }
                      : action.id === 'balance'
                        ? { investmentId: item.id, type: 'balance' }
                        : { investmentId: item.id, type: 'operation', action },
                  )
                }
                onDelete={() =>
                  onDelete({
                    title: 'Excluir investimento',
                    description: `${item.name}: ${plural(
                      records.investmentEntries.filter(
                        (entry) => entry.investmentId === item.id,
                      ).length,
                      'operação será removida',
                      'operações serão removidas',
                    )}, com as avaliações vinculadas. Saldos e patrimônio serão recalculados.`,
                    confirm: 'Confirmar exclusão',
                    run: () => {
                      const error = run({
                        type: 'deleteInvestment',
                        id: item.id,
                      });
                      if (!error && cardForm?.investmentId === item.id)
                        setCardForm(null);
                      return error;
                    },
                  })
                }
                form={
                  active && (
                    <InlineForm key={JSON.stringify(active)}>
                      {active.type === 'edit' ? (
                        <InvestmentForm
                          investment={item}
                          records={records}
                          today={today}
                          run={run}
                          onClose={close}
                        />
                      ) : active.type === 'balance' ? (
                        <SavingsBalanceForm
                          investment={item}
                          today={today}
                          onCommand={onCommand}
                          onClose={close}
                          onSaved={(text) => {
                            close();
                            setCardMessage({ id: item.id, text });
                          }}
                        />
                      ) : (
                        <OperationForm
                          records={records}
                          today={today}
                          run={run}
                          investment={item}
                          action={active.action}
                          onClose={close}
                        />
                      )}
                    </InlineForm>
                  )
                }
              />
            );
          })}
        </div>
      </section>
      {records.investmentEntries.length > 0 && (
        <Disclosure title="Histórico de investimentos">
          <InvestmentHistory
            records={records}
            today={today}
            run={run}
            onDelete={onDelete}
          />
        </Disclosure>
      )}
    </div>
  );
}

function InvestmentForm({
  investment,
  records,
  today,
  run,
  onClose,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  investment?: Investment;
  run: (command: RecordCommand) => string | null;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<InvestmentCategory>(
    investment?.category ?? 'Ações',
  );
  const saved = useRef(false);
  const quote = records.finance?.quotes.at(-1);
  return (
    <RecordForm
      title={investment ? 'Editar investimento' : 'Cadastrar investimento'}
      onSubmit={(data) => {
        if (saved.current) return null;
        const error = run(investmentCommand(data, investment, today, newId));
        if (!error) {
          saved.current = true;
          onClose();
        }
        return error;
      }}
    >
      <div className="record-fields">
        <Field label="Nome do investimento">
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={investment?.name}
          />
        </Field>
        <Field label="Categoria do investimento">
          <CustomSelect
            label="Categoria do investimento"
            name="category"
            value={category}
            onChange={setCategory}
            options={investmentCategories.map((item) => ({
              value: item,
              label: categoryLabel(item),
            }))}
          />
        </Field>
        {isMarketCategory(category) && (
          <TickerField defaultValue={investment?.ticker} />
        )}
        {!investment && (
          <InvestmentFields
            key={category}
            category={category}
            records={records}
            today={today}
            initial
            quote={quote}
            usdQuote={records.finance?.usdQuotes?.at(-1)}
          />
        )}
        {category === 'Caixinhas bancárias' && (
          <SavingsBoxFields investment={investment} today={today} />
        )}
      </div>
      {!investment && (
        <p className="record-hint">
          Se informar quantidade e preço, o valor aplicado será calculado pelo
          produto dos dois. Para Bitcoin, informe o valor em reais e a
          quantidade em BTC ou sats; em vendas, informe o valor recebido e a
          quantidade vendida. O preço opcional é ignorado para BTC.
        </p>
      )}
      <Actions
        submit={investment ? 'Salvar investimento' : 'Adicionar investimento'}
        cancel={investment ? 'Cancelar edição' : 'Cancelar'}
        onCancel={onClose}
      />
    </RecordForm>
  );
}

const OPERATION_HINT =
  'Para retiradas de ativos sem cotação, informe o custo de aquisição da parcela resgatada se diferente do valor recebido. Sem esse dado, o custo retirado é igual ao valor da operação. BTC usa custo médio automaticamente.';

/**
 * Formulário existente de aportes e retiradas. Aberto pelo cartão, chega com
 * o investimento e a operação definidos; aberto pelo histórico, edita a
 * operação existente e permite trocar o investimento, como antes.
 */
function OperationForm({
  records,
  today,
  run,
  investment,
  action,
  entry,
  onClose,
  onConvert,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  run: (command: RecordCommand) => string | null;
  investment?: Investment;
  action?: InvestmentAction;
  entry?: InvestmentEntry;
  onClose: () => void;
  onConvert?: (command: RecordCommand) => void;
}) {
  const [target, setTarget] = useState(
    investment?.id ?? entry?.investmentId ?? records.investments[0]?.id ?? '',
  );
  const saved = useRef(false);
  const asset = records.investments.find((item) => item.id === target);
  const category = asset?.category ?? 'Ações';
  return (
    <RecordForm
      title={
        entry
          ? 'Editar aporte ou retirada'
          : `${action?.label ?? 'Registrar operação'} · ${asset?.name ?? ''}`
      }
      onSubmit={(data) => {
        if (saved.current) return null;
        const investmentId = formText(data, 'investmentId');
        const command: RecordCommand = {
          type: 'saveInvestmentEntry',
          value: entryFromForm(
            data,
            entry?.id ?? newId(),
            investmentId,
            records.investments.find((item) => item.id === investmentId)
              ?.category ?? 'Ações',
            today,
          ),
        };
        if (
          entry &&
          onConvert &&
          !isInitialPosition(entry) &&
          isInitialPosition(command.value)
        ) {
          onConvert({ ...command, confirmInitial: true });
          return null;
        }
        const error = run(command);
        if (!error) {
          saved.current = true;
          onClose();
        }
        return error;
      }}
    >
      <div className="record-fields">
        {investment ? (
          <input type="hidden" name="investmentId" value={investment.id} />
        ) : (
          <Field label="Investimento">
            <CustomSelect
              label="Investimento"
              name="investmentId"
              value={target}
              onChange={setTarget}
              options={records.investments.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </Field>
        )}
        <InvestmentFields
          key={target}
          category={category}
          entry={entry}
          records={records}
          today={today}
          quote={records.finance?.quotes.at(-1)}
          usdQuote={records.finance?.usdQuotes?.at(-1)}
          defaultKind={action?.kind}
          lockKind={!!action}
        />
      </div>
      <p className="record-hint">{OPERATION_HINT}</p>
      <Actions
        submit={entry ? 'Salvar operação' : 'Registrar operação'}
        cancel={entry ? 'Cancelar edição' : 'Cancelar'}
        onCancel={onClose}
      />
    </RecordForm>
  );
}

function InvestmentHistory({
  records,
  today,
  run,
  onDelete,
}: Pick<RecordPageProps, 'records' | 'today'> & {
  run: (command: RecordCommand) => string | null;
  onDelete: (pending: PendingDeletion) => void;
}) {
  const [filters, setFilters] = useState<EntryFilters>({
    investmentId: ALL,
    category: ALL,
    operation: ALL,
    from: '',
    to: '',
  });
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingConversion, setPendingConversion] =
    useState<RecordCommand | null>(null);
  const [conversionError, setConversionError] = useState('');
  const update = (next: Partial<EntryFilters>) => {
    setFilters((value) => ({ ...value, ...next }));
    setLimit(HISTORY_PAGE_SIZE);
  };
  const entry = records.investmentEntries.find((item) => item.id === editing);
  const items = filterInvestmentEntries(
    records.investmentEntries,
    records.investments,
    filters,
  );
  const categories = investmentCategories.filter((category) =>
    records.investments.some((item) => item.category === category),
  );
  return (
    <>
      <div
        className="finance-filters"
        role="group"
        aria-label="Filtros do histórico de investimentos"
      >
        <Field label="Filtrar por investimento">
          <CustomSelect
            label="Filtrar por investimento"
            value={filters.investmentId}
            onChange={(investmentId) => update({ investmentId })}
            options={[
              { value: ALL, label: 'Todos os investimentos' },
              ...records.investments.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />
        </Field>
        <Field label="Filtrar por categoria">
          <CustomSelect<typeof ALL | InvestmentCategory>
            label="Filtrar por categoria"
            value={filters.category}
            onChange={(category) => update({ category })}
            options={[
              { value: ALL, label: 'Todas as categorias' },
              ...categories.map((item) => ({
                value: item,
                label: categoryLabel(item),
              })),
            ]}
          />
        </Field>
        <Field label="Tipo de operação">
          <CustomSelect<EntryFilters['operation']>
            label="Tipo de operação"
            value={filters.operation}
            onChange={(operation) => update({ operation })}
            options={[
              { value: ALL, label: 'Todas as operações' },
              { value: 'contribution', label: 'Compra ou aporte' },
              { value: 'withdrawal', label: 'Venda ou retirada' },
              { value: 'initial', label: 'Posição inicial' },
            ]}
          />
        </Field>
        <Field label="Período: de">
          <CustomDatePicker
            label="Período: de"
            value={filters.from}
            max={filters.to || today}
            onChange={(from) => update({ from })}
          />
        </Field>
        <Field label="Período: até">
          <CustomDatePicker
            label="Período: até"
            value={filters.to}
            min={filters.from || undefined}
            max={today}
            onChange={(to) => update({ to })}
          />
        </Field>
      </div>
      <p className="record-hint" aria-live="polite">
        {plural(items.length, 'operação encontrada', 'operações encontradas')}.
      </p>
      {entry && (
        <InlineForm key={entry.id}>
          <OperationForm
            records={records}
            today={today}
            run={run}
            entry={entry}
            onClose={() => setEditing(null)}
            onConvert={(command) => {
              setConversionError('');
              setPendingConversion(command);
            }}
          />
        </InlineForm>
      )}
      <ul className="record-list">
        {items.slice(0, limit).map((item) => {
          const asset = records.investments.find(
            (investment) => investment.id === item.investmentId,
          );
          const name = asset?.name;
          return (
            <li key={item.id}>
              <div>
                <strong>
                  {name} ·{' '}
                  {isInitialPosition(item)
                    ? `Posição inicial · ${item.costUnknown ? 'custo desconhecido' : money(item.amountCents)}`
                    : `${item.kind === 'contribution' ? 'Aporte' : 'Retirada'} de ${money(item.amountCents)}`}
                </strong>
                <p>
                  {item.acquisitionDateUnknown
                    ? 'Registrado em ' +
                      displayDate(item.date) +
                      ' · Data original não informada'
                    : displayDate(item.date)}
                  {item.quantity !== undefined &&
                    ` · Quantidade: ${asset?.category === 'Dólar (USD)' ? formatCurrency(Math.round(item.quantity * 100), 'USD') : item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 }) + (asset?.category === 'Bitcoin' ? ' BTC' : ' unidades')}${item.purchasePriceCents !== undefined ? ' · Preço: ' + money(item.purchasePriceCents) : ''}`}
                  {item.costUnknown &&
                    ' · Posição existente; custo desconhecido, sem débito em conta'}
                </p>
              </div>
              <div className="record-actions">
                {item.kind === 'contribution' && !isInitialPosition(item) && (
                  <button
                    type="button"
                    onClick={() => {
                      setConversionError('');
                      setPendingConversion({
                        type: 'convertToInitialPosition',
                        id: item.id,
                        confirmed: true,
                      });
                    }}
                  >
                    Corrigir como posição inicial de {name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(item.id)}
                  aria-label={`Editar operação de ${name}, ${displayDate(item.date)}, ${money(item.amountCents)}`}
                >
                  Editar operação
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onDelete({
                      title: 'Excluir operação',
                      description: `${name} · ${displayDate(item.date)} · ${money(item.amountCents)}. A posição, os saldos e o patrimônio serão recalculados.`,
                      confirm: 'Confirmar exclusão',
                      run: () => {
                        const error = run({
                          type: 'deleteInvestmentEntry',
                          id: item.id,
                        });
                        if (!error && editing === item.id) setEditing(null);
                        return error;
                      },
                    })
                  }
                  aria-label={`Excluir operação de ${name}, ${displayDate(item.date)}, ${money(item.amountCents)}`}
                >
                  Excluir operação
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {!items.length && (
        <Empty>Nenhuma operação com os filtros selecionados.</Empty>
      )}
      {items.length > limit && (
        <button
          type="button"
          className="filter-button finance-more"
          onClick={() => setLimit((value) => value + HISTORY_PAGE_SIZE)}
        >
          Mostrar mais operações
        </button>
      )}
      {pendingConversion && (
        <FinancialConfirmation
          title="Converter em posição inicial"
          onCancel={() => {
            setPendingConversion(null);
            setConversionError('');
          }}
        >
          <p>
            Confirme que este investimento já existia. O débito da conta será
            revertido, sem criar receita ou duplicar o ativo. A quantidade, o
            custo e as operações posteriores serão preservados na correção
            direta. O XP, o Radar e o histórico financeiro serão recalculados.
          </p>
          {pendingConversion.type === 'saveInvestmentEntry' && (
            <p>Também serão salvos os campos que você editou nesta operação.</p>
          )}
          {conversionError && <p role="alert">{conversionError}</p>}
          <button
            type="button"
            className="record-primary financial-danger"
            onClick={() => {
              const error = run(pendingConversion);
              if (error) setConversionError(error);
              else {
                setPendingConversion(null);
                setEditing(null);
              }
            }}
          >
            Confirmar conversão
          </button>
        </FinancialConfirmation>
      )}
    </>
  );
}
