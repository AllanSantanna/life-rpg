import { describe, it, expect } from 'vitest';
import {
  createInitialPlayerState,
  isPlayerState,
  migratePlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
  type PlayerState,
} from '../../app/playerState';
import { createLocalStateStorage } from '../../shared/storage/localStateStorage';
import {
  isCharacterState,
  projectCharacter,
  reconcileCharacter,
  renameCharacter,
} from './character';
import { shiftDate } from '../records/dates';
import { blankGoal } from '../goals/templates';

const today = '2026-11-13';
const reconcile = (state: PlayerState, date = today) =>
  reconcileCharacter(state, projectCharacter(state, date));
function populated() {
  const state = createInitialPlayerState();
  for (let i = 0; i < 52; i++) {
    const date = shiftDate(today, -i);
    state.records.workouts.push({ date, trained: true });
    state.records.sleep.push({ date, hours: 8 });
    state.records.movements.push({
      id: `m${i}`,
      date,
      amountCents: 100,
      kind: 'income',
      category: 'Outros',
      description: 'Registro',
    });
  }
  state.records.books = [{ id: 'b', title: 'Livro', totalPages: 100 }];
  state.records.readings = [{ id: 'r', bookId: 'b', date: today, pages: 100 }];
  state.goals.items = [
    {
      ...blankGoal(today),
      id: 'quest',
      title: 'Uma ação',
      kind: 'completion',
      target: 1000,
      createdDate: today,
      deletedOn: null,
      pauses: [],
      revisions: [],
    },
  ];
  state.goals.updates = [
    { id: 'u', goalId: 'quest', date: today, value: 1000 },
  ];
  return state;
}
const storage = () =>
  createLocalStateStorage(
    PLAYER_STORAGE_KEY,
    PLAYER_STORAGE_VERSION,
    isPlayerState,
    () => localStorage,
    migratePlayerState,
  );

describe('perfil simples e migração sem perda de progresso', () => {
  it('valida e normaliza nome sem alterar os demais dados', () => {
    const state = populated();
    const renamed = renameCharacter(state, '  Lia da Lua  ');
    expect(renamed.profile.name).toBe('Lia da Lua');
    expect(renamed.profile.initials).toBe('LI');
    expect(renamed.records).toBe(state.records);
    expect(renamed.character).toBe(state.character);
    expect(renamed.goals).toBe(state.goals);
    expect(projectCharacter(renamed, today).progress).toEqual(
      projectCharacter(state, today).progress,
    );
    expect(() => renameCharacter(state, '   ')).toThrow();
    expect(() => renameCharacter(state, 'a'.repeat(41))).toThrow();
  });

  it('a troca de classe preserva avatar, XP, nível, conquistas e todos os outros campos', () => {
    const state = populated();
    state.records.sleep = [];
    state.records.movements = [];
    state.character.avatar = 'ranger';
    const before = structuredClone(state);
    const facts = projectCharacter(state, today);
    const next = reconcileCharacter(state, facts);
    expect(next.character.classification.current).toBe('warrior');
    expect(next.character.avatar).toBe('ranger');
    const { character: _old, ...oldData } = state;
    const { character: _next, ...nextData } = next;
    void _old;
    void _next;
    expect(nextData).toEqual(oldData);
    expect(projectCharacter(next, today).progress).toEqual(facts.progress);
    expect(projectCharacter(next, today).achievements).toEqual(
      facts.achievements,
    );
    expect(facts.progress.level).toBeGreaterThan(1);
    expect(state).toEqual(before);
    expect(reconcile(next)).toBe(next);
  });

  it('ignora demonstrações, datas futuras e registros fora dos 30 dias', () => {
    const state = createInitialPlayerState();
    state.records.workouts = [
      { date: shiftDate(today, 1), trained: true },
      ...Array.from({ length: 30 }, (_, i) => ({
        date: shiftDate(today, -30 - i),
        trained: true,
      })),
    ];
    state.activityHistory = [
      { id: 'demo', area: 'Treinos', daysAgo: 0, effort: 1 },
    ];
    const facts = projectCharacter(state, today);
    expect(facts.classification.activeDays).toBe(0);
    expect(facts.classification.state.current).toBeNull();
  });

  it('reavalia imediatamente ao editar, excluir registros e avançar o período', () => {
    let state = createInitialPlayerState();
    state.records.workouts = Array.from({ length: 12 }, (_, i) => ({
      date: shiftDate(today, -i * 2),
      trained: true,
    }));
    state = reconcile(state);
    expect(state.character.classification.current).toBe('warrior');
    state = {
      ...state,
      records: {
        ...state.records,
        workouts: [],
        sleep: Array.from({ length: 24 }, (_, i) => ({
          date: shiftDate(today, -i),
          hours: 8,
        })),
      },
    };
    state = reconcile(state);
    expect(state.character.classification.current).toBe('guardian');
    expect(state.character.classification.pending).toBeNull();
    const edited = reconcile({
      ...state,
      records: {
        ...state.records,
        sleep: state.records.sleep.map((r) => ({ ...r, hours: 1 })),
      },
    });
    expect(edited.character.classification.pending).toBeNull();
    const deleted = reconcile({
      ...state,
      records: { ...state.records, sleep: [] },
    });
    expect(deleted.character.classification.pending).toBeNull();
    expect(deleted.character.classification.current).toBeNull();
    expect(
      reconcile(state, shiftDate(today, 40)).character.classification.current,
    ).toBeNull();
    expect(
      reconcile(state, shiftDate(today, 40)).character.classification.pending,
    ).toBeNull();
  });

  it.each([3, 4])(
    'migra v%s preservando o perfil e os registros existentes',
    (version) => {
      const old = populated();
      const { character: _character, ...withoutCharacter } = old;
      void _character;
      const source = {
        ...withoutCharacter,
        goals:
          version === 3 ? { items: [], updates: [] } : withoutCharacter.goals,
      };
      const migrated = migratePlayerState(version, source)!;
      expect(migrated).toMatchObject(source);
      expect(migrated.character).toEqual(createInitialPlayerState().character);
      expect(isPlayerState(migrated)).toBe(true);
    },
  );

  it('migra v5 removendo somente campos descontinuados e preserva dados após recarga', () => {
    const old = populated();
    old.character.avatar = 'mage';
    old.character.classification = {
      current: 'warrior',
      changedOn: '2026-11-01',
      pending: { id: 'guardian', since: today },
    };
    const data = {
      ...old,
      character: {
        ...old.character,
        frame: 'gold',
        background: 'sanctuary',
        title: 'veteran',
        unlocked: ['frame:gold'],
        highestLevel: 25,
        observedFrom: today,
        events: [
          {
            id: 'class:warrior',
            date: today,
            kind: 'class',
            label: 'Guerreiro',
          },
        ],
      },
    };
    const raw = JSON.stringify({ version: 5, data });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    const loaded = storage().load();
    expect(loaded).toEqual({
      status: 'loaded',
      data: old,
      raw,
      migrated: true,
      fromVersion: 5,
    });
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
    if (loaded.status !== 'loaded') throw new Error('Migração esperada');
    expect(projectCharacter(loaded.data, today).progress).toEqual(
      projectCharacter(old, today).progress,
    );
    expect(projectCharacter(loaded.data, today).achievements).toEqual(
      projectCharacter(old, today).achievements,
    );
    expect(storage().save(loaded.data)).toBe(true);
    expect(storage().load()).toEqual({
      status: 'loaded',
      data: old,
      raw: localStorage.getItem(PLAYER_STORAGE_KEY),
    });
    expect(JSON.parse(localStorage.getItem(PLAYER_STORAGE_KEY)!).version).toBe(
      PLAYER_STORAGE_VERSION,
    );
    expect(Object.keys(loaded.data.character).sort()).toEqual([
      'avatar',
      'classification',
    ]);
  });

  it.each([5, 6])(
    'migra Aventureiro de v%s e classifica os registros existentes sem alterar progresso',
    (version) => {
      const state = populated();
      const old = {
        ...state,
        character: {
          ...state.character,
          classification: {
            current: 'adventurer',
            changedOn: null,
            pending: null,
          },
        },
      };
      localStorage.setItem(
        PLAYER_STORAGE_KEY,
        JSON.stringify({ version, data: old }),
      );
      const loaded = storage().load();
      expect(loaded.status).toBe('loaded');
      if (loaded.status !== 'loaded') throw new Error('Migração esperada');
      expect(loaded.data.character.classification.current).toBeNull();
      const next = reconcile(loaded.data);
      expect(next.character.classification.current).not.toBeNull();
      expect(next.records).toEqual(state.records);
      expect(projectCharacter(next, today).progress).toEqual(
        projectCharacter(state, today).progress,
      );
      expect(storage().save(next)).toBe(true);
      expect(storage().load()).toEqual({
        status: 'loaded',
        data: next,
        raw: localStorage.getItem(PLAYER_STORAGE_KEY),
      });
    },
  );

  it('campos cosméticos antigos inválidos não causam perda de registros na migração', () => {
    const state = populated();
    expect(
      migratePlayerState(5, {
        ...state,
        character: {
          ...state.character,
          unlocked: null,
          events: [null],
          frame: 'removed',
        },
      }),
    ).toEqual(state);
  });

  it('rejeita estruturas e classes inválidas sem sobrescrever armazenamento incompatível', () => {
    const state = populated();
    for (const changes of [
      { avatar: 'unknown' },
      { classification: {} },
      {
        classification: {
          current: 'warrior',
          changedOn: 'yesterday',
          pending: null,
        },
      },
      {
        classification: {
          current: 'warrior',
          changedOn: null,
          pending: { id: 'unknown', since: today },
        },
      },
    ]) {
      const character = { ...state.character, ...changes };
      expect(isCharacterState(character)).toBe(false);
      expect(migratePlayerState(5, { ...state, character })).toBeNull();
    }
    const raw = JSON.stringify({ version: 999, data: state });
    localStorage.setItem(PLAYER_STORAGE_KEY, raw);
    expect(storage().save(state)).toBe(false);
    expect(localStorage.getItem(PLAYER_STORAGE_KEY)).toBe(raw);
  });
});
