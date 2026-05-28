import { describe, expect, it } from 'vitest';
import { type Storage, InvalidStorageKeyError } from '../src/storage/interface.js';

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

    it('returns null for a known key with no value yet', async () => {
      const storage = await makeStorage();
      expect(await storage.get('merchants')).toBeNull();
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

    it.each([
      ['empty', ''],
      ['parent traversal', '..'],
      ['slash', 'sub/key'],
      ['absolute', '/etc/passwd'],
      ['null byte', 'foo\0bar'],
      ['backslash', 'foo\\bar'],
      ['unknown well-formed key', 'sessions'],
    ])('rejects invalid key: %s', async (_label, key) => {
      const storage = await makeStorage();
      await expect(storage.set(key, 'x')).rejects.toBeInstanceOf(InvalidStorageKeyError);
      await expect(storage.get(key)).rejects.toBeInstanceOf(InvalidStorageKeyError);
    });

    it('handles concurrent writes to different keys', async () => {
      const storage = await makeStorage();

      await Promise.all([
        storage.set('merchants', 'value-a'),
        storage.set('config', 'value-b'),
      ]);

      expect(await storage.get('merchants')).toBe('value-a');
      expect(await storage.get('config')).toBe('value-b');
    });
  });
}
