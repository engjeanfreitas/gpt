import { describe, expect, it } from 'vitest';
import { chartBins, chartSeries } from '../../src/lib/chart';
import { categoryColor, classify, duration, groupEvents } from '../../src/lib/engine';
import { upgradeCategoryDefaults, upgradePalette } from '../../src/lib/colors';
import { createDemo } from '../../src/lib/demo';
import type { TimeEvent } from '../../src/lib/types';

const minute = 60_000;
const base = new Date(2026, 9, 19, 8).getTime();
const { config } = createDemo();
const raw: TimeEvent[] = [
  {
    id: 'work',
    start: base + 45 * minute,
    end: base + 75 * minute,
    app: 'eberick.exe',
    title: 'TFLM',
    kind: 'active',
    domain: null,
    projectId: null,
  },
  {
    id: 'research',
    start: base + 75 * minute,
    end: base + 105 * minute,
    app: 'chrome.exe',
    title: 'Documentação',
    kind: 'active',
    domain: null,
    projectId: null,
  },
  {
    id: 'pause',
    start: base + 105 * minute,
    end: base + 120 * minute,
    app: '',
    title: '',
    kind: 'pause',
    domain: null,
    projectId: null,
  },
  {
    id: 'afk',
    start: base + 120 * minute,
    end: base + 130 * minute,
    app: '',
    title: '',
    kind: 'idle',
    domain: null,
    projectId: null,
  },
  {
    id: 'gap',
    start: base + 130 * minute,
    end: base + 140 * minute,
    app: '',
    title: '',
    kind: 'unknown',
    domain: null,
    projectId: null,
  },
];
const events = classify(raw, config);

describe('Gráfico por categoria, software e projeto', () => {
  it('divide intervalos entre horas e preserva os totais em todos os agrupamentos', () => {
    for (const mode of ['activity', 'software', 'project'] as const) {
      const bins = chartBins(chartSeries(events, config, mode), {
        start: base,
        end: base + 180 * minute,
      });
      expect(bins.map((bin) => bin.segments.reduce((sum, s) => sum + s.duration, 0))).toEqual([
        15 * minute,
        60 * minute,
        10 * minute,
      ]);
      expect(
        bins
          .flatMap((bin) => bin.segments)
          .filter((s) => s.id !== 'pause' && s.id !== 'idle')
          .reduce((sum, s) => sum + s.duration, 0),
      ).toBe(60 * minute);
    }
  });
  it('herda a cor principal sem duplicar pais e respeita recortes', () => {
    const series = chartSeries([events[0]], config, 'activity');
    expect(series).toHaveLength(1);
    expect(series[0].id).toBe('work');
    expect(series[0].color).toBe(config.categories.find((c) => c.id === 'work')!.color);
    const clipped = chartBins(series, {
      start: base + 60 * minute,
      end: base + 70 * minute + 1250,
    });
    expect(clipped[0].segments[0].duration).toBe(10 * minute + 1250);
    for (const mode of ['software', 'project'] as const) {
      const rows = groupEvents(events, config, mode);
      for (const group of chartSeries(events, config, mode).filter(
        (s) => !['pause', 'idle'].includes(s.id),
      )) {
        const row = rows.find((r) => r.id === group.id)!;
        expect(group.color).toBe(row.color);
        expect(duration(group.events)).toBe(row.duration);
      }
    }
    expect(new Set(groupEvents(events, config, 'software').map((row) => row.color)).size).toBe(2);
  });
  it('separa dias em um intervalo que atravessa meia-noite', () => {
    const start = new Date(2026, 9, 19).getTime();
    const event = { ...events[0], start: start + 23 * 3600_000, end: start + 27 * 3600_000 };
    const bins = chartBins(chartSeries([event], config, 'activity'), {
      start,
      end: start + 48 * 3600_000,
    });
    expect(bins.map((bin) => bin.segments[0].duration)).toEqual([3600_000, 3 * 3600_000]);
  });
  it('atualiza a paleta antiga uma vez e preserva cores personalizadas e classificações', () => {
    const data = structuredClone(config);
    data.categories[0].color = '#7e9274';
    data.categories[1].color = '#123456';
    const assignments = structuredClone(data.assignments);
    expect(upgradePalette(data)).toBe(true);
    expect(data.categories[0].color).toBe('#2563EB');
    expect(data.categories[1].color).toBe('#123456');
    expect(data.assignments).toEqual(assignments);
    expect(upgradePalette(data)).toBe(false);
  });
  it('propaga a cor da categoria principal para todos os descendentes, inclusive após editar a cor', () => {
    const data = structuredClone(config);
    data.categories.push({
      id: 'calculation',
      parentId: 'engineering',
      name: 'Cálculo',
      color: '#123456',
    });
    const deep = { ...events[0], categoryId: 'calculation' };
    const flatten = (rows: ReturnType<typeof groupEvents>): ReturnType<typeof groupEvents> =>
      rows.flatMap((row) => [row, ...flatten(row.children)]);
    for (const color of ['#16A34A', '#9333EA']) {
      data.categories.find((c) => c.id === 'work')!.color = color;
      expect(categoryColor('calculation', data.categories)).toBe(color);
      for (const row of flatten(groupEvents([deep], data, 'activity')))
        expect(row.color).toBe(color);
      for (const mode of ['software', 'project'] as const) {
        const row = groupEvents([deep], data, mode)[0];
        expect(row.children[0].color).toBe(color);
      }
      expect(chartSeries([deep], data, 'activity')[0].color).toBe(color);
    }
  });
  it('ajusta apenas as cores padrão antigas de Trabalho e Estudo', () => {
    const data = structuredClone(config);
    data.categories.find((c) => c.id === 'work')!.color = '#2563EB';
    data.categories.find((c) => c.id === 'study')!.color = '#16A34A';
    expect(upgradeCategoryDefaults(data)).toBe(true);
    expect(data.categories.find((c) => c.id === 'work')!.color).toBe('#16A34A');
    expect(data.categories.find((c) => c.id === 'study')!.color).toBe('#2563EB');
    expect(upgradeCategoryDefaults(data)).toBe(false);
    data.categories.find((c) => c.id === 'work')!.color = '#123456';
    expect(upgradeCategoryDefaults(data)).toBe(false);
  });
});
