import { describe, expect, it } from 'vitest';
import { createLocalStateStorage } from './localStateStorage';
import { createBackup, listBackups } from './backups';

/** Armazenamento em memória: nenhum teste toca o localStorage real. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    access: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      key: (i: number) => [...data.keys()][i] ?? null,
      get length() {
        return data.size;
      },
    },
  };
}
type Item = { n: number };
const isItem = (v: unknown): v is Item =>
  typeof v === 'object' && v !== null && typeof (v as Item).n === 'number';
const KEY = 'test:state';
function storageFor(mem: ReturnType<typeof memory>, options = {}) {
  return createLocalStateStorage<Item>(
    KEY,
    2,
    isItem,
    () => mem.access,
    (version, data) => {
      if (version === 1 && isItem(data)) return { n: data.n * 10 };
      if (version === 0) throw new Error('migração interrompida');
      return null;
    },
    options,
  );
}
const envelope = (version: number, data: unknown) =>
  JSON.stringify({ version, data });

describe('adaptador de armazenamento versionado', () => {
  it('distingue vazio, válido, inválido, incompatível e indisponível, preservando o bruto', () => {
    expect(storageFor(memory()).load()).toEqual({ status: 'missing' });
    const valid = envelope(2, { n: 1 });
    expect(storageFor(memory({ [KEY]: valid })).load()).toEqual({
      status: 'loaded',
      data: { n: 1 },
      raw: valid,
    });
    for (const raw of ['{', envelope(2, { n: 'x' }), '[]'])
      expect(storageFor(memory({ [KEY]: raw })).load()).toEqual({
        status: 'invalid',
        raw,
      });
    const future = envelope(99, { n: 1 });
    expect(storageFor(memory({ [KEY]: future })).load()).toEqual({
      status: 'incompatible',
      raw: future,
    });
    const blocked = createLocalStateStorage(KEY, 2, isItem, () => {
      throw new Error('blocked');
    });
    expect(blocked.load()).toEqual({ status: 'unavailable' });
  });

  it('migra versão antiga em memória e trata migração interrompida como protegida', () => {
    const old = envelope(1, { n: 2 });
    expect(storageFor(memory({ [KEY]: old })).load()).toEqual({
      status: 'loaded',
      data: { n: 20 },
      raw: old,
      migrated: true,
      fromVersion: 1,
    });
    const broken = envelope(0, { n: 2 });
    expect(storageFor(memory({ [KEY]: broken })).load()).toEqual({
      status: 'incompatible',
      raw: broken,
    });
  });

  it('nunca sobrescreve conteúdo inválido ou incompatível sem decisão explícita', () => {
    for (const raw of ['{', envelope(2, { n: 'x' }), envelope(99, {})]) {
      const mem = memory({ [KEY]: raw });
      const storage = storageFor(mem);
      expect(storage.save({ n: 5 })).toBe(false);
      expect(storage.write({ n: 5 }, raw)).toEqual({ status: 'protected' });
      expect(mem.data.get(KEY)).toBe(raw);
      const replaced = storage.write({ n: 5 }, raw, { replaceProtected: true });
      expect(replaced.status).toBe('saved');
    }
    // Preferências descartáveis podem optar por substituir conteúdo inválido.
    const prefs = memory({ [KEY]: '{' });
    expect(storageFor(prefs, { overwriteInvalid: true }).save({ n: 1 })).toBe(
      true,
    );
  });

  it('gravação condicional detecta alteração de outra aba e falha de escrita', () => {
    const mem = memory({ [KEY]: envelope(2, { n: 1 }) });
    const storage = storageFor(mem);
    const first = storage.load();
    const known = first.status === 'loaded' ? first.raw : null;
    mem.data.set(KEY, envelope(2, { n: 7 }));
    expect(storage.write({ n: 2 }, known)).toEqual({ status: 'conflict' });
    expect(mem.data.get(KEY)).toBe(envelope(2, { n: 7 }));
    const saved = storage.write({ n: 8 }, envelope(2, { n: 7 }));
    expect(saved).toEqual({ status: 'saved', raw: envelope(2, { n: 8 }) });
    const failing = createLocalStateStorage<Item>(KEY, 2, isItem, () => ({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    }));
    expect(failing.write({ n: 1 }, null)).toEqual({ status: 'failed' });
  });

  it('cópias de segurança são verificadas, listadas e nunca sobrescrevem outra', () => {
    const mem = memory();
    const now = new Date('2026-11-20T12:00:00.000Z');
    const a = createBackup(mem.access, KEY, 'bruto-1', now);
    const b = createBackup(mem.access, KEY, 'bruto-2', now);
    expect(a).not.toBe(b);
    expect(mem.data.get(a)).toBe('bruto-1');
    expect(mem.data.get(b)).toBe('bruto-2');
    expect(listBackups(mem.access, KEY).map((x) => x.createdAt)).toEqual([
      now.toISOString(),
      now.toISOString(),
    ]);
    const broken = {
      ...mem.access,
      setItem: () => {},
      getItem: () => null,
    };
    expect(() => createBackup(broken, KEY, 'x')).toThrow(/confirmar/);
  });
});
