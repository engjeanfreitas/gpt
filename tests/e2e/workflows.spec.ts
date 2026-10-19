import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu tempo, com clareza.' })).toBeVisible();
});

test('alterna agrupamentos preservando o total e organiza três horas do TFLM', async ({ page }) => {
  const total = await page.locator('.table-footer b').innerText();
  await page.getByRole('button', { name: 'Projeto', exact: true }).click();
  await expect(page.locator('.table-footer b')).toHaveText(total);
  await expect(
    page.locator('.row-name-button').filter({ hasText: 'Estrutural TFLM' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Software', exact: true }).click();
  await expect(page.locator('.table-footer b')).toHaveText(total);
  await page.getByRole('button', { name: 'Expandir Eberick' }).click();
  const tflm = page.locator('.activity-row').filter({ hasText: 'Estrutural TFLM' }).first();
  await expect(tflm.locator('.row-time')).toHaveText('3h');
  await tflm.locator('.row-name-button').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Projeto', { exact: true }).selectOption('aurora');
  await dialog.getByRole('button', { name: 'Aplicar aos intervalos' }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Projeto', exact: true }).click();
  const aurora = page.locator('.activity-row').filter({ hasText: 'Residencial Aurora' }).first();
  await expect(aurora.locator('.row-time')).toHaveText('4h 05min');
  await expect(page.locator('.table-footer b')).toHaveText(total);
});

test('cria projeto, seleciona o contexto e preserva ao recarregar', async ({ page }) => {
  await page.getByRole('button', { name: 'Projetos', exact: true }).click();
  await page.getByRole('button', { name: 'Novo projeto', exact: true }).last().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do projeto').fill('Edifício Horizonte');
  await dialog.getByLabel('Cliente ou descrição').fill('Engenharia');
  await dialog.getByLabel('Estimativa de horas').fill('20');
  await dialog.getByLabel('Softwares da sessão').fill('eberick.exe, excel.exe');
  await dialog.getByRole('button', { name: 'Salvar projeto' }).click();
  const card = page.locator('.project-card').filter({ hasText: 'Edifício Horizonte' });
  await card.getByRole('button', { name: 'Trabalhar neste' }).click();
  await expect(card.getByText('Projeto atual', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Projeto atual')).not.toHaveValue('tflm');
  await expect(page.getByLabel('Projeto atual').locator('option:checked')).toHaveText(
    'Edifício Horizonte',
  );
});

test('pausa vence com aviso, continua pausada e permite prorrogar e retomar', async ({ page }) => {
  await page.getByRole('button', { name: 'Fazer uma pausa' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Outra duração').fill('0.05');
  await dialog.getByRole('button', { name: 'Iniciar pausa' }).click();
  await expect(page.locator('.pause-banner')).toBeVisible();
  await expect(page.locator('.pause-banner')).toContainText('Sua pausa terminou.', {
    timeout: 10_000,
  });
  await page.reload();
  await expect(page.locator('.pause-banner')).toContainText('Sua pausa terminou.');
  await page.getByRole('button', { name: '+ 5 min', exact: true }).click();
  await expect(page.locator('.pause-banner')).toContainText('Uma pausa para recarregar.');
  await page
    .locator('.pause-banner')
    .getByRole('button', { name: 'Continuar', exact: true })
    .click();
  await expect(page.locator('.pause-banner')).not.toBeVisible();
  await expect(page.getByLabel('Projeto atual')).toHaveValue('tflm');
});

test('uma regra identifica contexto histórico e seu efeito persiste', async ({ page }) => {
  await page.getByRole('button', { name: 'Regras e atividades' }).click();
  await page.getByRole('button', { name: 'Nova regra' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome da regra').fill('Nova guia é pesquisa');
  await dialog.getByLabel('Software (executável exato)').fill('chrome.exe');
  await dialog.getByLabel('Título da janela contém').fill('Nova guia');
  await dialog.getByLabel('Atribuir atividade').selectOption('research');
  await expect(dialog.locator('.rule-preview')).toContainText('intervalos');
  await dialog.getByRole('button', { name: 'Salvar regra' }).click();
  await expect(page.getByRole('button', { name: /Nova guia é pesquisa/ })).toBeVisible();
  await page.getByRole('button', { name: 'Linha do tempo' }).click();
  const row = page.locator('.timeline-item').filter({ hasText: 'Nova guia — Google Chrome' });
  await expect(row).toContainText('Pesquisa e referências');
});

test('preferências persistem e layout móvel não causa rolagem da página', async ({ page }) => {
  await page.getByRole('button', { name: 'Preferências' }).click();
  await page.getByLabel('Durações favoritas').fill('7, 12, 25');
  await page.getByLabel('Não registrar estes softwares').fill('keepass.exe');
  await page.getByRole('button', { name: 'Salvar preferências' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Preferências' }).click();
  await expect(page.getByLabel('Durações favoritas')).toHaveValue('7, 12, 25');
  await expect(page.getByLabel('Não registrar estes softwares')).toHaveValue('keepass.exe');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Visão geral' }).click();
  await expect(page.getByRole('heading', { name: 'Seu tempo, com clareza.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
