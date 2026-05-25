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
      const value = "some value\n";
      const key = "merchants";

      await storage.set(key, value);
      expect(await storage.get(key)).toBe(value)
    });

    it('overwrites an existing value', async () => {
      const storage = await makeStorage();
      const key = "merchants";
      const oldValue = "some value\n";
      const newValue = "some other value\n";

      await storage.set(key, oldValue);
      expect(await storage.get(key)).toBe(oldValue);
      await storage.set(key, newValue);
      expect(await storage.get(key)).toBe(newValue);
    });


    it('keeps separate keys independent', async () => {
      const storage = await makeStorage();
      const value = "some value\n";
      const otherValue = "some other value\n";

      await storage.set('merchants', value);
      await storage.set('config', otherValue);
      expect(await storage.get('merchants')).toBe(value);
      expect(await storage.get('config')).toBe(otherValue);
    });

    it.each([
      ['latin extended', 'café naïve jalapeño'],
      ['CJK', '日本語'],
      ['emoji', '🌮 👋🏽'],
      ['CRLF', 'line1\r\nline2\r\n'],
      ['tabs', '\tindented'],
      ['BOM', '\uFEFFcontent'],
    ])('preserves verbatim: %s', async (_label, value) => {
      const storage = await makeStorage();
      await storage.set('merchants', value);
      expect(await storage.get('merchants')).toBe(value);
    });

    it.todo('rejects keys with path traversal or invalid characters');
    it.todo('does not leave partial state when a write fails mid-flight');
    it.todo('handles concurrent writes to different keys');
  });
}
