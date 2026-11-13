import { describe, expect, it, vi } from 'vitest';
import { createLocalStateStorage } from './localStateStorage';
import {
  createDemoPlayerState,
  isPlayerState,
  PLAYER_STORAGE_KEY,
  PLAYER_STORAGE_VERSION,
} from '../../app/playerState';

function fixture(raw: string | null = null) {
  let content = raw;
  const browser = {
    getItem: vi.fn(() => content),
    setItem: vi.fn((_key: string, value: string) => {
      content = value;
    }),
  };
  const store = createLocalStateStorage(
    PLAYER_STORAGE_KEY,
    PLAYER_STORAGE_VERSION,
    isPlayerState,
    () => browser,
  );
  return { browser, store, content: () => content };
}

describe('Armazenamento local versionado', () => {
  it('não cria nem grava dados ao ler uma chave ausente', () => {
    const { store, browser } = fixture();
    expect(store.load()).toEqual({ status: 'missing' });
    expect(browser.getItem).toHaveBeenCalledWith(PLAYER_STORAGE_KEY);
    expect(browser.setItem).not.toHaveBeenCalled();
  });
  it('salva e recupera todas as fontes de dados, sem projeções derivadas', () => {
    const { store, content } = fixture();
    const state = createDemoPlayerState();
    state.profile.name = 'Jogadora';
    state.profile.title = 'Guardiã';
    state.missionCompletion = state.missionCompletion.map((mission) => ({
      ...mission,
      completed: true,
    }));
    state.unlockedAchievementIds.push('reader');
    state.activityHistory.push({
      id: 'test',
      area: 'Conhecimento',
      daysAgo: 3,
      effort: 1,
    });
    state.preferences = { missionFilter: 'done', radarPeriod: 90 };
    expect(store.save(state)).toBe(true);
    expect(store.load()).toEqual({ status: 'loaded', data: state });
    const envelope = JSON.parse(content()!);
    expect(envelope.version).toBe(2);
    expect(envelope.data).not.toHaveProperty('dedication');
    expect(envelope.data).not.toHaveProperty('progress');
    expect(envelope.data).not.toHaveProperty('xp');
  });
  it.each([
    '{',
    'null',
    '[]',
    '42',
    '{"version":2}',
    '{"version":2,"data":{}}',
  ])('recupera com segurança o conteúdo inválido %s', (raw) => {
    const { store, content } = fixture(raw);
    expect(store.load().status).toBe('invalid');
    expect(content()).toBe(raw);
    expect(store.save(createDemoPlayerState())).toBe(true);
    expect(store.load().status).toBe('loaded');
  });
  it('preserva versões desconhecidas inclusive após tentativa de gravação', () => {
    const raw = JSON.stringify({ version: 999, data: createDemoPlayerState() });
    const { store, content, browser } = fixture(raw);
    expect(store.load().status).toBe('incompatible');
    expect(store.save(createDemoPlayerState())).toBe(false);
    expect(content()).toBe(raw);
    expect(browser.setItem).not.toHaveBeenCalled();
  });
  it('trata acesso bloqueado e falhas de leitura sem tentar sobrescrever dados', () => {
    const denied = () => {
      throw new Error('SecurityError');
    };
    const store = createLocalStateStorage(
      PLAYER_STORAGE_KEY,
      1,
      isPlayerState,
      denied,
    );
    expect(store.load().status).toBe('unavailable');
    expect(store.save(createDemoPlayerState())).toBe(false);
    const { store: unreadable, browser } = fixture(
      'dados válidos que não podem ser lidos',
    );
    browser.getItem.mockImplementation(denied);
    expect(unreadable.save(createDemoPlayerState())).toBe(false);
    expect(browser.setItem).not.toHaveBeenCalled();
  });
  it('trata falta de espaço e preserva o último salvamento válido', () => {
    const { store, browser, content } = fixture();
    const state = createDemoPlayerState();
    store.save(state);
    const previous = content();
    browser.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(
      store.save({ ...state, profile: { ...state.profile, name: 'Novo' } }),
    ).toBe(false);
    expect(content()).toBe(previous);
    expect(store.load()).toEqual({ status: 'loaded', data: state });
  });
});

describe('Validação do estado do jogador', () => {
  it('aceita estados independentes e valida as estruturas internas', () => {
    const state = createDemoPlayerState();
    const other = createDemoPlayerState();
    state.profile.name = 'Novo';
    expect(other.profile.name).toBe('Allan');
    expect(isPlayerState(state)).toBe(true);
    expect(
      isPlayerState({ ...state, profile: { ...state.profile, name: '' } }),
    ).toBe(false);
    expect(isPlayerState({ ...state, missionCompletion: [] })).toBe(false);
    expect(
      isPlayerState({
        ...state,
        missionCompletion: state.missionCompletion.map(() => ({
          id: 'water',
          completed: true,
        })),
      }),
    ).toBe(false);
    expect(
      isPlayerState({ ...state, unlockedAchievementIds: ['unknown'] }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        preferences: { radarPeriod: 8, missionFilter: 'all' },
      }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        preferences: { radarPeriod: 7, missionFilter: 'invalid' },
      }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        progressOrigin: { ...state.progressOrigin, xp: -1 },
      }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        progressOrigin: { ...state.progressOrigin, xpPerLevel: 100 },
      }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        progressOrigin: { ...state.progressOrigin, level: 0 },
      }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        activityHistory: [
          { id: 'x', area: 'Finanças', daysAgo: -1, effort: 1 },
        ],
      }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        activityHistory: [
          { id: 'x', area: 'Finanças', daysAgo: 0, effort: Infinity },
        ],
      }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        activityHistory: [{ id: 'x', area: 'Outro', daysAgo: 0, effort: 1 }],
      }),
    ).toBe(false);
    expect(
      isPlayerState({
        ...state,
        activityHistory: [state.activityHistory[0], state.activityHistory[0]],
      }),
    ).toBe(false);
    expect(isPlayerState({ ...state, activityHistory: [] })).toBe(true);
  });
});
