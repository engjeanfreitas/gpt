import { test, expect } from '@playwright/test';

test('migra padrões uma vez, permite buscar, editar e desativar sem perder o tempo', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.table-footer b')).toBeVisible();
  await page.evaluate(async () => {
    const source = '/src/lib/demo.ts';
    const defaults = '/src/lib/default-config.json';
    const { createDemo } = await import(source);
    const { default: base } = await import(defaults);
    const snapshot = createDemo();
    snapshot.config = structuredClone(base);
    snapshot.config.categories[0].name = 'Meu trabalho';
    snapshot.config.categories[0].color = '#123456';
    snapshot.currentProjectId = null;
    const start = new Date().setHours(8, 0, 0, 0);
    snapshot.events = [
      {
        id: 'video',
        app: 'chrome.exe',
        title: 'Aula — YouTube',
        start,
        end: start + 180_000,
        kind: 'active',
        domain: null,
        projectId: null,
      },
    ];
    localStorage.setItem('tempo-demo-v1', JSON.stringify(snapshot));
    localStorage.removeItem('tempo-common-defaults-v1');
  });
  await page.reload();
  await expect(page.locator('.table-footer b')).toHaveText('3 min');
  await page.getByRole('button', { name: 'Expandir Pessoal', exact: true }).click();
  await expect(page.locator('.activity-row[data-group-id="common-videos"]')).toBeVisible();
  await page.getByRole('button', { name: 'Regras e atividades' }).click();
  await page.getByLabel('Buscar regras', { exact: true }).fill('YouTube no Chrome');
  await expect(page.locator('.rule-row')).toHaveCount(1);
  await page.locator('.rule-row').getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Prioridade', { exact: true })).toHaveValue('-90');
  await dialog.getByLabel('Nome da regra').fill('Aulas no YouTube');
  await dialog.getByLabel('Atribuir atividade').selectOption('research');
  await dialog.getByRole('button', { name: 'Salvar regra' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Buscar regras', { exact: true }).fill('Aulas no YouTube');
  await page.getByRole('checkbox', { name: 'Ativar regra Aulas no YouTube' }).uncheck();
  await page.reload();
  await page.getByRole('button', { name: 'Regras e atividades' }).click();
  await page.getByLabel('Buscar regras', { exact: true }).fill('Aulas no YouTube');
  await expect(page.locator('.rule-row')).toHaveCount(1);
  await expect(
    page.getByRole('checkbox', { name: 'Ativar regra Aulas no YouTube' }),
  ).not.toBeChecked();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('tempo-demo-v1')!).config,
  );
  expect(saved.rules).toHaveLength(117);
  expect(saved.categories[0]).toMatchObject({ name: 'Meu trabalho', color: '#123456' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Buscar regras', { exact: true }).fill('não existe esta regra');
  await expect(page.getByText('Nenhuma regra encontrada', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.table-footer b')).toHaveText('3 min');
});
