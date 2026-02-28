import { randomUUID } from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";

import { getStdioEnv } from "./env";
import { logger } from "./logger";
import {
  getOAuthConfig,
  getProtectedResourceMetadata,
  getWWWAuthenticateHeader,
} from "./oauth-config";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import {
  buildSession,
  getAllSessions,
  getSession,
  removeSession,
  SessionStatus,
  sessionExists,
  setSession,
} from "./session";
import { registerTools, theStdioSessionId } from "./tools";
import { version } from "./version";

const getApiKeyFromRequest = (req: Request): string | undefined => {
  logger.debug("Extracting API key/token from request headers");
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    logger.debug("No Authorization header found, checking x-api-key header");
    const apiKeyHeader = req.headers["x-api-key"];
    if (!apiKeyHeader) {
      logger.debug("No x-api-key header found, authentication failed");
      return undefined;
    }
    if (Array.isArray(apiKeyHeader)) {
      logger.debug("Found x-api-key header (array), using first value");
      return apiKeyHeader[0];
    }
    logger.debug("Found x-api-key header");
    return apiKeyHeader;
  } else if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    logger.debug(
      `Found Bearer token in Authorization header (length: ${token.length})`,
    );
    return token;
  }
  logger.debug("Authorization header present but not in Bearer format");
  return undefined;
};

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
    if (
      transport instanceof SSEServerTransport ||
      transport instanceof StreamableHTTPServerTransport
    ) {
      logger.debug("Connecting %s transport", transport.constructor.name);
    } else {
      // For STDIO transport, create session immediately
      const { apiKey } = getStdioEnv();
      logger.debug(
        "Creating session for STDIO transport, using %s",
        theStdioSessionId,
      );
      await setSession(
        buildSession({ transport, apiKey, sessionId: theStdioSessionId }),
      );
    }

    // Call original connect
    const result = await originalConnect.call(this, transport);

    return result;
  };

  return server;
};

const healthCheck = async (_req: Request, res: Response) => {
  res.json({
    status: "OK",
    version,
    sessions: (await getAllSessions()).length,
  });
};

const buildApp = () => {
  const app = express();

  // Add CORS headers for all requests
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, mcp-session-id, mcp-protocol-version",
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      logger.debug(`CORS preflight request for ${req.url}`);
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json());
  app.get("/", healthCheck);
  app.get("/health", healthCheck);

  // OAuth Protected Resource Metadata endpoint (RFC 9728)
  const oauthConfig = getOAuthConfig();
  const metadata = getProtectedResourceMetadata(oauthConfig);

  logger.debug("OAuth Protected Resource Metadata: %j", metadata);
  // Root well-known endpoint
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    logger.debug("Serving OAuth Protected Resource Metadata (root)");
    res.json(metadata);
  });

  // Sub-path well-known endpoint for /mcp
  app.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
    logger.debug("Serving OAuth Protected Resource Metadata (mcp sub-path)");
    res.json(metadata);
  });

  // Handle requests for OpenID Configuration - redirect to auth server
  app.get("/.well-known/openid-configuration", (_req, res) => {
    logger.info(
      "Received request for /.well-known/openid-configuration - this should be fetched from the authorization server",
    );
    logger.info(
      `Redirecting to authorization server: ${oauthConfig.authServerUrl}/.well-known/openid-configuration`,
    );
    res.redirect(
      301,
      `${oauthConfig.authServerUrl}/.well-known/openid-configuration`,
    );
  });

  // Handle requests for OAuth Authorization Server Metadata
  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    logger.info(
      "Received request for /.well-known/oauth-authorization-server - this should be fetched from the authorization server",
    );
    res.json({
      jwksUrl: `${oauthConfig.authServerUrl}/.well-known/jwks.json`,
      authEndpoint: `${oauthConfig.authServerUrl}/oauth/2.1/authorize`,
      tokenEndpoint: `${oauthConfig.authServerUrl}/oauth/2.1/token`,
    });
  });

  logger.info("OAuth Protected Resource Metadata endpoints registered");

  return app;
};

const sendError = (
  res: Response,
  code: number,
  message: string,
  includeWWWAuthenticate = false,
) => {
  logger.error("Error handling request", message);

  // Add WWW-Authenticate header for 401 responses if OAuth is configured
  if (code === 401 && includeWWWAuthenticate) {
    const oauthConfig = getOAuthConfig();
    const wwwAuthHeader = getWWWAuthenticateHeader(oauthConfig);
    res.setHeader("WWW-Authenticate", wwwAuthHeader);
  }

  res.status(code).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message,
    },
    id: null,
  });
};

export const startSSEServer = async (server: McpServer, port: number) => {
  logger.info("Starting server in SSE mode");
  const app = buildApp();

  app.get("/sse", async (req: Request, res: Response) => {
    logger.debug("SSE connection request received");
    const transport = new SSEServerTransport("/messages", res);
    const apiKey = getApiKeyFromRequest(req);
    if (!apiKey) {
      logger.debug("SSE authentication failed, sending 401 response");
      const oauthConfig = getOAuthConfig();
      const wwwAuthHeader = getWWWAuthenticateHeader(oauthConfig);
      logger.debug(`Adding WWW-Authenticate header: ${wwwAuthHeader}`);
      res.setHeader("WWW-Authenticate", wwwAuthHeader);
      res.status(401).send("Unauthorized, authorization header is required");
      return;
    }
    logger.debug("SSE authentication successful, creating session");
    await setSession(
      buildSession({ transport, apiKey, sessionId: transport.sessionId }),
    );
    res.on("close", async () => {
      await removeSession(transport.sessionId);
    });

    await server.connect(transport);
    logger.info(`Octomind MCP Server SSEversion ${version} started`);
  });
  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    logger.debug(`SSE message received for session: ${sessionId}`);
    let session;
    try {
      session = await getSession(sessionId);
      logger.debug(`Session found for ${sessionId}`);
    } catch (_error) {
      logger.debug(`No session found for ${sessionId}`);
      res.status(400).send("No transport found for sessionId");
      return;
    }
    const transport = session.transport as SSEServerTransport;
    const apiKey = session.apiKey;
    if (!apiKey) {
      logger.debug(
        `Session ${sessionId} has no API key, authentication failed`,
      );
      const oauthConfig = getOAuthConfig();
      const wwwAuthHeader = getWWWAuthenticateHeader(oauthConfig);
      logger.debug(`Adding WWW-Authenticate header: ${wwwAuthHeader}`);
      res.setHeader("WWW-Authenticate", wwwAuthHeader);
      res.status(401).send("Unauthorized, authorization header is required");
      return;
    }
    logger.debug(`Session ${sessionId} authenticated successfully`);
    if (transport) {
      if (!transport.sessionId) {
        sendError(res, 400, "Transport in invalid state: missing sessionId");
        return;
      }

      if (res.writableEnded) {
        sendError(res, 500, "Response is already ended");
        return;
      }

      try {
        await transport.handlePostMessage(req, res);
      } catch (error: unknown) {
        sendError(
          res,
          500,
          `Error handling message: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    } else {
      sendError(res, 400, "No transport found for sessionId");
    }
  });

  // Catch-all route to log unhandled requests
  app.use((req, res) => {
    logger.warn(
      `Unhandled request: ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`,
    );
    logger.debug(`Request body: ${JSON.stringify(req.body)}`);
    res.status(404).json({
      error: "Not Found",
      message: `Endpoint ${req.method} ${req.url} not found`,
      availableEndpoints: [
        "GET /",
        "GET /health",
        "GET /.well-known/oauth-protected-resource",
        "GET /.well-known/oauth-protected-resource/mcp",
        "GET /sse",
        "POST /messages",
      ],
    });
  });

  app.listen(port, () => {
    logger.info(`Server started on port ${port}`);
  });
  logger.info(`Octomind MCP Server version ${version} started`);
};

export const startStdioServer = async (server: McpServer) => {
  getStdioEnv();
  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  await server.connect(transport);
  console.error(`Octomind MCP Server version ${version} started`);
};

const buildTransport = async (
  req: Request,
  res: Response,
): Promise<StreamableHTTPServerTransport> => {
  logger.debug("Building new StreamableHTTPServerTransport");
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: async (sessionId) => {
      logger.debug(`Session initialized callback for ${sessionId}`);
      // Store the transport by session ID
      const apiKey = getApiKeyFromRequest(req);
      if (!apiKey) {
        logger.debug(`Session ${sessionId} initialization failed - no API key`);
        const oauthConfig = getOAuthConfig();
        const wwwAuthHeader = getWWWAuthenticateHeader(oauthConfig);
        logger.debug(`Adding WWW-Authenticate header: ${wwwAuthHeader}`);
        res.setHeader("WWW-Authenticate", wwwAuthHeader);
        res.status(401).send("Unauthorized");
        logger.error("Authorization header is required");
        return;
      }
      logger.debug(`Session ${sessionId} authenticated, storing session`);
      await setSession(buildSession({ transport, apiKey, sessionId }));
      logger.info(`Transport initialized for session ${sessionId}`);
    },
  });

  // Clean up transport when closed
  transport.onclose = async () => {
    logger.info(`Transport closed for session ${transport.sessionId}`);
    if (transport.sessionId) {
      await removeSession(transport.sessionId);
    }
  };
  return transport;
};

export const startStreamingServer = async (server: McpServer, port: number) => {
  logger.info(`Starting server in streaming mode on port ${port}`);
  const app = buildApp();
  app.post("/mcp", async (req: Request, res: Response) => {
    const xsessionId = req.headers["x-session-id"];
    const mcpSessionId = req.headers["mcp-session-id"];
    logger.info(
      `Received POST /mcp request for session ${mcpSessionId}, x-session-id: ${xsessionId}`,
    );
    logger.debug(
      `Request has Authorization header: ${!!req.headers["authorization"]}`,
    );
    logger.debug(`Request is initialize: ${isInitializeRequest(req.body)}`);

    // Check for existing session ID
    const sessionId = mcpSessionId as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && (await sessionExists(sessionId))) {
      logger.debug(`Reusing existing session ${sessionId}`);
      // Reuse existing transport
      const session = await getSession(sessionId);
      if (session.status === SessionStatus.TRANSPORT_MISSING) {
        logger.warn(`Transport missing for session ${sessionId}`);
        sendError(res, 404, "Transport missing for sessionId");
        logger.warn(
          `Transport missing for session ${sessionId}, connection closed`,
        );
        return;
      }
      logger.debug(`Session ${sessionId} transport found and active`);
      transport = session.transport as StreamableHTTPServerTransport;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      logger.debug("New initialize request, checking authentication");
      const apiKey = getApiKeyFromRequest(req);
      if (!apiKey) {
        logger.debug("Initialize request authentication failed");
        const oauthConfig = getOAuthConfig();
        if (oauthConfig) {
          const wwwAuthHeader = getWWWAuthenticateHeader(oauthConfig);
          logger.debug(`Adding WWW-Authenticate header: ${wwwAuthHeader}`);
          res.setHeader("WWW-Authenticate", wwwAuthHeader);
        } else {
          logger.debug(
            "OAuth not configured, sending 401 without WWW-Authenticate header",
          );
        }
        res.status(401).send("Unauthorized, Authorization header is required");
        logger.error("Authorization header is required");
        return;
      }
      logger.debug("Initialize request authenticated successfully");
      // New initialization request
      transport = await buildTransport(req, res);
      await server.connect(transport);
    } else {
      logger.warn("Bad Request: No valid session ID provided");
      sendError(res, 400, "Bad Request: No valid session ID provided");
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
    logger.info(
      `Received ${req.method} /mcp request for session ${req.headers["mcp-session-id"]}, x-session-id: ${xsessionId}`,
    );
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessionExists(sessionId)) {
      sendError(res, 400, "Invalid or missing session ID");
      return;
    }

    const session = await getSession(sessionId);
    if (session.status === SessionStatus.TRANSPORT_MISSING) {
      res.writeHead(404).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Session not found",
          },
          id: null,
        }),
      );
      logger.warn(
        `Transport missing for session ${sessionId}, connection closed`,
      );
      return;
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
  app.delete("/mcp", handleSessionRequest);

  // Handle GET requests for server-to-client notifications via SSE
  app.get("/mcp", handleSessionRequest);

  // Catch-all route to log unhandled requests
  app.use((req, res) => {
    logger.warn(
      `Unhandled request: ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`,
    );
    logger.debug(`Request body: ${JSON.stringify(req.body)}`);
    res.status(404).json({
      error: "Not Found",
      message: `Endpoint ${req.method} ${req.url} not found`,
      availableEndpoints: [
        "GET /",
        "GET /health",
        "GET /.well-known/oauth-protected-resource",
        "GET /.well-known/oauth-protected-resource/mcp",
        "POST /mcp",
        "GET /mcp",
        "DELETE /mcp",
      ],
    });
  });

  app.listen(port, () => {
    logger.info(`Streamable HTTP server started on port ${port}`);
  });
  logger.info(`Octomind MCP Server version ${version} started`);
};
