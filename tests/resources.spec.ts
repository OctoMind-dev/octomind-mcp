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
import {
  checkNotifications,
  resetRefreshTimes,
  listTestReports,
  registerResources,
  readTestReport,
} from "../src/resources";
import * as tools from "../src/tools";
import * as api from "../src/api";
import { TestReportsResponse } from "../src/types";

jest.mock("../src/tools", () => ({
  getLastTestTargetId: jest.fn(),
  APIKEY: "test-api-key",
}));

jest.mock("../src/api", () => ({
  getNotifications: jest.fn(),
  getTestReports: jest
    .fn()
    .mockResolvedValue({ data: [], hasNextPage: false } as TestReportsResponse),
  getTestCase: jest.fn().mockResolvedValue({ data: [] }),
}));

describe("Resources module", () => {
  let server: McpServer;
  const mockTestTargetId = "123e4567-e89b-12d3-a456-426614174000";
  const baseTime = new Date("2025-03-23T10:00:00Z").getTime();

  beforeEach(() => {
    jest.clearAllMocks();
    server = {
      server: {
        notification: jest.fn(),
      },
    } as unknown as McpServer;
    // Reset the module's state
    jest.isolateModules(() => {
      require("../src/resources");
    });
  });

  describe("checkNotifications", () => {
    beforeEach(() => {
      resetRefreshTimes(new Date(baseTime));
    });

    it("should do nothing when no test target is set", async () => {
      jest.spyOn(tools, "getLastTestTargetId").mockReturnValue(undefined);

      await checkNotifications(server);

      expect(api.getNotifications).not.toHaveBeenCalled();
      expect(server.server.notification).not.toHaveBeenCalled();
      expect(api.getTestReports).not.toHaveBeenCalled();
    });

    it("should reload reports when REPORT_EXECUTION_FINISHED notification is received", async () => {
      jest
        .spyOn(tools, "getLastTestTargetId")
        .mockReturnValue(mockTestTargetId);
      jest.spyOn(api, "getNotifications").mockResolvedValue([
        {
          id: "1",
          type: "REPORT_EXECUTION_FINISHED",
          updatedAt: new Date(baseTime + 1000), // 1 second later
          createdAt: new Date(baseTime),
          testTargetId: mockTestTargetId,
          ack: null,
        },
      ]);
      jest
        .spyOn(api, "getTestReports")
        .mockResolvedValue({ data: [], hasNextPage: false });

      await checkNotifications(server);

      expect(api.getNotifications).toHaveBeenCalledWith(
        "test-api-key",
        mockTestTargetId,
      );
      expect(api.getTestReports).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        testTargetId: mockTestTargetId,
      });
      expect(server.server.notification).toHaveBeenCalledWith({
        method: "notifications/resources/list_changed",
      });
    });

    it("should reload test cases when DISCOVERY_FINISHED notification is received", async () => {
      jest
        .spyOn(tools, "getLastTestTargetId")
        .mockReturnValue(mockTestTargetId);
      jest.spyOn(api, "getNotifications").mockResolvedValue([
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

      expect(api.getNotifications).toHaveBeenCalledWith(
        "test-api-key",
        mockTestTargetId,
      );
      expect(server.server.notification).toHaveBeenCalledWith({
        method: "notifications/resources/list_changed",
      });
    });

    it("should reload both when both types of notifications are received", async () => {
      jest
        .spyOn(tools, "getLastTestTargetId")
        .mockReturnValue(mockTestTargetId);
      jest.spyOn(api, "getNotifications").mockResolvedValue([
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
      jest
        .spyOn(api, "getTestReports")
        .mockResolvedValue({ data: [], hasNextPage: false });

      await checkNotifications(server);

      expect(api.getNotifications).toHaveBeenCalledWith(
        "test-api-key",
        mockTestTargetId,
      );
      expect(api.getTestReports).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        testTargetId: mockTestTargetId,
      });
      expect(server.server.notification).toHaveBeenCalledTimes(2);
    });

    it("should not reload when notifications are older than last refresh", async () => {
      jest
        .spyOn(tools, "getLastTestTargetId")
        .mockReturnValue(mockTestTargetId);
      jest.spyOn(api, "getNotifications").mockResolvedValue([
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

      expect(api.getNotifications).toHaveBeenCalledWith(
        "test-api-key",
        mockTestTargetId,
      );
      expect(api.getTestReports).not.toHaveBeenCalled();
      expect(server.server.notification).not.toHaveBeenCalled();
    });
  });
});
