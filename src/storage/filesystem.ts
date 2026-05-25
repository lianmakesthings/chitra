import type { Storage } from './interface.js';

export class FilesystemStorage implements Storage {
  constructor(private readonly dataDir: string) {
    // TODO: implement
    void this.dataDir;
  }

  async get(_key: string): Promise<string | null> {
    throw new Error('FilesystemStorage.get not implemented');
  }

  async set(_key: string, _value: string): Promise<void> {
    throw new Error('FilesystemStorage.set not implemented');
  }
}
