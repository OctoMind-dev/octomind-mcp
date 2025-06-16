import { buildServer } from "@/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as api from "@/api";
import { version } from "@/version";
import * as tools from "@/tools";
import { theStdioSessionId } from "@/tools";
import { trieveConfig } from "@/search";
import { AxiosError } from "axios";

jest.mock("@/search", () => ({
  trieveConfig: jest.fn().mockResolvedValue({}),
}));

type CLientTools = {
  name: string;
  description?: string;
  inputSchema: object;
}[];

const getTool = (clientTools: CLientTools, toolName: string) => {
  const tool = clientTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} not found`);
  }
  return tool;
};

describe("Client", () => {
  let client: Client;
  let server: McpServer;
  let clientTools: CLientTools;

  beforeAll(async () => {
    process.env.APIKEY = "test-api-key";
  });

  beforeEach(async () => {
    client = new Client({
      name: "test",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    clientTransport.sessionId = theStdioSessionId;
    serverTransport.sessionId = theStdioSessionId;
    await client.connect(clientTransport);

    server = await buildServer();
    await server.connect(serverTransport);
    clientTools = (await client.listTools()).tools;
    jest.clearAllMocks();
    jest.spyOn(tools, "getApiKey").mockResolvedValue("test-api-key");
    jest
      .spyOn(tools, "setLastTestTargetId")
      .mockImplementation(() => Promise.resolve());
  });
  describe("tools, prompts", () => {
    it("should find tools", async () => {
      expect(clientTools.length).toBe(18);
    });

    it("should find prompts", async () => {
      const prompts = await client.listPrompts();
      expect(prompts.prompts.length).toBe(1);
    });
  });
  describe("errors", () => {
    it("should return unauthorized error because apikey missing", async () => {
      jest.spyOn(tools, "getApiKey").mockImplementation(() => {
        throw new Error("Unauthorized, no apiKey found for session");
      });

      const getTestTargetsTool = getTool(clientTools, "getTestTargets");
      const result = await client.callTool({
        name: getTestTargetsTool.name,
        arguments: {},
      });
      expect(result).toMatchInlineSnapshot(`
{
  "content": [
    {
      "text": "Unauthorized, no apiKey found for session",
      "type": "text",
    },
  ],
  "isError": true,
}
`);
    });
    it("should return unauthorized error because session missing", async () => {
      jest.spyOn(tools, "getApiKey").mockImplementation(() => {
        throw new Error("Unauthorized, no session found");
      });

      const getTestTargetsTool = getTool(clientTools, "getTestTargets");
      const result = await client.callTool({
        name: getTestTargetsTool.name,
        arguments: {},
      });
      expect(result).toMatchInlineSnapshot(`
{
  "content": [
    {
      "text": "Unauthorized, no session found",
      "type": "text",
    },
  ],
  "isError": true,
}
`);
    });

    it("should return because apiCall fails", async () => {
      jest.spyOn(api, "apiCall").mockImplementation(() => {
        throw new AxiosError("unauthorized", "401");
      });

      const getTestTargetsTool = getTool(clientTools, "getTestTargets");
      const result = await client.callTool({
        name: getTestTargetsTool.name,
        arguments: {},
      });
      expect(result).toMatchInlineSnapshot(`
{
  "content": [
    {
      "text": "unauthorized",
      "type": "text",
    },
  ],
  "isError": true,
}
`);
    });
  });
  describe("version", () => {
    it("should return version", async () => {
      const versionTool = getTool(clientTools, "getVersion");
      if (!versionTool) {
        throw new Error("versionTool not found");
      }
      const result = await client.callTool({
        name: versionTool.name,
        arguments: {},
      });
      expect(result).toEqual({
        content: [
          { text: `Octomind MCP Server version: ${version}`, type: "text" },
        ],
      });
    });
  });
  describe("test targets", () => {
    it("should create a test target", async () => {
      const createTestTargetTool = getTool(clientTools, "createTestTarget");
      jest.spyOn(api, "createTestTarget").mockResolvedValue({
        id: "b2b3e7e8-1e2f-4c5d-8a6b-9c0d1e2f3a4b",
        app: "my-app",
        skipAutomaticTestCreation: false,
        environments: [],
      });

      const result = await client.callTool({
        name: createTestTargetTool.name,
        arguments: {
          app: "my-app",
          discoveryUrl: "https://example.com",
          skipAutomaticTestCreation: false,
        },
      });

      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Created test target with app name: my-app",
    "type": "text",
  },
  {
    "text": "{"id":"b2b3e7e8-1e2f-4c5d-8a6b-9c0d1e2f3a4b","app":"my-app","skipAutomaticTestCreation":false,"environments":[]}",
    "type": "text",
  },
]
`);
    });
    it("should call get test targets    ", async () => {
      const testTargetsTool = getTool(clientTools, "getTestTargets");
      if (!testTargetsTool) {
        throw new Error("testTargetsTool not found");
      }
      const testTarget = {
        id: "test-target-id",
        app: "test-app",
        environments: [],
        skipAutomaticTestCreation: false,
      };
      jest.spyOn(api, "apiCall").mockResolvedValue([testTarget]);
      const result = await client.callTool({
        name: testTargetsTool.name,
        arguments: {},
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Retrieved all test targets",
    "type": "text",
  },
  {
    "text": "[{"id":"test-target-id","app":"test-app","environments":[],"skipAutomaticTestCreation":false}]",
    "type": "text",
  },
]
`);
    });
    it("should delete a test target", async () => {
      const deleteTestTargetTool = getTool(clientTools, "deleteTestTarget");
      jest.spyOn(api, "deleteTestTarget").mockResolvedValue({
        success: true,
      });
      const result = await client.callTool({
        name: deleteTestTargetTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Deleted test target: 58f57faf-6da0-45be-aa76-a567ffb32e82",
    "type": "text",
  },
]
`);
    });
    it("should update a test target", async () => {
      const updateTestTargetTool = getTool(clientTools, "updateTestTarget");
      jest.spyOn(api, "updateTestTarget").mockResolvedValue({
        id: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        app: "test-app",
        environments: [],
        skipAutomaticTestCreation: false,
      });
      const result = await client.callTool({
        name: updateTestTargetTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          app: "test-app",
          discoveryUrl: "https://example.com",
          skipAutomaticTestCreation: false,
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Updated test target: 58f57faf-6da0-45be-aa76-a567ffb32e82",
    "type": "text",
  },
  {
    "text": "{"id":"58f57faf-6da0-45be-aa76-a567ffb32e82","app":"test-app","environments":[],"skipAutomaticTestCreation":false}",
    "type": "text",
  },
]
`);
    });
  });
  describe("discovery", () => {
    it("should call discover test case", async () => {
      const discoverTool = getTool(clientTools, "discovery");
      if (!discoverTool) {
        throw new Error("discoverTool not found");
      }
      jest.spyOn(api, "discovery").mockResolvedValue({
        discoveryId: "test-id",
        testCaseId: "test-case-id",
      });

      const result = await client.callTool({
        name: discoverTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          name: "test-case-name",
          prompt: "test-case-prompt",
          tagNames: ["test-case-tag"],
          folderName: "test-case-folder",
        },
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
  });
  describe("environments", () => {
    it("should create an environment", async () => {
      const createEnvironmentTool = getTool(clientTools, "createEnvironment");
      if (!createEnvironmentTool) {
        throw new Error("createEnvironmentTool not found");
      }
      jest.spyOn(api, "createEnvironment").mockResolvedValue({
        id: "env-id",
        name: "env-name",
        testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        updatedAt: "2025-06-10T16:26:49.000Z",
        type: "DEFAULT",
        discoveryUrl: "https://example.com",
      });

      const result = await client.callTool({
        name: createEnvironmentTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          name: "test-case-name",
          prompt: "test-case-prompt",
          tagNames: ["test-case-tag"],
          folderName: "test-case-folder",
          discoveryUrl: "https://example.com",
        },
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

    it("should delete an environment", async () => {
      const deleteEnvironmentTool = getTool(clientTools, "deleteEnvironment");
      if (!deleteEnvironmentTool) {
        throw new Error("deleteEnvironmentTool not found");
      }
      jest.spyOn(api, "deleteEnvironment").mockResolvedValue({ success: true });

      const result = await client.callTool({
        name: deleteEnvironmentTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          environmentId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Deleted environment: 58f57faf-6da0-45be-aa76-a567ffb32e82 for test target: 58f57faf-6da0-45be-aa76-a567ffb32e82",
    "type": "text",
  },
  {
    "text": "{"success":true}",
    "type": "text",
  },
]
`);
    });

    it("should list environments", async () => {
      const getEnvironmentsTool = getTool(clientTools, "getEnvironments");
      if (!getEnvironmentsTool) {
        throw new Error("getEnvironmentsTool not found");
      }
      jest.spyOn(api, "listEnvironments").mockResolvedValue([
        {
          id: "env-id",
          name: "env-name",
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          updatedAt: "2025-06-10T16:26:49.000Z",
          type: "DEFAULT",
          discoveryUrl: "https://example.com",
        },
      ]);
      const result = await client.callTool({
        name: getEnvironmentsTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Retrieved environments for test target: 58f57faf-6da0-45be-aa76-a567ffb32e82",
    "type": "text",
  },
  {
    "text": "[{"id":"env-id","name":"env-name","testTargetId":"58f57faf-6da0-45be-aa76-a567ffb32e82","updatedAt":"2025-06-10T16:26:49.000Z","type":"DEFAULT","discoveryUrl":"https://example.com"}]",
    "type": "text",
  },
]
`);
    });

    it("should update an environment", async () => {
      const updateEnvironmentTool = getTool(clientTools, "updateEnvironment");
      if (!updateEnvironmentTool) {
        throw new Error("updateEnvironmentTool not found");
      }
      jest.spyOn(api, "updateEnvironment").mockResolvedValue({
        id: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        name: "updated-env-name",
        testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        updatedAt: "2025-06-10T17:06:25.000Z",
        type: "DEFAULT",
        discoveryUrl: "https://updated-example.com",
        basicAuth: {
          username: "test-user",
          password: "test-pass",
          updatedAt: "2025-06-10T17:06:25.000Z",
        },
        testAccount: {
          username: "test-account",
          password: "test-account-pass",
          updatedAt: "2025-06-10T17:06:25.000Z",
        },
        additionalHeaderFields: {
          "x-custom-header": "test-value",
        },
      });

      const result = await client.callTool({
        name: updateEnvironmentTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          environmentId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          name: "updated-env-name",
          discoveryUrl: "https://updated-example.com",
          basicAuth: {
            username: "test-user",
            password: "test-pass",
            updatedAt: "2025-06-10T17:06:25.000Z",
          },
          testAccount: {
            username: "test-account",
            password: "test-account-pass",
            updatedAt: "2025-06-10T17:06:25.000Z",
          },
          additionalHeaderFields: {
            "x-custom-header": "test-value",
          },
          privateLocationName: "US Proxy",
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Updated environment for test target: 58f57faf-6da0-45be-aa76-a567ffb32e82",
    "type": "text",
  },
  {
    "text": "{"id":"58f57faf-6da0-45be-aa76-a567ffb32e82","name":"updated-env-name","testTargetId":"58f57faf-6da0-45be-aa76-a567ffb32e82","updatedAt":"2025-06-10T17:06:25.000Z","type":"DEFAULT","discoveryUrl":"https://updated-example.com","basicAuth":{"username":"test-user","password":"test-pass","updatedAt":"2025-06-10T17:06:25.000Z"},"testAccount":{"username":"test-account","password":"test-account-pass","updatedAt":"2025-06-10T17:06:25.000Z"},"additionalHeaderFields":{"x-custom-header":"test-value"}}",
    "type": "text",
  },
]
`);
    });
  });
  describe("test cases", () => {
    it("should get one test case", async () => {
      const getTestCaseTool = getTool(clientTools, "getTestCase");
      jest.spyOn(api, "getTestCase").mockResolvedValue({
        id: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        description: "test-case-description",
        status: "ENABLED",
        createdAt: new Date("2025-06-10T17:06:25.000Z"),
        updatedAt: new Date("2025-06-10T17:06:25.000Z"),
        discovery: {
          name: "test-case-name",
          prompt: "test-case-prompt",
          tagNames: ["test-case-tag"],
          folderName: "test-case-folder",
          discoveryUrl: "https://example.com",
        },
        elements: [],
      });
      const result = await client.callTool({
        name: getTestCaseTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          testCaseId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Retrieved test case: 58f57faf-6da0-45be-aa76-a567ffb32e82 for test target: 58f57faf-6da0-45be-aa76-a567ffb32e82",
    "type": "text",
  },
  {
    "text": "{"id":"58f57faf-6da0-45be-aa76-a567ffb32e82","testTargetId":"58f57faf-6da0-45be-aa76-a567ffb32e82","description":"test-case-description","status":"ENABLED","createdAt":"2025-06-10T17:06:25.000Z","updatedAt":"2025-06-10T17:06:25.000Z","discovery":{"name":"test-case-name","prompt":"test-case-prompt","tagNames":["test-case-tag"],"folderName":"test-case-folder","discoveryUrl":"https://example.com"},"elements":[]}",
    "type": "text",
  },
]
`);
    });
    it("should call get test cases", async () => {
      const getTestCasesTool = getTool(clientTools, "getTestCases");

      jest.spyOn(api, "getTestCases").mockResolvedValue([
        {
          id: "test-case-id",
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          updatedAt: "2025-06-10T17:06:25.000Z",
          description: "test-case-description",
          status: "ENABLED",
          runStatus: "ON",
          createdAt: "2025-06-10T17:06:25.000Z",
          tags: ["test-case-tag"],
        },
      ]);
      const result = await client.callTool({
        name: getTestCasesTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Retrieved 1 test cases for test target: 58f57faf-6da0-45be-aa76-a567ffb32e82 with filter: {"status":"ENABLED"}",
    "type": "text",
  },
  {
    "text": "[
  {
    "id": "test-case-id",
    "testTargetId": "58f57faf-6da0-45be-aa76-a567ffb32e82",
    "updatedAt": "2025-06-10T17:06:25.000Z",
    "description": "test-case-description",
    "status": "ENABLED",
    "runStatus": "ON",
    "createdAt": "2025-06-10T17:06:25.000Z",
    "tags": [
      "test-case-tag"
    ]
  }
]",
    "type": "text",
  },
]
`);
    });
    it("should update a test case", async () => {
      const updateTestCaseTool = getTool(clientTools, "updateTestCase");
      jest.spyOn(api, "patchTestCase").mockResolvedValue({
        id: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
        updatedAt: new Date("2025-06-10T17:06:25.000Z"),
        description: "test-case-description",
        status: "ENABLED",
        createdAt: new Date("2025-06-10T17:06:25.000Z"),
        discovery: {
          name: "test-case-name",
          prompt: "test-case-prompt",
          tagNames: ["test-case-tag"],
          folderName: "test-case-folder",
          discoveryUrl: "https://example.com",
        },
        elements: [],
      });
      const result = await client.callTool({
        name: updateTestCaseTool.name,
        arguments: {
          testTargetId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          testCaseId: "58f57faf-6da0-45be-aa76-a567ffb32e82",
          description: "test-case-description",
          status: "ENABLED",
          createdAt: "2025-06-10T17:06:25.000Z",
          discovery: {
            name: "test-case-name",
            prompt: "test-case-prompt",
            tagNames: ["test-case-tag"],
            folderName: "test-case-folder",
            discoveryUrl: "https://example.com",
          },
          elements: [],
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Updated test case: 58f57faf-6da0-45be-aa76-a567ffb32e82 for test target: 58f57faf-6da0-45be-aa76-a567ffb32e82",
    "type": "text",
  },
  {
    "text": "{
  "id": "58f57faf-6da0-45be-aa76-a567ffb32e82",
  "testTargetId": "58f57faf-6da0-45be-aa76-a567ffb32e82",
  "updatedAt": "2025-06-10T17:06:25.000Z",
  "description": "test-case-description",
  "status": "ENABLED",
  "createdAt": "2025-06-10T17:06:25.000Z",
  "discovery": {
    "name": "test-case-name",
    "prompt": "test-case-prompt",
    "tagNames": [
      "test-case-tag"
    ],
    "folderName": "test-case-folder",
    "discoveryUrl": "https://example.com"
  },
  "elements": []
}",
    "type": "text",
  },
]
`);
    });
  });
  describe("private locations", () => {
    it("should call get private locations", async () => {
      const getPrivateLocationsTool = getTool(
        clientTools,
        "getPrivateLocations",
      );
      jest.spyOn(api, "listPrivateLocations").mockResolvedValue([
        {
          name: "US Proxy",
          status: "ONLINE",
          address: "127.0.0.1",
        },
      ]);
      const result = await client.callTool({
        name: getPrivateLocationsTool.name,
        arguments: {},
      });
      expect(result.content).toMatchInlineSnapshot(`
[
  {
    "text": "Retrieved all private locations",
    "type": "text",
  },
  {
    "text": "[{"name":"US Proxy","status":"ONLINE","address":"127.0.0.1"}]",
    "type": "text",
  },
]
`);
    });
  });
});
