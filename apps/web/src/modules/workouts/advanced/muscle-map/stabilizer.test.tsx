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
import { libraryExercises } from '../library';
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

  it('a seleção funciona com mouse, toque e teclado no estado estabilizador', () => {
    renderMap([squat('a')]);
    const [first, second] = regions('core');
    fireEvent.click(first!);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerDown(second!, { pointerType: 'touch' });
    fireEvent.click(second!);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    const lower = regions('lowerBack')[0]!;
    lower.focus();
    fireEvent.keyDown(lower, { key: 'Enter' });
    expect(lower).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(first!, { key: ' ' });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByLabelText('Detalhes do músculo selecionado'),
    ).toHaveClass('muscle-tone-stabilizer');
  });
});

describe('participação somente estabilizadora na Recuperação estimada', () => {
  function recovery(sessions: WorkoutSession[]) {
    const view = renderMap(sessions);
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    return view;
  }

  it('usa o verde existente, sem cor nova nem percentual', () => {
    const css = read('./muscle-map.css');
    expect(css).toMatch(
      /\.muscle-tone-recovery-stabilizer\s*\{\s*--muscle-color:\s*var\(--color-muscle-ready\);\s*\}/,
    );
    recovery([squat('a')]);
    for (const path of [...regions('core'), ...regions('lowerBack')]) {
      expect(path.dataset.tone).toBe('recovery-stabilizer');
      expect(path.getAttribute('aria-label')).toMatch(
        /Estabilizador · sem carga de recuperação calculada$/,
      );
      expect(path.getAttribute('aria-label')).not.toMatch(/\d+\s*%/);
    }
  });

  it('o painel explica que o valor não foi calculado e que o verde não é medição', () => {
    recovery([squat('a')]);
    fireEvent.click(regions('core')[0]!);
    const details = screen.getByLabelText('Detalhes do músculo selecionado');
    expect(details).toHaveClass('muscle-tone-recovery-stabilizer');
    const gauge = within(details).getByRole('img', {
      name: 'Índice estimado: não calculado, participação estabilizadora',
    });
    expect(gauge).toHaveTextContent('—');
    expect(gauge).toHaveTextContent('Não calculado');
    expect(gauge).not.toHaveTextContent(/\d+%/);
    expect(
      within(details).getByRole('heading', {
        name: 'Participação estabilizadora',
      }),
    ).toBeInTheDocument();
    expect(details).toHaveTextContent(
      'Este músculo participou da estabilização, mas não possui carga de recuperação estimada.',
    );
    expect(details).toHaveTextContent(
      'O verde é uma convenção visual e não indica recuperação medida.',
    );
  });

  it('a legenda indica o estado com o verde existente e o diferencia da recuperação medida', () => {
    recovery([squat('a')]);
    const legend = screen.getByLabelText('Legenda de recuperação estimada');
    const items = within(legend).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Estimativa alta≥ 90%',
      'Intermediária70–89%',
      'Baixa50–69%',
      'Muito baixa< 50%',
      'EstabilizadorSem carga calculada · não é recuperação medida',
      'IndeterminadoSem dados suficientes',
    ]);
    expect(
      items[4]!.querySelector(
        '.muscle-v2-swatch.muscle-tone-recovery-stabilizer',
      ),
    ).not.toBeNull();
    expect(legend.querySelector('.muscle-tone-stabilizer')).toBeNull();
  });

  it('estímulo contabilizado mantém a escala normal; sem participação fica cinza', () => {
    recovery([squat('a'), testSession('b', '2026-11-19', sets(3), 'crunch')]);
    for (const path of regions('core')) {
      expect(path.dataset.tone).not.toMatch(/stabilizer/);
      expect(path.getAttribute('aria-label')).toMatch(/\d+% · /);
    }
    for (const path of regions('quadriceps'))
      expect(path.getAttribute('aria-label')).toMatch(/\d+% · /);
    for (const path of regions('chest')) {
      expect(path.dataset.tone).toBe('unknown');
      expect(path.getAttribute('aria-label')).toMatch(/Indeterminado$/);
    }
  });

  it('secundário na janela mantém a escala normal (lombar no terra)', () => {
    recovery([squat('a'), testSession('b', '2026-11-19', sets(3), 'deadlift')]);
    for (const path of regions('lowerBack'))
      expect(path.dataset.tone).not.toMatch(/stabilizer/);
  });

  it('respeita a janela de 14 dias, independente do período do Esforço', () => {
    // 20 dias atrás: dentro de 30 dias (Esforço), fora dos 14 da Recuperação.
    const old = [squat('a', '2026-10-31')];
    const view = renderMap(old, 'week');
    view.rerender(<MuscleMap sessions={old} today={today} period="month" />);
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('stabilizer');
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('unknown');
  });

  it('atualiza ao editar e excluir o treino', () => {
    const view = recovery([squat('a')]);
    for (const path of regions('core'))
      expect(path.dataset.tone).toBe('recovery-stabilizer');
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
});

/** Sessão com exercício da biblioteca (snapshot real do catálogo). */
function librarySession(id: string, exerciseId: string, date = '2026-11-18') {
  const session = testSession(id, date, sets(3));
  session.exercises[0]!.exercise = structuredClone(
    libraryExercises.find((e) => e.id === exerciseId)!,
  );
  return session;
}

describe('Abdutores como estabilizadores', () => {
  // Mapeamento existente: búlgaro e afundo (abdutores e adutores), subida no banco.
  for (const exerciseId of [
    'library:bulgarian-squat',
    'library:lunge',
    'library:step-up',
  ])
    it(`${exerciseId}: Abdutores estabilizadores nas vistas frontal e traseira`, () => {
      renderMap([librarySession('a', exerciseId)]);
      const abductors = regions('abductors');
      const views = new Set(
        abductors.map((p) =>
          p.closest('[role="group"]')!.getAttribute('aria-label'),
        ),
      );
      expect(views).toEqual(
        new Set([
          'Mapa muscular · visão frontal',
          'Mapa muscular · visão traseira',
        ]),
      );
      for (const path of abductors) {
        expect(path.dataset.tone).toBe('stabilizer');
        expect(path.getAttribute('aria-label')).toMatch(
          /Abdutores · .*: Estabilizador · participação não quantificada$/,
        );
      }
      const { summaries } = projectMuscles(
        [librarySession('a', exerciseId)],
        Date.now(),
        'week',
      );
      expect(summaries.abductors.units).toBe(0);
      expect(summaries.abductors.effort).toBeNull();
      expect(summaries.abductors.recovery).toBeNull();
    });

  it('regressão: afundo unilateral colore Abdutores nos dois modos e nas duas vistas', () => {
    const lunge = librarySession('a', 'library:lunge');
    // O mapeamento registra os Abdutores como estabilizadores do afundo.
    renderMap([lunge]);
    const effort = regions('abductors');
    expect(effort.length).toBeGreaterThanOrEqual(4);
    for (const path of effort) expect(path.dataset.tone).toBe('stabilizer');
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    for (const path of regions('abductors')) {
      expect(path.dataset.tone).toBe('recovery-stabilizer');
      expect(path.getAttribute('aria-label')).not.toMatch(/\d+\s*%/);
    }
    // Sessão em andamento não entra na projeção: nada é colorido.
    cleanup();
    renderMap([{ ...lunge, status: 'in_progress' }]);
    for (const path of regions('abductors'))
      expect(path.dataset.tone).toBe('unknown');
  });

  it('agachamento livre também colore Abdutores como estabilizadores', () => {
    renderMap([squat('a')]);
    for (const path of regions('abductors'))
      expect(path.dataset.tone).toBe('stabilizer');
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    for (const path of regions('abductors'))
      expect(path.dataset.tone).toBe('recovery-stabilizer');
  });

  it('exercício sem Abdutores mapeados não os colore (leg press)', () => {
    renderMap([testSession('a', '2026-11-18', sets(3), 'legpress')]);
    for (const path of regions('abductors'))
      expect(path.dataset.tone).toBe('unknown');
    fireEvent.click(screen.getByRole('tab', { name: 'Recuperação' }));
    for (const path of regions('abductors'))
      expect(path.dataset.tone).toBe('unknown');
  });

  it('cadeira abdutora (principal) tem prioridade sobre a estabilização', () => {
    renderMap([
      librarySession('a', 'library:bulgarian-squat'),
      librarySession('b', 'library:abductor', '2026-11-19'),
    ]);
    for (const path of regions('abductors')) {
      expect(path.dataset.tone).not.toBe('stabilizer');
      expect(path.getAttribute('aria-label')).toMatch(/\d+% · /);
    }
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
      expect(stabilizerOnly(summary, 'recovery')).toBe(true);
      expect(muscleTone(summary, 'effort')).toBe('stabilizer');
      expect(muscleTone(summary, 'recovery')).toBe('recovery-stabilizer');
      // O estado visual não altera os valores calculados.
      expect(summary.recovery).toBeNull();
      expect(summary.contributions.every((c) => c.residual === 0)).toBe(true);
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
    expect(muscleTone(undefined, 'recovery')).toBe('unknown');
    expect(muscleTone(summaries.chest, 'recovery')).toBe('unknown');
    // Quadríceps com estímulo: escala normal da Recuperação.
    expect(muscleTone(summaries.quadriceps, 'recovery')).toBe(
      metricTone(summaries.quadriceps.recovery, 'recovery'),
    );
  });
});
