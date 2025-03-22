import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { uuidValidation } from "./types";
import {
  discovery,
  executeTests,
  getNotifications,
  getTestCase,
  getTestReport,
  getTestReports,
} from "./api";
import { serverStartupTime } from ".";

const APIKEY = process.env.APIKEY ?? "";

let lastTestTargetId: string | undefined;

export const getLastTestTargetId = (): string | undefined => {
  return lastTestTargetId;
};
const setLastTestTargetId = (testTargetId: string): void => {
  if (sentNotificationsPerTestTarget[testTargetId] === undefined) {
    sentNotificationsPerTestTarget[testTargetId] = new Set<string>();
  }
  lastTestTargetId = testTargetId;
};

const sentNotificationsPerTestTarget: Record<string, Set<string>> = {};

export const checkNotifications = async (
  mcpServer: McpServer,
): Promise<void> => {
  const testTargetId = getLastTestTargetId();
  /*if (testTargetId) {
    const notifications = await getNotifications(APIKEY, testTargetId);
    notifications.forEach(async (notification) => {
      if (!sentNotificationsPerTestTarget[testTargetId].has(notification.id)) {
        sentNotificationsPerTestTarget[testTargetId].add(notification.id);
        if (notification.createdAt.getTime() > serverStartupTime) {
          await mcpServer.server.notification({
            method: "notifications/progress",
            params: {
              ...notification,
            },
          });
        }
      }
    });
  }*/
};

export const registerTools = (server: McpServer): void => {
  server.tool(
    "getTestCase",
    `the getTestCase tool can retrieve a test case for a given test target and test case id.
    A test case id is unique to the test target. The test case includes a set of interactions and assertions.
    it is the result of a discovery or a manual creation.`,
    {
      testCaseId: z.string().uuid(),
      testTargetId: z.string().uuid(),
    },
    async (params) => {
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
      testTargetId: z.string().uuid(),
      url: z.string().url(),
      description: z.string().optional(),
      environmentName: z.string().default("default"),
      variablesToOverwrite: z.record(z.array(z.string())).optional(),
      tags: z.array(z.string()).default([]),
    },
    async (params) => {
      setLastTestTargetId(params.testTargetId);
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
      testTargetId: z.string().uuid(),
    },
    async (params) => {
      setLastTestTargetId(params.testTargetId);
      return {
        content: [
          {
            type: "text",
            text: `Retrieved environments for test target: ${params.testTargetId}`,
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
      testTargetId: z.string().uuid(),
      name: z.string(),
      discoveryUrl: z.string().url(),
      testAccount: z
        .object({
          username: z.string(),
          password: z.string(),
          otpInitializerKey: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      basicAuth: z
        .object({
          username: z.string(),
          password: z.string(),
        })
        .nullable()
        .optional(),
      privateLocationName: z.string().optional(),
      additionalHeaderFields: z.record(z.string()).optional(),
    },
    async (params) => {
      setLastTestTargetId(params.testTargetId);
      return {
        content: [
          {
            type: "text",
            text: `Created environment: ${params.name} for test target: ${params.testTargetId}`,
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
      testTargetId: z.string().uuid(),
      environmentId: z.string().uuid(),
      name: z.string().optional(),
      discoveryUrl: z.string().url().optional(),
      testAccount: z
        .object({
          username: z.string(),
          password: z.string(),
          otpInitializerKey: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      basicAuth: z
        .object({
          username: z.string(),
          password: z.string(),
        })
        .nullable()
        .optional(),
      privateLocationName: z.string().optional(),
      additionalHeaderFields: z.record(z.string()).optional(),
    },
    async (params) => {
      setLastTestTargetId(params.testTargetId);
      return {
        content: [
          {
            type: "text",
            text: `Updated environment: ${params.environmentId} for test target: ${params.testTargetId}`,
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
      testTargetId: z.string().uuid(),
      environmentId: z.string().uuid(),
    },
    async (params) => {
      setLastTestTargetId(params.testTargetId);
      return {
        content: [
          {
            type: "text",
            text: `Deleted environment: ${params.environmentId} for test target: ${params.testTargetId}`,
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
      testTargetId: z.string().uuid(),
      key: z
        .object({
          createdAt: z.string().datetime(),
        })
        .optional(),
      filter: z
        .array(
          z.object({
            key: z.string(),
            operator: z.enum(["EQUALS"]),
            value: z.string(),
          }),
        )
        .optional(),
    },
    async (params) => {
      const res = await getTestReports({
        apiKey: APIKEY,
        json: true,
        testTargetId: params.testTargetId,
        key: params.key,
        filter: params.filter,
      });
      setLastTestTargetId(params.testTargetId);
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
      testTargetId: z.string().uuid(),
      testReportId: z.string().uuid(),
    },
    async (params) => {
      const res = await getTestReport({
        apiKey: APIKEY,
        json: true,
        reportId: params.testReportId,
        testTargetId: params.testTargetId,
      });
      setLastTestTargetId(params.testTargetId);
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
      name: z.string(),
      testTargetId: z.string().uuid(),
      entryPointUrlPath: z.string().optional(),
      prerequisiteId: uuidValidation(
        "expected prerequisiteId to be a valid uuid",
      ).optional(),
      externalId: z.string().optional(),
      assignedTagIds: z.array(uuidValidation()).optional(),
      prompt: z.string(),
      folderId: z.string().optional(),
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
  server.tool("getPrivateLocations", {}, async () => {
    return {
      content: [
        {
          type: "text",
          text: "Retrieved all private locations",
        },
      ],
    };
  });
};
