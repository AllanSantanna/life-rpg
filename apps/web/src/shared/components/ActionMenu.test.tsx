import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionMenu } from './ActionMenu';

afterEach(cleanup);

function setup() {
  const sell = vi.fn();
  const remove = vi.fn();
  render(
    <ActionMenu
      label="Mais ações"
      accessibleLabel="Mais ações de Bitcoin"
      items={[
        { id: 'sell', label: 'Vender', icon: 'arrow', onSelect: sell },
        {
          id: 'quote',
          label: 'Atualizar cotação',
          icon: 'chart',
          disabled: true,
          onSelect: vi.fn(),
        },
        { id: 'edit', label: 'Editar', icon: 'edit', onSelect: vi.fn() },
        {
          id: 'delete',
          label: 'Excluir',
          accessibleLabel: 'Excluir investimento Bitcoin',
          icon: 'trash',
          onSelect: remove,
        },
      ]}
    />,
  );
  return {
    trigger: screen.getByRole('button', { name: 'Mais ações de Bitcoin' }),
    sell,
    remove,
  };
}

describe('ActionMenu', () => {
  it('abre pelo teclado, percorre opções habilitadas e fecha com Tab', () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    // A opção desabilitada é ignorada.
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(items[2]!, { key: 'End' });
    expect(items[3]).toHaveFocus();
    fireEvent.keyDown(items[3]!, { key: 'ArrowDown' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: 'Home' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: 'Tab' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('executa a opção escolhida, devolve o foco e ignora opções desabilitadas', () => {
    const { trigger, sell, remove } = setup();
    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Atualizar cotação' }),
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Vender' }));
    expect(sell).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    expect(
      screen.getByRole('menuitem', { name: 'Excluir investimento Bitcoin' }),
    ).toHaveFocus();
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Excluir investimento Bitcoin' }),
    );
    expect(remove).toHaveBeenCalledOnce();
  });

  it('fecha ao clicar fora sem executar ações', () => {
    const { trigger, sell } = setup();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(sell).not.toHaveBeenCalled();
  });
});
