import { FromTestPlanHandler, FromTestPlanParams } from "@/handlers-from-test-plan";
import { createTestCasesFromTestPlan } from "@/api";

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
  createTestCasesFromTestPlan: jest.fn(),
}));

describe("FromTestPlanHandler", () => {
  let handler: FromTestPlanHandler;
  const sessionId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    handler = new FromTestPlanHandler();
    jest.clearAllMocks();
  });

  describe("execute", () => {
    it("should call createBatchGenerationFromTestPlan with correct parameters", async () => {
      const mockParams: FromTestPlanParams = {
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
        inputText: "Create tests from this plan",
        imageUrls: ["https://example.com/plan1.png", "https://example.com/plan2.png"],
        tagNames: ["smoke", "regression"],
      };

      const mockResponse = {
        testCases: [
          { testCaseId: "11111111-1111-1111-1111-111111111111", testCaseUrl: "https://app.octomind.dev/tc/1" },
          { testCaseId: "22222222-2222-2222-2222-222222222222", testCaseUrl: "https://app.octomind.dev/tc/2" },
        ],
        errorMessage: null,
      };

      (createTestCasesFromTestPlan as jest.Mock).mockResolvedValue(mockResponse);

      const result = await handler.execute(mockParams, sessionId);

      expect(createTestCasesFromTestPlan).toHaveBeenCalledWith({
        sessionId,
        testTargetId: mockParams.testTargetId,
        inputText: mockParams.inputText,
        imageUrls: mockParams.imageUrls,
        tagNames: mockParams.tagNames,
      });

      expect(result).toEqual({
        content: [
          { type: "text", text: `Created from-test-plan generation for: ${mockParams.testTargetId}` },
          { type: "text", text: JSON.stringify(mockResponse) },
        ],
      });
    });

    it("should propagate API errors", async () => {
      const mockParams: FromTestPlanParams = {
        testTargetId: "123e4567-e89b-12d3-a456-426614174000",
        inputText: "Create tests",
        imageUrls: [],
        tagNames: [],
      };

      (createTestCasesFromTestPlan as jest.Mock).mockRejectedValue(new Error("API error"));

      await expect(handler.execute(mockParams, sessionId)).rejects.toThrow("API error");
    });
  });
});
