import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../shared/components/Icon';
import { daysBetween, displayDate } from '../records/dates';
import { money } from './calculations';
import { smoothWealthPath } from './chartModel';
import {
  filterPeriod,
  formatUnits,
  marketPeriods,
  trendOf,
  type MarketChartPoint,
  type MarketPeriod,
  type MarketView,
} from './marketChart';

/**
 * Gráfico compacto do cartão: linha simples dos últimos pregões, sem eixos.
 * A cor segue a tendência (`.wealth-chart--up/down`), como o gráfico
 * financeiro principal.
 */
export function PriceSparkline({
  points,
  ticker,
}: {
  points: readonly MarketChartPoint[];
  ticker: string;
}) {
  if (points.length < 2)
    return (
      <p className="market-sparkline market-sparkline--empty record-hint">
        Sem histórico
      </p>
    );
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const coords = points.map((point, index) => ({
    x: 2 + (index / (points.length - 1)) * 116,
    y: 4 + (1 - (point.value - low) / span) * 28,
  }));
  const trend = trendOf(points);
  return (
    <svg
      className={`market-sparkline wealth-chart--${trend}`}
      viewBox="0 0 120 36"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Cotação de ${ticker} nos últimos ${points.length} pregões: de ${money(points[0]!.value)} em ${displayDate(points[0]!.date)} a ${money(points.at(-1)!.value)} em ${displayDate(points.at(-1)!.date)}.`}
    >
      <path d={smoothWealthPath(coords)} className="wealth-chart__line" />
    </svg>
  );
}

const height = 220;
const top = 18;
const bottom = 184;

/** Gráfico detalhado com períodos, preço do ativo e valor da posição. */
export function MarketChart({
  ticker,
  price,
  position,
  positionLimitation,
  updatedAt,
}: {
  ticker: string;
  price: readonly MarketChartPoint[];
  position: readonly MarketChartPoint[];
  positionLimitation: string | null;
  updatedAt: string;
}) {
  const [view, setView] = useState<MarketView>('price');
  const [period, setPeriod] = useState<MarketPeriod>('30d');
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [width, setWidth] = useState(520);
  const container = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () =>
      setWidth(Math.max(240, element.getBoundingClientRect().width || 520));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const source = view === 'price' ? price : position;
  const points = filterPeriod(source, period);
  const all = filterPeriod(source, 'all');
  const covered =
    all[0] &&
    marketPeriods.find((item) => item.id === period)?.days !== null &&
    daysBetween(all.at(-1)!.date, all[0].date) + 1 <
      (marketPeriods.find((item) => item.id === period)?.days ?? 0);
  const trend = trendOf(points);
  const active = points.find((point) => point.date === activeDate);
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max((high - low) * 0.15, high * 0.01, 1);
  const min = low - padding;
  const max = high + padding;
  const y = (value: number) =>
    bottom - ((value - min) / (max - min)) * (bottom - top);
  const left = 12;
  const right = width - 12;
  const x = (index: number) =>
    points.length === 1
      ? (left + right) / 2
      : left + (index / (points.length - 1)) * (right - left);
  const coords = points.map((point, index) => ({
    x: x(index),
    y: y(point.value),
  }));
  const path = smoothWealthPath(coords);
  const activeIndex = points.findIndex((point) => point.date === activeDate);
  const label =
    view === 'price' ? `Preço de ${ticker}` : `Valor estimado da posição`;
  return (
    <div
      className={`wealth-chart wealth-chart--${trend} market-chart`}
      role="group"
      aria-label={`Gráfico de ${ticker}`}
    >
      <div
        className="wealth-chart__periods"
        role="group"
        aria-label={`Visualização de ${ticker}`}
      >
        <button
          type="button"
          aria-pressed={view === 'price'}
          onClick={() => {
            setView('price');
            setActiveDate(null);
          }}
        >
          Preço do ativo
        </button>
        <button
          type="button"
          aria-pressed={view === 'position'}
          onClick={() => {
            setView('position');
            setActiveDate(null);
          }}
        >
          Valor da posição
        </button>
      </div>
      <div
        className="wealth-chart__periods market-chart__periods"
        role="group"
        aria-label={`Período do gráfico de ${ticker}`}
      >
        {marketPeriods.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={period === item.id}
            onClick={() => {
              setPeriod(item.id);
              setActiveDate(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="wealth-chart__plot market-chart__plot"
        ref={container}
        onMouseLeave={() => setActiveDate(null)}
        onMouseMove={(event) => {
          if (!points.length) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const mouseX =
            ((event.clientX - rect.left) * width) / (rect.width || width);
          const nearest = coords.reduce(
            (best, point, index) =>
              Math.abs(point.x - mouseX) < Math.abs(coords[best]!.x - mouseX)
                ? index
                : best,
            0,
          );
          setActiveDate(points[nearest]!.date);
        }}
      >
        {!points.length ? (
          <div className="wealth-chart__empty">
            <Icon name="chart" size={28} />
            <p>
              {view === 'position' && positionLimitation
                ? positionLimitation
                : 'A fonte ainda não disponibilizou histórico para este ativo.'}
            </p>
          </div>
        ) : (
          <>
            <svg
              width="100%"
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${label} em reais; ${points.length} pregões de ${displayDate(points[0]!.date)} a ${displayDate(points.at(-1)!.date)}. Consulte cada ponto por toque, mouse ou teclado.`}
            >
              {[0, 1, 2].map((index) => {
                const value = min + ((max - min) * (index + 0.5)) / 3;
                return (
                  <line
                    key={index}
                    x1={left}
                    x2={right}
                    y1={y(value)}
                    y2={y(value)}
                    className="wealth-chart__grid"
                  />
                );
              })}
              {path && <path d={path} className="wealth-chart__line" />}
              {points.length === 1 && (
                <circle
                  cx={coords[0]!.x}
                  cy={coords[0]!.y}
                  r="4"
                  className="wealth-chart__dot"
                />
              )}
              {active && (
                <>
                  <line
                    x1={x(activeIndex)}
                    x2={x(activeIndex)}
                    y1={top}
                    y2={bottom}
                    className="wealth-chart__cursor"
                  />
                  <circle
                    cx={x(activeIndex)}
                    cy={y(active.value)}
                    r="5"
                    className="wealth-chart__dot"
                  />
                </>
              )}
              <text x={left} y="208" className="wealth-chart__axis">
                {displayDate(points[0]!.date)}
              </text>
              <text
                x={right}
                y="208"
                textAnchor="end"
                className="wealth-chart__axis"
              >
                {displayDate(points.at(-1)!.date)}
              </text>
            </svg>
            <div role="group" aria-label={`Pontos: ${label}`}>
              {points.map((point, index) => (
                <button
                  type="button"
                  key={point.date}
                  ref={(element) => {
                    buttons.current[index] = element;
                  }}
                  className="wealth-chart__hit"
                  style={{
                    left: `${(x(index) / width) * 100}%`,
                    top: y(point.value),
                  }}
                  aria-label={`${displayDate(point.date)}: ${view === 'price' ? 'preço' : 'posição'} ${money(point.value)}`}
                  aria-describedby={
                    active?.date === point.date ? `${id}-tooltip` : undefined
                  }
                  onFocus={() => setActiveDate(point.date)}
                  onBlur={() => setActiveDate(null)}
                  onClick={() => setActiveDate(point.date)}
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
                  left: Math.max(
                    4,
                    Math.min(width - 244, x(activeIndex) - 120),
                  ),
                  top: y(active.value) < 110 ? 120 : 8,
                }}
              >
                <span>{displayDate(active.date)}</span>
                <strong>{money(active.value)}</strong>
                <dl>
                  <div>
                    <dt>Fechamento</dt>
                    <dd>{money(active.closeCents)}</dd>
                  </div>
                  {active.units !== undefined && (
                    <div>
                      <dt>Quantidade possuída</dt>
                      <dd>{formatUnits(active.units)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </>
        )}
      </div>
      {covered && (
        <p className="wealth-chart__note">
          A fonte disponibilizou pregões somente desde{' '}
          {displayDate(all[0]!.date)}; o período escolhido mostra esse
          intervalo.
        </p>
      )}
      {view === 'position' && points.length > 0 && (
        <p className="wealth-chart__note">
          Estimativa com a quantidade possuída em cada pregão. Saltos podem vir
          de compras ou vendas, não apenas da cotação; não representa
          rentabilidade nem valor recebido.
          {positionLimitation ? ` ${positionLimitation}` : ''}
        </p>
      )}
      <p className="wealth-chart__note">
        Fechamentos diários da brapi.dev, sem negociação em tempo real.{' '}
        {updatedAt}
      </p>
    </div>
  );
}
