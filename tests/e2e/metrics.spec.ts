import { test, expect } from '@playwright/test';

test('os quatro destaques separam trabalho, AFK, pausa e procrastinação e acompanham o período', async ({
  page,
}) => {
  await page.goto('/');
  const metric = (label: string) =>
    page.locator('.metric').filter({ has: page.locator('.metric-label', { hasText: label }) });
  await expect(page.locator('.metric')).toHaveCount(4);
  await expect(metric('Tempo ativo no dia').locator('.metric-value')).toHaveText('6h 22min');
  await expect(metric('Tempo de trabalho').locator('.metric-value')).toHaveText('5h 14min');
  await expect(metric('Tempo AFK').locator('.metric-value')).toHaveText('45 min');
  await expect(metric('Tempo AFK')).toContainText('pausa separada: 15 min');
  await expect(metric('Tempo procrastinando').locator('.metric-value')).toHaveText('12 min');
  await expect(metric('Tempo ativo no dia')).toContainText('18 min sem atividade definida');
  await page.getByLabel('Período', { exact: true }).selectOption('7');
  await expect(metric('Tempo ativo no período')).toBeVisible();
  await expect(metric('Tempo ativo no período').locator('.metric-value')).not.toHaveText(
    '6h 22min',
  );
});

test('regras usam a cor herdada da árvore na lista e no editor e mudam os destaques ao reclassificar', async ({
  page,
}) => {
  await page.goto('/');
  const workColor = await page
    .locator('.activity-row[data-group-id="work"] .category-dot')
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  const personalColor = await page
    .locator('.activity-row[data-group-id="personal"] .category-dot')
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.getByRole('button', { name: 'Regras e atividades', exact: true }).click();
  const rule = page.locator('.rule-row[data-rule-id="rule-eberick"]');
  await expect(rule.locator('.category-badge')).toContainText('Trabalho › Engenharia');
  await expect(rule.locator('.category-dot')).toHaveCSS('background-color', workColor);
  await expect(page.locator('.rule-row[data-rule-id="rule-tflm"] .category-badge')).toContainText(
    'Atividade definida por outras regras',
  );
  await rule.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.category-badge .category-dot')).toHaveCSS(
    'background-color',
    workColor,
  );
  await dialog.getByLabel('Atribuir atividade').selectOption('leisure');
  await expect(dialog.locator('.category-badge')).toContainText('Pessoal');
  await expect(dialog.locator('.category-badge .category-dot')).toHaveCSS(
    'background-color',
    personalColor,
  );
  await dialog.getByRole('button', { name: 'Salvar regra' }).click();
  await expect(rule.locator('.category-dot')).toHaveCSS('background-color', personalColor);
  await page.reload();
  await expect(
    page.locator('.metric').filter({ hasText: 'Tempo de trabalho' }).locator('.metric-value'),
  ).toHaveText('1h 09min');
  await expect(
    page.locator('.metric').filter({ hasText: 'Tempo procrastinando' }).locator('.metric-value'),
  ).toHaveText('4h 17min');
  await expect(
    page.locator('.metric').filter({ hasText: 'Tempo ativo no dia' }).locator('.metric-value'),
  ).toHaveText('6h 22min');
});
