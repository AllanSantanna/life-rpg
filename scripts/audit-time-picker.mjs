/**
 * Audita o CustomTimePicker na correção e na criação de sessões.
 * Recebe a página isolada da auditoria, já com uma sessão em andamento aberta.
 */
export async function auditTimePicker({ page, width, capture, check }) {
  const touch = width < 768;
  const press = (locator) => (touch ? locator.tap() : locator.click());
  const viewport = page.viewportSize();
  const stored = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('life-rpg:player-state')).data.records
          .advancedWorkouts,
    );
  async function openPicker(name) {
    const trigger = page.getByRole('combobox', {
      name: 'Horário do treino',
      exact: true,
    });
    await trigger.scrollIntoViewIfNeeded();
    await press(trigger);
    const dialog = page.getByRole('dialog', {
      name: 'Selecionar horário: Horário do treino',
    });
    await dialog.waitFor();
    // Aguarda a animação de abertura e o reposicionamento após a rolagem do campo.
    await page.waitForTimeout(200);
    const box = await dialog.boundingBox();
    check(
      !!box &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width + 0.5 &&
        box.y + box.height <= viewport.height + 0.5,
      `${name}-inside`,
      width,
      `Seletor de horário fora da tela: ${JSON.stringify(box)}`,
    );
    check(
      await dialog.evaluate((el) => el.matches(':modal')),
      `${name}-top-layer`,
      width,
      'Seletor fora da camada superior: pode ficar sob a navegação inferior',
    );
    check(
      await dialog.evaluate(
        (el) =>
          el.contains(document.activeElement) &&
          document.activeElement.getAttribute('role') === 'option' &&
          document.activeElement.getAttribute('aria-selected') === 'true',
      ),
      `${name}-focus`,
      width,
      'Foco inicial não está na hora selecionada',
    );
    check(
      (await page.locator('input[type="time"]').count()) === 0,
      `${name}-no-native`,
      width,
      'Ainda há input de horário nativo',
    );
    await capture(page, name, width);
    return { trigger, dialog };
  }

  // Correção: mesma sessão, mesmos exercícios, horário de início atualizado.
  const before = await stored();
  const session = before.sessions.at(-1);
  await press(
    page.getByText('Data, horário, observações e opções da sessão', {
      exact: true,
    }),
  );
  let { trigger, dialog } = await openPicker('horario-correcao');
  await press(dialog.getByRole('option', { name: '09 horas', exact: true }));
  await press(dialog.getByRole('option', { name: '30 minutos', exact: true }));
  check(
    (await page.getByRole('dialog').count()) === 0,
    'horario-correcao-close',
    width,
    'Seleção do minuto não fechou o seletor',
  );
  check(
    (await trigger.textContent()).includes('09:30'),
    'horario-correcao-value',
    width,
    'Horário escolhido não aparece no campo',
  );
  await press(page.getByRole('button', { name: 'Salvar data/hora' }));
  const after = await stored();
  const saved = after.sessions.find((s) => s.id === session.id);
  check(
    after.sessions.length === before.sessions.length &&
      saved?.startedAt?.startsWith(`${session.date}T09:30:00`) &&
      JSON.stringify(saved.exercises) === JSON.stringify(session.exercises),
    'horario-correcao-saved',
    width,
    `Correção não preservou a sessão: ${saved?.startedAt}`,
  );

  // Criação: Escape cancela e devolve o foco; digitação manual aplica HH:mm.
  await press(page.getByRole('button', { name: 'Nova sessão', exact: true }));
  ({ trigger, dialog } = await openPicker('horario-criacao'));
  const initial = await trigger.textContent();
  await page.keyboard.press('Escape');
  check(
    (await page.getByRole('dialog').count()) === 0 &&
      (await trigger.evaluate((el) => el === document.activeElement)) &&
      (await trigger.textContent()) === initial,
    'horario-criacao-escape',
    width,
    'Escape não cancelou nem devolveu o foco',
  );
  await page.keyboard.press('Enter');
  dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog
    .getByRole('textbox', { name: 'Digitar horário', exact: true })
    .fill('0745');
  await page.keyboard.press('Enter');
  check(
    (await trigger.textContent()).includes('07:45'),
    'horario-criacao-typed',
    width,
    'Digitação manual não aplicou o horário',
  );
  const pageWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  check(
    pageWidth <= viewport.width + 1,
    'horario-overflow',
    width,
    `Rolagem horizontal: ${pageWidth}`,
  );
}
