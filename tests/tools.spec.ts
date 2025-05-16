import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLastTestTargetId, setLastTestTargetId } from "@/tools";
import { reloadTestReports } from "@/resources";
import { getSession, Session, setSession } from "@/session";
import { logger } from "@/logger";

jest.mock("@/resources", () => ({
  reloadTestReports: jest.fn(),
}));
jest.mock("@/session", () => ({
  getSession: jest.fn(),
  setSession: jest.fn(),
}));
jest.mock("@/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  },
}));

describe("Tools module", () => {
  let server: McpServer;
  const mockGetSession = jest.mocked(getSession);
  const mockSetSession = jest.mocked(setSession);
  beforeEach(() => {
    jest.clearAllMocks();
    server = {
      server: {
        notification: jest.fn(),
      },
    } as unknown as McpServer;
  });

  describe("getLastTestTargetId and setLastTestTargetId", async () => {
    const sessionId = "123e4567-e89b-12d3-a456-426614174000";
    const mockSession: Session = {
      apiKey: "test-api-key",
      currentTestTargetId: undefined,
      sessionId,
    };
    it("should initially return undefined", async () => {
      mockGetSession.mockResolvedValue(mockSession);
      expect(await getLastTestTargetId(sessionId)).toBeUndefined();
    });

    it("should update lastTestTargetId and reload test reports when setting a new target", async () => {
      const testTargetId = "123e4567-e89b-12d3-a456-426614174000";
      mockGetSession.mockResolvedValue(mockSession);
      await setLastTestTargetId(server, testTargetId, sessionId);

      expect(mockGetSession).toHaveBeenCalledWith(sessionId);
      expect(mockSetSession).toHaveBeenCalledWith({
        ...mockSession,
        currentTestTargetId: testTargetId,
      });
      expect(reloadTestReports).toHaveBeenCalledWith(
        testTargetId,
        server,
        "test-api-key",
      );
    });

    it("should not reload test reports when setting the same target", async () => {
      const testTargetId = "123e4567-e89b-12d3-a456-426614174000";
      mockSession.currentTestTargetId = testTargetId;
      mockGetSession.mockResolvedValue(mockSession);
      await setLastTestTargetId(server, testTargetId, sessionId);
      await setLastTestTargetId(server, testTargetId, sessionId);

      expect(mockGetSession).toHaveBeenCalledWith(sessionId);
      expect(reloadTestReports).toHaveBeenCalledTimes(0);
    });
  });
});
