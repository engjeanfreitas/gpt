import type { Configuration } from './types';
import defaults from './default-config.json';

export { COLORS } from './colors';
export function createConfig(): Configuration {
  return structuredClone(defaults) as Configuration;
}
