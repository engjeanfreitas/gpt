import { describe, expect, it } from 'vitest';
import { classify, duration, groupEvents } from '../../src/lib/engine';
import { createDemo } from '../../src/lib/demo';
import { buildTimeline } from '../../src/lib/timeline';
import type { TimeEvent } from '../../src/lib/types';

const minute = 60_000;
const base = new Date(2026, 9, 19, 8).getTime();
const { config } = createDemo();
function sequence(parts: [string, number, TimeEvent['kind']?][], start = base) {
  return classify(
    parts.map(([title, minutes, kind = 'active'], i) => {
      const event: TimeEvent = {
        id: `event-${i}`,
        start,
        end: start + minutes * minute,
        kind,
        app: title.startsWith('TFLM') ? 'eberick.exe' : 'chrome.exe',
        title,
        domain: null,
        projectId: null,
      };
      start = event.end;
      return event;
    }),
    config,
  );
}

describe('Linha do tempo com mudanças rápidas', () => {
  it('oculta uma consulta rápida entre dois períodos da mesma janela sem reatribuir seu tempo', () => {
    const events = sequence([
      ['TFLM', 30],
      ['Documentação', 2.5],
      ['TFLM', 20],
    ]);
    const original = structuredClone(events);
    const blocks = buildTimeline(events);
    expect(blocks).toHaveLength(1);
    expect(duration(blocks[0].events)).toBe(52.5 * minute);
    for (const mode of ['activity', 'software', 'project'] as const) {
      expect(
        groupEvents(
          blocks.flatMap((b) => b.events),
          config,
          mode,
        ),
      ).toEqual(groupEvents(events, config, mode));
    }
    expect(
      groupEvents(events, config, 'software').find((r) => r.id === 's:chrome.exe')?.duration,
    ).toBe(2.5 * minute);
    expect(groupEvents(events, config, 'project').find((r) => r.id === 'p:tflm')?.duration).toBe(
      50 * minute,
    );
    expect(events).toEqual(original);
  });

  it('abre outro bloco ao permanecer cinco minutos em uma tela diferente', () => {
    const events = sequence([
      ['TFLM', 30],
      ['Consulta rápida', 5 - 1 / minute],
      ['Outro documento', 5],
    ]);
    const blocks = buildTimeline(events);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].events.map((e) => e.title)).toEqual(['Outro documento']);
    expect(blocks[1].events.map((e) => e.title)).toEqual(['TFLM', 'Consulta rápida']);
    expect(duration(blocks.flatMap((b) => b.events))).toBe(duration(events));
  });

  it('agrupa sequências de trocas curtas e permite ver todos os intervalos', () => {
    const events = sequence([
      ['A', 1],
      ['B', 2],
      ['TFLM', 10],
      ['C', 1],
    ]);
    const blocks = buildTimeline([...events].reverse());
    expect(blocks).toHaveLength(1);
    expect(blocks[0].anchor?.title).toBe('TFLM');
    expect(buildTimeline(events, false)).toHaveLength(4);
    expect(
      buildTimeline(
        sequence([
          ['A', 1],
          ['B', 2],
        ]),
      )[0].anchor,
    ).toBeNull();
  });

  it.each(['pause', 'idle', 'unknown'] as const)('preserva %s como limite entre blocos', (kind) => {
    const events = sequence([
      ['TFLM', 30],
      ['', 1, kind],
      ['Consulta', 2],
    ]);
    const blocks = buildTimeline(events);
    expect(blocks).toHaveLength(3);
    expect(blocks[1].events[0].kind).toBe(kind);
  });

  it('não preenche lacunas de filtros nem une registros sobrepostos', () => {
    const events = sequence([
      ['TFLM', 30],
      ['Consulta', 2],
    ]);
    for (const delta of [-1, 1]) {
      const separated = [events[0], { ...events[1], start: events[1].start + delta }];
      expect(buildTimeline(separated)).toHaveLength(2);
    }
  });

  it('separa dias locais mesmo se um único registro atravessar a meia-noite', () => {
    const start = new Date(2026, 9, 19, 23, 58).getTime();
    const events = sequence(
      [
        ['TFLM', 10],
        ['Consulta', 1],
      ],
      start,
    );
    const blocks = buildTimeline(events);
    expect(blocks).toHaveLength(2);
    expect(new Date(blocks[0].start).getDate()).toBe(20);
    expect(new Date(blocks[1].start).getDate()).toBe(19);
    expect(duration(blocks.flatMap((b) => b.events))).toBe(duration(events));
    expect(blocks[0].events[0].id).toBe(events[0].id);
  });

  it('respeita mudanças duradouras de projeto na mesma janela', () => {
    const events = sequence([
      ['TFLM', 10],
      ['TFLM', 10],
    ]);
    events[1] = { ...events[1], projectId: 'aurora', projectName: 'Residencial Aurora' };
    expect(buildTimeline(events)).toHaveLength(2);
  });
});
