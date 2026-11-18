/** Cenários de Estatísticas; usa somente fixtures do navegador isolado de auditoria. */
export async function auditStatistics({ page, width, capture, check }) {
  const storage = await page.evaluate(() =>
    localStorage.getItem('life-rpg:player-state'),
  );
  const radar = await page.locator('.evolution-panel').innerHTML();
  // O dia atual deve aparecer na rolagem local do calendário, à direita da coluna fixa.
  const todayVisible = () =>
    page.locator('.statistics-calendar-scroll').evaluate((container) => {
      const cell = container.querySelector('[aria-current="date"]');
      const sticky = container.querySelector('tbody th');
      if (!cell || !sticky) return false;
      const box = container.getBoundingClientRect();
      const target = cell.getBoundingClientRect();
      return (
        target.left >= sticky.getBoundingClientRect().right - 1 &&
        target.right <= box.right + 1
      );
    });
  check(
    await todayVisible(),
    'statistics-calendar-today',
    width,
    'Dia atual fora da área visível do calendário',
  );
  for (const period of [7, 90, 30]) {
    await page
      .getByRole('button', {
        name: `${period} dias nos novos gráficos`,
        exact: true,
      })
      .click();
    check(
      (await page
        .getByRole('button', {
          name: `${period} dias nos novos gráficos`,
          exact: true,
        })
        .getAttribute('aria-pressed')) === 'true',
      'statistics-period',
      width,
      `Período ${period} não selecionado`,
    );
  }
  check(
    (await page.locator('.evolution-panel').innerHTML()) === radar,
    'statistics-radar',
    width,
    'Filtro dos novos gráficos alterou o Radar',
  );
  const scene = page.locator('.statistics-scene canvas');
  await page.locator('.statistics-scene canvas, .statistics-lines').waitFor();
  const webgl = (await scene.count()) > 0;
  for (const mode of ['Barras 3D', 'Superfície', 'Paisagem']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await capture(
      page,
      `statistics-${mode === 'Barras 3D' ? 'bars' : mode === 'Superfície' ? 'surface' : 'landscape'}`,
      width,
    );
  }
  await page.getByRole('button', { name: 'Treinos', exact: true }).click();
  check(
    (await page
      .getByRole('button', { name: 'Treinos', exact: true })
      .getAttribute('aria-pressed')) === 'false',
    'statistics-layers',
    width,
    'Pilar não foi desativado',
  );
  await page.getByRole('button', { name: 'Treinos', exact: true }).click();
  await page.getByRole('slider').fill('0');
  check(
    (await page.getByRole('slider').inputValue()) === '0',
    'statistics-selection',
    width,
    'Seleção de data falhou',
  );
  await page.getByRole('button', { name: 'Próxima data da paisagem' }).click();
  check(
    (await page.getByRole('slider').inputValue()) === '1',
    'statistics-selection',
    width,
    'Navegação por data falhou',
  );
  if (webgl) {
    await scene.scrollIntoViewIfNeeded();
    const before = await scene.screenshot();
    await page.getByRole('button', { name: 'Girar câmera à esquerda' }).click();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const after = await scene.screenshot();
    check(
      !before.equals(after),
      'statistics-camera',
      width,
      'Câmera não alterou a imagem',
    );
    await scene.scrollIntoViewIfNeeded();
    const rect = await scene.boundingBox();
    if (!rect) throw new Error('Canvas 3D sem área renderizada');
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const beforeDrag = await scene.screenshot();
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 45, center.y + 20, { steps: 8 });
    await page.mouse.up();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    check(
      !beforeDrag.equals(await scene.screenshot()),
      'statistics-drag',
      width,
      'Arrastar não girou a câmera',
    );
    const beforeZoom = await scene.screenshot();
    await page.mouse.wheel(0, -100);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    check(
      !beforeZoom.equals(await scene.screenshot()),
      'statistics-wheel',
      width,
      'Roda do mouse não aproximou a câmera',
    );
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 2,
    });
    const beforePinch = await scene.screenshot();
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: center.x - 20, y: center.y, id: 1 },
        { x: center.x + 20, y: center.y, id: 2 },
      ],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: center.x - 40, y: center.y, id: 1 },
        { x: center.x + 40, y: center.y, id: 2 },
      ],
    });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    check(
      !beforePinch.equals(await scene.screenshot()),
      'statistics-pinch',
      width,
      'Pinça não aproximou a câmera',
    );
    await session.send('Emulation.setTouchEmulationEnabled', {
      enabled: false,
    });
    await session.detach();
    await page
      .getByRole('button', { name: 'Restaurar câmera', exact: true })
      .click();
    await page.getByRole('slider').fill('29');
    await scene.scrollIntoViewIfNeeded();
    const hitArea = await scene.boundingBox();
    let picked = false;
    if (hitArea) {
      for (const vertical of [0.4, 0.55, 0.7, 0.3, 0.8]) {
        for (const horizontal of [0.35, 0.5, 0.65]) {
          await page.mouse.click(
            hitArea.x + hitArea.width * horizontal,
            hitArea.y + hitArea.height * vertical,
          );
          if ((await page.getByRole('slider').inputValue()) !== '29') {
            picked = true;
            break;
          }
        }
        if (picked) break;
      }
    }
    check(
      picked,
      'statistics-raycasting',
      width,
      'Clique na superfície não selecionou uma data',
    );
    await capture(page, 'statistics-3d-selection', width);
    // Perda de contexto deve preservar controles, valores e seleção na alternativa 2D.
    await scene.evaluate((canvas) =>
      canvas
        .getContext('webgl2')
        ?.getExtension('WEBGL_lose_context')
        ?.loseContext(),
    );
    await page.locator('.statistics-lines').waitFor();
  }
  console.log(
    `statistics-renderer ${width}: ${webgl ? 'WebGL + fallback por perda de contexto' : 'fallback 2D (WebGL indisponível no ambiente)'}`,
  );
  await capture(page, 'statistics-fallback', width);
  await page
    .getByRole('button', {
      name: 'Conhecimento, 17/11/2026: Muito alta',
      exact: true,
    })
    .click();
  check(
    await page
      .getByRole('region', { name: 'Atividades do dia', exact: true })
      .textContent()
      .then(
        (text) => text.includes('130 páginas') || text.includes('30 páginas'),
      ),
    'statistics-day',
    width,
    'Detalhes do dia não mostram leituras reais',
  );
  await capture(page, 'statistics-daily-details', width);
  const cell = page.getByRole('button', {
    name: 'Finanças, 17/11/2026: Muito alta',
    exact: true,
  });
  await cell.focus();
  await cell.press('ArrowLeft');
  check(
    await page
      .getByRole('button', {
        name: 'Finanças, 16/11/2026: Nenhuma atividade',
        exact: true,
      })
      .evaluate((element) => document.activeElement === element),
    'statistics-keyboard',
    width,
    'Foco por teclado não acompanhou o dia',
  );
  await page
    .getByRole('button', { name: 'Mês anterior de atividades', exact: true })
    .click();
  check(
    await page
      .getByRole('region', { name: 'Atividades do dia', exact: true })
      .textContent()
      .then((text) => text.includes('Nenhum registro nesta data.')),
    'statistics-empty-day',
    width,
    'Dia vazio deve indicar ausência de registros',
  );
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  check(
    await todayVisible(),
    'statistics-calendar-today',
    width,
    'Botão Hoje não trouxe o dia atual para a área visível',
  );
  check(
    (await page.evaluate(() =>
      localStorage.getItem('life-rpg:player-state'),
    )) === storage,
    'statistics-storage',
    width,
    'Explorar Estatísticas modificou o estado persistido',
  );
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'statistics-overflow',
    width,
    'Página possui rolagem horizontal indevida',
  );
}
