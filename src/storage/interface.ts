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

export function assertValidKey(key: string): void {
  if (!/^[a-z0-9_-]+$/.test(key)) {
    throw new InvalidStorageKeyError(key);
  }
}
