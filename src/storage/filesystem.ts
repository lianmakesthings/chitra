import { type Storage, type StorageKey, assertValidKey } from './interface.js';
import { mkdir, rename, writeFile, readFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

const EXTENSIONS: Record<StorageKey, string> = {
  config: '.yaml',
  merchants: '.md',
};

export class FilesystemStorage implements Storage {
  constructor(private readonly dataDir: string) {}

  private getFilePath(key: StorageKey) {
    return join(this.dataDir, key + EXTENSIONS[key]);
  }

  private isENOENT(err: unknown) {
    return err instanceof Error && 'code' in err && err.code === 'ENOENT';
  }

  async get(key: string): Promise<string | null> {
    try {
      assertValidKey(key);
      const filePath = this.getFilePath(key);
      return await readFile(filePath, 'utf8');
    } catch (err) {
      if (this.isENOENT(err)) return null;
      throw err;
    }
  }

  async set(key: string, value: string): Promise<void> {
    assertValidKey(key);
    const target = this.getFilePath(key);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tmp, value, 'utf8');
    try {
      await rename(tmp, target);
    } catch (err) {
      await unlink(tmp).catch(() => {}); // best-effort cleanup
      throw err;
    }
  }
}
