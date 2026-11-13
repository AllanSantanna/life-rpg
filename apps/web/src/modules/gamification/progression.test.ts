import { describe, expect, it } from 'vitest';
import { projectProgress } from './progression';

describe('Projeção visual de experiência', () => {
  const initial = { level: 12, xp: 1640, xpPerLevel: 2000 };
  it('trata o limite exato de nível e conserva o excedente', () => {
    expect(projectProgress(initial, 360)).toEqual({
      level: 13,
      xp: 0,
      xpPerLevel: 2000,
    });
    expect(projectProgress(initial, 450)).toEqual({
      level: 13,
      xp: 90,
      xpPerLevel: 2000,
    });
  });
  it('remove uma recompensa sem alterar o estado inicial', () => {
    expect(projectProgress(initial, -120).xp).toBe(1520);
    expect(initial.xp).toBe(1640);
  });
});
