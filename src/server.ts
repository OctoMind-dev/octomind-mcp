import { getAllSessions, removeSession, SessionStatus, setSession } from "./session";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express, { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { getSession, sessionExists } from "./session";
import { logger } from "./logger";
import { version } from "./version";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerResources } from "./resources";
import { registerTools, theStdioSessionId } from "./tools";
import { registerPrompts } from "./prompts";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildSession } from "./session";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";

const getApiKeyFromRequest = (req: Request): string | undefined => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    const apiKeyHeader = req.headers["x-api-key"];
    if (!apiKeyHeader) {
      return undefined;
    }
    if (Array.isArray(apiKeyHeader)) {
      return apiKeyHeader[0];
    }
    return apiKeyHeader;
  } else if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
}

export const buildServer = async (): Promise<McpServer> => {
  const server = new McpServer({
    name: "Octomind MCP Server",
    version,
  });
  await registerTools(server);
  registerResources(server);
  registerPrompts(server);
  const originalConnect = server.connect.bind(server);
  server.connect = async function (transport: Transport) {
    if (transport instanceof SSEServerTransport || transport instanceof StreamableHTTPServerTransport) { 
      logger.debug("Connecting %s transport", transport.constructor.name);
    } else {
    // For STDIO transport, create session immediately
    const apiKey = process.env.APIKEY;
      if (!apiKey) {
        throw new Error("APIKEY environment variable is required");
      }
      logger.debug("Creating session for STDIO transport, using %s", theStdioSessionId);
      await setSession(buildSession({ transport, apiKey, sessionId: theStdioSessionId }));
    }

    // Call original connect
    const result = await originalConnect.call(this, transport);

    return result;
  };

  return server;
};

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.get('/', async (_req: Request, res: Response) => { // health check
    const sessions = await getAllSessions();
    logger.info("Health check, sessions: %s", sessions.length);
    res.json({
      status: "OK",
      version,
      sessions: sessions.length,
    });
  });
  return app;
}

const sendError = (res: Response, code: number, message: string) => {
  logger.error("Error handling request", message);
  res.status(code).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message,
    },
    id: null,
  });
}

export const startSSEServer = async (server: McpServer, port: number) => {
  logger.info("Starting server in SSE mode");
  const app = buildApp();

     app.get('/sse', async (req: Request, res: Response) => {
       const transport = new SSEServerTransport('/messages', res);
       const apiKey = getApiKeyFromRequest(req);
       if (!apiKey) {
         res.status(401).send('Unauthorized, authorization header is required');
         return;
       }
       await setSession(buildSession({ transport, apiKey, sessionId: transport.sessionId }));
       res.on('close', async () => {
         await removeSession(transport.sessionId);
       });
 
       await server.connect(transport);
       logger.info(`Octomind MCP Server SSEversion ${version} started`);
     });
     app.post('/messages', async (req: Request, res: Response) => {
       const sessionId = req.query.sessionId as string;
       let session;
       try {
         session = await getSession(sessionId);
       } catch (error) {
         res.status(400).send('No transport found for sessionId');
         return;
       }
       const transport = session.transport as SSEServerTransport;
       const apiKey = session.apiKey;
       if (!apiKey) {
         res.status(401).send('Unauthorized, authorization header is required');
         return;
       }
       if (transport) {
         if (!transport.sessionId) {
           sendError(res, 400, 'Transport in invalid state: missing sessionId');
           return;
         }
 
         if (res.writableEnded) {
           sendError(res, 500, 'Response is already ended');
           return;
         }
 
         try {
           await transport.handlePostMessage(req, res);
         } catch (error: any) {
           sendError(res, 500, `Error handling message: ${error.message || 'Unknown error'}`);
         }
       } else {
         sendError(res, 400, 'No transport found for sessionId');
       }
     });
     app.listen(port, () => {
       logger.info(`Server started on port ${port}`);
     });
     logger.info(`Octomind MCP Server version ${version} started`);
}

export const startStdioServer = async (server: McpServer) => {
  if (!process.env.APIKEY) {
    console.error("APIKEY environment variable is required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  await server.connect(transport);
  console.error(`Octomind MCP Server version ${version} started`);
}

const buildTransport = async (req: Request, res: Response): Promise<StreamableHTTPServerTransport> => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    eventStore: new InMemoryEventStore(),
    onsessioninitialized: async (sessionId) => {
      // Store the transport by session ID
      const apiKey = getApiKeyFromRequest(req);
      if (!apiKey) {
        res.status(401).send('Unauthorized');
        logger.error("Authorization header is required");
        return;
      }
      await setSession(buildSession({ transport, apiKey, sessionId }));
      logger.info(`Transport initialized for session ${sessionId}`);
    }
  });

  // Clean up transport when closed
  transport.onclose = async () => {
    logger.info(`Transport closed for session ${transport.sessionId}`);
    if (transport.sessionId) {
      await removeSession(transport.sessionId);
    }
  };
  return transport;
}

export const startStreamingServer = async (server: McpServer, port: number) => {
  logger.info(`Starting server in streaming mode on port ${port}`);
    const app = buildApp();
    app.post('/mcp', async (req: Request, res: Response) => {
      const xsessionId = req.headers["x-session-id"];
      logger.info(`Received POST /mcp request for session ${req.headers['mcp-session-id']}, x-session-id: ${xsessionId}`);
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && await sessionExists(sessionId)) {
        // Reuse existing transport
        const session = await getSession(sessionId);
        if (session.status === SessionStatus.TRANSPORT_MISSING) {
          sendError(res, 404, 'Transport missing for sessionId');
          logger.warn(`Transport missing for session ${sessionId}, connection closed`);
          return;
        }
        transport = session.transport as StreamableHTTPServerTransport;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        const apiKey = getApiKeyFromRequest(req);
        if (!apiKey) {
          res.status(401).send('Unauthorized, Authorization header is required');
          logger.error("Authorization header is required");
          return;
        }
        // New initialization request
        transport = await buildTransport(req, res);
        await server.connect(transport);
      } else {
        logger.warn("Bad Request: No valid session ID provided");
        sendError(res, 400, 'Bad Request: No valid session ID provided');
        return;
      }
      try {
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error({ error }, "Error handling request");
      }
    });

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (req: Request, res: Response) => {
    const xsessionId = req.headers["x-session-id"];
    logger.info(`Received ${req.method} /mcp request for session ${req.headers['mcp-session-id']}, x-session-id: ${xsessionId}`);
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessionExists(sessionId)) {
      sendError(res, 400, 'Invalid or missing session ID');
      return;
    }

    const session = await getSession(sessionId);
    if (session.status === SessionStatus.TRANSPORT_MISSING) {
      res.writeHead(404).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Session not found"
        },
        id: null
      }));
      logger.warn(`Transport missing for session ${sessionId}, connection closed`);
      return;
    }
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
      logger.info(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
      logger.info(`Establishing new SSE stream for session ${sessionId}`);
    }
    const transport = session.transport as StreamableHTTPServerTransport;
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error({ error }, "Error handling request");
    }
    if (req.method === "DELETE") {
      await removeSession(sessionId);
      logger.info(`Session ${sessionId} removed`);
    }
  };

  // Handle DELETE requests for session termination
  app.delete('/mcp', handleSessionRequest);

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', handleSessionRequest);

  app.listen(port, () => {
    logger.info(`Streamable HTTP server started on port ${port}`);
  });
  logger.info(`Octomind MCP Server version ${version} started`);
}