/**
 * Proper TypeScript declarations for electron-store
 */

declare module 'electron-store' {
  interface Options<T = Record<string, unknown>> {
    name?: string;
    cwd?: string;
    encryptionKey?: string | Buffer | NodeJS.TypedArray | DataView;
    fileExtension?: string;
    clearInvalidConfig?: boolean;
    serialize?: (value: T) => string;
    deserialize?: (text: string) => T;
    projectName?: string;
    projectSuffix?: string;
    projectVersion?: string;
    schema?: Record<string, any>;
    defaults?: T;
    migrations?: Record<string, (store: ElectronStore<T>) => void>;
    beforeEachMigration?: (store: ElectronStore<T>, context: { fromVersion: string; toVersion: string; finalVersion: string; versions: string[] }) => void;
    accessPropertiesByDotNotation?: boolean;
    watch?: boolean;
    configFileMode?: number;
  }

  interface ElectronStore<T = Record<string, unknown>> {
    /**
     * Get an item from the store
     */
    get<K extends keyof T>(key: K): T[K];
    get<K extends keyof T>(key: K, defaultValue: T[K]): T[K];
    get(key: string): unknown;
    get(key: string, defaultValue: unknown): unknown;

    /**
     * Set an item in the store
     */
    set<K extends keyof T>(key: K, value: T[K]): void;
    set(key: string, value: unknown): void;
    set(object: Partial<T>): void;

    /**
     * Check if an item exists
     */
    has(key: string): boolean;

    /**
     * Delete an item
     */
    delete(key: string): void;

    /**
     * Clear all items
     */
    clear(): void;

    /**
     * Reset known items to their default values
     */
    reset(...keys: string[]): void;

    /**
     * Get the size of the store
     */
    readonly size: number;

    /**
     * Get/set all store data
     */
    store: T;

    /**
     * Get the store path
     */
    readonly path: string;

    /**
     * Open the config file in the user's editor
     */
    openInEditor(): void;
  }

  class ElectronStore<T = Record<string, unknown>> {
    constructor(options?: Options<T>);

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

    onDidChange<K extends keyof T>(
      key: K,
      callback: (newValue: T[K], oldValue: T[K]) => void
    ): () => void;

    onDidAnyChange(callback: (newValue: T, oldValue: T) => void): () => void;
  }

  export default ElectronStore;
  export { ElectronStore };
}