import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createBatchGeneration } from "./api";
import type { ToolResponse } from "./handlers";
import { logger } from "./logger";
import { CreateBatchGenerationOptions } from "./types";

export interface BatchGenerationParams {
  testTargetId: string;
  prompt?: string;
  imageUrls?: string[];
  entryPointUrlPath?: string | null;
  environmentId?: string | null;
  prerequisiteId?: string | null;
  baseUrl?: string | null;
  guessDependency?: boolean | null;
}

export class BatchGenerationHandler {
  async execute(
    params: BatchGenerationParams,
    sessionId: string | undefined,
  ): Promise<ToolResponse> {
    logger.debug({ params }, "Creating batch generation");

    const options: CreateBatchGenerationOptions = {
      sessionId,
      testTargetId: params.testTargetId,
      prompt: params.prompt,
      imageUrls: params.imageUrls,
      entryPointUrlPath: params.entryPointUrlPath ?? null,
      environmentId: params.environmentId ?? null,
      prerequisiteId: params.prerequisiteId ?? null,
      baseUrl: params.baseUrl ?? null,
      guessDependency: params.guessDependency ?? false,
    };

    const res = await createBatchGeneration(options);
    logger.debug({ res }, "Created batch generation");

    return {
      content: [
        {
          type: "text",
          text: `Created batch generation for test target: ${params.testTargetId}`,
        },
        { type: "text", text: JSON.stringify(res) },
      ],
    };
  }
}

export function registerBatchGenerationTool(
  server: McpServer,
  handler: BatchGenerationHandler,
): void {
  server.tool(
    "createBatchGeneration",
    `create a batch discovery for a given test target. Useful to generate multiple test cases from a prompt and optional images in one go`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      prompt: z
        .string()
        .optional()
        .describe("Prompt to generate the test cases"),
      imageUrls: z
        .array(z.string())
        .optional()
        .describe("Image URLs to guide generation"),
      entryPointUrlPath: z
        .string()
        .optional()
        .describe(
          "Optional entry point URL path. Use this if the discovery should not start at the root of the test target.",
        ),
      environmentId: z
        .string()
        .uuid()
        .optional()
        .describe("Optional environment ID"),
      prerequisiteId: z
        .string()
        .uuid()
        .optional()
        .describe("Optional prerequisite test case id"),
      baseUrl: z
        .string()
        .url()
        .optional()
        .describe(
          "Optional base URL override. This is especially useful when discovering on a branch deployment that uses a different URL than the main branch.",
        ),
      guessDependency: z
        .boolean()
        .optional()
        .describe("Guess dependency for the generation"),
    },
    async (params, { sessionId }) => handler.execute(params, sessionId),
  );
}
