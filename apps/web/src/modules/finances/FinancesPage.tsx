import { useState } from 'react';
import { ActionButton } from '../../shared/components/ActionButton';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { Field, RecordFeedback, Summary } from '../records/RecordUI';
import type { RecordPageProps } from '../records/types';
import { useCommand } from '../records/useCommand';
import { money, monthlyBalance } from './calculations';
import { DeleteConfirmation, type PendingDeletion } from './DeleteConfirmation';
import { FinanceTabs } from './FinanceLayout';
import { FinancialChart } from './FinancialChart';
import { FinancialSettings } from './FinancialSettings';
import { InvestmentCharts } from './InvestmentCharts';
import { InvestmentsPanel } from './InvestmentsPanel';
import { financialSummary } from './ledger';
import {
  MovementForm,
  MovementsPanel,
  type MovementDraft,
} from './MovementsPanel';
import { ValuationsPanel } from './ValuationsPanel';
import { BudgetPanel } from './BudgetPanel';
import { FinanceHelp } from './FinanceHelp';
import { RecurrencesPanel } from './RecurrencesPanel';
import type { MarketTracker } from './useMarketQuotes';

/** Duas áreas: a carteira única (padrão) e o patrimônio investido. */
type FinanceArea = 'wallet' | 'investments';
const areas = [
  { id: 'wallet', label: 'Carteira' },
  { id: 'investments', label: 'Investimentos' },
] as const;

export function FinancesPage({
  records,
  today,
  onCommand,
  quoteError = '',
  quoteStale = false,
  usdError = '',
  usdStale = false,
  market,
}: RecordPageProps & {
  market?: MarketTracker;
  quoteError?: string;
  quoteStale?: boolean;
  usdError?: string;
  usdStale?: boolean;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [area, setArea] = useState<FinanceArea>('wallet');
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null);
  const [managementRevision, setManagementRevision] = useState(0);
  /** Formulário de receita/despesa aberto; `undefined` quando fechado. */
  const [movementDraft, setMovementDraft] = useState<MovementDraft>();
  const [draftRevision, setDraftRevision] = useState(0);
  const openMovement = (draft: MovementDraft) => {
    setMovementDraft(draft);
    // Reabre o formulário com o novo tipo mesmo se outro já estiver aberto.
    setDraftRevision((n) => n + 1);
  };
  const { run, message } = useCommand(onCommand);
  const monthly = monthlyBalance(records.movements, month);
  const financial = financialSummary(records, today);
  const manage: typeof onCommand = (command) => {
    const error = onCommand(command);
    if (
      !error &&
      (command.type === 'deleteAccount' || command.type === 'resetFinances')
    ) {
      // Formulários abertos podem referenciar registros removidos.
      setPendingDeletion(null);
      setMovementDraft(undefined);
      setManagementRevision((n) => n + 1);
    }
    return error;
  };
  const wallet = (
    <div className="finance-area">
      <section className="finance-overview" aria-label="Visão geral financeira">
        <Field label="Período">
          <CustomDatePicker
            label="Período"
            mode="month"
            value={month}
            max={today.slice(0, 7)}
            onChange={setMonth}
          />
        </Field>
        <Summary
          values={[
            {
              label: 'Saldo disponível',
              help: <FinanceHelp topic="cash" />,
              value:
                financial.cash === null
                  ? 'Saldo pendente'
                  : money(financial.cash),
            },
            {
              label: 'Receitas do mês',
              value: money(monthly.income),
              help: <FinanceHelp topic="income" />,
            },
            {
              label: 'Despesas do mês',
              value: money(monthly.expense),
              help: <FinanceHelp topic="expense" />,
            },
            {
              label: 'Resultado mensal',
              value: money(monthly.balance),
              help: <FinanceHelp topic="result" />,
            },
          ]}
        />
        <div
          className="finance-quick-actions"
          role="group"
          aria-label="Registrar movimentação"
        >
          <ActionButton
            icon="plus"
            onClick={() => openMovement({ id: null, kind: 'income' })}
          >
            Adicionar receita
          </ActionButton>
          <ActionButton
            icon="plus"
            onClick={() => openMovement({ id: null, kind: 'expense' })}
          >
            Adicionar despesa
          </ActionButton>
        </div>
        {movementDraft && (
          <MovementForm
            key={draftRevision}
            records={records}
            today={today}
            draft={movementDraft}
            run={run}
            onClose={() => setMovementDraft(undefined)}
          />
        )}
      </section>
      <FinancialChart records={records} today={today} defaultView="cash" />
      <RecurrencesPanel
        key={`recurrences:${managementRevision}`}
        records={records}
        today={today}
        run={run}
        onDelete={setPendingDeletion}
      />
      <BudgetPanel
        key={`budget:${managementRevision}`}
        records={records}
        today={today}
        month={month}
        run={run}
        onDelete={setPendingDeletion}
      />
      <MovementsPanel
        key={managementRevision}
        records={records}
        month={month}
        onEdit={openMovement}
        run={run}
        onDelete={setPendingDeletion}
      />
    </div>
  );
  const investments = (
    <div className="finance-area">
      <section
        className="finance-overview"
        aria-label="Visão geral dos investimentos"
      >
        <Summary
          values={[
            {
              label: 'Valor dos investimentos',
              help: <FinanceHelp topic="investmentsValue" />,
              value: financial.unpriced
                ? 'Cotação pendente'
                : money(financial.investments),
            },
            {
              label: 'Patrimônio financeiro total',
              help: <FinanceHelp topic="wealth" />,
              value:
                financial.wealth === null
                  ? 'Patrimônio pendente'
                  : money(financial.wealth),
            },
            {
              label: 'Custo de aquisição atual',
              help: <FinanceHelp topic="cost" />,
              value: financial.costKnown
                ? money(financial.cost)
                : 'Custo parcialmente desconhecido',
            },
            {
              label: 'Total aportado conhecido',
              help: <FinanceHelp topic="contributed" />,
              value: money(financial.contributed),
            },
            {
              label: 'Resgates e retiradas',
              help: <FinanceHelp topic="withdrawn" />,
              value: money(financial.withdrawn),
            },
          ]}
        />
        {!financial.known && (
          <p className="record-hint">
            Há investimentos sem avaliação atual: o total usa o custo de
            aquisição como referência. Atualize em Avaliações manuais.
          </p>
        )}
      </section>
      <InvestmentsPanel
        key={managementRevision}
        records={records}
        today={today}
        onCommand={onCommand}
        run={run}
        onDelete={setPendingDeletion}
        btcStatus={{ error: quoteError, stale: quoteStale }}
        usdStatus={{ error: usdError, stale: usdStale }}
        market={market}
        charts={<InvestmentCharts records={records} today={today} />}
      />
      <ValuationsPanel
        key={`valuations:${managementRevision}`}
        records={records}
        today={today}
        onCommand={onCommand}
      />
    </div>
  );
  return (
    <div className="pillar-page finance-page" data-area="Finanças">
      <FinanceTabs
        label="Áreas de Finanças"
        tabs={areas}
        active={area}
        onChange={setArea}
      >
        {area === 'wallet' ? wallet : investments}
      </FinanceTabs>
      <RecordFeedback message={message} />
      {pendingDeletion && (
        <DeleteConfirmation
          pending={pendingDeletion}
          onClose={() => setPendingDeletion(null)}
        />
      )}
      <FinancialSettings onCommand={manage} />
    </div>
  );
}
