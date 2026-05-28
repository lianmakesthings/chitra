import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilesystemStorage } from '../src/storage/filesystem.js';
import { runStorageContract } from './storage.contract.js';
import { describe, expect, it, vi } from 'vitest';
import * as fsp from 'node:fs/promises';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsp>();
  return { ...actual };
});

runStorageContract('FilesystemStorage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chitra-fs-'));
  return new FilesystemStorage(dir);
});


describe('FilesystemStorage', () => {
    it('writes files inside the data directory', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'chitra-fs-'));
      const storage = new FilesystemStorage(dir);
      await storage.set('merchants', 'x');
      const entries = await fsp.readdir(dir);
      expect(entries).toContain('merchants.md');
    });

  it('does not leave partial state when rename fails mid-write', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'chitra-fs-'));
    const storage = new FilesystemStorage(dir);

    await storage.set('merchants', 'original');

    const renameSpy = vi
      .spyOn(fsp, 'rename')
      .mockRejectedValueOnce(new Error('simulated rename failure'));

    await expect(storage.set('merchants', 'new value')).rejects.toThrow(
      'simulated rename failure',
    );
    const entries = await fsp.readdir(dir);

    expect(renameSpy).toHaveBeenCalledTimes(1);
    expect(await storage.get('merchants')).toBe('original');
    expect(entries.filter((e) => e.endsWith('.tmp'))).toEqual([]);

    renameSpy.mockRestore();
  });
});