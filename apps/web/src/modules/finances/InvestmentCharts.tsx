import { useId, useState } from 'react';
import { Empty } from '../records/RecordUI';
import type { LifeRecords } from '../records/types';
import { money } from './calculations';
import { CategoryIcon } from './CategoryIcon';
import { FinancialChart } from './FinancialChart';
import { categoryLabel } from './investmentActions';
import { categoryBreakdown, type CategoryBreakdown } from './categoryBreakdown';

const chartKinds = [
  { id: 'evolution', label: 'Evolução' },
  { id: 'distribution', label: 'Distribuição' },
  { id: 'cost', label: 'Custo × valor' },
] as const;
type ChartKind = (typeof chartKinds)[number]['id'];

const percent = (share: number) =>
  `${(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/**
 * Gráficos da aba Investimentos com escolha do tipo. Todos usam somente os
 * valores já projetados (`financialHistory`/`investmentValue`); nada é
 * estimado além das regras de patrimônio existentes.
 */
export function InvestmentCharts({
  records,
  today,
}: {
  records: LifeRecords;
  today: string;
}) {
  const [kind, setKind] = useState<ChartKind>('evolution');
  const id = useId();
  const rows = categoryBreakdown(records, today);
  return (
    <section className="investment-charts" aria-labelledby={`${id}-title`}>
      <div className="investment-charts__head">
        <h2 id={`${id}-title`}>Gráficos de investimentos</h2>
        <div
          className="finance-segmented"
          role="group"
          aria-label="Tipo de gráfico de investimentos"
        >
          {chartKinds.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`filter-button${kind === item.id ? ' active' : ''}`}
              aria-pressed={kind === item.id}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {kind === 'evolution' ? (
        <FinancialChart records={records} today={today} defaultView="wealth" />
      ) : !rows.length ? (
        <div className="panel record-section">
          <Empty>
            Cadastre um investimento para comparar categorias. Os gráficos usam
            somente valores registrados.
          </Empty>
        </div>
      ) : kind === 'distribution' ? (
        <Distribution rows={rows} />
      ) : (
        <CostValue rows={rows} />
      )}
    </section>
  );
}

function Notes({ rows }: { rows: CategoryBreakdown[] }) {
  return (
    <>
      {rows.some((row) => row.reference) && (
        <p className="record-hint">
          * Valor de referência pelo custo: falta avaliação ou cotação atual.
        </p>
      )}
      {rows.some((row) => row.unpriced) && (
        <p className="record-hint">
          Posições sem custo nem cotação ficam fora do valor até serem
          avaliadas.
        </p>
      )}
    </>
  );
}

function Distribution({ rows }: { rows: CategoryBreakdown[] }) {
  return (
    <div className="panel record-section investment-chart">
      <h3>Distribuição do valor atual por categoria</h3>
      <ul className="investment-bars">
        {rows.map((row) => (
          <li key={row.category}>
            <div className="investment-bars__label">
              <span>
                <CategoryIcon category={row.category} />
                {categoryLabel(row.category)}
                {row.reference && ' *'}
              </span>
              <strong>
                {money(row.value)} · {percent(row.share)}
              </strong>
            </div>
            <div className="investment-bars__track" aria-hidden="true">
              <span
                className="investment-bars__fill"
                style={{ width: `${row.share * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <Notes rows={rows} />
    </div>
  );
}

function CostValue({ rows }: { rows: CategoryBreakdown[] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.cost, row.value]));
  return (
    <div className="panel record-section investment-chart">
      <h3>Custo de aquisição × valor atual por categoria</h3>
      <ul className="investment-bars">
        {rows.map((row) => {
          const comparable = row.costKnown && !row.reference && !row.unpriced;
          const difference = row.value - row.cost;
          return (
            <li key={row.category}>
              <div className="investment-bars__label">
                <span>
                  <CategoryIcon category={row.category} />
                  {categoryLabel(row.category)}
                  {row.reference && ' *'}
                </span>
                <strong>
                  {comparable
                    ? `${difference > 0 ? '+' : ''}${money(difference)}`
                    : 'Diferença indisponível'}
                </strong>
              </div>
              <p className="investment-bars__detail">
                Custo{' '}
                {row.costKnown ? money(row.cost) : 'parcialmente desconhecido'}{' '}
                · Valor {money(row.value)}
              </p>
              <div className="investment-bars__track" aria-hidden="true">
                <span
                  className="investment-bars__fill investment-bars__fill--cost"
                  style={{ width: `${(row.cost / max) * 100}%` }}
                />
              </div>
              <div className="investment-bars__track" aria-hidden="true">
                <span
                  className="investment-bars__fill"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="record-hint">
        Barra cinza: custo; barra verde: valor atual. A diferença compara o
        valor registrado com o custo e não representa rentabilidade.
      </p>
      <Notes rows={rows} />
    </div>
  );
}
