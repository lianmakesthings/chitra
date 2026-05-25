import type { Storage } from './interface.js';
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

const EXTENSIONS: Record<string, string> = {
  config: '.yaml',
  merchants: '.md',
};

export class FilesystemStorage implements Storage {
  constructor(private readonly dataDir: string) {}

  getFilePath(key: string) {
    return this.dataDir + key + EXTENSIONS[key];
  }

  isENOENT(err: unknown) {
    return err instanceof Error && 'code' in err && err.code === 'ENOENT';
  }

  async get(_key: string): Promise<string | null> {
    const filePath = this.getFilePath(_key);
    try {
      return await readFile(filePath, 'utf8');
    } catch (err) {
      if (this.isENOENT(err)) return null;
      throw err;
    }
  }

  async set(_key: string, _value: string): Promise<void> {
    const target = this.getFilePath(_key);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tmp, _value, 'utf8');
    await rename(tmp, target);
  }
}
