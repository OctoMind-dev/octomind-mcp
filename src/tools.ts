import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { uuidValidation } from "./types";
import { version } from "./version";
import {
  createEnvironment,
  deleteEnvironment,
  discovery,
  executeTests,
  getTestCase,
  getTestReport,
  getTestReports,
  listEnvironments,
  search,
  trieveConfig,
  updateEnvironment,
} from "./api";

import { reloadTestReports } from "./resources";

export const APIKEY = process.env.APIKEY ?? "";

let lastTestTargetId: string | undefined;

export const getLastTestTargetId = (): string | undefined => {
  return lastTestTargetId;
};

export const setLastTestTargetId = async (
  server: McpServer,
  testTargetId: string,
): Promise<void> => {
  if (lastTestTargetId !== testTargetId) {
    await reloadTestReports(testTargetId, server);
    lastTestTargetId = testTargetId;
  }
};

export const registerTools = async (server: McpServer): Promise<void> => {
  const trieve = await trieveConfig();

  server.tool(
    "search",
    `the search tool can be used to search the octomind documentation for a given query.
    The search results are returned as a list of links to the documentation.`,
    {
      query: z.string().describe("Search query"),
    },
    async (params) => {
      const results = await search(params.query, trieve);
      const c = results.map((result) => {
        const { title, content, link } = result;
        const text = `Title: ${title}\nContent: ${content}\nLink: ${link}`;
        return {
          type: "text",
          text,
        };
      });
      return {
        content: c.map((content) => ({
          ...content,
          type: "text",
        })),
      };
    },
  );

  server.tool(
    "getTestCase",
    `the getTestCase tool can retrieve a test case for a given test target and test case id.
    A test case id is unique to the test target. The test case includes a set of interactions and assertions.
    it is the result of a discovery or a manual creation.`,
    {
      testCaseId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test case"),
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
    },
    async (params) => {
      await setLastTestTargetId(server, params.testTargetId);
      const res = await getTestCase(
        APIKEY,
        params.testCaseId,
        params.testTargetId,
      );
      return {
        content: [
          {
            text: `Retrieved test case: ${params.testCaseId} for test target: ${params.testTargetId}`,
            ...res,
            type: "text",
          },
        ],
      };
    },
  );

  // Test execution
  server.tool(
    "executeTests",
    `the executeTests tool can trigger a set of tests for a given test target.
    The test target id is unique to the test target. The tests are executed on the provided url.
    The context object is used to provide information about the source of the test execution.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      url: z.string().url().describe("URL where the tests will be executed"),
      description: z
        .string()
        .optional()
        .describe("Optional description of the test execution"),
      environmentName: z
        .string()
        .default("default")
        .describe("Name of the environment to use for test execution"),
      variablesToOverwrite: z
        .record(z.array(z.string()))
        .optional()
        .describe("Optional variables to override during test execution"),
      tags: z
        .array(z.string())
        .default([])
        .describe("List of tags used for filtering the tests to execute"),
    },
    async (params) => {
      await setLastTestTargetId(server, params.testTargetId);
      const res = await executeTests({
        apiKey: APIKEY,
        json: true,
        description: params.description || "triggered by MCP Tool",
        ...params,
      });
      return {
        content: [
          {
            type: "text",
            text: `Executing tests for target: ${params.testTargetId} on URL: ${params.url}`,
            ...res,
          },
        ],
      };
    },
  );

  // Environment endpoints
  server.tool(
    "getEnvironments",
    `the getEnvironments tool can retrieve environments for a given test target.
   an environment represents a specific setup or deployments for a test target. It include a test account when necsesary
    to login, a header configuration, a discovery url and a set of variables.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
    },
    async (params) => {
      await setLastTestTargetId(server, params.testTargetId);
      const res = await listEnvironments({
        apiKey: APIKEY,
        testTargetId: params.testTargetId,
      });
      return {
        content: [
          {
            type: "text",
            text: `Retrieved environments for test target: ${params.testTargetId}`,
            ...res,
          },
        ],
      };
    },
  );

  server.tool(
    "createEnvironment",
    `the createEnvironment tool can create an environment for a given test target.
    an environment represents a specific setup or deployments for a test target. It include a test account when necsesary
    to login, a header configuration, a discovery url and a set of variables.`,

    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      name: z.string().describe("Name of the environment"),
      discoveryUrl: z.string().url().describe("URL used for test discovery"),
      testAccount: z
        .object({
          username: z
            .string()
            .describe(
              "Username for test account, if discovery needs authentication",
            ),
          password: z
            .string()
            .describe(
              "Password for test account, if discovery needs authentication",
            ),
          otpInitializerKey: z
            .string()
            .optional()
            .describe(
              "Optional OTP initializer key, if discovery needs authentication with otp",
            ),
        })
        .optional()
        .describe(
          "Optional test account credentials, if discovery needs authentication",
        ),
      basicAuth: z
        .object({
          username: z
            .string()
            .describe(
              "Username for basic auth, if discovery needs authentication ",
            ),
          password: z
            .string()
            .describe(
              "Password for basic auth, if discovery needs authentication",
            ),
        })
        .optional()
        .describe(
          "Optional basic authentication credentials, if discovery needs authentication",
        ),
      privateLocationName: z.string().optional().describe(
        "Optional name of the private location, if discovery \
        needs to discover in a private location e.g. behind a firewall or VPN",
      ),
      additionalHeaderFields: z.record(z.string()).optional().describe(
        "Optional additional HTTP header fields, \
        if discovery needs additional headers to be set",
      ),
    },
    async (params) => {
      await setLastTestTargetId(server, params.testTargetId);
      const res = await createEnvironment({
        apiKey: APIKEY,
        ...params,
      });
      return {
        content: [
          {
            text: `Created environment: ${params.name} for test target: ${params.testTargetId}`,
            ...res,
            type: "text",
          },
        ],
      };
    },
  );

  server.tool(
    "updateEnvironment",
    `the updateEnvironment tool can update an environment for a given test target.
    an environment represents a specific setup or deployments for a test target. It include a test account when necsesary
    to login, a header configuration, a discovery url and a set of variables.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      environmentId: z
        .string()
        .uuid()
        .describe("Unique identifier of the environment"),
      name: z
        .string()
        .optional()
        .describe("Optional new name for the environment"),
      discoveryUrl: z
        .string()
        .url()
        .optional()
        .describe("Optional new discovery URL"),
      testAccount: z
        .object({
          username: z
            .string()
            .describe(
              "Username for test account, if discovery needs authentication",
            ),
          password: z
            .string()
            .describe(
              "Password for test account, if discovery needs authentication",
            ),
          otpInitializerKey: z
            .string()
            .optional()
            .describe(
              "Optional OTP initializer key, if discovery needs authentication with otp",
            ),
        })
        .optional()
        .describe(
          "Optional test account credentials, if discovery needs authentication",
        ),
      basicAuth: z
        .object({
          username: z
            .string()
            .describe(
              "Username for basic auth, if discovery needs authentication ",
            ),
          password: z
            .string()
            .describe(
              "Password for basic auth, if discovery needs authentication",
            ),
        })
        .optional()
        .describe(
          "Optional basic authentication credentials, if discovery needs authentication",
        ),
      privateLocationName: z
        .string()
        .optional()
        .describe(
          "Optional name of the private location, if discovery needs to discover in a private location e.g. behind a firewall or VPN",
        ),
      additionalHeaderFields: z
        .record(z.string())
        .optional()
        .describe(
          "Optional additional HTTP header fields, if discovery needs additional headers to be set",
        ),
    },
    async (params) => {
      await setLastTestTargetId(server, params.testTargetId);
      const res = await updateEnvironment({
        apiKey: APIKEY,
        ...params,
      });
      return {
        content: [
          {
            text: `Updated environment: ${params.environmentId} for test target: ${params.testTargetId}`,
            ...res,
            type: "text",
          },
        ],
      };
    },
  );

  server.tool(
    "deleteEnvironment",
    `deleteEnvironment tool can delete an environment for a given test target.
    The environment id is unique to the test target. The call is not reversible.
    an environment represents a specific setup or deployments for a test target. It include a test account when necsesary
    to login, a header configuration, a discovery url and a set of variables.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      environmentId: z
        .string()
        .uuid()
        .describe("Unique identifier of the environment to delete"),
    },
    async (params) => {
      await setLastTestTargetId(server, params.testTargetId);
      const res = await deleteEnvironment({
        apiKey: APIKEY,
        ...params,
      });
      return {
        content: [
          {
            type: "text",
            text: `Deleted environment: ${params.environmentId} for test target: ${params.testTargetId}`,
            ...res,
          },
        ],
      };
    },
  );

  // Test reports
  server.tool(
    "getTestReports",
    `the getTestReports tool can retrieve test reports for a given test target.
    Test reports are generated when set of tests are executed. The test report id is unique to the test target.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      key: z
        .object({
          createdAt: z
            .string()
            .datetime()
            .describe("Creation timestamp for filtering reports"),
        })
        .optional()
        .describe("Optional key for filtering test reports"),
      filter: z
        .array(
          z.object({
            key: z.string().describe("Filter key"),
            operator: z
              .enum(["EQUALS"])
              .describe("Filter operator, currently only EQUALS is supported"),
            value: z.string().describe("Filter value"),
          }),
        )
        .optional()
        .describe("Optional filters for test reports"),
    },
    async (params) => {
      const res = await getTestReports({
        apiKey: APIKEY,
        json: true,
        testTargetId: params.testTargetId,
        key: params.key,
        filter: params.filter,
      });
      await setLastTestTargetId(server, params.testTargetId);
      return {
        content: [
          {
            type: "text",
            text: `Retrieved test reports for test target: ${params.testTargetId}`,
            ...res,
          },
        ],
      };
    },
  );

  server.tool(
    "getTestReport",
    `the getTestReport tool can retrieve a test report for a given test target and test report id.
    A test report id is generated when a set of test are executed on
    a test target. The test report id is unique to the test target.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      testReportId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test report"),
    },
    async (params) => {
      const res = await getTestReport({
        apiKey: APIKEY,
        json: true,
        reportId: params.testReportId,
        testTargetId: params.testTargetId,
      });
      await setLastTestTargetId(server, params.testTargetId);
      return {
        content: [
          {
            type: "text",
            text: `Retrieved test report: ${params.testReportId} for test target: ${params.testTargetId}`,
            ...res,
          },
        ],
      };
    },
  );

  server.tool(
    "discovery",
    `the discovery tool can create a test case on a giver test target with a test case description or prompt.
    one can either start from the predefined url for that test case or provide a new entry point url.`,
    {
      name: z.string().describe("Name of the test case to create"),
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      entryPointUrlPath: z
        .string()
        .optional()
        .describe(
          "Optional entry point URL path, if not provided the predefined url of the test target will be used",
        ),
      prerequisiteId: uuidValidation(
        "expected prerequisiteId to be a valid uuid",
      )
        .optional()
        .describe(
          "Optional prerequisite test case ID. If set all steps of the prerequisite will be executed before the test case discovery starts",
        ),
      externalId: z
        .string()
        .optional()
        .describe(
          "Optional external identifier. E.g. a ticket number or test rail id",
        ),
      assignedTagIds: z
        .array(uuidValidation())
        .optional()
        .describe("Optional list of tag IDs to assign"),
      prompt: z
        .string()
        .describe("Description or prompt used for test case generation"),
      folderId: z
        .string()
        .optional()
        .describe("Optional folder ID for organizing test cases"),
    },
    async (params) => {
      const res = await discovery({ apiKey: APIKEY, json: true, ...params });
      return {
        content: [
          {
            type: "text",
            text: `Retrieved discovery for: ${params.name}`,
            ...res,
          },
        ],
      };
    },
  );
  // Private location endpoints
  server.tool(
    "getPrivateLocations",
    `the getPrivateLocations tool can retrieve all private locations configured for that org. 
    A private location is a server that can be used to access a test target behind a firewall or VPN.`,
    {},
    async () => {
      return {
        content: [
          {
            type: "text",
            text: "Retrieved all private locations",
          },
        ],
      };
    },
  );

  // Version information
  server.tool(
    "getVersion",
    "Returns the current version of the Octomind MCP server",
    {},
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `Octomind MCP Server version: ${version}`,
          },
        ],
      };
    },
  );
};
