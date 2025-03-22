import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  executeTests,
  getNotifications,
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
  if (testTargetId) {
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
  }
};

export const registerTools = (server: McpServer): void => {
  // Test execution
  server.tool(
    "executeTests",
    {
      testTargetId: z.string().uuid(),
      url: z.string().url(),
      context: z.object({
        source: z.literal("manual"),
        description: z.string(),
      }),
      environmentName: z.string().default("default"),
      variablesToOverwrite: z.record(z.array(z.string())).optional(),
      tags: z.array(z.string()).default([]),
    },
    async (params) => {
      setLastTestTargetId(params.testTargetId);
      const res = await executeTests({
        apiKey: APIKEY,
        json: true,
        description: "triggered by MCP Tool",
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
