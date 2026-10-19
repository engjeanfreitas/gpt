import { test, expect } from '@playwright/test';

test('atualizador confirma instalação, mostra progresso e permite recuperação após falhas', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Seu tempo, com clareza.' }).waitFor();
  await page.evaluate(async () => {
    const source = '/src/lib/demo.ts';
    const { createDemo } = await import(source);
    localStorage.setItem('tempo-update-test', JSON.stringify(createDemo()));
  });
  await page.addInitScript(() => {
    const callbacks = new Map<number, (event: unknown) => void>();
    const listeners = new Map<string, number>();
    let sequence = 0;
    Object.assign(window, {
      __tempoUpdateResult: 'available',
      __tempoInstallCalls: 0,
      __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
      __TAURI_INTERNALS__: {
        transformCallback: (fn: (event: unknown) => void) => {
          callbacks.set(++sequence, fn);
          return sequence;
        },
        unregisterCallback: (id: number) => callbacks.delete(id),
        invoke: async (command: string, args: { event?: string; handler?: number } = {}) => {
          const state = window as unknown as {
            __tempoUpdateResult: string;
            __tempoInstallCalls: number;
          };
          if (command === 'get_snapshot')
            return JSON.parse(localStorage.getItem('tempo-update-test')!);
          if (command === 'get_autostart') return false;
          if (command === 'plugin:event|listen') {
            listeners.set(args.event!, args.handler!);
            return args.handler;
          }
          if (command === 'check_for_updates') {
            if (state.__tempoUpdateResult === 'offline')
              throw new Error('Sem conexão. Tente novamente.');
            return {
              currentVersion: '0.1.3',
              availableVersion: state.__tempoUpdateResult === 'available' ? '0.1.4' : null,
              notes: 'Melhorias no Tempo.',
            };
          }
          if (command === 'install_update') {
            state.__tempoInstallCalls++;
            callbacks.get(listeners.get('update-progress')!)?.({
              payload: { phase: 'downloading', downloaded: 50, total: 100 },
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
            throw new Error('Assinatura inválida. Nenhuma instalação foi iniciada.');
          }
          return 1;
        },
      },
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Preferências', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar atualizações', exact: true }).click();
  await expect(page.getByText('Versão 0.1.4 disponível')).toBeVisible();
  await page.getByRole('button', { name: 'Baixar e instalar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Atualizar o Tempo?' });
  await expect(dialog).toContainText('backup');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(await page.evaluate(() => Reflect.get(window, '__tempoInstallCalls'))).toBe(0);
  await page.getByRole('button', { name: 'Baixar e instalar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Atualizar agora', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Download da atualização' })).toHaveAttribute(
    'value',
    '50',
  );
  await expect(page.getByRole('alert')).toContainText('Nenhuma instalação foi iniciada');
  expect(await page.evaluate(() => Reflect.get(window, '__tempoInstallCalls'))).toBe(1);
  await page.evaluate(() => Reflect.set(window, '__tempoUpdateResult', 'offline'));
  await page.getByRole('button', { name: 'Verificar atualizações', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Sem conexão');
  await page.evaluate(() => Reflect.set(window, '__tempoUpdateResult', 'current'));
  await page.getByRole('button', { name: 'Verificar atualizações', exact: true }).click();
  await expect(page.getByText('Você está usando a versão mais recente.')).toBeVisible();
});
