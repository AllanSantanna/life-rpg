import { readFileSync } from 'node:fs';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MuscleMap } from '../MuscleMap';
import { testSession, testSet } from '../testFixtures';
import type { WorkoutSession } from '../types';
import {
  metricTone,
  muscleTone,
  projectMuscles,
  stabilizerOnly,
  windowMetrics,
} from './model';

afterEach(cleanup);
beforeEach(() => vi.setSystemTime(new Date('2026-11-20T12:00:00')));

const read = (path: string) =>
  readFileSync(
    decodeURIComponent(new URL(path, import.meta.url).pathname),
    'utf8',
  );
const today = '2026-11-20';
const sets = (n: number) =>
  Array.from({ length: n }, (_, i) => testSet(`s${i}`, 60, 8, 'working', 2));
// Agachamento: quadríceps principal; glúteos/adutores secundários;
// abdômen e lombar somente estabilizadores (revisão de participation.ts).
const squat = (id: string, date = '2026-11-18') =>
  testSession(id, date, sets(4), 'squat');
const front = () =>
  screen.getByRole('group', { name: 'Mapa muscular · visão frontal' });
const back = () =>
  screen.getByRole('group', { name: 'Mapa muscular · visão traseira' });
const regions = (group: string) =>
  [front(), back()].flatMap((view) => [
    ...view.querySelectorAll<SVGPathElement>(`[data-group="${group}"]`),
  ]);

function renderMap(sessions: WorkoutSession[], period = 'week' as const) {
  const view = render(
    <MuscleMap sessions={sessions} today={today} period={period} />,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Esforço' }));
  return view;
}

describe('participação somente estabilizadora no Esforço relativo', () => {
  it('usa o token aprovado #80565A, exclusivo do novo estado', () => {
    const theme = read('../../../../shared/styles/index.css');
    const css = read('./muscle-map.css');
    expect(theme).toMatch(/--color-muscle-stabilizer:\s*#80565a;/i);
    expect(css).toMatch(
      /\.muscle-tone-stabilizer\s*\{\s*--muscle-color:\s*var\(--color-muscle-stabilizer\);\s*\}/,
    );
    // Nenhuma outra classe de tom reutiliza a cor do estabilizador.
    expect(css.match(/var\(--color-muscle-stabilizer\)/g)).toHaveLength(1);
  });

  it('marca o músculo somente estabilizador nas vistas frontal e traseira', () => {
    renderMap([squat('a')]);
    const core = regions('core');
    const lowerBack = regions('lowerBack');
    expect(core.length).toBeGreaterThan(0);
    expect(lowerBack.length).toBeGreaterThan(0);
    for (const path of [...core, ...lowerBack]) {
      expect(path.dataset.tone).toBe('stabilizer');
      expect(path.getAttribute('aria-label')).toMatch(
        /Estabilizador · participação não quantificada$/,
      );
    }
    // Mesmo gradiente/cor nas duas vistas para o mesmo grupo.
    const tones = new Set(
      [...core, ...lowerBack].map((p) => {
        const id = /^url\(#(.+)\)$/.exec(p.getAttribute('fill')!)![1]!;
        return document.getElementById(id)!.getAttribute('class');
      }),
    );
    expect([...tones]).toEqual(['muscle-tone-stabilizer']);
  });

  it('não cria percentual para a participação estabilizadora', () => {
    renderMap([squat('a')]);
    for (const path of [...regions('core'), ...regions('lowerBack')])
      expect(path.getAttribute('aria-label')).not.toMatch(/\d+\s*%/);
    const region = regions('core')[0]!;
    fireEvent.click(region);
    const details = screen.getByLabelText('Detalhes do músculo selecionado');
    expect(
      within(details).getByRole('img', {
        name: 'Esforço relativo: não quantificado, participação estabilizadora',
      }),
    ).toHaveTextContent('—');
    expect(details).toHaveClass('muscle-tone-stabilizer');
    expect(
      within(details).getByRole('heading', {
        name: 'Participação estabilizadora',
      }),
    ).toBeInTheDocument();
    expect(details).toHaveTextContent(
      'Este músculo participou da estabilização durante o exercício, mas não recebeu séries equivalentes no cálculo de esforço.',
    );
    // A lista de exercícios estabilizadores continua disponível.
    expect(
      within(details).getByRole('button', {
        name: /Participação estabilizadora · não contabilizada/,
      }),
    ).toBeInTheDocument();
    // Lista de grupos: mesmo tom e zero séries válidas.
    const item = screen.getByRole('button', { name: /^Abdômen/ });
    expect(item.querySelector('.muscle-v2-dot')).toHaveClass(
      'muscle-tone-stabilizer',
    );
    expect(item).toHaveTextContent(/0$/);
  });

  it('dá prioridade à escala normal quando há estímulo principal', () => {
    // Abdominal: abdômen principal no mesmo período.
    renderMap([squat('a'), testSession('b', '2026-11-19', sets(3), 'crunch')]);
    for (const path of regions('core')) {
      expect(path.dataset.tone).not.toBe('stabilizer');
      expect(path.getAttribute('aria-label')).toMatch(/\d+% · /);
    }
  });

  it('dá prioridade à escala normal quando há estímulo secundário', () => {
    // Levantamento terra: lombar secundária no mesmo período.
    renderMap([
      squat('a'),
      testSession('b', '2026-11-19', sets(3), 'deadlift'),
    ]);
    for (const path of regions('lowerBack')) {
      expect(path.dataset.tone).not.toBe('stabilizer');
      expect(path.getAttribute('aria-label')).toMatch(/\d+% · /);
    }
  });

  it('mantém indeterminado o músculo sem participação', () => {
    renderMap([squat('a')]);
    for (const path of regions('calves'))
      expect(path.dataset.tone).toBe('unknown');
    for (const path of regions('chest'))
      expect(path.getAttribute('aria-label')).toMatch(/Indeterminado$/);
  });

  it('acompanha o período selecionado', () => {
    // Agachamento há 20 dias: fora de 7 dias, dentro de 30.
    const sessions = [squat('a', '2026-10-31')];
    const view = renderMap(sessions, 'week');
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('unknown');
    view.rerender(
      <MuscleMap sessions={sessions} today={today} period="month" />,
    );
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('stabilizer');
  });

  it('atualiza após criar, editar e excluir treinos', () => {
    const view = renderMap([]);
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('unknown');
    view.rerender(
      <MuscleMap sessions={[squat('a')]} today={today} period="week" />,
    );
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('stabilizer');
    const edited = squat('a');
    edited.exercises[0]!.sets = edited.exercises[0]!.sets.map((s) => ({
      ...s,
      completed: false,
    }));
    view.rerender(
      <MuscleMap sessions={[edited]} today={today} period="week" />,
    );
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('unknown');
    view.rerender(<MuscleMap sessions={[]} today={today} period="week" />);
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('unknown');
  });

  it('não altera a Recuperação estimada', () => {
    renderMap([squat('a')]);
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    for (const path of [...regions('core'), ...regions('lowerBack')]) {
      expect(path.dataset.tone).toBe('unknown');
      // Sem estímulo contabilizado: nada de 100% como medição.
      expect(path.getAttribute('aria-label')).toMatch(/Indeterminado$/);
    }
    const legend = screen.getByLabelText('Legenda de recuperação estimada');
    expect(legend.querySelector('.muscle-tone-stabilizer')).toBeNull();
  });
});

describe('cálculos preservados', () => {
  it('estabilizador continua sem séries equivalentes, carga ou recuperação', () => {
    const { summaries } = projectMuscles([squat('a')], Date.now(), 'week');
    for (const group of ['core', 'lowerBack'] as const) {
      const summary = summaries[group];
      expect(summary.effort).toBeNull();
      expect(summary.recovery).toBeNull();
      expect(summary.units).toBe(0);
      expect(summary.sets).toBe(0);
      expect(summary.volume).toBe(0);
      expect(summary.residualBurden).toBe(0);
      expect(windowMetrics(summary, 'effort').sets).toBe(0);
      expect(
        summary.contributions.every(
          (c) => c.role === 'stabilizer' && c.units === 0 && c.burden === 0,
        ),
      ).toBe(true);
      expect(stabilizerOnly(summary)).toBe(true);
      expect(muscleTone(summary, 'effort')).toBe('stabilizer');
      expect(muscleTone(summary, 'recovery')).toBe('unknown');
    }
    // Principal e secundários mantêm os mesmos valores e faixas.
    expect(summaries.quadriceps.units).toBe(4);
    expect(summaries.glutes.units).toBe(2);
    expect(summaries.quadriceps.effort).toBe(100);
    expect(summaries.glutes.effort).toBe(50);
    expect(muscleTone(summaries.quadriceps, 'effort')).toBe(
      metricTone(100, 'effort'),
    );
    expect(muscleTone(summaries.glutes, 'effort')).toBe('high');
  });

  it('não cria o estado para grupos sem participação nem para resumos ausentes', () => {
    const { summaries } = projectMuscles([squat('a')], Date.now(), 'week');
    expect(stabilizerOnly(summaries.chest)).toBe(false);
    expect(stabilizerOnly(undefined)).toBe(false);
    expect(muscleTone(undefined, 'effort')).toBe('unknown');
  });
});
