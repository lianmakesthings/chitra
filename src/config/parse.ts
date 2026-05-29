import { ConfigSchema, type Config } from './schema.js';
import YAML from 'yaml';

/**
 * Parse a YAML string into a validated Config, or return null when the storage
 * value is absent (uninitialized state).
 */
export function parseConfig(yamlOrNull: string | null): Config | null {
  if (yamlOrNull === null) return null;
  const raw = YAML.parse(yamlOrNull);
  return ConfigSchema.parse(raw);
}

/**
 * Serialize a Config back into the YAML representation stored on disk / in KV.
 */
export function serializeConfig(_config: Config): string {
  throw new Error('serializeConfig not implemented');
}
