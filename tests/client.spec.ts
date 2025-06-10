import { buildServer } from "@/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as api from "@/api";
import { version } from "@/version";
import * as tools from '@/tools';
import { theStdioSessionId } from '@/tools';

describe("Client", () => {

  let client: Client;
  let server: McpServer;

  beforeAll(async () => {
    process.env.APIKEY = "test-api-key";
  });

  beforeEach(async () => {
    client = new Client({
      name: "test",
      version: '1.0.0'
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    clientTransport.sessionId = theStdioSessionId;
    serverTransport.sessionId = theStdioSessionId;
    client.connect(clientTransport);

    server = await buildServer();
    await server.connect(serverTransport);
    jest.clearAllMocks();
    jest.spyOn(tools, 'getApiKey').mockResolvedValue("test-api-key");
    jest.spyOn(tools, 'setLastTestTargetId').mockImplementation(() => Promise.resolve());
  });

  it("should find tools", async () => {
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(17);

  });

  it("should find prompts", async () => {
    const prompts = await client.listPrompts();
    expect(prompts.prompts.length).toBe(1);
  });

  it("should return version", async () => {
    const tools = await client.listTools();
    const versionTool = tools.tools.find((tool) => tool.name === "getVersion");
    expect(versionTool).toBeDefined();
    const result = await client.callTool({
      name: versionTool!.name,
      arguments: {}
    });
    expect(result).toEqual({"content": [{"text": `Octomind MCP Server version: ${version}`, "type": "text"}]});
  });

  it("should call get test targets    ", async () => {
    const tools = await client.listTools();
    const testTargetsTool = tools.tools.find((tool) => tool.name === "getTestTargets");
    expect(testTargetsTool).toBeDefined();
    const testTarget = {
      id: "test-target-id",
      app: "test-app",
      environments: [],
      skipAutomaticTestCreation: false,
    };
    jest.spyOn(api, 'apiCall').mockResolvedValue([
      testTarget
    ]);
    const result = await client.callTool({
      name: testTargetsTool!.name,
      arguments: {}
    });
    expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Retrieved all test targets",
    "type": "text",
  },
  {
    "text": "[{\"id\":\"test-target-id\",\"app\":\"test-app\",\"environments\":[],\"skipAutomaticTestCreation\":false}]",
    "type": "text",
  },
]
`);
  });
  it("should call discover test case", async () => {
    const tools = await client.listTools();
    const discoverTool = tools.tools.find((tool) => tool.name === "discovery");
    expect(discoverTool).toBeDefined();

    jest.spyOn(api, 'discovery').mockResolvedValue({
      discoveryId: "test-id",
      testCaseId: "test-case-id",
    }); 

    const result = await client.callTool({
      name: discoverTool!.name,
      arguments: {
        testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        name: "test-case-name",
        prompt: "test-case-prompt",
        tagNames: ["test-case-tag"],
        folderName: "test-case-folder",
      }
    });
    expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Retrieved discovery for: test-case-name",
    "type": "text",
  },
  {
    "text": "{"discoveryId":"test-id","testCaseId":"test-case-id"}",
    "type": "text",
  },
]
`);
  });
  it("should create an environment", async () => {
    const tools = await client.listTools();
    const createEnvironmentTool = tools.tools.find((tool) => tool.name === "createEnvironment");
    expect(createEnvironmentTool).toBeDefined();

    jest.spyOn(api, 'createEnvironment').mockResolvedValue({
      id: "env-id",
      name: "env-name",
      testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
      updatedAt: "2025-06-10T16:26:49.000Z",
      type: "DEFAULT",
      discoveryUrl: "https://example.com",
    }); 

    const result = await client.callTool({
      name: createEnvironmentTool!.name,
      arguments: {
        testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        name: "test-case-name",
        prompt: "test-case-prompt",
        tagNames: ["test-case-tag"],
        folderName: "test-case-folder",
        discoveryUrl: "https://example.com",
      }
    });
    expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Created environment for test target: 58f57faf-6da0-45be-aa76-a567ffb32e82",
    "type": "text",
  },
  {
    "text": "{"id":"env-id","name":"env-name","testTargetId":"58f57faf-6da0-45be-aa76-a567ffb32e82","updatedAt":"2025-06-10T16:26:49.000Z","type":"DEFAULT","discoveryUrl":"https://example.com"}",
    "type": "text",
  },
]
`);
  });
});
