import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLastTestTargetId, setLastTestTargetId } from "../src/tools";
import { reloadTestReports } from "../src/resources";

jest.mock("../src/resources", () => ({
  reloadTestReports: jest.fn(),
}));

describe("Tools module", () => {
  let server: McpServer;

  beforeEach(() => {
    jest.clearAllMocks();
    server = {
      server: {
        notification: jest.fn(),
      },
    } as unknown as McpServer;
  });

  describe("getLastTestTargetId and setLastTestTargetId", () => {

    const sessionId = "123e4567-e89b-12d3-a456-426614174000";

    it("should initially return undefined", () => {
      expect(getLastTestTargetId(sessionId))
        .resolves
        .toBeUndefined();
    });

    it("should update lastTestTargetId and reload test reports when setting a new target", async () => {
      const testTargetId = "123e4567-e89b-12d3-a456-426614174000";
      await setLastTestTargetId(server, testTargetId, sessionId);

      expect(getLastTestTargetId(sessionId)).resolves.toBe(testTargetId);
      expect(reloadTestReports).toHaveBeenCalledWith(testTargetId, server);
    });

    it("should not reload test reports when setting the same target", async () => {
      const testTargetId = "123e4567-e89b-12d3-a456-426614174000";

      await setLastTestTargetId(server, testTargetId, sessionId);
      await setLastTestTargetId(server, testTargetId, sessionId);

      expect(getLastTestTargetId(sessionId)).resolves.toBe(testTargetId);
      expect(reloadTestReports).toHaveBeenCalledTimes(0);
    });
  });
});
