import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityCalendar } from './ActivityCalendar';
import {
  indexActivities,
  evolutionSeries,
  pillarSummaries,
} from './aggregation';
import { EvolutionLandscape } from './EvolutionLandscape';
import { PillarCards } from './PillarCards';
import { emptyRecords } from '../records/types';
import { projectEffortActivities } from '../records/progression';
import { App } from '../../app/App';
import {
  createInitialPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';
import { projectCharacter } from '../profile/character';

afterEach(cleanup);
const today = '2026-11-13';
function fixture() {
  const records = emptyRecords();
  records.workouts = [{ date: today, trained: true }];
  records.sleep = [{ date: today, hours: 7.5 }];
  records.books = [{ id: 'b', title: 'Meditações', totalPages: 100 }];
  records.readings = [{ id: 'r', date: today, bookId: 'b', pages: 20 }];
  return records;
}

describe('Calendário e atividades reais', () => {
  it('exibe o mês completo, hoje e os detalhes somente da data selecionada', () => {
    render(
      <ActivityCalendar index={indexActivities(fixture())} today={today} />,
    );
    const calendar = within(
      screen.getByRole('region', { name: 'Calendário de Atividades' }),
    );
    expect(calendar.getAllByRole('row')).toHaveLength(5);
    expect(
      calendar.getByRole('button', { name: 'Treinos, 13/11/2026: Média' }),
    ).toHaveAttribute('aria-current', 'date');
    const details = within(
      calendar.getByRole('region', { name: 'Atividades do dia' }),
    );
    expect(details.getByText(/Meditações · 20 páginas/)).toBeInTheDocument();
    expect(details.getByText(/Sono: 7,5 h/)).toBeInTheDocument();
    fireEvent.click(
      calendar.getByRole('button', {
        name: 'Treinos, 12/11/2026: Nenhuma atividade',
      }),
    );
    expect(
      details.getByText('Nenhum registro nesta data.'),
    ).toBeInTheDocument();
    expect(details.queryByText(/Meditações/)).not.toBeInTheDocument();
  });
  it('navega meses e retorna a hoje, incluindo fevereiro bissexto', () => {
    render(
      <ActivityCalendar
        index={indexActivities(emptyRecords())}
        today="2024-02-29"
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Treinos, 29/02/2024: Nenhuma atividade',
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Próximo mês de atividades' }),
    );
    expect(
      screen.getByRole('button', {
        name: 'Finanças, 31/03/2024: Nenhuma atividade',
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Mês anterior de atividades' }),
    );
    expect(
      screen.queryByRole('button', { name: /30\/02/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(
      screen.getByRole('button', {
        name: 'Finanças, 29/02/2024: Nenhuma atividade',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  it('permite explorar datas e pilares por teclado com foco visível e intensidade rotulada', () => {
    render(
      <ActivityCalendar index={indexActivities(fixture())} today={today} />,
    );
    const original = screen.getByRole('button', {
      name: 'Finanças, 13/11/2026: Nenhuma atividade',
    });
    original.focus();
    fireEvent.keyDown(original, { key: 'ArrowLeft' });
    const previous = screen.getByRole('button', {
      name: 'Finanças, 12/11/2026: Nenhuma atividade',
    });
    expect(previous).toHaveFocus();
    fireEvent.keyDown(previous, { key: 'ArrowDown' });
    expect(
      screen.getByRole('button', {
        name: 'Treinos, 12/11/2026: Nenhuma atividade',
      }),
    ).toHaveFocus();
    expect(
      screen.getByRole('button', { name: 'Conhecimento, 13/11/2026: Alta' }),
    ).toHaveAttribute('data-intensity', '3');
  });
});

describe('Paisagem e cartões', () => {
  const activities = [
    { id: 'w', area: 'Treinos' as const, daysAgo: 0, effort: 1 },
  ];
  it('oferece fallback 2D e tabela textual com os mesmos valores sem WebGL', () => {
    render(
      <EvolutionLandscape
        series={evolutionSeries(activities, today, 7)}
        period={7}
      />,
    );
    expect(
      screen.getByRole('img', { name: /Alternativa 2D/ }),
    ).toBeInTheDocument();
    const point = screen.getByRole('status', {
      name: 'Valores da data selecionada',
    });
    expect(point).toHaveTextContent('25/100');
    expect(screen.getByText(/não oferece WebGL 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Valores acessíveis e método'));
    expect(screen.getByRole('table')).toHaveTextContent('13/11/2026');
  });
  it('alterna os três modos sem mudar dados, oculta pilares e seleciona datas por toque ou teclado', () => {
    render(
      <EvolutionLandscape
        series={evolutionSeries(activities, today, 7)}
        period={7}
      />,
    );
    for (const mode of ['Barras 3D', 'Superfície', 'Paisagem']) {
      fireEvent.click(screen.getByRole('button', { name: mode }));
      expect(screen.getByRole('button', { name: mode })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(
        screen.getByRole('status', { name: 'Valores da data selecionada' }),
      ).toHaveTextContent('25/100');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Treinos' }));
    expect(
      screen.getByRole('status', { name: 'Valores da data selecionada' }),
    ).not.toHaveTextContent('Treinos');
    fireEvent.click(screen.getByRole('button', { name: 'Treinos' }));
    expect(
      Array.from(
        screen
          .getByRole('status', { name: 'Valores da data selecionada' })
          .querySelectorAll('dt'),
        (term) => term.textContent,
      ),
    ).toEqual(['Finanças', 'Treinos', 'Descanso', 'Conhecimento']);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    expect(screen.getByRole('slider')).toHaveAttribute(
      'aria-valuetext',
      '07/11/2026',
    );
    expect(
      screen.getByRole('status', { name: 'Valores da data selecionada' }),
    ).toHaveTextContent('0/100');
    fireEvent.click(
      screen.getByRole('button', { name: 'Próxima data da paisagem' }),
    );
    expect(screen.getByRole('slider')).toHaveValue('1');
  });
  it('mantém seleção válida quando o período muda e não apresenta comparação inexistente', () => {
    const { rerender } = render(
      <EvolutionLandscape
        series={evolutionSeries(activities, today, 90)}
        period={90}
      />,
    );
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    rerender(
      <EvolutionLandscape
        series={evolutionSeries(activities, today, 7)}
        period={7}
      />,
    );
    expect(screen.getByRole('slider')).toHaveValue('6');
    expect(
      screen.getByRole('status', { name: 'Valores da data selecionada' }),
    ).toHaveTextContent('Sem comparação anterior disponível');
  });
  it('mostra quatro cartões, consistência calculada, estado vazio e acesso às rotas existentes', () => {
    const records = fixture();
    const activities = projectEffortActivities([], [], records, today);
    const onNavigate = vi.fn();
    render(
      <PillarCards
        summaries={pillarSummaries(
          indexActivities(records),
          activities,
          today,
          7,
        )}
        series={evolutionSeries(activities, today, 7)}
        period={7}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getAllByRole('article')).toHaveLength(4);
    const workouts = within(screen.getByRole('article', { name: 'Treinos' }));
    expect(workouts.getByText('1/7')).toBeInTheDocument();
    expect(workouts.getByText('14%')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Finanças' })).toHaveTextContent(
      'Sem dedicação pontuada',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalhes de Treinos' }),
    );
    expect(onNavigate).toHaveBeenCalledWith('workouts');
  });
});

describe('Página Estatísticas integrada', () => {
  it('carrega registros existentes e mantém o Radar intacto ao filtrar os novos gráficos, sem gravar ou gerar XP', () => {
    const state = createInitialPlayerState();
    state.records = fixture();
    state.character.classification = projectCharacter(
      state,
      today,
    ).classification.state;
    const raw = JSON.stringify({
      version: PLAYER_STORAGE_VERSION,
      data: state,
    });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    window.history.replaceState(null, '', '/estatisticas');
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const app = render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Sua evolução' }),
    ).toBeInTheDocument();
    const radar = screen.getByRole('region', { name: 'Radar de Evolução' });
    const before = radar.innerHTML;
    for (const period of [7, 90, 30]) {
      fireEvent.click(
        screen.getByRole('button', {
          name: `${period} dias nos novos gráficos`,
        }),
      );
      expect(radar.innerHTML).toBe(before);
      expect(
        screen.getByRole('region', { name: 'Estatísticas individuais' }),
      ).toHaveTextContent(`últimos ${period} dias`);
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Mês anterior de atividades' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Superfície' }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    app.unmount();
    render(<App />);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    expect(
      screen.getByRole('region', { name: 'Radar de Evolução' }),
    ).toHaveTextContent('25/100');
  });
});
