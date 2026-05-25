import { describe, expect, it } from 'vitest';
import type { Storage } from '../src/storage/interface.js';

/**
 * Shared contract suite for any Storage implementation.
 * Phase 5 will reuse this for the Cloudflare KV backend.
 */
export function runStorageContract(name: string, makeStorage: () => Promise<Storage> | Storage) {
  describe(`Storage contract: ${name}`, () => {
    it('constructs a Storage instance', async () => {
      const storage = await makeStorage();
      expect(storage).toBeDefined();
    });

    it('returns null for an unknown key', async () => {
      const storage = await makeStorage();
      expect(await storage.get('unknown')).toBeNull();
    });

    it('writes and reads a value', async () => {
      const storage = await makeStorage();
      const value = "some value";
      const key = "merchants";

      await storage.set(key, value);
      expect(await storage.get(key)).toBe(value)
    });

    it.todo('overwrites an existing value');
    it.todo('keeps separate keys independent');
    it.todo('preserves unicode and newlines verbatim');
    it.todo('rejects keys with path traversal or invalid characters');
    it.todo('does not leave partial state when a write fails mid-flight');
    it.todo('handles concurrent writes to different keys');
  });
}
