import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import {
  ListResourcesResult,
  ReadResourceResult,
  ServerNotification,
  ServerRequest,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { getNotifications, getTestReports, getTestCases, getTestReport } from "./api";
import { TestReport, TestCaseListItem } from "./types";
import { getAllSessions, getSession, Session, setSession } from "./session";
import { logger } from "./logger";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

let tracesForTestReport: Record<string, string> = {};

export const reloadTestReports = async (
  session: Session,
  server: McpServer,
) => {
  if (!session.currentTestTargetId) {
    logger.warn(`No test target id found for session ${session.sessionId}, cannot load test reports`);
    session.lastTestReportRefreshTime = Date.now();
    await setSession(session);
    return;
  }
  const result = await getTestReports({ apiKey: session.apiKey, testTargetId: session.currentTestTargetId });
  logger.info("Reloaded reports for test target:", session.currentTestTargetId);
  const reports = result.data;

  tracesForTestReport = {};
  session.testReportIds = [];
  session.tracesForTestReport = {};
  reports.forEach((r: TestReport) => {
    session.testReportIds.push(r.id);
    const testResults = r.testResults;
    for (const testResult of testResults) {
      if (testResult.traceUrl) {
        session.tracesForTestReport[r.id] = testResult.traceUrl;
      }
    }
  });
  server.sendResourceListChanged();
  session.lastTestReportRefreshTime = Date.now();
  await setSession(session);
};

export const clearTestReports = async (session: Session, server: McpServer) => {
  session.testReportIds = [];
  session.tracesForTestReport = {};

  server.sendResourceListChanged();
  session.lastTestReportRefreshTime = Date.now();
  await setSession(session);
};

export const reloadTestCases = async (
  session: Session,
  server: McpServer,
) => {
  if (!session.currentTestTargetId) {
    logger.warn(`No test target id found for session ${session.sessionId}, cannot load test cases`);
    session.lastTestCaseRefreshTime = Date.now();
    await setSession(session);
    return;
  }
  const result = await getTestCases({ apiKey: session.apiKey, testTargetId: session.currentTestTargetId });
  session.testCaseIds = result.map((tc: TestCaseListItem) => tc.id);

  server.sendResourceListChanged();
  session.lastTestCaseRefreshTime = Date.now();
  await setSession(session);
};

export const checkNotifications = async (server: McpServer): Promise<void> => {
  for (const session of await getAllSessions()) {
    if (!session.currentTestTargetId) {
      continue;
    }
    logger.debug("Checking notifications for test target: %s, session: %s", session.currentTestTargetId, session.sessionId);
    try {
      await checkNotificationsForSession(server, session);
    } catch (e) {
      logger.error("Failed to check notifications for test target: %s, session: %s", session.currentTestTargetId, session.sessionId, e);
      await setSession({...session, currentTestTargetId: undefined});
    }
  }
}

const checkNotificationsForSession = async (server: McpServer, session: Session): Promise<void> => {
  let forceReloadReports = false;
  let forceReloadTestCases = false;
  if (session.currentTestTargetId) {
    logger.info("Checking notifications for test target:", session.currentTestTargetId);
    const notifications = await getNotifications(session.apiKey, session.currentTestTargetId);
    notifications.forEach(async (n) => {
      if (
        n.type === "REPORT_EXECUTION_FINISHED" &&
        n.updatedAt.getTime() > (session.lastTestReportRefreshTime ?? Date.now())
      ) {
        forceReloadReports = true;
      }
      if (
        n.type === "DISCOVERY_FINISHED" &&
        n.updatedAt.getTime() > (session.lastTestCaseRefreshTime ?? Date.now())
      ) {
        forceReloadTestCases = true;
      }
    });
    if (forceReloadReports) {
      await reloadTestReports(session, server);
    }
    if (forceReloadTestCases) {
      await reloadTestCases(session, server);
    }
  }
};

export const listTestReports = async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<ListResourcesResult> => {
  const session = await getSession(extra.sessionId!);
  if (!session) {
    throw new Error(`No session found for sessionId ${extra.sessionId}`);
  }
  return {
    resources:
      session.testReportIds?.map((reportId) => ({
        uri: `testreport://${reportId}`,
        name: `report: ${reportId}`,
        mimeType: "application/json",
      })) ?? [],
  };
};

export const readTestReport = async (
  uri: URL,
  vars: Variables,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<ReadResourceResult> => {
  const session = await getSession(extra.sessionId!);
  if (!session) {
    throw new Error(`No session found for sessionId ${extra.sessionId}`);
  }
  logger.info("Reading test report:", uri, vars);
  const reportId = vars.id as string;
  const result = await getTestReport({ apiKey: session.apiKey, testTargetId: session.currentTestTargetId!, reportId });
  if (result) {
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: "application/json",
          name: `report: ${reportId}`,
          text: JSON.stringify(result),
        },
      ],
    };
  } else {
    return {
      contents: [],
    };
  }
};

const listTestResultTraces = async (extra: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<ListResourcesResult> => {
  const session = await getSession(extra.sessionId!);
  if (!session) {
    throw new Error(`No session found for sessionId ${extra.sessionId}`);
  }
  return {
    resources: Object.entries(session.tracesForTestReport).map(([id, traceUrl]) => ({
      uri: `testresulttrace://${id}`,
      name: `Trace ${id}`,
      description: `Trace for test result ${id}`,
      metadata: { traceUrl },
    })),
  };
};

const readTestResultTrace = async (
  _uri: URL,
  vars: Variables,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
): Promise<ReadResourceResult> => {
  const id: string = vars.id as string;
  const session = await getSession(extra.sessionId!);
  if (!session) {
    throw new Error(`No session found for sessionId ${extra.sessionId}`);
  }
  const traceUrl = session.tracesForTestReport[id];
  if (!traceUrl) {
    throw new Error(`No trace found for test result ${id}`);
  }

  const response = await fetch(traceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch trace from ${traceUrl}: ${response.statusText}`,
    );
  }

  const buffer = await response.arrayBuffer();
  const base64Data = Buffer.from(buffer).toString("base64");

  return {
    contents: [
      {
        uri: traceUrl,
        mimeType: "application/zip",
        name: "trace",
        text: base64Data,
      },
    ],
  };
};

export const registerResources = (server: McpServer): void => {
  server.resource(
    "test reports",
    new ResourceTemplate("testreport://{id}", { 
      list: listTestReports,
    }),
    readTestReport,
  );
  server.resource(
    "test result traces",
    new ResourceTemplate("testresulttrace://{id}", {
      list: listTestResultTraces,
    }),
    readTestResultTrace,
  );

  const subscriptions = new Set<string>();

  server.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    const { uri } = request.params;
    subscriptions.add(uri);

    // Request sampling from client when someone subscribes
    //await requestSampling("A new subscription was started", uri);
    return {};
  });

  server.server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    subscriptions.delete(request.params.uri);
    return {};
  });
};
