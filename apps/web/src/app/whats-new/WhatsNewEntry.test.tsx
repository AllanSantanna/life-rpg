import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsNewEntry } from './WhatsNewEntry';

afterEach(cleanup);

describe('WhatsNewEntry', () => {
  it('é uma seção discreta com botão secundário que abre a janela', () => {
    const onOpen = vi.fn();
    render(<WhatsNewEntry onOpen={onOpen} />);
    const section = screen.getByRole('region', { name: 'Novidades da versão' });
    const button = screen.getByRole('button', { name: 'Ver novidades' });
    expect(section).toContainElement(button);
    expect(button).toHaveClass('filter-button');
    expect(button).not.toHaveClass('action-button');
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
