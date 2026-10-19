import { dayStart, groupEvents } from './engine';
import type { ClassifiedEvent, Configuration, DateRange, GroupMode, GroupRow } from './types';

export interface ChartSeries {
  id: string;
  name: string;
  color: string;
  events: ClassifiedEvent[];
}
export interface ChartBin {
  start: number;
  end: number;
  label: string;
  segments: { id: string; name: string; color: string; duration: number }[];
}

export function chartSeries(
  events: ClassifiedEvent[],
  config: Configuration,
  mode: GroupMode,
  rows?: GroupRow[],
): ChartSeries[] {
  // Root rows partition active time. Descendant rows include the same events
  // again, so using them as extra series would double-count the category total.
  const series: ChartSeries[] = (rows ?? groupEvents(events, config, mode)).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    events: row.events,
  }));
  series.push(
    {
      id: 'pause',
      name: 'Pausa',
      color: '#FACC15',
      events: events.filter((e) => e.kind === 'pause'),
    },
    {
      id: 'idle',
      name: 'AFK / tela bloqueada',
      color: '#94A3B8',
      events: events.filter((e) => e.kind === 'idle'),
    },
  );
  return series.filter((group) => group.events.some((e) => e.end > e.start));
}

export function chartBins(series: ChartSeries[], range: DateRange): ChartBin[] {
  const daily = range.end - range.start > 26 * 3600_000;
  const bins: ChartBin[] = [];
  let start = range.start;
  while (start < range.end && bins.length < 366) {
    const next = new Date(dayStart(new Date(start)));
    next.setDate(next.getDate() + 1);
    const end = Math.min(range.end, daily ? next.getTime() : start + 3600_000);
    const label = daily
      ? new Date(start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : `${new Date(start).getHours()}h`;
    const segments = series
      .map((group) => ({
        id: group.id,
        name: group.name,
        color: group.color,
        duration: group.events.reduce(
          (sum, e) => sum + Math.max(0, Math.min(end, e.end) - Math.max(start, e.start)),
          0,
        ),
      }))
      .filter((segment) => segment.duration > 0);
    bins.push({ start, end, label, segments });
    start = end;
  }
  return bins;
}
