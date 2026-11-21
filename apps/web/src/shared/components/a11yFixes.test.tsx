import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formCents } from '../../modules/records/form';
import { Field, RecordForm } from '../../modules/records/RecordUI';
import { ConfirmAction } from './ConfirmAction';
import { CustomSelect } from './CustomSelect';

afterEach(cleanup);

describe('M-10: ConfirmAction', () => {
  it('foca Cancelar, Escape cancela e devolve o foco; confirmar executa uma vez', () => {
    const confirm = vi.fn();
    render(
      <ConfirmAction
        label="Excluir"
        ariaLabel="Excluir sono de 12/11/2026"
        detail="O registro será excluído."
        onConfirm={confirm}
      />,
    );
    const trigger = screen.getByRole('button', {
      name: 'Excluir sono de 12/11/2026',
    });
    fireEvent.click(trigger);
    expect(
      screen.getByRole('group', {
        name: 'Confirmar excluir sono de 12/11/2026',
      }),
    ).toHaveTextContent('O registro será excluído.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancelar' }), {
      key: 'Escape',
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Excluir sono de 12/11/2026' }),
    ).toHaveFocus();
    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir sono de 12/11/2026' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

describe('M-07: erros associados aos campos', () => {
  it('CustomSelect expõe descrição e estado inválido', () => {
    render(
      <>
        <p id="erro">Escolha o exercício.</p>
        <CustomSelect
          label="Exercício 1"
          value=""
          options={[{ value: '', label: 'Escolha' }]}
          describedBy="erro"
          invalid
        />
      </>,
    );
    const control = screen.getByRole('combobox', { name: 'Exercício 1' });
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAccessibleDescription(/Escolha o exercício\./);
  });

  it('RecordForm marca o campo do erro, foca e limpa na próxima tentativa válida', () => {
    const submit = vi.fn((data: FormData) => {
      formCents(data, 'amount');
      return null;
    });
    render(
      <RecordForm title="Nova despesa" onSubmit={submit}>
        <Field label="Valor (R$)">
          <input name="amount" defaultValue="12,345" />
        </Field>
        <button type="submit">Salvar</button>
      </RecordForm>,
    );
    const field = screen.getByRole('textbox', { name: 'Valor (R$)' });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Informe um valor com até duas casas decimais.',
    );
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(
      'Informe um valor com até duas casas decimais.',
    );
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: '12,34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
