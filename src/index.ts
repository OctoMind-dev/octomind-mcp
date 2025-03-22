import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerTools } from "./tools";

const buildServer = (): McpServer => {
  const server = new McpServer({
    name: "Octomind MCP Server",
    version: "1.0.0",
  });
  registerTools(server);
  return server;
}

const servers : Record<string, McpServer> = {};
const transports : Record<string, SSEServerTransport> = {};

const app = express();

app.get("/sse", async (req, res) => {
  console.log({ headers: req.headers, route: req.route, url: req.url });
  const transport = new SSEServerTransport("/messages", res);
  console.log("Client connected, session", transport.sessionId);
  const server = buildServer();
  servers[transport.sessionId] = server;
  transports[transport.sessionId] = transport;
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (!transport) {
    res.status(400);
    res.json({ error: "No transport" });
    return;
  }
  console.log({ headers: req.headers, route: req.route, url: req.url });
  await transport.handlePostMessage(req, res);
});

const PORT = parseInt(process.env.PORT || "3002", 10);

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});