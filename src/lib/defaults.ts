import type { Configuration } from './types';
import defaults from './default-config.json';
import { installCommonDefaults } from './common-defaults';

export { COLORS } from './colors';
export function createConfig(): Configuration {
  const config = structuredClone(defaults) as Configuration;
  installCommonDefaults(config);
  return config;
}
