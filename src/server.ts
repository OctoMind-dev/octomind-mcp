import { removeSession, SessionStatus, setSession } from "./session";
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
import { registerTools } from "./tools";
import { registerPrompts } from "./prompts";

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
  return server;
};

export const startSSEServer = async(server: McpServer, port: number) => {
     logger.info("Starting server in SSE mode");
     const app = express();
     app.use(express.json());
     app.get('/', (_req: Request, res: Response) => { // health check
       res.send('OK');
     });
     app.get('/sse', async (req: Request, res: Response) => {
       const transport = new SSEServerTransport('/messages', res);
       const apiKey = getApiKeyFromRequest(req);
       if (!apiKey) {
         res.status(401).send('Unauthorized, authorization header is required');
         return;
       }
       await setSession({ transport, apiKey, sessionId: transport.sessionId });
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
         // Check if transport is in a good state
         if (!transport.sessionId) {
           logger.error('Transport missing sessionId');
           res.status(500).send('Transport in invalid state: missing sessionId');
           return;
         }
 
         // Check if the response object is still writable
         if (res.writableEnded) {
           logger.error('Response is already ended');
           return;
         }
 
         try {
           logger.debug(`Handling post message for session ${sessionId}`);
           // Add more debugging about the transport state
           logger.info(`Transport state: sessionId=${transport.sessionId}`);
           // Log request details to help diagnose the issue
           logger.debug(`Request body:`, JSON.stringify(req.body));
           logger.debug(`Request headers:`, JSON.stringify(req.headers));
 
           await transport.handlePostMessage(req, res);
           logger.debug(`Successfully handled post message for session ${sessionId}`);
         } catch (error: any) {
           logger.error('Error handling post message:', error);
           if (!res.headersSent) {
             res.status(500).send(`Error handling message: ${error.message || 'Unknown error'}`);
           }
         }
       } else {
         res.status(400).send('No transport found for sessionId');
       }
     });
     app.listen(port, () => {
       logger.info(`Server started on port ${port}`);
     });
     logger.info(`Octomind MCP Server version ${version} started`);
    
}

export const startStreamingServer = async (server: McpServer, port: number) => {
    const app = express();
    app.use(express.json());
    app.get('/', (_req: Request, res: Response) => { // health check
      res.send('OK');
    });
    app.post('/mcp', async (req: Request, res: Response) => {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && await sessionExists(sessionId)) {
        // Reuse existing transport
        const session = await getSession(sessionId);
        if (session.status === SessionStatus.TRANSPORT_MISSING) {
          res.status(404).send('Transport missing for sessionId');
          logger.warn(`Transport missing for session ${sessionId}, connection closed`);
          return;
        }
        transport = session.transport as StreamableHTTPServerTransport;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: async (sessionId) => {
            // Store the transport by session ID
            const apiKey = getApiKeyFromRequest(req);
            if (!apiKey) {
              throw new Error("Unauthorized");
            }
            await setSession({ transport, apiKey, sessionId });
          }
        });

        // Clean up transport when closed
        transport.onclose = async () => {
          if (transport.sessionId) {
            await removeSession(transport.sessionId);
          }
        };

        // Connect to the MCP server
        await server.connect(transport);
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }
      // Handle the request
      await transport.handleRequest(req, res, req.body);
    });

    // Reusable handler for GET and DELETE requests
    const handleSessionRequest = async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !sessionExists(sessionId)) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const session = await getSession(sessionId);
      if (session.status === SessionStatus.TRANSPORT_MISSING) {
        res.status(404).send('Transport missing for sessionId');
        logger.warn(`Transport missing for session ${sessionId}, connection closed`);
        return;
      }
      const transport = session.transport as StreamableHTTPServerTransport;
      await transport.handleRequest(req, res);
      if( req.method === "DELETE") {
        await removeSession(sessionId);
      }
    };

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    app.delete('/mcp', handleSessionRequest);
    app.listen(port, () => {
      logger.info(`Streamable HTTP server started on port ${port}`);
    });
    logger.info(`Octomind MCP Server version ${version} started`);
  }