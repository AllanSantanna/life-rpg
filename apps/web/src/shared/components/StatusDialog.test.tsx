import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusDialog } from './StatusDialog';

afterEach(cleanup);
const escape = (dialog: HTMLElement) =>
  fireEvent(dialog, new Event('cancel', { cancelable: true }));

function Harness({
  busy = false,
  onClose = () => {},
}: {
  busy?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open && (
        <StatusDialog
          tone="review"
          title="Finalizar treino?"
          message="Confira os dados registrados antes de concluir."
          summary={[{ label: 'Treino', value: 'Treino A' }]}
          busy={busy}
          initialFocus="secondary"
          primary={{
            label: 'Finalizar treino',
            busyLabel: 'Finalizando…',
            onClick: () => {},
          }}
          secondary={{ label: 'Revisar', onClick: () => setOpen(false) }}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

describe('StatusDialog', () => {
  it('tem nome, descrição e resumo acessíveis e foca a ação indicada', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Finalizar treino?' });
    expect(dialog).toHaveAccessibleDescription(
      'Confira os dados registrados antes de concluir.',
    );
    expect(dialog.querySelector('dt')).toHaveTextContent('Treino');
    expect(dialog.querySelector('dd')).toHaveTextContent('Treino A');
    expect(screen.getByRole('button', { name: 'Revisar' })).toHaveFocus();
  });

  it('Escape fecha e devolve o foco ao elemento de origem', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    trigger.focus();
    fireEvent.click(trigger);
    escape(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('em andamento, bloqueia os botões e o Escape', () => {
    const onClose = vi.fn();
    render(<Harness busy onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Finalizando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revisar' })).toBeDisabled();
    escape(dialog);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('mostra erro como alerta e usa o retorno de foco quando a origem saiu da tela', () => {
    const fallback = document.createElement('button');
    document.body.append(fallback);
    const { unmount } = render(
      <StatusDialog
        tone="success"
        title="Treino importado!"
        message="O treino foi adicionado com sucesso à sua biblioteca."
        error="Falha ao gravar."
        primary={{ label: 'OK', onClick: () => {} }}
        onClose={() => {}}
        returnFocus={() => fallback}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao gravar.');
    expect(screen.getByRole('button', { name: 'OK' })).toHaveFocus();
    unmount();
    expect(fallback).toHaveFocus();
    fallback.remove();
  });
});
