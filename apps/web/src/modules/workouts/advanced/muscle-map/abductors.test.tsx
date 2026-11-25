import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MuscleMap } from '../MuscleMap';
import { starterExercises } from '../catalog';
import { libraryExercises } from '../library';
import { testSession, testSet } from '../testFixtures';
import type { TrainingPeriod } from '../calculations';
import type { WorkoutSession } from '../types';
import { metricTone, projectMuscles } from './model';
import { exerciseParticipation, reviewedExerciseIds } from './participation';

afterEach(cleanup);
beforeEach(() => vi.setSystemTime(new Date('2026-11-20T12:00:00')));

const today = '2026-11-20';
/** Sessão concluída com séries válidas e exercício real da biblioteca. */
function session(id: string, exerciseId: string, date = '2026-11-18') {
  const value = testSession(
    id,
    date,
    Array.from({ length: 3 }, (_, i) => testSet(`s${i}`, 30, 10, 'working', 2)),
  );
  const exercise = allExercises.find((e) => e.id === exerciseId);
  if (!exercise) throw new Error(`ID inexistente no catálogo: ${exerciseId}`);
  value.exercises[0]!.exercise = structuredClone(exercise);
  return value;
}
const stabilizerIds = [
  'library:bulgarian-squat',
  'library:lunge',
  'library:step-up',
] as const;
// Decisão de 25/11/2026: agachamentos bilaterais também estabilizam com abdutores.
const bilateralSquatIds = [
  'squat',
  'library:front-squat',
  'library:goblet-squat',
  'library:smith-squat',
  'library:hack-squat',
  'library:bodyweight-squat',
] as const;
const allExercises = [...starterExercises, ...libraryExercises];

function show(sessions: WorkoutSession[], period: TrainingPeriod = 'week') {
  const view = render(
    <MuscleMap sessions={sessions} today={today} period={period} />,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Esforço' }));
  return view;
}
const mode = (name: 'Esforço' | 'Recuperação') =>
  fireEvent.click(screen.getByRole('tab', { name }));
/** Caminhos reais das superfícies ABDUCTOR_* nas duas vistas. */
function abductorPaths() {
  return (['frontal', 'traseira'] as const).flatMap((view) =>
    [
      ...screen
        .getByRole('group', { name: `Mapa muscular · visão ${view}` })
        .querySelectorAll<SVGPathElement>('[data-surface^="ABDUCTOR_"]'),
    ].map((path) => ({ view, path })),
  );
}
function gradientOf(path: SVGPathElement) {
  const id = /^url\(#(.+)\)$/.exec(path.getAttribute('fill')!)![1]!;
  return document.getElementById(id)!;
}
function expectAbductors(tone: string, label: RegExp) {
  const paths = abductorPaths();
  // Duas superfícies (esquerda/direita) em cada vista.
  expect(paths.map((p) => `${p.view}:${p.path.dataset.surface}`)).toEqual([
    'frontal:ABDUCTOR_LEFT',
    'frontal:ABDUCTOR_RIGHT',
    'traseira:ABDUCTOR_LEFT',
    'traseira:ABDUCTOR_RIGHT',
  ]);
  for (const { path } of paths) {
    expect(path.dataset.group).toBe('abductors');
    expect(path.dataset.tone).toBe(tone);
    expect(path.getAttribute('aria-label')).toMatch(label);
    // O preenchimento vem do gradiente da própria superfície, com o mesmo tom.
    const gradient = gradientOf(path);
    expect(gradient).toHaveClass(`muscle-tone-${tone}`);
    expect(
      [...gradient.querySelectorAll('stop')].map((s) => s.className.baseVal),
    ).toEqual(['muscle-v2-shade', 'muscle-v2-color', 'muscle-v2-shade']);
  }
}

describe('Abdutores: participação registrada nos IDs reais do catálogo', () => {
  it('a revisão atribui os papéis esperados', () => {
    const role = (id: string) =>
      exerciseParticipation(allExercises.find((e) => e.id === id)!).find(
        (p) => p.group === 'abductors',
      )?.role;
    for (const id of [...stabilizerIds, ...bilateralSquatIds])
      expect(role(id)).toBe('stabilizer');
    // Leg press e elevação pélvica continuam sem Abdutores.
    expect(role('legpress')).toBeUndefined();
    expect(role('hipthrust')).toBeUndefined();
    expect(role('library:abductor')).toBe('primary');
    expect(reviewedExerciseIds('abductors').sort()).toEqual(
      [...bilateralSquatIds, ...stabilizerIds, 'library:abductor'].sort(),
    );
  });
});

describe('Abdutores estabilizadores no mapa renderizado', () => {
  for (const id of [...stabilizerIds, ...bilateralSquatIds])
    it(`${id}: #80565A no Esforço e verde na Recuperação, sem percentual`, () => {
      show([session('a', id)]);
      expectAbductors(
        'stabilizer',
        /Abdutores · .*: Estabilizador · participação não quantificada$/,
      );
      mode('Recuperação');
      expectAbductors(
        'recovery-stabilizer',
        /Abdutores · .*: Estabilizador · sem carga de recuperação calculada$/,
      );
      for (const { path } of abductorPaths())
        expect(path.getAttribute('aria-label')).not.toMatch(/\d+\s*%/);
    });

  it('painel e legenda descrevem o mesmo estado nos dois modos', () => {
    show([session('a', 'library:lunge')]);
    fireEvent.click(abductorPaths()[2]!.path);
    let details = screen.getByLabelText('Detalhes do músculo selecionado');
    expect(details).toHaveClass('muscle-tone-stabilizer');
    expect(
      screen
        .getByLabelText('Legenda de esforço')
        .querySelector('.muscle-tone-stabilizer'),
    ).not.toBeNull();
    mode('Recuperação');
    details = screen.getByLabelText('Detalhes do músculo selecionado');
    expect(details).toHaveClass('muscle-tone-recovery-stabilizer');
    expect(details).toHaveTextContent(
      'Este músculo participou da estabilização, mas não possui carga de recuperação estimada.',
    );
    expect(
      within(details).getByRole('img', {
        name: 'Índice estimado: não calculado, participação estabilizadora',
      }),
    ).toHaveTextContent('Não calculado');
    expect(
      screen
        .getByLabelText('Legenda de recuperação estimada')
        .querySelector('.muscle-tone-recovery-stabilizer'),
    ).not.toBeNull();
  });
});

describe('Cadeira abdutora: estímulo principal contabilizado', () => {
  it('gera Esforço e Recuperação calculados pela escala normal', () => {
    const sessions = [session('a', 'library:abductor')];
    const { summaries } = projectMuscles(sessions, Date.now(), 'week');
    expect(summaries.abductors.units).toBe(3);
    expect(summaries.abductors.effort).toBe(100);
    expect(summaries.abductors.recovery).not.toBeNull();
    show(sessions);
    expectAbductors(
      metricTone(100, 'effort'),
      /Abdutores · .*: 100% · Muito alto$/,
    );
    mode('Recuperação');
    const recovery = summaries.abductors.recovery!;
    expectAbductors(
      metricTone(recovery, 'recovery'),
      new RegExp(`Abdutores · .*: ${recovery}% · `),
    );
  });

  it('o principal tem prioridade sobre a estabilização do afundo', () => {
    show([
      session('a', 'library:lunge'),
      session('b', 'library:abductor', '2026-11-19'),
    ]);
    for (const { path } of abductorPaths())
      expect(path.dataset.tone).not.toMatch(/stabilizer|unknown/);
    mode('Recuperação');
    for (const { path } of abductorPaths())
      expect(path.dataset.tone).not.toMatch(/stabilizer|unknown/);
  });
});

describe('Abdutores sem participação ou fora da janela', () => {
  it('exercício sem Abdutores registrados mantém indeterminado e explica a identificação', () => {
    show([testSession('a', '2026-11-18', [testSet('s', 80, 8)], 'legpress')]);
    expectAbductors('unknown', /Indeterminado$/);
    fireEvent.click(abductorPaths()[0]!.path);
    expect(
      screen.getByLabelText('Detalhes do músculo selecionado'),
    ).toHaveTextContent(
      /Este grupo só é identificado nos exercícios revisados do catálogo: Agachamento.*Agachamento búlgaro, Afundo, Subida no banco e Cadeira abdutora\./,
    );
    mode('Recuperação');
    expectAbductors('unknown', /Indeterminado$/);
  });

  it('com participação na janela, a explicação de identificação não aparece', () => {
    show([session('a', 'library:step-up')]);
    fireEvent.click(abductorPaths()[0]!.path);
    expect(
      screen.getByLabelText('Detalhes do músculo selecionado'),
    ).not.toHaveTextContent('só é identificado');
  });

  it('cada modo usa sua janela', () => {
    // 20 dias: fora de 7 dias e dos 14 da Recuperação; dentro de 30 dias.
    const old = [session('a', 'library:lunge', '2026-10-31')];
    const view = show(old, 'week');
    expectAbductors('unknown', /Indeterminado$/);
    view.rerender(<MuscleMap sessions={old} today={today} period="month" />);
    expectAbductors('stabilizer', /participação não quantificada$/);
    mode('Recuperação');
    expectAbductors('unknown', /Indeterminado$/);
  });

  it('sessão em andamento não conta', () => {
    show([{ ...session('a', 'library:lunge'), status: 'in_progress' }]);
    expectAbductors('unknown', /Indeterminado$/);
  });

  it('editar e excluir a sessão atualiza as superfícies', () => {
    const value = session('a', 'library:bulgarian-squat');
    const view = show([value]);
    expectAbductors('stabilizer', /participação não quantificada$/);
    const edited = structuredClone(value);
    edited.exercises[0]!.sets = edited.exercises[0]!.sets.map((s) => ({
      ...s,
      completed: false,
    }));
    view.rerender(
      <MuscleMap sessions={[edited]} today={today} period="week" />,
    );
    expectAbductors('unknown', /Indeterminado$/);
    view.rerender(<MuscleMap sessions={[value]} today={today} period="week" />);
    expectAbductors('stabilizer', /participação não quantificada$/);
    view.rerender(<MuscleMap sessions={[]} today={today} period="week" />);
    expectAbductors('unknown', /Indeterminado$/);
  });
});

describe('cálculos e dados preservados', () => {
  it('estabilização não cria séries, carga, percentual ou gravação', () => {
    const sessions = [session('a', 'library:lunge')];
    const before = structuredClone(sessions);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    show(sessions);
    fireEvent.click(abductorPaths()[0]!.path);
    mode('Recuperação');
    expect(sessions).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    const { summaries } = projectMuscles(sessions, Date.now(), 'week');
    const abductors = summaries.abductors;
    expect([
      abductors.units,
      abductors.sets,
      abductors.volume,
      abductors.residualBurden,
    ]).toEqual([0, 0, 0, 0]);
    expect(abductors.effort).toBeNull();
    expect(abductors.recovery).toBeNull();
    expect(
      abductors.contributions.map((c) => [
        c.role,
        c.units,
        c.burden,
        c.residual,
      ]),
    ).toEqual([['stabilizer', 0, 0, 0]]);
    // Os músculos contabilizados do afundo seguem os pesos 1 e 0,5.
    expect(summaries.quadriceps.units).toBe(3);
    expect(summaries.glutes.units).toBe(1.5);
  });
});
