export const STORAGE_KEYS = ['config', 'merchants'] as const;
export type StorageKey = (typeof STORAGE_KEYS)[number];

export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export class InvalidStorageKeyError extends Error {
  constructor(key: string) {
    super(`Invalid storage key: ${JSON.stringify(key)}`);
    this.name = 'InvalidStorageKeyError';
  }
}

export function assertValidKey(key: string): asserts key is StorageKey {
  if (!(STORAGE_KEYS as readonly string[]).includes(key)) {
    throw new InvalidStorageKeyError(key);
  }
}
