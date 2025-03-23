#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { version } from "./version";

import { checkNotifications, registerResources } from "./resources";

const buildServer = (): McpServer => {
  const server = new McpServer({
    name: "Octomind MCP Server",
    version,
  });
  registerTools(server);
  registerResources(server);
  return server;
};

export const serverStartupTime = Date.now();

const start = async () => {
  if (!process.env.APIKEY) {
    console.error("APIKEY environment variable is required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  const server = buildServer();
  await server.connect(transport);
  setInterval(async () => {
    await checkNotifications(server);
  }, 20_000);
  // Cleanup on exit
  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
  process.on("SIGINT", async () => {
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
