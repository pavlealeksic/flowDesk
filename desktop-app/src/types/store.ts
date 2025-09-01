/**
 * Proper typed wrapper for electron-store v10
 * 
 * This provides a clean interface that wraps electron-store with proper typing
 * to avoid the module resolution issues with the official types.
 */

import Store from 'electron-store';

export interface TypedStore<T extends Record<string, unknown>> {
  get<K extends keyof T>(key: K): T[K];
  get<K extends keyof T>(key: K, defaultValue: T[K]): T[K];
  get(key: string): unknown;
  get(key: string, defaultValue: unknown): unknown;

  set<K extends keyof T>(key: K, value: T[K]): void;
  set(key: string, value: unknown): void;
  set(object: Partial<T>): void;

  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  reset(...keys: string[]): void;

  readonly size: number;
  store: T;
  readonly path: string;

  openInEditor(): void;
  onDidChange<K extends keyof T>(key: K, callback: (newValue?: T[K], oldValue?: T[K]) => void): () => void;
  onDidAnyChange(callback: (newValue?: T, oldValue?: T) => void): () => void;
}

/**
 * Create a typed store instance
 */
export function createTypedStore<T extends Record<string, unknown>>(options?: Record<string, unknown>): TypedStore<T> {
  return new Store(options) as unknown as TypedStore<T>;
}

export { Store };
export default Store;