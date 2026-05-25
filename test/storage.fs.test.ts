import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilesystemStorage } from '../src/storage/filesystem.js';
import { runStorageContract } from './storage.contract.js';

runStorageContract('FilesystemStorage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chitra-fs-'));
  return new FilesystemStorage(dir);
});
