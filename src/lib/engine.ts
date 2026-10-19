import type {
  Category,
  ClassifiedEvent,
  Configuration,
  DateRange,
  GroupMode,
  GroupRow,
  Rule,
  TimeEvent,
} from './types';

const lower = (s: string) => s.normalize('NFKC').toLocaleLowerCase('pt-BR');
export function matchesRule(event: TimeEvent, rule: Rule): boolean {
  if (!rule.enabled || (!rule.app.trim() && !rule.titleContains.trim() && !rule.domain.trim()))
    return false;
  return (
    (!rule.app.trim() || lower(event.app) === lower(rule.app.trim())) &&
    (!rule.titleContains.trim() || lower(event.title).includes(lower(rule.titleContains.trim()))) &&
    (!rule.domain.trim() || (!!event.domain && lower(event.domain) === lower(rule.domain.trim())))
  );
}
export function classify(events: TimeEvent[], config: Configuration): ClassifiedEvent[] {
  const rules = [...config.rules].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );
  return events
    .filter((e) => !config.assignments[e.id]?.excluded)
    .map((event) => {
      const software = config.softwares.find((s) => lower(s.executable) === lower(event.app));
      const matched = event.kind === 'active' ? rules.filter((r) => matchesRule(event, r)) : [];
      const assignment = config.assignments[event.id] ?? {};
      const activityId = Object.hasOwn(assignment, 'activityId')
        ? (assignment.activityId ?? null)
        : (matched.find((r) => r.activityId)?.activityId ?? null);
      const projectId = Object.hasOwn(assignment, 'projectId')
        ? (assignment.projectId ?? null)
        : (matched.find((r) => r.projectId)?.projectId ?? event.projectId);
      const activity = config.activities.find((a) => a.id === activityId);
      return {
        ...event,
        activityId,
        projectId,
        categoryId: activity?.categoryId ?? software?.categoryId ?? null,
        softwareName: software?.name ?? (event.app.replace(/\.exe$/i, '') || 'Sistema'),
        activityName: activity?.name ?? 'Sem classificação',
        projectName: config.projects.find((p) => p.id === projectId)?.name ?? 'Sem projeto',
        matchedRules: matched.map((r) => r.id),
      };
    });
}
export function clipEvents<T extends TimeEvent>(events: T[], range: DateRange): T[] {
  return events
    .filter((e) => e.end > range.start && e.start < range.end)
    .map((e) => ({ ...e, start: Math.max(e.start, range.start), end: Math.min(e.end, range.end) }));
}
export function duration(events: TimeEvent[]): number {
  return events.reduce((sum, e) => sum + Math.max(0, e.end - e.start), 0);
}
export function formatDuration(ms: number, compact = false): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours)
    return `${hours}h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}min` : ''}`;
  if (minutes) return `${minutes}${compact ? 'min' : ' min'}`;
  return ms > 0 ? '< 1 min' : '0 min';
}
export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
export function dayStart(date = new Date()): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
export function dateInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function rangeForDays(days: number): DateRange {
  const start = new Date(dayStart());
  start.setDate(start.getDate() - days + 1);
  const end = new Date(dayStart());
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}
export function categoryPath(id: string | null, categories: Category[]): Category[] {
  const path: Category[] = [];
  const visited = new Set<string>();
  while (id && !visited.has(id)) {
    visited.add(id);
    const c = categories.find((c) => c.id === id);
    if (!c) break;
    path.unshift(c);
    id = c.parentId;
  }
  return path;
}
export function isInCategory(id: string | null, parentId: string, categories: Category[]): boolean {
  return categoryPath(id, categories).some((c) => c.id === parentId);
}
export function groupEvents(
  events: ClassifiedEvent[],
  config: Configuration,
  mode: GroupMode,
): GroupRow[] {
  const rows: GroupRow[] = [];
  const insert = (
    path: { id: string; name: string; color: string; subtitle: string }[],
    event: ClassifiedEvent,
  ) => {
    let level = rows;
    for (const part of path) {
      let row = level.find((r) => r.id === part.id);
      if (!row) {
        row = { ...part, duration: 0, events: [], children: [] };
        level.push(row);
      }
      row.duration += event.end - event.start;
      row.events.push(event);
      level = row.children;
    }
  };
  for (const e of events.filter((e) => e.kind === 'active')) {
    const categories = categoryPath(e.categoryId, config.categories);
    const color = categories.at(-1)?.color ?? '#9a9b91';
    const ignored = [e.softwareName, e.app, e.app.replace(/\.exe$/i, '')].map(lower);
    const titleParts = e.title
      .split(/\s+[-–—|:>]\s+|\\/)
      .map((part) => part.trim())
      .filter((part) => part && !ignored.includes(lower(part)))
      .slice(0, 6);
    const context = (titleParts.length ? titleParts : ['Sem título']).map((name, index) => ({
      id: `title:${index}:${encodeURIComponent(name)}`,
      name,
      color,
      subtitle: index === 0 ? 'Contexto da janela' : 'Documento / detalhe',
    }));
    if (mode === 'activity') {
      const path: { id: string; name: string; color: string; subtitle: string }[] = categories.map(
        (c) => ({ ...c, subtitle: 'Categoria' }),
      );
      if (!path.length)
        path.push({ id: 'uncategorized', name: 'Sem classificação', color, subtitle: 'Categoria' });
      insert(
        [
          ...path,
          { id: `a:${e.activityId ?? 'none'}`, name: e.activityName, color, subtitle: 'Atividade' },
          { id: `s:${e.app}`, name: e.softwareName, color, subtitle: 'Software' },
          ...context,
        ],
        e,
      );
    } else if (mode === 'software') {
      insert(
        [
          { id: `s:${e.app}`, name: e.softwareName, color, subtitle: e.app },
          {
            id: `a:${e.activityId ?? 'none'}:p:${e.projectId ?? 'none'}`,
            name: e.activityName,
            color,
            subtitle: e.projectName,
          },
          ...context,
        ],
        e,
      );
    } else {
      const project = config.projects.find((p) => p.id === e.projectId);
      insert(
        [
          {
            id: `p:${e.projectId ?? 'none'}`,
            name: e.projectName,
            color: project?.color ?? '#9a9b91',
            subtitle: project?.client || 'Projeto',
          },
          { id: `a:${e.activityId ?? 'none'}`, name: e.activityName, color, subtitle: 'Atividade' },
          { id: `s:${e.app}`, name: e.softwareName, color, subtitle: e.app },
          ...context,
        ],
        e,
      );
    }
  }
  const sort = (rows: GroupRow[]) => {
    rows.sort((a, b) => b.duration - a.duration);
    rows.forEach((r) => sort(r.children));
  };
  sort(rows);
  return rows;
}
export function csvEscape(s: string): string {
  const safe = /^\s*[=+\-@]|^[\t\r\n]/.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
}
