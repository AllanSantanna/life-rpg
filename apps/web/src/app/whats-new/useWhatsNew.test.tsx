import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRecordCommand } from '../../modules/records/commands';
import { createInitialPlayerState } from '../playerState';
import {
  hasPersonalHistory,
  interfaceIsBusy,
  whatsNewDecision,
} from './presentation';
import { latestRelease, releases, type Release } from './releases';
import { useWhatsNew } from './useWhatsNew';
import {
  createWhatsNewStorage,
  isNewerRelease,
  WHATS_NEW_KEY,
} from './whatsNewPreference';

const current = latestRelease()!.id;
const stored = () => localStorage.getItem(WHATS_NEW_KEY);
const seenValue = () =>
  (JSON.parse(stored() ?? 'null') as { data?: { seen?: string } } | null)?.data
    ?.seen ?? null;
const seed = (seen: string) =>
  localStorage.setItem(
    WHATS_NEW_KEY,
    JSON.stringify({ version: 1, data: { seen } }),
  );

beforeEach(() => {
  // O setup semeia uma versão posterior; aqui cada teste define a sua.
  localStorage.removeItem(WHATS_NEW_KEY);
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('whatsNewDecision', () => {
  it('mostra a usuários existentes, registra em silêncio para instalações novas', () => {
    expect(
      whatsNewDecision({ release: current, seen: null, existingUser: true }),
    ).toBe('show');
    expect(
      whatsNewDecision({ release: current, seen: null, existingUser: false }),
    ).toBe('mark');
  });
  it('uma preferência anterior prova uso: mostra a versão nova mesmo sem registros', () => {
    expect(
      whatsNewDecision({
        release: '2027-02-01',
        seen: current,
        existingUser: false,
      }),
    ).toBe('show');
  });
  it('não mostra a mesma versão de novo, nem versões anteriores à já vista', () => {
    expect(
      whatsNewDecision({ release: current, seen: current, existingUser: true }),
    ).toBe('none');
    expect(
      whatsNewDecision({
        release: current,
        seen: '9999-12-31',
        existingUser: true,
      }),
    ).toBe('none');
  });
  it('sem catálogo (atualização sem novidades), nada acontece', () => {
    expect(
      whatsNewDecision({ release: undefined, seen: null, existingUser: true }),
    ).toBe('none');
  });
  it('compara identificadores em ordem cronológica', () => {
    expect(isNewerRelease('2026-11-26', null)).toBe(true);
    expect(isNewerRelease('2026-12-01', '2026-11-26')).toBe(true);
    expect(isNewerRelease('2026-11-26', '2026-11-26')).toBe(false);
    expect(isNewerRelease('2026-11-26', '2027-01-01')).toBe(false);
  });
});

describe('hasPersonalHistory', () => {
  it('estado inicial não indica uso anterior', () => {
    expect(hasPersonalHistory(createInitialPlayerState())).toBe(false);
  });
  it('registros, nome, Quests ou meta de sono indicam uso anterior', () => {
    const base = createInitialPlayerState();
    const withSleep = {
      ...base,
      records: applyRecordCommand(
        base.records,
        { type: 'saveSleep', value: { date: '2026-11-12', hours: 7 } },
        '2026-11-13',
      ),
    };
    expect(hasPersonalHistory(withSleep)).toBe(true);
    expect(
      hasPersonalHistory({
        ...base,
        profile: { ...base.profile, name: 'Ana' },
      }),
    ).toBe(true);
    expect(
      hasPersonalHistory({
        ...base,
        records: { ...base.records, sleepGoalHours: 7 },
      }),
    ).toBe(true);
  });
  it('cotações gravadas automaticamente não contam como uso', () => {
    const base = createInitialPlayerState();
    expect(
      hasPersonalHistory({
        ...base,
        records: {
          ...base.records,
          finance: {
            accounts: [],
            transfers: [],
            valuations: [],
            quotes: [
              {
                id: 'q',
                date: '2026-11-13',
                priceCents: 1,
                source: 'manual',
              } as never,
            ],
          },
        },
      }),
    ).toBe(false);
  });
});

describe('interfaceIsBusy', () => {
  it('ocupada com modal, janela, lista, gravação ou campo em edição', () => {
    expect(interfaceIsBusy()).toBe(false);
    for (const html of [
      '<dialog open></dialog>',
      '<div role="dialog"></div>',
      '<div class="achievement-unlock"></div>',
      '<section aria-busy="true"></section>',
      '<ul role="listbox"></ul>',
    ]) {
      document.body.innerHTML = html;
      expect(interfaceIsBusy()).toBe(true);
    }
    document.body.innerHTML = '<input id="field" /><button>Ok</button>';
    document.getElementById('field')!.focus();
    expect(interfaceIsBusy()).toBe(true);
    document.querySelector('button')!.focus();
    expect(interfaceIsBusy()).toBe(false);
  });
});

describe('preferência life-rpg:whats-new', () => {
  it('guarda só o identificador, em envelope versionado; valor inválido é substituível', () => {
    const storage = createWhatsNewStorage();
    expect(storage.load().status).toBe('missing');
    storage.save({ seen: current });
    expect(JSON.parse(stored()!)).toEqual({
      version: 1,
      data: { seen: current },
    });
    localStorage.setItem(WHATS_NEW_KEY, '{"version":1,"data":{"seen":"x"}}');
    expect(storage.load().status).toBe('invalid');
    expect(storage.save({ seen: current })).toBe(true);
    expect(seenValue()).toBe(current);
  });
});

function setup(
  options: Partial<Parameters<typeof useWhatsNew>[0]> & {
    existing?: boolean;
  } = {},
) {
  vi.useFakeTimers();
  const { existing = true, ...rest } = options;
  return renderHook(
    (props: Parameters<typeof useWhatsNew>[0]) => useWhatsNew(props),
    {
      initialProps: {
        settled: true,
        existingUser: () => existing,
        blocked: false,
        ...rest,
      },
    },
  );
}

describe('useWhatsNew', () => {
  it('usuário existente: abre após o carregamento e registra só ao fechar', () => {
    const { result } = setup();
    expect(result.current.open).toBeNull();
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.open).toBe('auto');
    // Exibida, mas ainda não fechada: nada registrado.
    expect(stored()).toBeNull();
    act(() => result.current.close());
    expect(result.current.open).toBeNull();
    expect(seenValue()).toBe(current);
  });

  it('instalação nova: registra a versão sem abrir', () => {
    const { result } = setup({ existing: false });
    expect(seenValue()).toBe(current);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.open).toBeNull();
  });

  it('não decide antes de os registros estarem carregados', () => {
    const { result, rerender } = setup({ settled: false });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.open).toBeNull();
    rerender({ settled: true, existingUser: () => true, blocked: false });
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.open).toBe('auto');
  });

  it('versão já apresentada não abre de novo', () => {
    seed(current);
    const { result } = setup();
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.open).toBeNull();
    expect(seenValue()).toBe(current);
  });

  it('uma versão nova no catálogo abre para quem já viu a anterior', () => {
    seed(current);
    const next: Release = {
      id: '2027-01-15',
      groups: [
        {
          title: 'Treinos',
          items: [
            {
              id: 'x',
              title: 'Novo',
              description: 'Descrição de teste de versão futura.',
              icon: 'dumbbell',
            },
          ],
        },
      ],
    };
    const { result } = setup({
      existing: false,
      catalog: [...releases, next],
    });
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.open).toBe('auto');
    expect(result.current.release).toBe(next);
    act(() => result.current.close());
    expect(seenValue()).toBe('2027-01-15');
  });

  it('adia enquanto bloqueado ou com a interface ocupada', () => {
    const { result, rerender } = setup({ blocked: true });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.open).toBeNull();
    document.body.innerHTML = '<dialog open></dialog>';
    rerender({ settled: true, existingUser: () => true, blocked: false });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.open).toBeNull();
    document.body.replaceChildren();
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.open).toBe('auto');
  });

  it('abertura manual não regride a preferência existente', () => {
    seed('9999-12-31');
    const { result } = setup();
    act(() => result.current.openManually());
    expect(result.current.open).toBe('manual');
    act(() => result.current.close());
    expect(seenValue()).toBe('9999-12-31');
  });

  it('abertura manual de quem ainda não viu também conta como apresentada', () => {
    const { result } = setup({ blocked: true });
    act(() => result.current.openManually());
    act(() => result.current.close());
    expect(seenValue()).toBe(current);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.open).toBeNull();
  });

  it('sem armazenamento disponível, não abre automaticamente', () => {
    const storage = createWhatsNewStorage(() => {
      throw new Error('bloqueado');
    });
    const { result } = setup({ storage });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.open).toBeNull();
    act(() => result.current.openManually());
    expect(result.current.open).toBe('manual');
    act(() => result.current.close());
    expect(result.current.open).toBeNull();
  });

  it('preferência de uma versão posterior do aplicativo é preservada', () => {
    localStorage.setItem(
      WHATS_NEW_KEY,
      JSON.stringify({ version: 2, data: { seen: '2030-01-01', extra: 1 } }),
    );
    const raw = stored();
    const { result } = setup();
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.open).toBeNull();
    act(() => result.current.openManually());
    act(() => result.current.close());
    expect(stored()).toBe(raw);
  });
});
