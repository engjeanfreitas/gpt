import { test, expect } from '@playwright/test';

test('atribui um projeto ao bloco inteiro, preserva atividades e permite corrigir só um detalhe', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.table-footer b')).toBeVisible();
  const before = await page.evaluate(async () => {
    const source = '/src/lib/demo.ts';
    const { createDemo } = await import(source);
    const data = createDemo();
    let start = new Date().setHours(8, 0, 0, 0);
    data.events = [
      ['eberick.exe', 'TFLM — Eberick', 30, 'active'],
      ['chrome.exe', 'Documentação rápida', 2, 'active'],
      ['eberick.exe', 'TFLM — Eberick', 20, 'active'],
      ['', '', 3, 'pause'],
      ['', '', 5, 'idle'],
      ['chrome.exe', 'Outro documento', 5, 'active'],
    ].map(([app, title, minutes, kind], index) => {
      const end = start + Number(minutes) * 60_000;
      const event = {
        id: `block-${index}`,
        app: String(app),
        title: String(title),
        start,
        end,
        kind: String(kind),
        domain: null,
        projectId: null,
      };
      start = end;
      return event;
    });
    data.config.assignments['block-1'] = { projectId: 'office', activityId: 'research' };
    localStorage.setItem('tempo-demo-v1', JSON.stringify(data));
    return data;
  });
  await page.reload();
  await expect(page.locator('.table-footer b')).toHaveText('57 min');
  await page.getByRole('button', { name: 'Linha do tempo', exact: true }).click();
  await expect(page.locator('.timeline-summary')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.timeline-details')).not.toBeVisible();
  const editBlock = page.getByRole('button', { name: 'Editar bloco', exact: true });
  await expect(editBlock).toHaveCount(1); // Rest records and the separate long screen have no bulk button.
  await editBlock.click();
  const dialog = page.getByRole('dialog', { name: 'Editar bloco de tempo' });
  await expect(dialog).toContainText('08:00–08:52 · 3 intervalos selecionados · 52 min');
  await expect(dialog.getByLabel('Projeto', { exact: true })).toHaveValue('__keep');
  await expect(dialog.getByLabel('Atividade', { exact: true })).toHaveValue('__keep');
  await expect(dialog.locator('.warning-line')).not.toBeVisible();
  await dialog.getByLabel('Projeto', { exact: true }).selectOption('aurora');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tempo-demo-v1')!));
  expect(saved.config.assignments).toEqual(before.config.assignments);
  await editBlock.click();
  await dialog.getByLabel('Projeto', { exact: true }).selectOption('aurora');
  await dialog.getByRole('button', { name: 'Aplicar ao bloco', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tempo-demo-v1')!));
  expect(saved.events).toEqual(before.events);
  expect(saved.config.rules).toEqual(before.config.rules);
  expect(saved.config.activities).toEqual(before.config.activities);
  expect(saved.config.categories).toEqual(before.config.categories);
  expect(saved.currentProjectId).toBe(before.currentProjectId);
  expect(saved.config.assignments).toEqual({
    'block-0': { projectId: 'aurora' },
    'block-1': { projectId: 'aurora', activityId: 'research' },
    'block-2': { projectId: 'aurora' },
  });
  await page.reload();
  await expect(page.locator('.table-footer b')).toHaveText('57 min');
  await page.getByRole('button', { name: 'Projeto', exact: true }).click();
  await expect(page.locator('.activity-row[data-group-id="p:aurora"] .row-time')).toHaveText(
    '52 min',
  );
  await expect(page.locator('.activity-row[data-group-id="p:none"] .row-time')).toHaveText('5 min');
  await page.getByRole('button', { name: 'Linha do tempo', exact: true }).click();
  await expect(page.locator('.timeline-summary .project-pill')).toHaveText('Residencial Aurora');
  await page.locator('.timeline-summary').click();
  await page
    .locator('.timeline-details .timeline-item')
    .filter({ hasText: 'Documentação rápida' })
    .click();
  const detailDialog = page.getByRole('dialog', { name: 'Organizar seu tempo' });
  await detailDialog.getByLabel('Projeto', { exact: true }).selectOption('office');
  await detailDialog.getByRole('button', { name: 'Aplicar aos intervalos', exact: true }).click();
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.activity-row[data-group-id="p:aurora"] .row-time')).toHaveText(
    '50 min',
  );
  await expect(page.locator('.activity-row[data-group-id="p:office"] .row-time')).toHaveText(
    '2 min',
  );
  await expect(page.locator('.table-footer b')).toHaveText('57 min');
});

test('avisa quando um registro do bloco atravessa o limite do período e mantém o botão acessível no celular', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.table-footer b')).toBeVisible();
  await page.evaluate(async () => {
    const source = '/src/lib/demo.ts';
    const { createDemo } = await import(source);
    const data = createDemo();
    const midnight = new Date().setHours(0, 0, 0, 0);
    data.events = [
      {
        id: 'cross-midnight',
        start: midnight - 10 * 60_000,
        end: midnight + 10 * 60_000,
        app: 'eberick.exe',
        title: 'TFLM — Eberick',
        kind: 'active',
        domain: null,
        projectId: null,
      },
      {
        id: 'quick',
        start: midnight + 10 * 60_000,
        end: midnight + 12 * 60_000,
        app: 'chrome.exe',
        title: 'Consulta',
        kind: 'active',
        domain: null,
        projectId: null,
      },
    ];
    localStorage.setItem('tempo-demo-v1', JSON.stringify(data));
  });
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Linha do tempo', exact: true }).click();
  const editBlock = page.getByRole('button', { name: 'Editar bloco', exact: true });
  await expect(editBlock).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await editBlock.click();
  const dialog = page.getByRole('dialog', { name: 'Editar bloco de tempo' });
  await expect(dialog).toContainText('00:00–00:12 · 2 intervalos selecionados · 12 min');
  await expect(dialog.locator('.warning-line')).toContainText(
    'restante desses registros originais',
  );
});
