import { randomUUID } from "crypto";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Minimal function to create and use an MCP client
async function createAndUseMcpClient(serverUrl: string) {
  try {
    // 1. Create the client
    const client = new Client({
      name: "minimal-mcp-client",
      version: "1.0.0",
    });

    // 2. Create the transport with the server URL
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: {
        headers: {
          Authorization: "Bearer test-api-key",
          "X-Session-Id": randomUUID(),
        },
      },
    });
    console.log("Successfully created transport", transport.sessionId);
    // 3. Connect the client to the transport
    // This handles the initialization handshake with the server
    await client.connect(transport);
    console.log(
      "Successfully connected to MCP server",
      client.getServerCapabilities(),
      client.transport?.sessionId,
    );

    // 4. Basic interaction examples
    // List available tools
    const toolsResponse = await client.listTools();
    console.log(
      "Available tools:",
      toolsResponse.tools.map((tool) => tool.name),
    );

    const versionResponse = await client.callTool({
      name: "getVersion",
      arguments: {},
    });
    console.log("Version:", versionResponse);

    // List available resources
    const resourcesResponse = await client.listResources();
    console.log("Available resources:", resourcesResponse.resources);

    // 6. Cleanup when done
    transport.close();
    return client; // Return client in case you want to reuse it
  } catch (error) {
    console.error("Error with MCP client:", error);
    throw error;
  }
}

// Usage example
const serverUrlExample = "https://mcp.preview.octomind.dev/mcp";
createAndUseMcpClient(serverUrlExample)
  .then((client) => {
    console.log("Client operation complete");
  })
  .catch((err) => {
    console.error("Failed to create or use MCP client:", err);
  });
