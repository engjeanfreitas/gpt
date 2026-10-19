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
  await assertColor('engineering');
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
