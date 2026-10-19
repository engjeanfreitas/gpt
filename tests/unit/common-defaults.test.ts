import { describe, expect, it } from 'vitest';
import { createConfig } from '../../src/lib/defaults';
import { installCommonDefaults } from '../../src/lib/common-defaults';
import base from '../../src/lib/default-config.json';
import { classify, duration, groupEvents } from '../../src/lib/engine';
import type { Configuration, TimeEvent } from '../../src/lib/types';

const sample = (app: string, title = ''): TimeEvent => ({
  id: 'event',
  app,
  title,
  start: 0,
  end: 180_000,
  kind: 'active',
  domain: null,
  projectId: null,
});

describe('Regras comuns adaptadas do ActivityWatch', () => {
  it('reconhece software e sites por título sem classificar o navegador inteiro', () => {
    const config = createConfig();
    for (const [app, title, activity] of [
      ['CODE.EXE', 'main.ts — editor', 'common-programming'],
      ['winword.exe', 'Relatório YouTube', 'common-documents'],
      ['blender.exe', 'Modelo', 'common-3d'],
      ['revit.exe', 'Edifício', 'common-cad'],
      ['ms-teams.exe', 'Chamada', 'common-meetings'],
      ['spotify.exe', '', 'common-music'],
      ['rimworldwin64.exe', '', 'common-games'],
      ['chrome.exe', 'Minha organização · GitHub', 'common-programming'],
      ['msedge.exe', 'Meu vídeo — YouTube', 'common-videos'],
      ['firefox.exe', 'caixa de entrada — Gmail', 'common-messages'],
      ['brave.exe', 'Instagram', 'common-social'],
      ['opera.exe', 'Artigo — Wikipédia', 'common-references'],
    ]) {
      const result = classify([sample(app, title)], config)[0];
      expect(result.activityId, `${app}: ${title}`).toBe(activity);
      expect(result.projectId).toBeNull();
    }
    for (const event of [
      sample('chrome.exe', 'Nova guia'),
      sample('other.exe', 'YouTube'),
      sample('steam.exe', 'Loja'),
      sample('reader.exe', 'Texto'),
    ])
      expect(classify([event], config)[0].activityId).toBeNull();
  });

  it('preserva regras existentes, prioridades próprias, correções e tempo original', () => {
    const config = createConfig();
    expect(classify([sample('eberick.exe')], config)[0].activityId).toBe('structural');
    expect(classify([sample('excel.exe')], config)[0].activityId).toBe('budget');
    expect(classify([sample('outlook.exe')], config)[0].activityId).toBe('communication');
    config.rules.push({
      id: 'custom',
      name: 'Curso em vídeo',
      enabled: true,
      priority: 0,
      app: 'chrome.exe',
      titleContains: 'YouTube',
      domain: '',
      activityId: 'research',
      projectId: null,
    });
    const event = sample('chrome.exe', 'Aula — YouTube');
    const original = structuredClone(event);
    const result = classify([event], config);
    expect(result[0].activityId).toBe('research');
    for (const mode of ['activity', 'software', 'project'] as const)
      expect(groupEvents(result, config, mode).reduce((sum, row) => sum + row.duration, 0)).toBe(
        duration([event]),
      );
    config.assignments.event = { activityId: 'leisure' };
    expect(classify([event], config)[0].activityId).toBe('leisure');
    expect(event).toEqual(original);
    for (const kind of ['pause', 'idle', 'unknown'] as const)
      expect(classify([{ ...event, id: kind, kind }], config)[0].matchedRules).toEqual([]);
  });

  it('acrescenta padrões sem substituir personalizações nem duplicar identificadores', () => {
    const config = structuredClone(base) as Configuration;
    config.categories[0].name = 'Escritório';
    config.categories[0].color = '#123456';
    config.softwares[0].name = 'Meu Eberick';
    const disabled = {
      id: 'common-app-code',
      name: 'Meu editor',
      enabled: false,
      priority: 45,
      app: 'code.exe',
      titleContains: '',
      domain: '',
      activityId: 'research',
      projectId: null,
    };
    config.rules.push(disabled);
    expect(installCommonDefaults(config)).toBe(true);
    const result = structuredClone(config);
    expect(installCommonDefaults(config)).toBe(false);
    expect(config).toEqual(result);
    expect(config.rules.find((r) => r.id === disabled.id)).toEqual(disabled);
    expect(config.categories[0]).toMatchObject({ name: 'Escritório', color: '#123456' });
    expect(config.softwares[0].name).toBe('Meu Eberick');
    for (const items of [config.categories, config.activities, config.rules])
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(new Set(config.softwares.map((s) => s.executable.toLowerCase())).size).toBe(
      config.softwares.length,
    );
  });
});
