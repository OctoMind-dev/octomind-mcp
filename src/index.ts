#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { version } from "./version";

import { checkNotifications, registerResources } from "./resources";
import { registerPrompts } from "./prompts";
import { logger } from "./logger";

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
          args: ["-y", "@octomind/octomind-mcp"],
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
          args: ["-y", "@octomind/octomind-mcp"],
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
          args: ["-y", "@octomind/octomind-mcp"],
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

export const serverStartupTime = Date.now();

const start = async () => {
  const { argv } = process;
  if (argv[2] === "--clients") {
    helpInstall();
  }
  if (!process.env.APIKEY) {
    console.error("APIKEY environment variable is required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  const server = await buildServer();
  await server.connect(transport);
  logger.info(`Octomind MCP Server version ${version} started`);
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
