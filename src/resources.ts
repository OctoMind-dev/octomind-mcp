import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import {
  ListResourcesResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import { getNotifications, getTestReports, TestCase } from "./api";
import { APIKEY, getLastTestTargetId } from "./tools";
import { TestReport } from "./types";

// examples
/*server.resource("private-location", "plw://foo", (_uri: URL, _extra: RequestHandlerExtra): ReadResourceResult => {
    return { contents: [{ uri: "foo", mimeType: "application/json", name: "location", text: "http://localhost:3000" }] };
  });
  server.resource("private-location", "plw://foo2", { description: "test" }, (_uri: URL, _extra: RequestHandlerExtra): ReadResourceResult => {
    return { contents: [{ uri: "foo", mimeType: "application/json", name: "location", text: "http://localhost:3000" }] };
  });
  server.resource("private-location", "plw://foo2", { description: "test" }, (_uri: URL, _extra: RequestHandlerExtra): ReadResourceResult => {
    return { contents: [{ uri: "foo", mimeType: "application/json", name: "location", text: "http://localhost:3000" }] };
  });*/

let reports: TestReport[] | undefined;
let lastReportRefreshTime = Date.now();
let testCases: TestCase[] | undefined;
let lastTestCaseRefreshTime = Date.now();

export const resetRefreshTimes = (time: Date) => {
  lastReportRefreshTime = time.getTime();
  lastTestCaseRefreshTime = time.getTime();
};

export const reloadTestReports = async (
  testTargetId: string,
  server: McpServer,
) => {
  const result = await getTestReports({ apiKey: APIKEY, testTargetId });
  console.error("Reloaded reports for test target:", testTargetId);
  reports = result.data;
  await server.server.notification({
    method: "notifications/resources/list_changed",
  });
  lastReportRefreshTime = Date.now();
};

export const reloadTestCases = async (
  _testTargetId: string,
  server: McpServer,
) => {
  const result = { data: [] }; //await getTestCases({ apiKey: APIKEY, testTargetId });
  testCases = result.data;
  await server.server.notification({
    method: "notifications/resources/list_changed",
  });
  lastTestCaseRefreshTime = Date.now();
};

export const checkNotifications = async (server: McpServer): Promise<void> => {
  const testTargetId = getLastTestTargetId();
  let forceReloadReports = false;
  let forceReloadTestCases = false;
  if (testTargetId) {
    console.error("Checking notifications for test target:", testTargetId);
    const notifications = await getNotifications(APIKEY, testTargetId);
    notifications.forEach(async (n) => {
      if (
        n.type === "REPORT_EXECUTION_FINISHED" &&
        n.updatedAt.getTime() > lastReportRefreshTime
      ) {
        forceReloadReports = true;
      }
      if (
        n.type === "DISCOVERY_FINISHED" &&
        n.updatedAt.getTime() > lastReportRefreshTime
      ) {
        forceReloadTestCases = true;
      }
    });
    if (forceReloadReports) {
      await reloadTestReports(testTargetId, server);
    }
    if (forceReloadTestCases) {
      await reloadTestCases(testTargetId, server);
    }
  }
};

export const listTestReports = (
  _extra: RequestHandlerExtra,
): ListResourcesResult => {
  return {
    resources:
      reports?.map((report) => ({
        uri: `testreport://${report.id}`,
        name: `report: ${report.id} with status ${report.status} on ${report.executionUrl}`,
        mimeType: "application/json",
      })) ?? [],
  };
};

export const readTestReport = (
  uri: URL,
  vars: Variables,
  _extra: RequestHandlerExtra,
): ReadResourceResult => {
  console.error("Reading test report:", uri, vars);
  const reportId = vars.id;
  const report = reports?.find((r) => r.id === reportId);
  if (report) {
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: "application/json",
          name: `report: ${report.id} with status ${report.status} on ${report.executionUrl}`,
          text: JSON.stringify(report),
        },
      ],
    };
  } else {
    return {
      contents: [],
    };
  }
};

export const registerResources = (server: McpServer): void => {
  server.resource(
    "test reports",
    new ResourceTemplate("testreport://{id}", {
      list: listTestReports,
    }),
    readTestReport,
  );
};
