declare module 'redis' {
  export function createClient(options: { url: string }): RedisClient;
  
  export interface RedisClient {
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    del(key: string): Promise<void>;
    keys(pattern: string): Promise<string[]>;
    exists(key: string): Promise<number>;
    on(event: string, callback: (error: Error) => void): void;
  }
}
