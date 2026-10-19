import { test, expect } from '@playwright/test';

test('cores do gráfico acompanham a árvore e o agrupamento sem mudar o total', async ({ page }) => {
  await page.goto('/');
  const total = await page.locator('.table-footer b').innerText();
  const assertColor = async (id: string) => {
    const dot = page.locator(`.activity-row[data-group-id="${id}"] .category-dot`).first();
    const color = await dot.evaluate((element) => getComputedStyle(element).backgroundColor);
    await expect(page.locator(`.chart-segment[data-series-id="${id}"]`).first()).toHaveCSS(
      'fill',
      color,
    );
    await expect(page.locator(`.chart-legend [data-series-id="${id}"] i`)).toHaveCSS(
      'background-color',
      color,
    );
  };
  await assertColor('work');
  const workColor = await page
    .locator('.activity-row[data-group-id="work"] .category-dot')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(
    page.locator('.activity-row[data-group-id="engineering"] .category-dot').first(),
  ).toHaveCSS('background-color', workColor);
  expect(
    await page
      .locator('.chart-bin')
      .evaluateAll((bins) =>
        bins.some(
          (bin) =>
            new Set([...bin.querySelectorAll('.chart-segment')].map((s) => s.getAttribute('fill')))
              .size > 1,
        ),
      ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Software', exact: true }).click();
  await assertColor('s:eberick.exe');
  await assertColor('s:chrome.exe');
  await expect(page.locator('.table-footer b')).toHaveText(total);
  await page.getByRole('button', { name: 'Projeto', exact: true }).click();
  await assertColor('p:tflm');
  await expect(page.locator('.table-footer b')).toHaveText(total);
});

test('mudar a cor de Trabalho atualiza descendentes e gráfico e persiste ao reiniciar', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.table-footer b')).toBeVisible();
  const total = await page.locator('.table-footer b').innerText();
  await page.getByRole('button', { name: 'Preferências', exact: true }).click();
  await page
    .locator('.category-settings')
    .getByRole('button', { name: 'Trabalho Editar', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Cor #DB2777', exact: true }).click();
  await dialog.getByRole('button', { name: 'Salvar categoria' }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .locator('.category-settings')
    .getByRole('button', { name: 'Trabalho › Engenharia Editar', exact: true })
    .click();
  await expect(dialog).toContainText('Cor herdada de Trabalho');
  await expect(dialog.locator('.category-dot')).toHaveCSS('background-color', 'rgb(219, 39, 119)');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.reload();
  for (const id of ['work', 'engineering']) {
    await expect(
      page.locator(`.activity-row[data-group-id="${id}"] .category-dot`).first(),
    ).toHaveCSS('background-color', 'rgb(219, 39, 119)');
  }
  await expect(page.locator('.chart-segment[data-series-id="work"]').first()).toHaveCSS(
    'fill',
    'rgb(219, 39, 119)',
  );
  await expect(page.locator('.table-footer b')).toHaveText(total);
});
