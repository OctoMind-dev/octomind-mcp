declare module "redis" {
  export function createClient(options: { url: string }): RedisClient;

  export interface RedisClient {
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: SetOptions): Promise<void>;
    del(key: string): Promise<void>;
    keys(pattern: string): Promise<string[]>;
    exists(key: string): Promise<number>;
    on(event: string, callback: (error: Error) => void): void;
  }

  export interface SetOptions {
    EX?: number; // Expiration time in seconds
    PX?: number; // Expiration time in milliseconds
    NX?: boolean; // Only set the key if it does not already exist
    XX?: boolean; // Only set the key if it already exists
    KEEPTTL?: boolean; // Retain the time to live associated with the key
  }
}
