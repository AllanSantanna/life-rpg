import { useState } from 'react';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { Field, RecordFeedback, Summary } from '../records/RecordUI';
import type { RecordPageProps } from '../records/types';
import { useCommand } from '../records/useCommand';
import { CashLedgerPanel } from './CashLedgerPanel';
import { money, monthlyBalance } from './calculations';
import { DeleteConfirmation, type PendingDeletion } from './DeleteConfirmation';
import { FinanceTabs } from './FinanceLayout';
import { FinancialChart } from './FinancialChart';
import { FinancialSettings } from './FinancialSettings';
import { InvestmentsPanel } from './InvestmentsPanel';
import { financialSummary } from './ledger';
import { MovementsPanel } from './MovementsPanel';

type FinanceArea = 'movements' | 'investments';
const areas = [
  { id: 'movements', label: 'Movimentações' },
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
}: RecordPageProps & {
  quoteError?: string;
  quoteStale?: boolean;
  usdError?: string;
  usdStale?: boolean;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [area, setArea] = useState<FinanceArea>('movements');
  const [pendingDeletion, setPendingDeletion] =
    useState<PendingDeletion | null>(null);
  const [managementRevision, setManagementRevision] = useState(0);
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
      setManagementRevision((n) => n + 1);
    }
    return error;
  };
  return (
    <div className="pillar-page" data-area="Finanças">
      <section className="finance-overview" aria-label="Visão geral financeira">
        <Field label="Mês financeiro">
          <CustomDatePicker
            label="Mês financeiro"
            mode="month"
            value={month}
            max={today.slice(0, 7)}
            onChange={setMonth}
          />
        </Field>
        <Summary
          values={[
            { label: 'Receitas do mês', value: money(monthly.income) },
            { label: 'Despesas do mês', value: money(monthly.expense) },
            { label: 'Resultado mensal', value: money(monthly.balance) },
          ]}
        />
        <p className="record-hint">
          Resultado mensal = receitas − despesas. É fluxo do período, separado
          dos saldos e investimentos.
        </p>
        <Summary
          values={[
            {
              label: 'Dinheiro disponível',
              value:
                financial.cash === null
                  ? 'Informe os saldos iniciais'
                  : money(financial.cash),
            },
            {
              label: 'Valor dos investimentos',
              value: financial.unpriced
                ? 'Cotação pendente'
                : money(financial.investments),
            },
            {
              label: 'Patrimônio financeiro total',
              value:
                financial.wealth === null
                  ? 'Patrimônio pendente'
                  : money(financial.wealth),
            },
            {
              label: 'Custo de aquisição atual',
              value: financial.costKnown
                ? money(financial.cost)
                : 'Custo parcialmente desconhecido',
            },
            {
              label: 'Total aportado conhecido',
              value: money(financial.contributed),
            },
            {
              label: 'Resgates e retiradas',
              value: money(financial.withdrawn),
            },
          ]}
        />
        {!financial.known && (
          <p className="record-hint">
            Há investimentos sem avaliação atual: o total usa o custo de
            aquisição como referência. Atualize os valores manuais; operações
            posteriores exigem nova avaliação.
          </p>
        )}
        <CashLedgerPanel
          key={managementRevision}
          records={records}
          today={today}
          onCommand={manage}
        />
        <FinancialChart records={records} today={today} />
      </section>
      <FinanceTabs
        label="Gerenciamento financeiro"
        tabs={areas}
        active={area}
        onChange={setArea}
      >
        {area === 'movements' ? (
          <MovementsPanel
            key={managementRevision}
            records={records}
            today={today}
            month={month}
            onMonthChange={setMonth}
            run={run}
            onDelete={setPendingDeletion}
          />
        ) : (
          <InvestmentsPanel
            key={managementRevision}
            records={records}
            today={today}
            onCommand={onCommand}
            run={run}
            onDelete={setPendingDeletion}
            btcStatus={{ error: quoteError, stale: quoteStale }}
            usdStatus={{ error: usdError, stale: usdStale }}
          />
        )}
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
