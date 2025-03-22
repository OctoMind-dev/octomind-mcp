import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerTools } from "./tools";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const buildServer = (): McpServer => {
  const server = new McpServer({
    name: "Octomind MCP Server",
    version: "1.0.0",
  });
  registerTools(server);
  return server;
}

const start = async () => {
  if(process.env.APIKEY === undefined) {
    console.error("APIKEY environment variable is required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  const server = buildServer();
  await server.connect(transport);
};

start().then(() => {
  console.error("Server started");
}).catch((error) => {
  console.error("Error starting server:", error);
  process.exit(1);
});
