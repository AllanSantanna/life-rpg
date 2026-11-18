import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CustomDatePicker } from '../../shared/components/CustomDatePicker';
import { SectionHeading } from '../../shared/components/SectionHeading';
import { months, shiftMonth } from '../../shared/dates/picker';
import { areas } from '../evolution/scoring';
import { displayDate, monthDates } from '../records/dates';
import { intensityLabels } from './aggregation';
import { DayDetails } from './DayDetails';
import type { ActivityIndex } from './types';

export function ActivityCalendar({
  index,
  today,
}: {
  index: ActivityIndex;
  today: string;
}) {
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const table = useRef<HTMLTableElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dates = monthDates(month);
  const active = selected.startsWith(month) ? selected : dates[0];
  // Em telas estreitas, a data inicial do mês fica visível na rolagem local,
  // sem mover a página nem reagir a cada clique.
  useEffect(() => {
    const container = scroller.current;
    const target = month === today.slice(0, 7) ? today : `${month}-01`;
    const cell = container?.querySelector<HTMLElement>(
      `[data-date="${target}"]`,
    );
    if (!container || !cell) return;
    const sticky =
      container.querySelector<HTMLElement>('tbody th')?.offsetWidth ?? 0;
    const offset =
      cell.getBoundingClientRect().left -
      container.getBoundingClientRect().left +
      container.scrollLeft;
    container.scrollLeft = Math.max(
      0,
      offset - sticky - (container.clientWidth - sticky - cell.offsetWidth) / 2,
    );
  }, [month, today]);
  function changeMonth(next: string) {
    if (!next || monthDates(next).length === 0) return;
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  }
  function move(
    event: KeyboardEvent<HTMLButtonElement>,
    date: string,
    row: number,
  ) {
    const position = dates.indexOf(date);
    const column =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? dates.length - 1
          : position +
            (event.key === 'ArrowRight'
              ? 1
              : event.key === 'ArrowLeft'
                ? -1
                : 0);
    const nextRow =
      row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0);
    if (
      ![
        'Home',
        'End',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    const next = dates[Math.max(0, Math.min(dates.length - 1, column))];
    if (!next) return;
    setSelected(next);
    table.current
      ?.querySelector<HTMLButtonElement>(
        `[data-date="${next}"][data-row="${Math.max(0, Math.min(3, nextRow))}"]`,
      )
      ?.focus();
  }
  const title = `${months[Number(month.slice(5)) - 1]} de ${month.slice(0, 4)}`;
  return (
    <section
      className="panel statistics-calendar"
      aria-label="Calendário de Atividades"
    >
      <SectionHeading title="Calendário de Atividades" eyebrow="Cada dia conta">
        <div className="statistics-month-controls">
          <button
            type="button"
            className="filter-button"
            aria-label="Mês anterior de atividades"
            disabled={month === '0001-01'}
            onClick={() => changeMonth(shiftMonth(month, -1))}
          >
            ←
          </button>
          <CustomDatePicker
            label="Mês das atividades"
            mode="month"
            value={month}
            required
            onChange={changeMonth}
          />
          <button
            type="button"
            className="filter-button"
            aria-label="Próximo mês de atividades"
            disabled={month === '9999-12'}
            onClick={() => changeMonth(shiftMonth(month, 1))}
          >
            →
          </button>
          <button
            type="button"
            className="filter-button"
            onClick={() => changeMonth(today.slice(0, 7))}
          >
            Hoje
          </button>
        </div>
      </SectionHeading>
      <p className="statistics-copy">
        Explore seus registros de {title}. O calendário navega por meses,
        independentemente dos gráficos.
      </p>
      <div
        ref={scroller}
        className="statistics-calendar-scroll"
        role="region"
        aria-label="Dias e pilares do mês; rolagem horizontal"
        tabIndex={0}
      >
        <table ref={table} className="statistics-heatmap">
          <caption className="sr-only">
            Atividade registrada em {title}. Use as setas para explorar dias e
            pilares.
          </caption>
          <thead>
            <tr>
              <th scope="col">Pilar / dia</th>
              {dates.map((date) => (
                <th key={date} scope="col" data-today={date === today}>
                  <span aria-label={displayDate(date)}>
                    {Number(date.slice(8))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((area, row) => (
              <tr key={area} data-area={area}>
                <th scope="row">{area}</th>
                {dates.map((date) => {
                  const intensity =
                    index.get(date)?.pillars[area].intensity ?? 0;
                  return (
                    <td key={date}>
                      <button
                        type="button"
                        className="statistics-heat-cell"
                        data-intensity={intensity}
                        data-date={date}
                        data-row={row}
                        tabIndex={date === active ? 0 : -1}
                        aria-label={`${area}, ${displayDate(date)}: ${intensityLabels[intensity]}`}
                        aria-pressed={selected === date}
                        aria-current={date === today ? 'date' : undefined}
                        title={`${area} · ${displayDate(date)} · ${intensityLabels[intensity]}`}
                        onClick={() => setSelected(date)}
                        onKeyDown={(event) => move(event, date, row)}
                      >
                        <span className="statistics-heat-square" />
                        <span className="sr-only">
                          {intensityLabels[intensity]}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="statistics-calendar-legend"
        aria-label="Legenda de intensidade"
      >
        {intensityLabels.map((label, level) => (
          <span key={label} data-intensity={level}>
            <i className="statistics-heat-square" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
      <details className="statistics-method">
        <summary>Como ler as intensidades?</summary>
        <p>
          As escalas indicam atividade registrada em cada pilar e não são
          comparáveis entre pilares. Valores financeiros e quantidade de séries
          não aumentam a intensidade nem geram pontos.
        </p>
        <ul>
          <li>
            Finanças: avaliação isolada (baixa); receita, despesa ou
            transferência (média); aporte ou resgate (alta); operações de caixa
            e investimento no mesmo dia (muito alta). Posições iniciais e
            cotações não contam.
          </li>
          <li>
            Treinos: sessão em andamento (baixa); dia treinado (média); sessão
            concluída (alta); dia treinado com sessão concluída (muito alta).
            Representa completude do registro, sem recompensas extras.
          </li>
          <li>
            Descanso: abaixo de 50%, de 50% a menos de 75%, de 75% a menos de
            100% e a partir de 100% da meta pessoal de sono.
          </li>
          <li>
            Conhecimento: 1–9, 10–19, 20–39 e 40 ou mais páginas no dia. O
            volume não altera XP nem Radar.
          </li>
        </ul>
      </details>
      <DayDetails index={index} date={selected} />
    </section>
  );
}
