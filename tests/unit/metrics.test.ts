import { describe, expect, it } from 'vitest';
import { createDemo } from '../../src/lib/demo';
import { classify, clipEvents } from '../../src/lib/engine';
import { dashboardTotals } from '../../src/lib/metrics';
import type { TimeEvent } from '../../src/lib/types';

const minute = 60_000;
function sample() {
  const { config } = createDemo();
  let start = new Date(2026, 9, 19, 8).getTime();
  const sequence: [string, string, number, TimeEvent['kind'], string | null][] = [
    ['eberick.exe', 'Modelo', 30, 'active', null],
    ['chrome.exe', 'Instagram', 10, 'active', 'tflm'],
    ['chrome.exe', 'Nova guia', 15, 'active', null],
    ['chrome.exe', 'GitHub', 20, 'active', null],
    ['', '', 7, 'pause', null],
    ['', '', 5, 'idle', null],
    ['', '', 3, 'unknown', null],
    ['firefox.exe', 'Wikipedia', 12, 'active', null],
  ];
  const events: TimeEvent[] = sequence.map(([app, title, minutes, kind, projectId], i) => {
    const event = {
      id: String(i),
      app,
      title,
      kind,
      projectId,
      start,
      end: start + minutes * minute,
      domain: null,
    };
    start = event.end;
    return event;
  });
  return { config, events };
}

describe('Destaques do dashboard', () => {
  it('conta Trabalho pela categoria, separa AFK de pausa e mantém navegação desconhecida pendente', () => {
    const { config, events } = sample();
    expect(dashboardTotals(classify(events, config), config)).toEqual({
      active: 87 * minute,
      work: 50 * minute,
      procrastination: 10 * minute,
      afk: 5 * minute,
      paused: 7 * minute,
      unclassified: 15 * minute,
    });
  });

  it('acompanha correções e a hierarquia mesmo depois de renomear as categorias', () => {
    const { config, events } = sample();
    config.categories.find((c) => c.id === 'work')!.name = 'Escritório';
    config.categories.find((c) => c.id === 'personal')!.name = 'Distrações';
    config.assignments['1'] = { activityId: 'research' };
    expect(dashboardTotals(classify(events, config), config)).toMatchObject({
      active: 87 * minute,
      work: 50 * minute,
      procrastination: 0,
    });
    delete config.assignments['1'];
    config.categories.find((c) => c.id === 'common-social')!.parentId = 'work';
    expect(dashboardTotals(classify(events, config), config)).toMatchObject({
      active: 87 * minute,
      work: 60 * minute,
      procrastination: 0,
    });
  });

  it('respeita o recorte do período e não preenche lacunas com atividade', () => {
    const { config, events } = sample();
    const start = events[0].start;
    const clipped = clipEvents(classify(events, config), {
      start: start + 25 * minute,
      end: start + 38 * minute,
    });
    expect(dashboardTotals(clipped, config)).toMatchObject({
      active: 13 * minute,
      work: 5 * minute,
      procrastination: 8 * minute,
      afk: 0,
      paused: 0,
    });
    expect(dashboardTotals([], config)).toEqual({
      active: 0,
      work: 0,
      procrastination: 0,
      afk: 0,
      paused: 0,
      unclassified: 0,
    });
  });
});
