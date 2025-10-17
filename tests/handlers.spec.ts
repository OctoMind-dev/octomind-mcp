import { DiscoveryHandler, DiscoveryParams } from "@/handlers";
import { discovery } from "@/api";
jest.mock("@/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  },
}));

jest.mock("@/api", () => ({
  discovery: jest.fn(),
}));

jest.mock("@/logger", () => ({
  logger: {
    debug: jest.fn(),
  },
}));

describe("DiscoveryHandler", () => {
  let handler: DiscoveryHandler;

  beforeEach(() => {
    handler = new DiscoveryHandler();
    jest.clearAllMocks();
  });

  const sessionId = "123e4567-e89b-12d3-a456-426614174000";

  describe("execute", () => {
    it("should call discovery API with correct parameters", async () => {
      const mockParams: DiscoveryParams = {
        name: "Test Case",
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
        prompt: "Create a test for login functionality",
        tagNames: ["login", "authentication"],
        folderName: "Auth Tests",
      };

      const mockResponse = {
        id: "test-id",
        status: "success",
        testCaseId: "test-case-id",
      };

      (discovery as jest.Mock).mockResolvedValue(mockResponse);

      const result = await handler.execute(mockParams, sessionId);

      expect(discovery).toHaveBeenCalledWith({
        sessionId,
        json: true,
        name: mockParams.name,
        prompt: mockParams.prompt,
        testTargetId: mockParams.testTargetId,
        tagNames: mockParams.tagNames,
        folderName: mockParams.folderName,
        entryPointUrlPath: undefined,
        prerequisiteName: undefined,
        externalId: undefined,
      });

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: `Retrieved discovery for: ${mockParams.name}`,
          },
          {
            type: "text",
            text: JSON.stringify(mockResponse),
          },
        ],
      });
    });

    it("should handle API errors gracefully", async () => {
      const mockParams: DiscoveryParams = {
        name: "Test Case",
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
        prompt: "Create a test for login functionality",
      };

      const mockError = new Error("API error");

      (discovery as jest.Mock).mockRejectedValue(mockError);

      await expect(handler.execute(mockParams, sessionId)).rejects.toThrow(
        "API error",
      );
    });

    it("should handle optional parameters correctly", async () => {
      const mockParams: DiscoveryParams = {
        name: "Test Case with Options",
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
        prompt: "Create a test for registration",
        entryPointUrlPath: "/register",
        prerequisiteName: "Login Test",
        externalId: "TR-123",
      };

      const mockResponse = {
        id: "test-id-2",
        status: "success",
        testCaseId: "test-case-id-2",
      };

      (discovery as jest.Mock).mockResolvedValue(mockResponse);

      await handler.execute(mockParams, sessionId);
      expect(discovery).toHaveBeenCalledWith({
        sessionId,
        json: true,
        name: mockParams.name,
        prompt: mockParams.prompt,
        testTargetId: mockParams.testTargetId,
        entryPointUrlPath: mockParams.entryPointUrlPath,
        prerequisiteName: mockParams.prerequisiteName,
        externalId: mockParams.externalId,
        tagNames: undefined,
        folderName: undefined,
      });
    });
  });
});
