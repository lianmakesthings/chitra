import { ConfigSchema, type Config } from './schema.js';
import YAML from 'yaml';

/**
 * Parse a YAML string into a validated Config, or return null when the
 * storage value is absent. Throws ZodError if the YAML is structurally
 * invalid or violates a schema rule.
 */
export function parseConfig(yamlOrNull: string | null): Config | null {
  if (yamlOrNull === null) return null;
  const raw = YAML.parse(yamlOrNull);
  return ConfigSchema.parse(raw);
}

/**
 * Serialize a Config back into the YAML representation stored on disk / in KV.
 */
export function serializeConfig(config: Config): string {
  return YAML.stringify(ConfigSchema.parse(config));
}
