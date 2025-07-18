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
// Mock the discovery function from the API
jest.mock("@/api", () => ({
  discovery: jest.fn(),
}));

// Mock the logger to avoid logging during tests
jest.mock("@/logger", () => ({
  logger: {
    debug: jest.fn(),
  },
}));

describe("DiscoveryHandler", () => {
  let handler: DiscoveryHandler;

  beforeEach(() => {
    // Create a new handler instance before each test
    handler = new DiscoveryHandler();

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  const sessionId = "123e4567-e89b-12d3-a456-426614174000";

  describe("execute", () => {
    it("should call discovery API with correct parameters", async () => {
      // Arrange
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

      // Mock the discovery function to return a successful response
      (discovery as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await handler.execute(mockParams, sessionId);

      // Assert
      // Check that discovery was called with the correct parameters
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

      // Check the response structure
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
      // Arrange
      const mockParams: DiscoveryParams = {
        name: "Test Case",
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
        prompt: "Create a test for login functionality",
      };

      const mockError = new Error("API error");

      // Mock the discovery function to throw an error
      (discovery as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(handler.execute(mockParams, sessionId)).rejects.toThrow(
        "API error",
      );
    });

    it("should handle optional parameters correctly", async () => {
      // Arrange
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

      // Mock the discovery function to return a successful response
      (discovery as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handler.execute(mockParams, sessionId);

      // Assert
      // Check that discovery was called with all the optional parameters
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
