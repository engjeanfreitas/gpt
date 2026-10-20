import { categoryPath } from './engine';
import type { ClassifiedEvent, Configuration } from './types';

/** Use classified, clipped events so cards obey the same rules and filters as the tree. */
export function dashboardTotals(events: ClassifiedEvent[], config: Configuration) {
  const totals = { active: 0, work: 0, afk: 0, procrastination: 0, paused: 0, unclassified: 0 };
  for (const event of events) {
    const elapsed = Math.max(0, event.end - event.start);
    if (event.kind === 'idle') totals.afk += elapsed;
    if (event.kind === 'pause') totals.paused += elapsed;
    if (event.kind !== 'active') continue;
    totals.active += elapsed;
    if (!event.activityId) totals.unclassified += elapsed;
    // Stable IDs preserve the meaning after renaming; descendants follow their root.
    const root = categoryPath(event.categoryId, config.categories)[0]?.id;
    if (root === 'work') totals.work += elapsed;
    if (root === 'personal') totals.procrastination += elapsed;
  }
  return totals;
}
