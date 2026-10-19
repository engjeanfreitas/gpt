import catalog from './common-defaults.json';
import base from './default-config.json';
import type { Category, Configuration } from './types';

/** Add missing seeds once; never replace a user's renamed, moved or disabled item. */
export function installCommonDefaults(config: Configuration): boolean {
  let changed = false;
  const seeds = [...base.categories, ...catalog.categories] as Category[];
  const ensureCategory = (id: string) => {
    if (config.categories.some((c) => c.id === id)) return;
    const category = seeds.find((c) => c.id === id);
    if (!category) throw new Error(`Categoria padrão inexistente: ${id}`);
    if (category.parentId) ensureCategory(category.parentId);
    config.categories.push(structuredClone(category));
    changed = true;
  };
  for (const category of catalog.categories) ensureCategory(category.id);
  for (const activity of catalog.activities) {
    if (config.activities.some((a) => a.id === activity.id)) continue;
    if (activity.categoryId) ensureCategory(activity.categoryId);
    config.activities.push(structuredClone(activity));
    changed = true;
  }
  for (const software of catalog.softwares) {
    if (
      config.softwares.some((s) => s.executable.toLowerCase() === software.executable.toLowerCase())
    )
      continue;
    if (software.categoryId) ensureCategory(software.categoryId);
    config.softwares.push(structuredClone(software));
    changed = true;
  }
  for (const rule of catalog.rules) {
    if (config.rules.some((r) => r.id === rule.id)) continue;
    config.rules.push(structuredClone(rule));
    changed = true;
  }
  return changed;
}
