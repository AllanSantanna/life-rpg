import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ContextHelp, HelpHeading } from './ContextHelp';
import { Disclosure } from './Disclosure';

afterEach(cleanup);

describe('ContextHelp', () => {
  it('mantém a explicação oculta até o clique e abre como diálogo nomeado', () => {
    render(
      <ContextHelp title="Saldo disponível">
        <p>Dinheiro disponível na Carteira.</p>
      </ContextHelp>,
    );
    const trigger = screen.getByRole('button', {
      name: 'Ajuda sobre saldo disponível',
    });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('title');
    expect(screen.queryByText('Dinheiro disponível na Carteira.')).toBeNull();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Saldo disponível' });
    expect(dialog).toHaveTextContent('Dinheiro disponível na Carteira.');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    expect(dialog).toHaveFocus();
  });

  it('fecha por Esc e pelo botão, devolvendo o foco ao “?”', () => {
    render(
      <ContextHelp title="Orçamento" label="Ajuda sobre orçamento mensal">
        <p>Limite por categoria.</p>
      </ContextHelp>,
    );
    const trigger = screen.getByRole('button', {
      name: 'Ajuda sobre orçamento mensal',
    });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar ajuda' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    // Segundo clique no “?” também fecha.
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fecha ao clicar fora e não propaga o Esc para outros diálogos', () => {
    let outer = 0;
    render(
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape') outer += 1;
        }}
      >
        <button type="button">Fora</button>
        <ContextHelp title="Recorrências">
          <p>Movimentação prevista.</p>
        </ContextHelp>
      </div>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Ajuda sobre recorrências' }),
    );
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Ajuda sobre recorrências' }),
      {
        key: 'Escape',
      },
    );
    expect(outer).toBe(0);
    fireEvent.click(
      screen.getByRole('button', { name: 'Ajuda sobre recorrências' }),
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Fora' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fica fora do botão de abrir/fechar do Disclosure', () => {
    render(
      <Disclosure
        title="Avaliações manuais"
        help={
          <ContextHelp title="Avaliações manuais">
            <p>Valor informado.</p>
          </ContextHelp>
        }
      >
        <p>Conteúdo</p>
      </Disclosure>,
    );
    const toggle = screen.getByRole('button', { name: 'Avaliações manuais' });
    const help = screen.getByRole('button', {
      name: 'Ajuda sobre avaliações manuais',
    });
    expect(toggle.contains(help)).toBe(false);
    fireEvent.click(help);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Conteúdo')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('HelpHeading mantém o título como cabeçalho', () => {
    render(
      <HelpHeading
        id="t"
        title="Meus investimentos"
        help={<ContextHelp title="Meus investimentos">x</ContextHelp>}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Meus investimentos' }),
    ).toHaveAttribute('id', 't');
  });
});
