import { FinanceHelp } from './FinanceHelp';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Empty } from '../records/RecordUI';
import type { LifeRecords } from '../records/types';
import { money } from './calculations';
import { CategoryIcon } from './CategoryIcon';
import { FinancialChart } from './FinancialChart';
import { categoryLabel } from './investmentActions';
import { categoryBreakdown, type CategoryBreakdown } from './categoryBreakdown';
import { formatTenths, percentTenths, pieSlices } from './pieChart';
import { investmentCategories } from './types';

const chartKinds = [
  { id: 'evolution', label: 'Evolução' },
  { id: 'distribution', label: 'Distribuição' },
  { id: 'cost', label: 'Custo × valor' },
] as const;
type ChartKind = (typeof chartKinds)[number]['id'];

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
        <div className="help-heading">
          <h2 id={`${id}-title`}>Gráficos de investimentos</h2>
          <FinanceHelp topic="investmentCharts" />
        </div>
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

/** Tom fixo por categoria (tokens `--color-chart-1` a `--color-chart-7`). */
const tone = (category: CategoryBreakdown['category']) =>
  investmentCategories.indexOf(category);

type Category = CategoryBreakdown['category'];
/** Toque seleciona sem passar por hover (não há ponteiro “sobre” no toque). */
const previewable = (event: PointerEvent) => event.pointerType !== 'touch';

/**
 * Distribuição do valor atual por categoria em pizza (setores até o centro).
 * Base única: o mesmo valor por investimento usado em “Valor dos
 * investimentos” (`investmentValue`); custo e saldo da Carteira não entram.
 * Percentuais em décimos pelo método dos maiores restos (somam 100,0%).
 *
 * Seleção (clique, toque ou teclado na legenda) e pré-visualização (hover do
 * mouse) são estados separados: ao tirar o mouse, volta a categoria
 * selecionada. O destaque fica numa camada sobreposta com uma cópia de cada
 * setor; só opacidade, escala e brilho mudam (transições CSS), sem
 * reconstruir o gráfico. Nenhum texto é desenhado sobre os setores.
 */
function Distribution({ rows }: { rows: CategoryBreakdown[] }) {
  const id = useId();
  const values = rows.map((row) => Math.max(0, row.value));
  const tenths = percentTenths(values);
  const slices = pieSlices(values);
  const [selected, setSelected] = useState<Category>();
  const [hovered, setHovered] = useState<Category>();
  const indexOf = (category: Category | undefined) =>
    category === undefined
      ? -1
      : rows.findIndex((row) => row.category === category);
  // Seleção inicial: a maior fatia. Categorias que saem da lista voltam a ela.
  const chosen =
    indexOf(selected) >= 0 ? indexOf(selected) : (slices[0]?.index ?? 0);
  const shown = indexOf(hovered) >= 0 ? indexOf(hovered) : chosen;
  const current = rows[shown];
  const total = values.reduce((sum, value) => sum + value, 0);
  const legend = useRef<HTMLUListElement>(null);
  const choose = (index: number) => setSelected(rows[index]?.category);
  function onLegendKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : step
            ? (index + step + rows.length) % rows.length
            : -1;
    if (next < 0) return;
    event.preventDefault();
    choose(next);
    const buttons =
      legend.current?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[next]?.focus();
  }
  const shape = (slice: (typeof slices)[number], props: object) =>
    slice.path ? (
      <path d={slice.path} {...props} />
    ) : (
      <circle cx="100" cy="100" r="96" {...props} />
    );
  return (
    <div className="panel record-section investment-chart distribution-pie">
      <h3 id={`${id}-title`}>Distribuição dos investimentos</h3>
      {total <= 0 ? (
        <Empty>
          Ainda não há valores registrados para distribuir. Informe um custo,
          uma avaliação ou uma cotação.
        </Empty>
      ) : (
        <div className="distribution-pie__body">
          <div className="distribution-pie__figure">
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-labelledby={`${id}-title`}
              aria-describedby={`${id}-summary`}
              className="distribution-pie__svg"
              data-slices={slices.length}
              onPointerLeave={() => setHovered(undefined)}
            >
              <g className="distribution-pie__base">
                {slices.map((slice) => {
                  const row = rows[slice.index]!;
                  return (
                    <g key={row.category}>
                      {shape(slice, {
                        className: `distribution-pie__slice${slice.index === shown ? ' is-active' : ''}`,
                        'data-tone': tone(row.category),
                        'data-category': row.category,
                        'data-selected': slice.index === chosen || undefined,
                        onPointerEnter: (event: PointerEvent) => {
                          if (previewable(event)) setHovered(row.category);
                        },
                        onClick: () => {
                          setHovered(undefined);
                          choose(slice.index);
                        },
                      })}
                    </g>
                  );
                })}
              </g>
              {/* Camada de destaque: cópias fixas dos setores, por cima. */}
              <g className="distribution-pie__highlights" aria-hidden="true">
                {slices.map((slice) => {
                  const row = rows[slice.index]!;
                  return (
                    <g key={row.category}>
                      {shape(slice, {
                        className: 'distribution-pie__glow',
                        'data-tone': tone(row.category),
                        'data-glow': row.category,
                        'data-on': slice.index === shown || undefined,
                      })}
                    </g>
                  );
                })}
              </g>
            </svg>
            <p id={`${id}-summary`} className="sr-only">
              {rows
                .map(
                  (row, index) =>
                    `${categoryLabel(row.category)}: ${money(values[index]!)}, ${formatTenths(tenths[index]!)}`,
                )
                .join('; ')}
              .
            </p>
          </div>
          <div className="distribution-pie__side">
            {current && (
              <p
                className="distribution-pie__detail"
                data-tone={tone(current.category)}
                aria-live="polite"
              >
                {/* Nova montagem por categoria: entrada curta, sem atraso. */}
                <span
                  key={current.category}
                  className="distribution-pie__detail-content"
                >
                  <strong>
                    {categoryLabel(current.category)}
                    {current.reference && ' *'}
                  </strong>
                  <span>
                    {money(values[shown]!)} · {formatTenths(tenths[shown]!)}
                  </span>
                </span>
              </p>
            )}
            <ul
              ref={legend}
              className="distribution-pie__legend"
              aria-label="Categorias da distribuição"
              onPointerLeave={() => setHovered(undefined)}
            >
              {rows.map((row, index) => (
                <li key={row.category}>
                  <button
                    type="button"
                    data-tone={tone(row.category)}
                    data-shown={index === shown || undefined}
                    aria-pressed={index === chosen}
                    tabIndex={index === chosen ? 0 : -1}
                    onPointerEnter={(event) => {
                      if (previewable(event.nativeEvent))
                        setHovered(row.category);
                    }}
                    onClick={() => {
                      setHovered(undefined);
                      choose(index);
                    }}
                    onFocus={() => choose(index)}
                    onKeyDown={(event) => onLegendKey(event, index)}
                  >
                    <span
                      className="distribution-pie__swatch"
                      data-tone={tone(row.category)}
                      aria-hidden="true"
                    />
                    <span className="distribution-pie__name">
                      <CategoryIcon category={row.category} />
                      {categoryLabel(row.category)}
                      {row.reference && ' *'}
                    </span>
                    <span className="distribution-pie__value">
                      {values[index]! > 0
                        ? `${money(values[index]!)} · ${formatTenths(tenths[index]!)}`
                        : row.unpriced
                          ? 'Valor pendente'
                          : `${money(0)} · 0%`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
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
        Barra cinza: custo · barra verde: valor atual.
      </p>
      <Notes rows={rows} />
    </div>
  );
}
