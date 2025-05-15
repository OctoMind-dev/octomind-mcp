#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { version } from "./version";

import { checkNotifications } from "./resources";
import { logger } from "./logger";
import { program } from "commander";
import { randomUUID } from "crypto";
import { setSession, initializeSessionStore } from "./session";
import { helpInstall } from "./help";
import { buildServer, startSSEServer, startStreamingServer } from "./server";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export const serverStartupTime = Date.now();
export const theStdioSessionId = randomUUID();

const start = async () => {
  program
    .version(version)
    .option("-s, --sse", "Enable SSE")
    .option("-t, --stream", "Enable Streamable HTTP")
    .option("-c, --clients", "Show clients")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .option("-r, --redis-url <url>", "Redis URL for session storage", process.env.REDIS_URL)
    .option("-e, --session-expiration <seconds>", "Session expiration time in seconds", process.env.SESSION_EXPIRATION_SECONDS)
    .parse(process.argv);

  const opts = program.opts();
  const PORT = parseInt(opts.port);
  
  if (opts.clients) {
    helpInstall();
  }
  
  // Initialize the appropriate session store based on transport type
  if (opts.sse || opts.stream) {
    // For SSE and HTTP transport, use Redis if URL is provided
    const redisUrl = opts.redisUrl || process.env.REDIS_URL;
    const sessionExpirationSeconds = opts.sessionExpiration ? parseInt(opts.sessionExpiration) : undefined;
    
    if (redisUrl) {
      logger.info(`Initializing Redis session store with URL: ${redisUrl.replace(/:[^:]*@/, ':***@')}`);
      if (sessionExpirationSeconds) {
        logger.info(`Session expiration set to ${sessionExpirationSeconds} seconds`);
      }
      
      initializeSessionStore('redis', {
        redisUrl,
        sessionExpirationSeconds,
        redisKeyPrefix: 'octomind:session:'
      });
    } else {
      logger.info('Redis URL not provided, using in-memory session store');
      initializeSessionStore('memory');
    }
  } else {
    // For stdio transport, use in-memory store
    logger.info('Using in-memory session store for stdio transport');
    initializeSessionStore('memory');
  }

  const server = await buildServer();
  const originalConnect = server.connect.bind(server);
  server.connect = async function (transport: Transport) {
    // For STDIO transport, create session immediately
    if (transport instanceof StdioServerTransport) {
      const apiKey = process.env.APIKEY;
      if (!apiKey) {
        throw new Error("APIKEY environment variable is required");
      }
      await setSession({ transport, apiKey, sessionId: theStdioSessionId });
    }

    // Call original connect
    const result = await originalConnect.call(this, transport);

    return result;
  };
  if (opts.stream) {
    await startStreamingServer(server, PORT);
  } else if (opts.sse) {
    await startSSEServer(server, PORT);
  } else {
    if (!process.env.APIKEY) {
      logger.error("APIKEY environment variable is required");
      process.exit(1);
    }
    const transport = new StdioServerTransport();
    logger.info("Connecting server to transport...");
    await server.connect(transport);
    logger.info(`Octomind MCP Server version ${version} started`);

  }
  setInterval(async () => {
    await checkNotifications(server);
  }, 60_000);
  // Cleanup on exit
  process.on("SIGTERM", async () => {
    logger.info(`Octomind MCP Server version ${version} closing`);
    await server.close();
    process.exit(0);
  });
  process.on("SIGINT", async () => {
    logger.info(`Octomind MCP Server version ${version} closing`);
    await server.close();
    process.exit(0);
  });
};

start()
  .then(() => {
    logger.info(`Server version ${version} started`);
  })
  .catch((error) => {
    logger.error("Error starting server:", error);
    process.exit(1);
  });
