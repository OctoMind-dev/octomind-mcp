import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkNotifications, resetRefreshTimes } from "../src/resources";
import { getLastTestTargetId } from "../src/tools";
import { getNotifications, getTestReports } from "../src/api";

jest.mock("../src/tools");
jest.mock("../src/api");

describe("Resources module", () => {
  let server: McpServer;
  const mockTestTargetId = "123e4567-e89b-12d3-a456-426614174000";
  const baseTime = new Date("2025-03-23T10:00:00Z").getTime();
  const mockGetLastTestTargetId = jest.mocked(getLastTestTargetId);
  const mockGetNotifications = jest.mocked(getNotifications);
  const mockGetTestReports = jest.mocked(getTestReports);
  //const mockGetTestCases = jest.mocked(getTestCases);
  beforeEach(() => {
    jest.clearAllMocks();
    server = {
      server: {
        notification: jest.fn(),
      },
    } as unknown as McpServer;
  });

  describe("checkNotifications", () => {
    beforeEach(() => {
      resetRefreshTimes(new Date(baseTime));
    });

    it("should do nothing when no test target is set", async () => {
      mockGetLastTestTargetId.mockReturnValue(undefined);

      await checkNotifications(server);

      expect(mockGetNotifications).not.toHaveBeenCalled();
      expect(server.server.notification).not.toHaveBeenCalled();
      expect(mockGetTestReports).not.toHaveBeenCalled();
    });

    it("should reload reports when REPORT_EXECUTION_FINISHED notification is received", async () => {
      mockGetLastTestTargetId.mockReturnValue(mockTestTargetId);
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

      expect(mockGetNotifications).toHaveBeenCalledWith(
        "",
        mockTestTargetId,
      );
      expect(mockGetTestReports).toHaveBeenCalledWith({
        apiKey: "",
        testTargetId: mockTestTargetId,
      });
      expect(server.server.notification).toHaveBeenCalledWith({
        method: "notifications/resources/list_changed",
      });
    });

    it("should reload test cases when DISCOVERY_FINISHED notification is received", async () => {
      mockGetLastTestTargetId.mockReturnValue(mockTestTargetId);
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

      await checkNotifications(server);

      expect(mockGetNotifications).toHaveBeenCalledWith(
        "",
        mockTestTargetId,
      );
      expect(server.server.notification).toHaveBeenCalledWith({
        method: "notifications/resources/list_changed",
      });
    });

    it("should reload both when both types of notifications are received", async () => {
      mockGetLastTestTargetId.mockReturnValue(mockTestTargetId);
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

      await checkNotifications(server);

      expect(mockGetNotifications).toHaveBeenCalledWith(
        "",
        mockTestTargetId,
      );
      expect(mockGetTestReports).toHaveBeenCalledWith({
        apiKey: "",
        testTargetId: mockTestTargetId,
      });
      expect(server.server.notification).toHaveBeenCalledTimes(2);
    });

    it("should not reload when notifications are older than last refresh", async () => {
      mockGetLastTestTargetId.mockReturnValue(mockTestTargetId);
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

      expect(mockGetNotifications).toHaveBeenCalledWith(
        "",
        mockTestTargetId,
      );
      expect(mockGetTestReports).not.toHaveBeenCalled();
      expect(server.server.notification).not.toHaveBeenCalled();
    });
  });
});
