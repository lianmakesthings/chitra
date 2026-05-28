import { type Storage, type StorageKey, assertValidKey } from './interface.js';
import { mkdir, rename, writeFile, readFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const EXTENSIONS: Record<StorageKey, string> = {
  config: '.yaml',
  merchants: '.md',
};

export class FilesystemStorage implements Storage {
  constructor(private readonly dataDir: string) {}

  getFilePath(key: StorageKey) {
    return join(this.dataDir, key + EXTENSIONS[key]);
  }

  isENOENT(err: unknown) {
    return err instanceof Error && 'code' in err && err.code === 'ENOENT';
  }

  async get(_key: StorageKey): Promise<string | null> {
    try {
      assertValidKey(_key)
      const filePath = this.getFilePath(_key);
      return await readFile(filePath, 'utf8');
    } catch (err) {
      if (this.isENOENT(err)) return null;
      throw err;
    }
  }

  async set(_key: StorageKey, _value: string): Promise<void> {
    assertValidKey(_key);
    const target = this.getFilePath(_key);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tmp, _value, 'utf8');
    try {
      await rename(tmp, target);
    } catch (err) {
      await unlink(tmp).catch(() => {});  // best-effort cleanup
      throw err;
    }
  }
}
