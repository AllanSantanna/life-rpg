import { useEffect, useId, useRef, useState } from 'react';
import type { LifeRecords } from '../records/types';
import { daysBetween, displayDate } from '../records/dates';
import { money } from './calculations';
import {
  chartPeriods,
  smoothWealthPath,
  wealthChartModel,
  type ChartPeriod,
  type ChartView,
} from './chartModel';
import { Icon } from '../../shared/components/Icon';

const height = 270;
const top = 24;
const bottom = 228;
const compactMoney = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 2,
  });
export function FinancialChart({
  records,
  today,
  defaultView = 'cash',
}: {
  records: LifeRecords;
  today: string;
  /** Visão inicial: saldo na aba Carteira, patrimônio na aba Investimentos. */
  defaultView?: ChartView;
}) {
  const [view, setView] = useState<ChartView>(defaultView);
  const label = view === 'cash' ? 'Saldo disponível' : 'Patrimônio total';
  const pointLabel = view === 'cash' ? 'saldo disponível' : 'patrimônio';
  const [period, setPeriod] = useState<ChartPeriod>(30);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [width, setWidth] = useState(720);
  const container = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const model = wealthChartModel(records, today, period, view);
  const { points, current, currentValue, change, percent, trend } = model;
  // Sem nenhum registro, a carteira interna começa em zero: ainda não há histórico.
  const fresh =
    !records.movements.length &&
    !records.investmentEntries.length &&
    !records.finance?.accounts.length;
  const active = points.find((point) => point.date === activeDate);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () =>
      setWidth(Math.max(240, element.getBoundingClientRect().width || 720));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const values = points.map((point) => point.value);
  const low = Math.min(...values, currentValue ?? 0);
  const high = Math.max(...values, currentValue ?? 0);
  const padding = Math.max((high - low) * 0.15, Math.abs(high) * 0.02, 100);
  const min = low - padding,
    max = high + padding;
  const y = (value: number) =>
    bottom - ((value - min) / (max - min)) * (bottom - top);
  const first = points[0];
  const last = points.at(-1);
  const duration = Math.max(
    1,
    daysBetween(last?.date ?? today, first?.date ?? today),
  );
  const left = width < 450 ? 64 : 82;
  const right = width - 20;
  const x = (date: string) =>
    points.length === 1
      ? (left + right) / 2
      : left +
        (daysBetween(date, first?.date ?? today) / duration) * (right - left);
  const coords = points.map((point) => ({
    x: x(point.date),
    y: y(point.value),
  }));
  const path = smoothWealthPath(coords);
  const ticks = Array.from(
    { length: 4 },
    (_, i) => min + ((max - min) * i) / 3,
  );
  const labelIndexes = [
    ...new Set([
      0,
      ...(width >= 500 ? [Math.floor((points.length - 1) / 2)] : []),
      points.length - 1,
    ]),
  ];
  const showPoint = (index: number) =>
    setActiveDate(points[index]?.date ?? null);
  const tooltipLeft = active
    ? Math.max(4, Math.min(width - 244, x(active.date) - 120))
    : 4;
  function selectNearest(clientX: number, element: HTMLDivElement) {
    if (!points.length) return;
    const rect = element.getBoundingClientRect();
    const mouseX = ((clientX - rect.left) * width) / (rect.width || width);
    const nearest = coords.reduce(
      (best, point, index) =>
        Math.abs(point.x - mouseX) < Math.abs(coords[best]!.x - mouseX)
          ? index
          : best,
      0,
    );
    showPoint(nearest);
  }
  return (
    <section
      className={`panel record-section wealth-chart wealth-chart--${trend}`}
      aria-label="Evolução financeira"
    >
      <div className="wealth-chart__heading">
        <div>
          <span className="wealth-chart__eyebrow">
            EVOLUÇÃO DOS SEUS SALDOS
          </span>
          <h2>Evolução financeira</h2>
        </div>
        <div
          className="wealth-chart__periods"
          role="group"
          aria-label="Período da evolução financeira"
        >
          {chartPeriods.map((item) => (
            <button
              type="button"
              key={item.days}
              aria-pressed={period === item.days}
              onClick={() => {
                setPeriod(item.days);
                setActiveDate(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="wealth-chart__periods wealth-chart__views"
        role="group"
        aria-label="Visualização financeira"
      >
        <button
          type="button"
          aria-pressed={view === 'cash'}
          onClick={() => {
            setView('cash');
            setActiveDate(null);
          }}
        >
          Saldo disponível
        </button>
        <button
          type="button"
          aria-pressed={view === 'wealth'}
          onClick={() => {
            setView('wealth');
            setActiveDate(null);
          }}
        >
          Patrimônio total
        </button>
      </div>
      <div
        className="wealth-chart__summary"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="wealth-chart__amount">
          <span>{label} atual</span>
          <strong>
            {currentValue === null
              ? view === 'wealth' && current.unpriced
                ? 'Cotação pendente'
                : 'Saldo pendente'
              : money(currentValue)}
          </strong>
        </p>
        <div className="wealth-chart__variation">
          <strong>
            <span aria-hidden="true">
              {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '—'}
            </span>{' '}
            {change === null
              ? 'Sem comparação no período'
              : `${change > 0 ? '+' : ''}${money(change)}`}
          </strong>
          <span>
            {change === null
              ? 'O histórico cresce com seus registros'
              : percent === null
                ? 'Percentual indisponível: base zero ou negativa'
                : `${percent > 0 ? '+' : ''}${percent.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}% no histórico do período`}
          </span>
        </div>
      </div>
      <p className="wealth-chart__context">
        {view === 'cash'
          ? 'Saldo da carteira com receitas, despesas, aportes e resgates reais. Posições iniciais e oscilações dos investimentos não alteram o saldo disponível.'
          : 'Mudança do patrimônio total, incluindo entradas e saídas de dinheiro. Não representa rentabilidade.'}
      </p>
      <div
        className="wealth-chart__plot"
        ref={container}
        onMouseLeave={() => setActiveDate(null)}
        onClick={(event) => {
          if (event.detail > 0)
            selectNearest(event.clientX, event.currentTarget);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === 'touch')
            selectNearest(event.clientX, event.currentTarget);
        }}
        onMouseMove={(event) => {
          selectNearest(event.clientX, event.currentTarget);
        }}
      >
        {!points.length ? (
          <div className="wealth-chart__empty">
            <Icon name="chart" size={32} />
            <h3>
              {currentValue === null && current.unpriced
                ? 'Aguardando referência USD/BRL'
                : currentValue === null || fresh
                  ? 'Seu histórico começa aqui'
                  : 'Nenhum registro neste período'}
            </h3>
            <p>
              {currentValue === null || fresh
                ? 'Registre a primeira receita ou despesa para acompanhar seu patrimônio.'
                : 'Selecione outro período ou registre uma nova movimentação.'}
            </p>
          </div>
        ) : (
          <>
            <svg
              width="100%"
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${view === 'cash' ? 'Saldo disponível' : 'Patrimônio financeiro'} em reais; ${points.length} ${points.length === 1 ? 'ponto' : 'pontos'}. Consulte cada ponto por toque, mouse ou teclado.`}
            >
              <defs>
                <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--wealth-color)"
                    stopOpacity=".18"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--wealth-color)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              {ticks.map((value, index) => (
                <g key={index}>
                  <line
                    x1={left}
                    x2={right}
                    y1={y(value)}
                    y2={y(value)}
                    className="wealth-chart__grid"
                  />
                  <text
                    x={left - 12}
                    y={y(value) + 4}
                    textAnchor="end"
                    className="wealth-chart__axis"
                  >
                    {compactMoney(value)}
                  </text>
                </g>
              ))}
              <g
                key={`${view}:${period}:${path}`}
                className="wealth-chart__drawing"
              >
                {path && (
                  <>
                    <path
                      d={`${path} L ${coords.at(-1)!.x} ${bottom} L ${coords[0]!.x} ${bottom} Z`}
                      fill={`url(#${id}-fill)`}
                    />
                    <path d={path} className="wealth-chart__line" />
                  </>
                )}
                {coords.map((point, index) => (
                  <circle
                    key={points[index]!.date}
                    cx={point.x}
                    cy={point.y}
                    r={index === points.length - 1 ? 5 : 3}
                    className="wealth-chart__dot"
                  />
                ))}
                <circle
                  cx={coords.at(-1)!.x}
                  cy={coords.at(-1)!.y}
                  r="10"
                  className="wealth-chart__latest"
                />
              </g>
              {active && (
                <>
                  <line
                    x1={x(active.date)}
                    x2={x(active.date)}
                    y1={top}
                    y2={bottom}
                    className="wealth-chart__cursor"
                  />
                  <circle
                    cx={x(active.date)}
                    cy={y(active.value)}
                    r="6"
                    className="wealth-chart__dot"
                  />
                </>
              )}
              {labelIndexes.map((index) => {
                const point = points[index];
                return (
                  point &&
                  (index === 0 ||
                    index === points.length - 1 ||
                    (x(point.date) - left > 100 &&
                      right - x(point.date) > 100)) && (
                    <text
                      key={point.date}
                      x={x(point.date)}
                      y="256"
                      textAnchor={
                        points.length === 1
                          ? 'middle'
                          : index === 0
                            ? 'start'
                            : index === points.length - 1
                              ? 'end'
                              : 'middle'
                      }
                      className="wealth-chart__axis"
                    >
                      {displayDate(point.date)}
                    </text>
                  )
                );
              })}
            </svg>
            <div
              role="group"
              aria-label={
                view === 'cash'
                  ? 'Pontos do saldo disponível'
                  : 'Pontos do patrimônio'
              }
            >
              {points.map((point, index) => (
                <button
                  type="button"
                  key={point.date}
                  ref={(element) => {
                    buttons.current[index] = element;
                  }}
                  className="wealth-chart__hit"
                  style={{
                    left: `${(x(point.date) / width) * 100}%`,
                    top: y(point.value),
                  }}
                  aria-label={`${displayDate(point.date)}: ${pointLabel} ${money(point.value)}`}
                  aria-describedby={
                    active?.date === point.date ? `${id}-tooltip` : undefined
                  }
                  onFocus={() => showPoint(index)}
                  onBlur={() => setActiveDate(null)}
                  onClick={() => showPoint(index)}
                  onKeyDown={(event) => {
                    const next =
                      event.key === 'ArrowRight'
                        ? Math.min(points.length - 1, index + 1)
                        : event.key === 'ArrowLeft'
                          ? Math.max(0, index - 1)
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? points.length - 1
                              : null;
                    if (event.key === 'Escape') setActiveDate(null);
                    if (next !== null) {
                      event.preventDefault();
                      buttons.current[next]?.focus();
                    }
                  }}
                />
              ))}
            </div>
            {active && (
              <div
                id={`${id}-tooltip`}
                role="tooltip"
                className="wealth-chart__tooltip"
                style={{
                  left: tooltipLeft,
                  top: y(active.value) < 130 ? 140 : 12,
                }}
              >
                <span>{displayDate(active.date)}</span>
                <strong>{money(active.value)}</strong>
                <dl>
                  <div>
                    <dt>Disponível</dt>
                    <dd>
                      {active.cash === null
                        ? 'Saldo pendente'
                        : money(active.cash)}
                    </dd>
                  </div>
                  <div>
                    <dt>Investimentos</dt>
                    <dd>
                      {active.unpriced
                        ? 'Cotação pendente'
                        : money(active.investments)}
                    </dd>
                  </div>
                </dl>
                {view === 'wealth' && !active.known && (
                  <small>Inclui investimentos sem avaliação, pelo custo.</small>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {points.length === 1 && (
        <p className="wealth-chart__note">
          Seu histórico ainda está sendo construído. Novos registros mostrarão a
          evolução.
        </p>
      )}
      {points.length > 1 && first && last && (
        <p className="wealth-chart__note">
          Comparação entre os registros de {displayDate(first.date)} e{' '}
          {displayDate(last.date)}. Toque ou passe o mouse para ver os detalhes.
        </p>
      )}
      {view === 'wealth' && !current.known && (
        <p className="wealth-chart__note">
          Estimativa parcial: investimentos sem avaliação atual usam o custo de
          aquisição. Cotações são a última informação conhecida.
        </p>
      )}
    </section>
  );
}
