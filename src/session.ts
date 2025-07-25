import { logger } from "./logger";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * Session status enum to track the state of the session
 */
export enum SessionStatus {
  /** Session is active with a valid transport */
  ACTIVE = 'active',
  /** Session exists but transport is missing (e.g., after server restart) */
  TRANSPORT_MISSING = 'transport_missing'
}

/**
 * Session interface representing a client session
 */
export type Session = {
  /** Transport for communication with the client */
  transport?: Transport;
  /** Unique session identifier */
  sessionId: string;
  /** API key for authentication */
  apiKey: string;
  /** Optional current test target ID */
  currentTestTargetId?: string;
  /** Session status (defaults to ACTIVE when not specified) */
  status?: SessionStatus;

  /** The time when the last test report was refreshed */
  lastTestReportRefreshTime?: number;
  /** The time when the last test case was refreshed */
  lastTestCaseRefreshTime?: number;
  /** IDs of the test reports that are currently available */
  testReportIds: string[];
  testCaseIds: string[];
  tracesForTestReport: Record<string, string>;
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
/**
 * Extended session with expiration tracking
 */
interface SessionWithExpiry extends Session {
  /** Timestamp when the session was last accessed */
  lastAccessedAt: number;
}

export class InMemorySessionStore implements SessionStore {
  private sessions: Record<string, SessionWithExpiry> = {};
  private expirationTimeMs: number;
  private cleanupIntervalId?: NodeJS.Timeout;

  /**
   * Creates a new InMemorySessionStore
   * @param expirationSeconds Time in seconds after which inactive sessions expire (default: 3600 = 1 hour)
   * @param cleanupIntervalSeconds Interval in seconds to check for and remove expired sessions (default: 300 = 5 minutes)
   */
  constructor(expirationSeconds = 3600, cleanupIntervalSeconds = 300) {
    this.expirationTimeMs = expirationSeconds * 1000;
    logger.info(`InMemorySessionStore created with ${expirationSeconds === 0 ? 'no expiration' : `expiration time of ${expirationSeconds} seconds`}`);
    
    // Only set up cleanup if expiration is enabled (non-zero)
    if (expirationSeconds > 0) {
      this.cleanupIntervalId = setInterval(() => {
        this.removeExpiredSessions();
      }, cleanupIntervalSeconds * 1000);
    }
  }

  /**
   * Removes all expired sessions from the store
   * @returns The number of sessions that were removed
   */
  private removeExpiredSessions(): number {
    // If expiration is disabled, no sessions should expire
    if (this.expirationTimeMs <= 0) {
      return 0;
    }
    
    const now = Date.now();
    const expiredSessionIds = Object.entries(this.sessions)
      .filter(([_, session]) => now - session.lastAccessedAt > this.expirationTimeMs)
      .map(([id, _]) => id);
    
    expiredSessionIds.forEach(id => {
      logger.info(`Removing expired session: ${id}`);
      delete this.sessions[id];
    });
    
    if (expiredSessionIds.length > 0) {
      logger.info(`Removed ${expiredSessionIds.length} expired sessions`);
    }
    
    return expiredSessionIds.length;
  }

  /**
   * Updates the last accessed timestamp for a session
   * @param sessionId The ID of the session to update
   */
  private updateAccessTime(sessionId: string): void {
    if (this.sessions[sessionId]) {
      this.sessions[sessionId].lastAccessedAt = Date.now();
    }
  }

  /**
   * Cleans up resources when the store is no longer needed
   */
  public dispose(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
  }

  async getSession(sessionId: string): Promise<Session> {
    const session = this.sessions[sessionId];
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Update the last accessed time
    this.updateAccessTime(sessionId);
    
    return session;
  }

  async removeSession(sessionId: string): Promise<void> {
    delete this.sessions[sessionId];
  }

  async getAllSessions(): Promise<Session[]> {
    return Object.values(this.sessions);
  }

  async setSession(session: Session): Promise<void> {
    // Add the lastAccessedAt property when storing the session
    this.sessions[session.sessionId] = {
      ...session,
      lastAccessedAt: Date.now()
    };
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    const exists = this.sessions[sessionId] !== undefined;
    
    if (exists) {
      // Update the last accessed time if the session exists
      this.updateAccessTime(sessionId);
    }
    
    return exists;
  }
}

export const buildSession = ({transport, apiKey, sessionId, testReportIds, testCaseIds, tracesForTestReport, lastTestReportRefreshTime, lastTestCaseRefreshTime, status}:
   {transport: Transport,
  apiKey: string, 
  sessionId: string,
  testReportIds?: string[],
  testCaseIds?: string[],
  tracesForTestReport?: Record<string, string>,
  lastTestReportRefreshTime?: number,
  lastTestCaseRefreshTime?: number,
  status?: SessionStatus,
}): Session => {
  return {
    transport,
    apiKey,
    sessionId,
    testReportIds: testReportIds || [],
    testCaseIds: testCaseIds || [],
    tracesForTestReport: tracesForTestReport || {},
    lastTestReportRefreshTime: lastTestReportRefreshTime || undefined,
    lastTestCaseRefreshTime: lastTestCaseRefreshTime || undefined,
    status: status || SessionStatus.ACTIVE,
  };
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
  private transportCache: Record<string, Transport> = {};

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
    logger.info("RedisSessionStore created", {redisUrl, prefix: this.prefix, expirationSeconds: this.expirationSeconds});
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
        logger.error('Redis client error:', err);
      });
      
      await this.client.connect();
      this.clientInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
      throw error;
    }
  }

  /**
   * Extracts the session ID from a Redis key
   * @param key Redis key with prefix
   * @returns Session ID without prefix
   */
  private extractSessionId(key: string): string {
    return key.substring(this.prefix.length);
  }

  /**
   * Prepares a session for storage by removing the transport object
   * @param session The complete session object
   * @returns A session object without the transport property
   */
  private prepareSessionForStorage(session: Session): Omit<Session, 'transport'> {
    // Only store the transport if it exists
    if (session.transport) {
      this.transportCache[session.sessionId] = session.transport;
    }
    
    // Create a new object without the transport property
    const { transport, ...sessionWithoutTransport } = session;
    
    // Determine the appropriate status for this process
    // Note: This status will be overridden when the session is restored
    // based on whether the transport is available in that process
    let status = session.status || SessionStatus.ACTIVE;
    
    // If transport is missing, override status regardless of what was provided
    if (!session.transport) {
      status = SessionStatus.TRANSPORT_MISSING;
    }
    
    // Return session data without transport (for Redis storage)
    return { 
      ...sessionWithoutTransport, 
      status
    };
  }

  /**
   * Restores a session by adding back the transport object from memory if available
   * @param sessionData The session data from Redis
   * @param sessionId The session ID
   * @returns The complete session with transport if available
   */
  private restoreSession(sessionData: any, sessionId: string): Session {
    // Parse the session data
    const parsedData = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
    
    // Always try to get the transport from memory cache
    const transport = this.transportCache[sessionId];
    
    // Create a copy of the session data
    const sessionCopy = { ...parsedData };
    
    if (transport) {
      // Transport found in memory cache, add it to the session
      sessionCopy.transport = transport;
      sessionCopy.status = SessionStatus.ACTIVE;
      logger.debug(`Restored transport from memory cache for session ${sessionId}`);
    } else {
      // No transport in memory cache, mark as missing
      sessionCopy.status = SessionStatus.TRANSPORT_MISSING;
      logger.debug(`No transport found in memory cache for session ${sessionId}`);
    }
    
    return sessionCopy;
  }

  async getSession(sessionId: string): Promise<Session> {
    await this.ensureClient();
    const key = this.prefix + sessionId;
    const sessionData = await this.client.get(key);
    
    if (!sessionData) {
      throw new Error("Session not found");
    }
    
    return this.restoreSession(sessionData, sessionId);
  }

  async removeSession(sessionId: string): Promise<void> {
    await this.ensureClient();
    const key = this.prefix + sessionId;
    await this.client.del(key);
    
    // Also remove from transport cache
    delete this.transportCache[sessionId];
  }

  async getAllSessions(): Promise<Session[]> {
    await this.ensureClient();
    const keys = await this.client.keys(this.prefix + '*');
    if (keys.length === 0) return [];
    
    const sessions = await Promise.all(
      keys.map(async (key: string) => {
        const sessionId = this.extractSessionId(key);
        const data = await this.client.get(key);
        return data ? this.restoreSession(data, sessionId) : null;
      })
    );
    
    return sessions.filter((session): session is Session => session !== null);
  }

  async setSession(session: Session): Promise<void> {
    await this.ensureClient();
    const key = this.prefix + session.sessionId;
    
    // Prepare session for storage (remove transport and store it in memory)
    const storableSession = this.prepareSessionForStorage(session);
    
    if (this.expirationSeconds) {
      // Set with expiration
      await this.client.set(key, JSON.stringify(storableSession), {
        EX: this.expirationSeconds
      });
    } else {
      // Set without expiration
      await this.client.set(key, JSON.stringify(storableSession));
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
  logger.info("Initializing session store", {storeType, options});
  if (storeType === 'redis') {
    if (!options?.redisUrl) {
      throw new Error('Redis URL is required for Redis session store');
    }
    sessionStore = new RedisSessionStore(options.redisUrl, {
      prefix: options.redisKeyPrefix,
      expirationSeconds: options.sessionExpirationSeconds
    });
  } else {
    sessionStore = new InMemorySessionStore(options?.sessionExpirationSeconds);
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