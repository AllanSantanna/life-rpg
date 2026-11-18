import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it('usa o singular somente para uma unidade', () => {
    expect(plural(0, 'treino', 'treinos')).toBe('0 treinos');
    expect(plural(1, 'treino', 'treinos')).toBe('1 treino');
    expect(plural(2, 'treino', 'treinos')).toBe('2 treinos');
    expect(plural(1, 'série válida', 'séries válidas')).toBe('1 série válida');
    expect(plural(3, 'exercício', 'exercícios')).toBe('3 exercícios');
  });
  it('aceita o valor já formatado sem mudar a regra', () => {
    expect(plural(1500, 'página', 'páginas', '1.500')).toBe('1.500 páginas');
    expect(plural(1, 'página', 'páginas', '1')).toBe('1 página');
  });
});
