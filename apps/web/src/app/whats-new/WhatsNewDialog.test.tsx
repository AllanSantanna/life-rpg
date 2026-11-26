import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsNewDialog } from './WhatsNewDialog';
import { latestRelease } from './releases';

const release = latestRelease()!;

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function renderDialog() {
  const onClose = vi.fn();
  const origin = document.createElement('button');
  origin.textContent = 'Origem';
  document.body.append(origin);
  origin.focus();
  const view = render(<WhatsNewDialog release={release} onClose={onClose} />);
  return { onClose, origin, ...view };
}

describe('WhatsNewDialog', () => {
  it('apresenta título, descrição e todas as novidades agrupadas', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Novidades da versão' });
    expect(dialog).toHaveAccessibleDescription(
      'Confira as melhorias que chegaram ao Life RPG.',
    );
    expect(screen.getByText('Atualização de novembro de 2026')).toBeVisible();
    for (const group of release.groups) {
      const section = screen.getByRole('region', { name: group.title });
      for (const item of group.items) {
        expect(section).toHaveTextContent(item.title);
        expect(section).toHaveTextContent(item.description);
      }
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(
      release.groups.reduce((total, group) => total + group.items.length, 0),
    );
  });

  it('foca “Começar a usar” ao abrir: fechar não exige leitura nem rolagem', () => {
    const { onClose } = renderDialog();
    const start = screen.getByRole('button', { name: 'Começar a usar' });
    // Foco inicial no botão de fechar: Enter ou toque fecham na hora, sem
    // leitura, rolagem ou interação com os cartões.
    expect(start).toHaveFocus();
    fireEvent.click(start);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fecha pelo ×, com nome acessível', () => {
    const { onClose } = renderDialog();
    fireEvent.click(
      screen.getByRole('button', { name: 'Fechar novidades da versão' }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fecha por Escape pelo mesmo caminho dos botões', () => {
    const { onClose } = renderDialog();
    const dialog = screen.getByRole('dialog');
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('não tem cartões interativos nem confirmação de leitura', () => {
    renderDialog();
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '',
      'Começar a usar',
    ]);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('devolve o foco à origem ao fechar', () => {
    const { origin, unmount } = renderDialog();
    expect(origin).not.toHaveFocus();
    unmount();
    expect(origin).toHaveFocus();
    origin.remove();
  });

  it('usa returnFocus quando a origem saiu da tela', () => {
    const target = document.createElement('h1');
    target.tabIndex = -1;
    document.body.append(target);
    const { unmount } = render(
      <WhatsNewDialog
        release={release}
        onClose={() => {}}
        returnFocus={() => target}
      />,
    );
    unmount();
    expect(target).toHaveFocus();
    target.remove();
  });

  it('mantém × e botão inferior fora da área rolável, com animação curta e redução de movimento', () => {
    renderDialog();
    const body = document.querySelector('.whats-new__body')!;
    expect(body.contains(screen.getByRole('button', { name: /Fechar/ }))).toBe(
      false,
    );
    expect(
      body.contains(screen.getByRole('button', { name: 'Começar a usar' })),
    ).toBe(false);
    const css = readFileSync(resolve(__dirname, 'whatsNew.css'), 'utf8');
    expect(css).toMatch(/\.whats-new__body \{[^}]*overflow-y: auto/);
    expect(css).toMatch(/animation: whats-new-in 200ms/);
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.whats-new \{\s*animation: none/,
    );
    expect(css).toMatch(/width: min\(600px, calc\(100vw - 32px\)\)/);
  });
});
