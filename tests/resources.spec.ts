import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkNotifications } from "@/resources";
import { getLastTestTargetId } from "@/tools";
import { getNotifications, getTestCases, getTestReports } from "@/api";
import { getAllSessions } from "@/session";
import { logger } from "@/logger";
jest.mock("@/tools");
jest.mock("@/api");
jest.mock("@/session");
jest.mock("@/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  },
}));
describe("Resources module", () => {
  let server: McpServer;
  const mockTestTargetId = "123e4567-e89b-12d3-a456-426614174000";
  const mockSessionId = "test-session-id";
  const baseTime = new Date("2025-03-23T10:00:00Z").getTime();
  const mockGetLastTestTargetId = jest.mocked(getLastTestTargetId);
  const mockGetNotifications = jest.mocked(getNotifications);
  const mockGetTestReports = jest.mocked(getTestReports);
  const mockgetAllSessions = jest.mocked(getAllSessions);
  const mockGetTestCases = jest.mocked(getTestCases);
  beforeEach(() => {
    jest.clearAllMocks();
    server = {
      server: {
        notification: jest.fn(),
      },
    } as unknown as McpServer;

    mockgetAllSessions.mockResolvedValue([
      {
        apiKey: "test-api-key",
        currentTestTargetId: mockTestTargetId,
        sessionId: mockSessionId,
        testReportIds: [],
        testCaseIds: [],
        tracesForTestReport: {},
      },
    ]);
  });

  describe("checkNotifications", () => {
    beforeEach(() => {});

    const apiKey = "test-api-key";
    it("should do nothing when no test target is set", async () => {
      mockgetAllSessions.mockResolvedValue([
        {
          apiKey: "test-api-key",
          currentTestTargetId: undefined,
          sessionId: mockSessionId,
          testReportIds: [],
          testCaseIds: [],
          tracesForTestReport: {},
          lastTestReportRefreshTime: baseTime,
          lastTestCaseRefreshTime: baseTime,
        },
      ]);
      await checkNotifications(server);

      expect(mockGetNotifications).not.toHaveBeenCalled();
      expect(server.server.notification).not.toHaveBeenCalled();
      expect(mockGetTestReports).not.toHaveBeenCalled();
    });

    it("should reload reports when REPORT_EXECUTION_FINISHED notification is received", async () => {
      mockgetAllSessions.mockResolvedValue([
        {
          apiKey: "test-api-key",
          currentTestTargetId: mockTestTargetId,
          sessionId: mockSessionId,
          testReportIds: [],
          testCaseIds: [],
          tracesForTestReport: {},
          lastTestReportRefreshTime: baseTime,
          lastTestCaseRefreshTime: baseTime,
        },
      ]);
      mockGetLastTestTargetId.mockResolvedValue(mockTestTargetId);
      mockGetNotifications.mockResolvedValue([
        {
          id: "1",
          type: "REPORT_EXECUTION_FINISHED",
          updatedAt: new Date(baseTime + 1000), // 1 second later
          createdAt: new Date(baseTime),
          testTargetId: mockTestTargetId,
          ack: null,
        },
      ]);
      mockGetTestReports.mockResolvedValue({ data: [], hasNextPage: false });

      await checkNotifications(server);

      expect(mockGetNotifications).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        testTargetId: mockTestTargetId,
      });
      expect(mockGetTestReports).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        testTargetId: mockTestTargetId,
      });
      expect(server.server.notification).toHaveBeenCalledWith({
        method: "notifications/resources/list_changed",
      });
    });

    it("should reload test cases when DISCOVERY_FINISHED notification is received", async () => {
      mockgetAllSessions.mockResolvedValue([
        {
          apiKey: "test-api-key",
          currentTestTargetId: mockTestTargetId,
          sessionId: mockSessionId,
          testReportIds: [],
          testCaseIds: [],
          tracesForTestReport: {},
          lastTestReportRefreshTime: baseTime,
          lastTestCaseRefreshTime: baseTime,
        },
      ]);
      mockGetLastTestTargetId.mockResolvedValue(mockTestTargetId);
      mockGetNotifications.mockResolvedValue([
        {
          id: "1",
          type: "DISCOVERY_FINISHED",
          updatedAt: new Date(baseTime + 1000), // 1 second later
          createdAt: new Date(baseTime),
          testTargetId: mockTestTargetId,
          ack: null,
        },
      ]);

      mockGetTestCases.mockResolvedValue([]);

      await checkNotifications(server);

      expect(mockGetNotifications).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        testTargetId: mockTestTargetId,
      });
      expect(mockGetTestCases).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        testTargetId: mockTestTargetId,
      });
      expect(server.server.notification).toHaveBeenCalledWith({
        method: "notifications/resources/list_changed",
      });
    });

    it("should reload both when both types of notifications are received", async () => {
      mockgetAllSessions.mockResolvedValue([
        {
          apiKey: "test-api-key",
          currentTestTargetId: mockTestTargetId,
          sessionId: mockSessionId,
          testReportIds: [],
          testCaseIds: [],
          tracesForTestReport: {},
          lastTestReportRefreshTime: baseTime,
          lastTestCaseRefreshTime: baseTime,
        },
      ]);
      mockGetLastTestTargetId.mockResolvedValue(mockTestTargetId);
      mockGetNotifications.mockResolvedValue([
        {
          id: "1",
          type: "REPORT_EXECUTION_FINISHED",
          updatedAt: new Date(baseTime + 1000),
          createdAt: new Date(baseTime),
          testTargetId: mockTestTargetId,
          ack: null,
        },
        {
          id: "2",
          type: "DISCOVERY_FINISHED",
          updatedAt: new Date(baseTime + 1000),
          createdAt: new Date(baseTime),
          testTargetId: mockTestTargetId,
          ack: null,
        },
      ]);
      mockGetTestReports.mockResolvedValue({ data: [], hasNextPage: false });
      mockGetTestCases.mockResolvedValue([]);

      await checkNotifications(server);

      expect(mockGetNotifications).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        testTargetId: mockTestTargetId,
      });
      expect(mockGetTestReports).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        testTargetId: mockTestTargetId,
      });
      expect(mockGetTestCases).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        testTargetId: mockTestTargetId,
      });
      expect(server.server.notification).toHaveBeenCalledTimes(2);
    });

    it("should not reload when notifications are older than last refresh", async () => {
      mockGetLastTestTargetId.mockResolvedValue(mockTestTargetId);
      mockGetNotifications.mockResolvedValue([
        {
          id: "1",
          type: "REPORT_EXECUTION_FINISHED",
          updatedAt: new Date(baseTime - 1000), // 1 second earlier than base time
          createdAt: new Date(baseTime - 2000),
          testTargetId: mockTestTargetId,
          ack: null,
        },
      ]);

      await checkNotifications(server);

      expect(mockGetNotifications).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        testTargetId: mockTestTargetId,
      });
      expect(mockGetTestReports).not.toHaveBeenCalled();
      expect(server.server.notification).not.toHaveBeenCalled();
    });
  });
});
