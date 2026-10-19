import palette from './palette.json';
import type { Configuration } from './types';

export const COLORS = palette.colors;
/** Upgrade only the shipped pastel palette; arbitrary custom colors are preserved. */
export function upgradePalette(config: Configuration): boolean {
  let changed = false;
  for (const item of [...config.categories, ...config.projects]) {
    const color = palette.legacy[item.color.toLowerCase() as keyof typeof palette.legacy];
    if (color) {
      item.color = color;
      changed = true;
    }
  }
  return changed;
}
/** Run once per data store so later user choices are never reset on startup. */
export function upgradeCategoryDefaults(config: Configuration): boolean {
  let changed = false;
  for (const replacement of palette.categoryDefaults) {
    const category = config.categories.find((c) => c.id === replacement.id);
    if (
      category &&
      !category.parentId &&
      category.color.toLowerCase() === replacement.from.toLowerCase()
    ) {
      category.color = replacement.to;
      changed = true;
    }
  }
  return changed;
}
export function softwareColor(app: string, config: Configuration): string {
  const index = config.softwares.findIndex((s) => s.executable.toLowerCase() === app.toLowerCase());
  if (index >= 0) return COLORS[index % COLORS.length];
  let hash = 2166136261;
  for (const char of app.toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  // Unlisted executables keep their color even when a filter hides other apps.
  return `hsl(${(hash >>> 0) % 360} 65% 42%)`;
}
