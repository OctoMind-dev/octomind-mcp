import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "Octomind MCP Server",
    version: "1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

export const notify = async () => {
  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  /*server.resource("private-location", "plw://foo", (_uri: URL, _extra: RequestHandlerExtra): ReadResourceResult => {
       console.error("Reading resource: foo");
       const arr = [];
       for(let i = 0; i < numberOfNotifications; i++) {
           arr.push({ uri: `foo${i}`, mimeType: "application/json", name: `location${i}`, text: `http://localhost:3000${i}` });
       }
       return { contents: arr };
     });*/
  await server.connect(transport);
  setTimeout(async () => {
    console.error("Sending notification...");
    await server.notification({
      method: "notifications/resources/list_changed",
    });
  }, 1000);
};

notify()
  .then(() => {
    console.error("Server version 1.0.6 started");
    //process.exit(0);
  })
  .catch((error) => {
    console.error("Error starting server:", error);
    process.exit(1);
  });
