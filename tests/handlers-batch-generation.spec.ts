import { BatchGenerationHandler, BatchGenerationParams } from "@/handlers-batch-generation";
import { createBatchGeneration } from "@/api";

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
  createBatchGeneration: jest.fn(),
}));

describe("BatchGenerationHandler", () => {
  let handler: BatchGenerationHandler;
  const sessionId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    handler = new BatchGenerationHandler();
    jest.clearAllMocks();
  });

  describe("execute", () => {
    it("should call createBatchGeneration API with correct parameters", async () => {
      const mockParams: BatchGenerationParams = {
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
        prompt: "Generate tests",
        imageUrls: ["https://example.com/img1.png"],
        entryPointUrlPath: "/start",
        environmentId: "223e4567-e89b-12d3-a456-426614174000",
        prerequisiteId: "323e4567-e89b-12d3-a456-426614174000",
        baseUrl: "https://example.com",
        guessDependency: true,
      };

      const mockResponse = { batchGenerationId: "826c15af-644b-4b28-89b4-f50ff34e46b7" };
      (createBatchGeneration as jest.Mock).mockResolvedValue(mockResponse);

      const result = await handler.execute(mockParams, sessionId);

      expect(createBatchGeneration).toHaveBeenCalledWith({
        sessionId,
        testTargetId: mockParams.testTargetId,
        prompt: mockParams.prompt,
        imageUrls: mockParams.imageUrls,
        entryPointUrlPath: mockParams.entryPointUrlPath,
        environmentId: mockParams.environmentId,
        prerequisiteId: mockParams.prerequisiteId,
        baseUrl: mockParams.baseUrl,
        guessDependency: mockParams.guessDependency,
      });

      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: `Created batch generation for test target: ${mockParams.testTargetId}`,
          },
          {
            type: "text",
            text: JSON.stringify(mockResponse),
          },
        ],
      });
    });

    it("should handle optional parameters and defaults", async () => {
      const mockParams: BatchGenerationParams = {
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
      };
      const mockResponse = { batchGenerationId: "11111111-2222-3333-4444-555555555555" };
      (createBatchGeneration as jest.Mock).mockResolvedValue(mockResponse);

      await handler.execute(mockParams, sessionId);

      expect(createBatchGeneration).toHaveBeenCalledWith({
        sessionId,
        testTargetId: mockParams.testTargetId,
        prompt: undefined,
        imageUrls: undefined,
        entryPointUrlPath: null,
        environmentId: null,
        prerequisiteId: null,
        baseUrl: null,
        guessDependency: false,
      });
    });

    it("should propagate API errors", async () => {
      const mockParams: BatchGenerationParams = {
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
        prompt: "Generate tests",
      };
      (createBatchGeneration as jest.Mock).mockRejectedValue(new Error("API error"));

      await expect(handler.execute(mockParams, sessionId)).rejects.toThrow("API error");
    });
  });
});
