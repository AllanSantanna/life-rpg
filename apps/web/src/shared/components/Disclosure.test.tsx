import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Disclosure } from './Disclosure';

afterEach(cleanup);

describe('Disclosure compartilhado', () => {
  it('começa fechado, monta o conteúdo só ao abrir e anuncia o estado', () => {
    render(
      <Disclosure
        title="Registros"
        count={6}
        level={5}
        hint={{ open: 'Ocultar detalhes', closed: 'Mostrar detalhes' }}
      >
        <p>Conteúdo</p>
      </Disclosure>,
    );
    const button = screen.getByRole('button', { name: 'Registros (6)' });
    expect(button.closest('h5')).not.toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Mostrar detalhes')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.queryByText('Conteúdo')).toBeNull();
    const region = screen.getByRole('region', { name: 'Registros (6)' });
    expect(
      document.getElementById(button.getAttribute('aria-controls')!),
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(region).toHaveTextContent('Conteúdo');
    expect(screen.getByText('Ocultar detalhes')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText('Conteúdo')).toBeNull();
  });

  it('mantém o contrato anterior sem contagem nem texto auxiliar', () => {
    render(
      <Disclosure title="Histórico" level={6} defaultOpen>
        <p>Itens</p>
      </Disclosure>,
    );
    const button = screen.getByRole('button', { name: 'Histórico' });
    expect(button.closest('h6')).not.toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Itens')).toBeInTheDocument();
  });
});
