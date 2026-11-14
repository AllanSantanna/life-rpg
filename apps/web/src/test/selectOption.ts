import { fireEvent, screen, within } from '@testing-library/react';

/** Seleciona pelo rótulo visível, como nas interações do usuário. */
export function selectOption(control: HTMLElement, label: string) {
  fireEvent.click(control);
  fireEvent.click(screen.getByRole('option', { name: label }));
}

/** Preenche pelo campo de digitação do calendário, mantendo os valores ISO dos testes. */
export function selectDate(control: HTMLElement, value: string) {
  fireEvent.click(control);
  const calendar = screen.getByRole('dialog');
  fireEvent.change(
    within(calendar).getByRole('textbox', { name: /^Digitar (data|mês)$/ }),
    { target: { value } },
  );
  fireEvent.click(within(calendar).getByRole('button', { name: 'Aplicar' }));
}
