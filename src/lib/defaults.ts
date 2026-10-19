import type { Configuration } from './types';
import defaults from './default-config.json';

export const COLORS = ['#c87957', '#7e9274', '#778db5', '#b18eb8', '#d4a44d', '#6faaaa', '#ba7f83'];
export function createConfig(): Configuration {
  return structuredClone(defaults) as Configuration;
}
