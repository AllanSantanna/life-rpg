import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MethodHelp } from './MethodHelp';

afterEach(cleanup);

describe('B-01: ajuda descreve a evolução temporal sem ambiguidade', () => {
  it('a carga residual cai, o índice sobe e estabilizadores não entram', () => {
    render(<MethodHelp />);
    const text = screen.getByText(
      /carga residual de cada estímulo/,
    ).textContent!;
    expect(text).toMatch(/cai pela metade a cada 48 horas/);
    expect(text).toMatch(/índice de recuperação estimada sobe com o tempo/);
    expect(text).toMatch(/estabilizadoras não entram na fórmula/);
    expect(document.body.textContent).not.toMatch(/participação decai/);
    expect(document.body.textContent).toMatch(
      /Não significa porcentagem de tecido recuperado/,
    );
  });
});
