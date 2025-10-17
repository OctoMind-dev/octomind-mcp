import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createBatchGenerationFromTestPlan } from "./api";
import type { ToolResponse } from "./handlers";
import { logger } from "./logger";
import { CreateFromTestPlanOptions } from "./types";

export interface FromTestPlanParams {
  testTargetId: string;
  inputText: string;
  imageUrls: string[];
  tagNames: string[];
}

export class FromTestPlanHandler {
  async execute(
    params: FromTestPlanParams,
    sessionId: string | undefined,
  ): Promise<ToolResponse> {
    logger.debug({ params }, "Creating test cases from test plan");

    const options: CreateFromTestPlanOptions = {
      sessionId,
      testTargetId: params.testTargetId,
      inputText: params.inputText,
      imageUrls: params.imageUrls,
      tagNames: params.tagNames,
    };

    const res = await createBatchGenerationFromTestPlan(options);
    logger.debug({ res }, "Created from test plan generation");

    return {
      content: [
        {
          type: "text",
          text: `Created from-test-plan generation for: ${params.testTargetId}`,
        },
        { type: "text", text: JSON.stringify(res) },
      ],
    };
  }
}

export function registerFromTestPlanTool(
  server: McpServer,
  handler: FromTestPlanHandler,
): void {
  server.tool(
    "createFromTestPlan",
    `create test cases from a test plan for a given test target. Provide freeform text, related images and tag names to assign`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      inputText: z.string().describe("Freeform input text from the test plan"),
      imageUrls: z
        .array(z.string().url())
        .describe("Images referenced in the test plan"),
      tagNames: z
        .array(z.string())
        .describe("Tags to assign to generated test cases"),
    },
    async (params, { sessionId }) => handler.execute(params, sessionId),
  );
}
