import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionButton } from './ActionButton';

afterEach(cleanup);

describe('ActionButton', () => {
  it('executa a ação sem submeter o formulário por padrão', () => {
    const submit = vi.fn((event) => event.preventDefault());
    const click = vi.fn();
    render(
      <form onSubmit={submit}>
        <ActionButton icon="plus" onClick={click}>
          Nova ficha
        </ActionButton>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Nova ficha' }));
    expect(click).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  it('permite submit explícito e respeita o estado desabilitado', () => {
    const submit = vi.fn((event) => event.preventDefault());
    const { rerender } = render(
      <form onSubmit={submit}>
        <ActionButton type="submit" disabled>
          Salvar
        </ActionButton>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(submit).not.toHaveBeenCalled();
    rerender(
      <form onSubmit={submit}>
        <ActionButton type="submit">Salvar</ActionButton>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it('expõe a ref nativa para restaurar o foco após uma interação', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<ActionButton ref={ref}>Importar treino</ActionButton>);
    ref.current?.focus();
    expect(
      screen.getByRole('button', { name: 'Importar treino' }),
    ).toHaveFocus();
  });
});
