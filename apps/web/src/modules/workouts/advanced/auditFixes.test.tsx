import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectOption, selectTime } from '../../../test/selectOption';
import { applyAdvancedWorkoutCommand } from './commands';
import { commitWorkoutImport } from './importing/persistence';
import { projectMuscles, windowMetrics } from './muscle-map/model';
import { SessionTimingEditor } from './SessionTimingEditor';
import {
  AmbiguousTimeError,
  compareSessionsDesc,
  createSessionStart,
  currentSessionStart,
  localStartOffsets,
  withSessionTiming,
} from './sessionTiming';
import { testSession, testSet, testState } from './testFixtures';
import type { WorkoutSession } from './types';

const today = '2026-11-20';
const originalTz = process.env.TZ;
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  process.env.TZ = originalTz;
});

describe('M-01: horário futuro rejeitado em todos os caminhos', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-11-20T12:00:00')));
  const state = () => ({
    ...testState(),
    sessions: [
      {
        ...testSession('old', '2020-01-01', [testSet('a')]),
        startedAt: createSessionStart('2020-01-01', '23:59'),
      },
    ],
  });

  it('importação que leva o início ao futuro é recusada com orientação', () => {
    const current = state();
    const expected = current.sessions[0]!;
    // A importação troca a data para hoje e preserva HH:mm (23:59 > 12:00).
    const value = withSessionTiming(expected, today, '23:59');
    expect(() => commitWorkoutImport(current, value, expected, today)).toThrow(
      /início registrado \(23:59\) ficaria no futuro/,
    );
    const past = withSessionTiming(expected, today, '09:00');
    expect(
      commitWorkoutImport(current, past, expected, today).sessions[0]!
        .startedAt,
    ).toBe(past.startedAt);
  });

  it('início e correção manuais seguem a mesma regra; horário antigo não alterado continua editável', () => {
    expect(() =>
      applyAdvancedWorkoutCommand(
        testState(),
        {
          type: 'startSession',
          id: 'n',
          planId: null,
          date: today,
          startedAt: createSessionStart(today, '18:00'),
        },
        today,
      ),
    ).toThrow(/futuro/);
    const current = state();
    const session = current.sessions[0]!;
    expect(() =>
      applyAdvancedWorkoutCommand(
        current,
        {
          type: 'saveSession',
          value: withSessionTiming(session, today, '18:00'),
        },
        today,
      ),
    ).toThrow(/futuro/);
    // Sessão já gravada com início "futuro" (ex.: importação antiga) não fica
    // presa: editar outros campos mantém o horário e é aceito.
    const legacy = {
      ...current,
      sessions: [
        { ...session, date: today, startedAt: `${today}T18:00:00-03:00` },
      ],
    };
    const edited = applyAdvancedWorkoutCommand(
      legacy,
      { type: 'saveSession', value: { ...legacy.sessions[0]!, notes: 'nota' } },
      today,
    );
    expect(edited.sessions[0]!.notes).toBe('nota');
  });
});

describe('B-09: ordem pelo instante real', () => {
  it('compara deslocamentos UTC diferentes e põe sessões sem horário por último no dia', () => {
    const a = { date: today, startedAt: '2026-11-20T10:00:00-03:00' }; // 13:00Z
    const b = { date: today, startedAt: '2026-11-20T11:00:00+00:00' }; // 11:00Z
    const unknown = { date: today };
    const older = {
      date: '2026-11-19',
      startedAt: '2026-11-19T23:00:00-03:00',
    };
    expect([b, unknown, older, a].sort(compareSessionsDesc)).toEqual([
      a,
      b,
      unknown,
      older,
    ]);
  });

  it('o rastreio do mapa usa a mesma ordem', () => {
    const make = (id: string, startedAt: string): WorkoutSession => ({
      ...testSession(id, today, [testSet('s', 40, 10)], 'squat'),
      startedAt,
    });
    const { summaries } = projectMuscles(
      [
        make('A', '2026-11-20T10:00:00-03:00'),
        make('B', '2026-11-20T11:00:00+00:00'),
      ],
      Date.parse('2026-11-20T15:00:00-03:00'),
      'month',
    );
    expect(summaries.quadriceps.contributions.map((c) => c.sessionId)).toEqual([
      'A',
      'B',
    ]);
  });
});

describe('B-10: horário repetido no fim do horário de verão', () => {
  beforeEach(() => {
    process.env.TZ = 'America/New_York';
  });

  it('exige a escolha da ocorrência; horário inexistente segue recusado', () => {
    expect(localStartOffsets('2026-11-01', '01:30')).toEqual([
      '-04:00',
      '-05:00',
    ]);
    expect(() => createSessionStart('2026-11-01', '01:30')).toThrow(
      AmbiguousTimeError,
    );
    expect(createSessionStart('2026-11-01', '01:30', '-05:00')).toBe(
      '2026-11-01T01:30:00-05:00',
    );
    expect(createSessionStart('2026-11-01', '01:30', '-04:00')).toBe(
      '2026-11-01T01:30:00-04:00',
    );
    expect(localStartOffsets('2026-03-08', '02:30')).toEqual([]);
    expect(() => createSessionStart('2026-03-08', '02:30')).toThrow(
      /não existe/,
    );
    expect(createSessionStart('2026-11-02', '01:30')).toBe(
      '2026-11-02T01:30:00-05:00',
    );
    // “Agora” tem deslocamento conhecido mesmo na hora repetida.
    const second = new Date('2026-11-01T01:30:00-05:00');
    expect(currentSessionStart('2026-11-01', second)).toBe(
      '2026-11-01T01:30:00-05:00',
    );
  });

  it('a correção de sessão mostra a escolha e grava a ocorrência escolhida', () => {
    vi.setSystemTime(new Date('2026-11-05T12:00:00-05:00'));
    const session = testSession('s', '2026-11-01');
    const onSave = vi.fn(() => null);
    render(
      <SessionTimingEditor
        session={session}
        today="2026-11-05"
        onSave={onSave}
      />,
    );
    selectTime(
      screen.getByRole('combobox', { name: 'Horário do treino' }),
      '01:30',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar data/hora' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/ocorre duas vezes/);
    selectOption(
      screen.getByRole('combobox', { name: 'Ocorrência do horário' }),
      'Segunda ocorrência (UTC-05:00)',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar data/hora' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: '2026-11-01T01:30:00-05:00' }),
    );
  });
});

describe('M-02: contagens na janela de cada modo', () => {
  it('Recuperação conta os 14 dias; Esforço, o período escolhido', () => {
    const session = {
      ...testSession('s', '2026-11-10', [testSet('a'), testSet('b')], 'squat'),
      startedAt: '2026-11-10T10:00:00-03:00',
    };
    const summary = projectMuscles(
      [session],
      Date.parse('2026-11-20T12:00:00-03:00'),
      'week',
    ).summaries.quadriceps;
    expect(windowMetrics(summary, 'effort')).toEqual({
      sets: 0,
      direct: 0,
      secondary: 0,
      volume: 0,
      sessions: 0,
    });
    expect(summary.recovery).not.toBeNull();
    expect(windowMetrics(summary, 'recovery')).toEqual({
      sets: 2,
      direct: 2,
      secondary: 0,
      volume: 400, // 2 séries × 20 kg × 10 repetições
      sessions: 1,
    });
    // Adutor é secundário no agachamento: contado como secundário na janela.
    expect(
      windowMetrics(
        projectMuscles(
          [session],
          Date.parse('2026-11-20T12:00:00-03:00'),
          'week',
        ).summaries.adductors,
        'recovery',
      ),
    ).toMatchObject({ sets: 2, direct: 0, secondary: 2 });
  });
});
