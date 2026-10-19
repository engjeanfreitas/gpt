import { describe, expect, it } from 'vitest';
import {
  categoryPath,
  classify,
  clipEvents,
  csvEscape,
  duration,
  groupEvents,
  matchesRule,
} from '../../src/lib/engine';
import { createDemo } from '../../src/lib/demo';
import { createConfig } from '../../src/lib/defaults';
import type { Rule, TimeEvent } from '../../src/lib/types';

const event: TimeEvent = {
  id: 'test',
  start: 0,
  end: 3 * 3600_000,
  kind: 'active',
  app: 'eberick.exe',
  title: 'TFLM — Eberick',
  projectId: null,
  domain: null,
};
describe('Classificação e totais', () => {
  it('atribui as mesmas três horas ao software e ao projeto sem duplicar', () => {
    const { config } = createDemo();
    const events = classify([event], config);
    expect(events[0].projectName).toBe('Estrutural TFLM');
    for (const mode of ['activity', 'software', 'project'] as const)
      expect(groupEvents(events, config, mode).reduce((sum, r) => sum + r.duration, 0)).toBe(
        3 * 3600_000,
      );
  });
  it('resolve atividade e projeto separadamente e respeita correção manual', () => {
    const { config } = createDemo();
    config.assignments.test = { projectId: 'aurora', activityId: null };
    const result = classify([event], config)[0];
    expect(result.projectId).toBe('aurora');
    expect(result.activityId).toBeNull();
    delete config.assignments.test;
    expect(classify([event], config)[0].activityId).toBe('structural');
    expect(classify([event], config)[0].projectId).toBe('tflm');
  });
  it('reclassifica o passado sem alterar os intervalos e preserva renomeações por id', () => {
    const { config } = createDemo();
    const original = structuredClone(event);
    config.projects[0].name = 'TFLM — novo nome';
    config.rules.find((r) => r.id === 'rule-tflm')!.projectId = 'aurora';
    expect(classify([event], config)[0].projectId).toBe('aurora');
    expect(event).toEqual(original);
    config.rules.find((r) => r.id === 'rule-tflm')!.projectId = 'tflm';
    expect(classify([event], config)[0].projectName).toBe('TFLM — novo nome');
  });
  it('combina todas as condições e não inventa domínio a partir do título', () => {
    const rule: Rule = {
      id: 'r',
      name: 'r',
      enabled: true,
      priority: 10,
      app: 'eberick.exe',
      titleContains: 'TFLM',
      domain: '',
      activityId: 'structural',
      projectId: null,
    };
    expect(matchesRule(event, rule)).toBe(true);
    expect(matchesRule({ ...event, app: 'excel.exe' }, rule)).toBe(false);
    expect(matchesRule(event, { ...rule, domain: 'site.com' })).toBe(false);
    expect(matchesRule(event, { ...rule, app: '', titleContains: '' })).toBe(false);
  });
  it('recorta intervalos nos limites do período e descarta pausas do total ativo', () => {
    const config = createConfig();
    const clipped = clipEvents(
      classify([event, { ...event, id: 'pause', kind: 'pause' }], config),
      { start: 3600_000, end: 2 * 3600_000 },
    );
    expect(duration(clipped.filter((e) => e.kind === 'active'))).toBe(3600_000);
    expect(groupEvents(clipped, config, 'software')[0].duration).toBe(3600_000);
  });
  it('mantém a árvore finita mesmo diante de um ciclo em dados importados', () => {
    const config = createConfig();
    config.categories[0].parentId = 'engineering';
    expect(categoryPath('engineering', config.categories)).toHaveLength(2);
  });
  it('protege exportações CSV contra fórmulas e preserva aspas', () => {
    expect(csvEscape('=CMD()')).toBe('"\'=CMD()"');
    expect(csvEscape('a"b')).toBe('"a""b"');
  });
});
