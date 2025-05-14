#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { version } from "./version";

import { checkNotifications, registerResources } from "./resources";
import { registerPrompts } from "./prompts";
import { logger } from "./logger";
import { program } from "commander";
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express, { Request, Response } from 'express';
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";

const buildServer = async (): Promise<McpServer> => {
  const server = new McpServer({
    name: "Octomind MCP Server",
    version,
  });
  await registerTools(server);
  registerResources(server);
  registerPrompts(server);
  return server;
};

const helpInstall = () => {
  const configs = {
    claude: {
      mcpServers: {
        "octomind-mcp": {
          name: "Octomind MCP Server",
          command: "npx",
          args: ["-y", "@octomind/octomind-mcp@latest"],
          env: {
            APIKEY: "your-api-key-here",
          },
        },
      },
    },
    cursor: {
      mcpServers: {
        "octomind-mcp": {
          name: "Octomind MCP Server",
          command: "npx",
          args: ["-y", "@octomind/octomind-mcp@latest"],
          env: {
            APIKEY: "your-api-key-here",
          },
        },
      },
    },
    windsurf: {
      mcpServers: {
        "octomind-mcp": {
          name: "Octomind MCP Server",
          command: "npx",
          args: ["-y", "@octomind/octomind-mcp@latest"],
          environment: {
            APIKEY: "your-api-key-here",
          },
        },
      },
    },
  };

  console.error("Configuration snippets for different clients:\n");
  console.error("Claude Desktop (.claude-config.json):");
  console.error(`${JSON.stringify(configs.claude, null, 2)}\n`);

  console.error("Cursor (cursor.json):");
  console.error(`${JSON.stringify(configs.cursor, null, 2)}\n`);

  console.error("Windsurf (config.json):");
  console.error(`${JSON.stringify(configs.windsurf, null, 2)}\n`);

  console.error("Note: Replace 'your-api-key-here' with your actual API key");
  process.exit(0);
};

const getApiKey = (req: Request): string | undefined => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return undefined;
  }
  const apiKey = authHeader.split(" ")[1];
  return apiKey;
}

export const serverStartupTime = Date.now();
export const sessions: Record<string, { transport: SSEServerTransport | StdioServerTransport | StreamableHTTPServerTransport; apiKey: string }> = {};

const start = async () => {
  program
    .version(version)
    .option("-s, --sse", "Enable SSE")
    .option("-t, --stream", "Enable Streamable HTTP")
    .option("-c, --clients", "Show clients")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .parse(process.argv);

  const opts = program.opts();
  const PORT = parseInt(opts.port);
  if (opts.clients) {
    helpInstall();
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
      const sessionId = randomUUID();
      sessions[sessionId] = { transport, apiKey };
    }

    // Call original connect
    const result = await originalConnect.call(this, transport);

    return result;
  };
  if (opts.stream) {
    const app = express();
    app.use(express.json());
    app.post('/mcp', async (req, res) => {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && sessions[sessionId]) {
        // Reuse existing transport
        const session = sessions[sessionId];
        transport = session.transport as StreamableHTTPServerTransport;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            // Store the transport by session ID
            sessions[sessionId] = { transport, apiKey: getApiKey(req) ?? "" };
          }
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete sessions[transport.sessionId];
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
      if (!sessionId || !sessions[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const session = sessions[sessionId];
      const transport = session.transport as StreamableHTTPServerTransport;
      await transport.handleRequest(req, res);
      if( req.method === "DELETE") {
        delete sessions[sessionId];
      }
    };

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    app.delete('/mcp', handleSessionRequest);
    app.listen(PORT, () => {
      console.log(`Streamable HTTP server started on port ${PORT}`);
    });
    console.log(`Octomind MCP Server version ${version} started`);
  } else if (opts.sse) {
    logger.info("Starting server in SSE mode");
    const app = express();
    app.use(express.json());

    app.get('/sse', async (req: Request, res: Response) => {
      const transport = new SSEServerTransport('/messages', res);
      const apiKey = getApiKey(req);
      if (!apiKey) {
        res.status(401).send('Unauthorized, authorization header is required');
        return;
      }
      sessions[transport.sessionId] = { transport, apiKey };
      res.on('close', () => {
        delete sessions[transport.sessionId];
      });

      await server.connect(transport);
      logger.info(`Octomind MCP Server SSEversion ${version} started`);
    });
    app.post('/messages', async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      const sessionData = sessions[sessionId];
      if (!sessionData) {
        res.status(400).send('No transport found for sessionId');
        return;
      }
      const transport = sessionData.transport as SSEServerTransport;
      const apiKey = sessionData.apiKey;
      if (!apiKey) {
        res.status(401).send('Unauthorized, authorization header is required');
        return;
      }
      if (transport) {
        // Check if transport is in a good state
        if (!transport.sessionId) {
          console.error('Transport missing sessionId');
          res.status(500).send('Transport in invalid state: missing sessionId');
          return;
        }

        // Check if the response object is still writable
        if (res.writableEnded) {
          console.error('Response is already ended');
          return;
        }

        try {
          console.log(`Handling post message for session ${sessionId}`);
          // Add more debugging about the transport state
          console.log(`Transport state: sessionId=${transport.sessionId}`);
          // Log request details to help diagnose the issue
          console.log(`Request body:`, JSON.stringify(req.body));
          console.log(`Request headers:`, JSON.stringify(req.headers));

          await transport.handlePostMessage(req, res);
          console.log(`Successfully handled post message for session ${sessionId}`);
        } catch (error: any) {
          console.error('Error handling post message:', error);
          if (!res.headersSent) {
            res.status(500).send(`Error handling message: ${error.message || 'Unknown error'}`);
          }
        }
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    });
    app.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    });
    console.log(`Octomind MCP Server version ${version} started`);
  } else {
    if (!process.env.APIKEY) {
      console.error("APIKEY environment variable is required");
      process.exit(1);
    }
    const transport = new StdioServerTransport();
    console.error("Connecting server to transport...");
    await server.connect(transport);
    logger.info(`Octomind MCP Server version ${version} started`);

  }
  setInterval(async () => {
    await checkNotifications(server);
  }, 20_000);
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
    console.error(`Server version ${version} started`);
  })
  .catch((error) => {
    console.error("Error starting server:", error);
    process.exit(1);
  });
