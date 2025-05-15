import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export type Session = {
  transport: SSEServerTransport | StdioServerTransport | StreamableHTTPServerTransport;
  sessionId: string;
  apiKey: string;
  currentTestTargetId?: string;
}

/**
 * Interface for session storage implementations
 */
export interface SessionStore {
  /**
   * Get a session by its ID
   * @param sessionId The session ID
   * @returns The session object
   * @throws Error if session not found
   */
  getSession(sessionId: string): Promise<Session>;

  /**
   * Remove a session by its ID
   * @param sessionId The session ID
   */
  removeSession(sessionId: string): Promise<void>;

  /**
   * Get all active sessions
   * @returns Array of all sessions
   */
  getAllSessions(): Promise<Session[]>;

  /**
   * Store a session
   * @param session The session to store
   */
  setSession(session: Session): Promise<void>;

  /**
   * Check if a session exists
   * @param sessionId The session ID to check
   * @returns True if the session exists, false otherwise
   */
  sessionExists(sessionId: string): Promise<boolean>;
}

/**
 * In-memory implementation of SessionStore
 */
export class InMemorySessionStore implements SessionStore {
  private sessions: Record<string, Session> = {};

  async getSession(sessionId: string): Promise<Session> {
    const session = this.sessions[sessionId];
    if (!session) {
      throw new Error("Session not found");
    }
    return session;
  }

  async removeSession(sessionId: string): Promise<void> {
    delete this.sessions[sessionId];
  }

  async getAllSessions(): Promise<Session[]> {
    return Object.values(this.sessions);
  }

  async setSession(session: Session): Promise<void> {
    this.sessions[session.sessionId] = session;
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    return this.sessions[sessionId] !== undefined;
  }
}

/**
 * Redis implementation of SessionStore
 * Requires redis package to be installed
 */
export class RedisSessionStore implements SessionStore {
  private client: any; // Redis client
  private prefix: string;
  private clientInitialized: boolean = false;
  private clientInitPromise: Promise<void> | null = null;
  private redisUrl: string;
  private expirationSeconds: number | null;

  /**
   * Create a new RedisSessionStore
   * @param redisUrl Redis connection URL (e.g., redis://localhost:6379)
   * @param options Configuration options
   * @param options.prefix Key prefix for Redis storage (default: 'octomind:session:')
   * @param options.expirationSeconds Time in seconds after which sessions expire (default: null, no expiration)
   */
  constructor(redisUrl: string, options?: { prefix?: string; expirationSeconds?: number }) {
    this.redisUrl = redisUrl;
    this.prefix = options?.prefix || 'octomind:session:';
    this.expirationSeconds = options?.expirationSeconds || null;
  }

  /**
   * Ensures the Redis client is initialized before performing operations
   */
  private async ensureClient(): Promise<void> {
    if (this.clientInitialized) return;
    
    if (!this.clientInitPromise) {
      this.clientInitPromise = this.initializeRedisClient();
    }
    
    await this.clientInitPromise;
  }

  /**
   * Initialize the Redis client
   */
  private async initializeRedisClient(): Promise<void> {
    try {
      // Dynamic import to avoid requiring redis for users who don't need it
      const redis = await import('redis').catch(() => {
        throw new Error('Redis package not installed. Please install it with: pnpm add redis');
      });
      
      this.client = redis.createClient({ url: this.redisUrl });
      
      // Set up error handler
      this.client.on('error', (err: Error) => {
        console.error('Redis client error:', err);
      });
      
      await this.client.connect();
      this.clientInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<Session> {
    await this.ensureClient();
    const key = this.prefix + sessionId;
    const sessionData = await this.client.get(key);
    
    if (!sessionData) {
      throw new Error("Session not found");
    }
    
    return JSON.parse(sessionData);
  }

  async removeSession(sessionId: string): Promise<void> {
    await this.ensureClient();
    const key = this.prefix + sessionId;
    await this.client.del(key);
  }

  async getAllSessions(): Promise<Session[]> {
    await this.ensureClient();
    const keys = await this.client.keys(this.prefix + '*');
    if (keys.length === 0) return [];
    
    const sessions = await Promise.all(
      keys.map(async (key: string) => {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      })
    );
    
    return sessions.filter((session): session is Session => session !== null);
  }

  async setSession(session: Session): Promise<void> {
    await this.ensureClient();
    const key = this.prefix + session.sessionId;
    
    if (this.expirationSeconds) {
      // Set with expiration
      await this.client.set(key, JSON.stringify(session), {
        EX: this.expirationSeconds
      });
    } else {
      // Set without expiration
      await this.client.set(key, JSON.stringify(session));
    }
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    await this.ensureClient();
    const key = this.prefix + sessionId;
    const exists = await this.client.exists(key);
    return exists > 0;
  }
}

// Global store instance that will be initialized in the startup code
let sessionStore: SessionStore | null = null;

/**
 * Initialize the session store
 * @param storeType Type of store to initialize ('memory' or 'redis')
 * @param options Configuration options
 * @param options.redisUrl Redis URL if using Redis store
 * @param options.sessionExpirationSeconds Time in seconds after which sessions expire (Redis only)
 * @param options.redisKeyPrefix Key prefix for Redis storage (default: 'octomind:session:')
 */
export const initializeSessionStore = (
  storeType: 'memory' | 'redis', 
  options?: { 
    redisUrl?: string; 
    sessionExpirationSeconds?: number; 
    redisKeyPrefix?: string 
  }
): SessionStore => {
  if (storeType === 'redis') {
    if (!options?.redisUrl) {
      throw new Error('Redis URL is required for Redis session store');
    }
    sessionStore = new RedisSessionStore(options.redisUrl, {
      prefix: options.redisKeyPrefix,
      expirationSeconds: options.sessionExpirationSeconds
    });
  } else {
    sessionStore = new InMemorySessionStore();
  }
  return sessionStore;
};

/**
 * Get the current session store or initialize a default in-memory store if none exists
 */
export const getSessionStore = (): SessionStore => {
  if (!sessionStore) {
    sessionStore = new InMemorySessionStore();
  }
  return sessionStore;
};

/**
 * Get a session by its ID
 */
export const getSession = async (sessionId: string): Promise<Session> => {
  return getSessionStore().getSession(sessionId);
};

/**
 * Remove a session by its ID
 */
export const removeSession = async (sessionId: string): Promise<void> => {
  return getSessionStore().removeSession(sessionId);
};

/**
 * Get all active sessions
 */
export const getAllSessions = async (): Promise<Session[]> => {
  return getSessionStore().getAllSessions();
};

/**
 * Store a session
 */
export const setSession = async (session: Session): Promise<void> => {
  return getSessionStore().setSession(session);
};

/**
 * Check if a session exists
 */
export const sessionExists = async (sessionId: string): Promise<boolean> => {
  return getSessionStore().sessionExists(sessionId);
};