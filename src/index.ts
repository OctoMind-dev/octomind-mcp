import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerTools } from "./tools";

const server = new McpServer({
  name: "Octomind MCP Server",
  version: "1.0.0",
});

registerTools(server);

const app = express();

let transport: SSEServerTransport | undefined =
  undefined;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  console.log("Client connected");
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (!transport) {
    res.status(400);
    res.json({ error: "No transport" });
    return;
  }
  console.log("Received message", req.body);
  await transport.handlePostMessage(req, res);
});

const PORT = parseInt(process.env.PORT || "3002", 10);

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});