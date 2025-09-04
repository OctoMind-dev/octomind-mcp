import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { batchGeneration, discovery } from "./api";
import { logger } from "./logger";
import { DiscoveryOptions } from "./types";

/**
 * Interface for tool handler functions
 */
export interface ToolHandler<T, R> {
  /**
   * Execute the tool handler with the given parameters
   * @param params Parameters for the tool
   * @returns Response from the tool execution
   */
  execute(params: T, apiKey: string): Promise<R>;
}

/**
 * Parameters for the discovery tool
 */
export interface DiscoveryParams {
  name: string;
  testTargetId: string;
  entryPointUrlPath?: string;
  prerequisiteName?: string;
  externalId?: string;
  tagNames?: string[];
  prompt: string;
  folderName?: string;
}

/**
 * Response from a tool
 */
export interface ToolResponse {
  [key: string]: unknown;
  content: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image";
        data: string;
        mimeType: string;
      }
    | {
        type: "audio";
        data: string;
        mimeType: string;
      }
    | {
        type: "resource";
        resource:
          | {
              text: string;
              uri: string;
              mimeType?: string;
            }
          | {
              uri: string;
              blob: string;
              mimeType?: string;
            };
      }
  >;
  _meta?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Handler for the discovery tool
 */
export class DiscoveryHandler
  implements ToolHandler<DiscoveryParams, ToolResponse>
{
  /**
   * Execute the discovery tool with the given parameters
   * @param params Parameters for the discovery tool
   * @returns Response from the discovery tool execution
   */
  async execute(
    params: DiscoveryParams,
    sessionId: string | undefined,
  ): Promise<ToolResponse> {
    logger.debug({ params }, "Discovering test case");

    const discoveryOptions: DiscoveryOptions = {
      sessionId,
      json: true,
      name: params.name,
      prompt: params.prompt,
      testTargetId: params.testTargetId,
      entryPointUrlPath: params.entryPointUrlPath,
      prerequisiteName: params.prerequisiteName,
      externalId: params.externalId,
      tagNames: params.tagNames,
      folderName: params.folderName,
    };

    const res = await discovery(discoveryOptions);
    logger.debug({ res }, `Retrieved discovery for: ${params.name}`);

    return {
      content: [
        {
          type: "text" as const,
          text: `Retrieved discovery for: ${params.name}`,
        },
        {
          type: "text" as const,
          text: JSON.stringify(res),
        },
      ],
    };
  }
}

/**
 * Register the discovery tool with the MCP server
 * @param server MCP server instance
 * @param handler Discovery handler instance
 */
export function registerDiscoveryTool(
  server: McpServer,
  handler: DiscoveryHandler,
): void {
  server.tool(
    "discovery",
    `the discovery tool can create a test case on a given test target with a test case description or prompt.
    One can either start from the predefined url for that test case or provide a new entry point url.`,
    {
      name: z.string().describe("Name of the test case to create"),
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      entryPointUrlPath: z
        .string()
        .optional()
        .describe(
          "Optional entry point URL path, if not provided the predefined url of the test target will be used",
        ),
      prerequisiteName: z
        .string()
        .optional()
        .describe(
          "Optional prerequisite test case name. If set all steps of the prerequisite will be executed before the test case discovery starts",
        ),
      externalId: z
        .string()
        .optional()
        .describe(
          "Optional external identifier. E.g. a ticket number or test rail id",
        ),
      tagNames: z
        .array(z.string())
        .optional()
        .describe(
          "Optional list of tag names to assign to the newly discovered test case",
        ),
      prompt: z
        .string()
        .describe(`Description or prompt that is used for test case generation. Best results are achieved when the prompt is strctured like: "INTENT 
<describe what you want to test> 
INSTRUCTIONS
<everything important you want the agent to take into account> 
record evidence by checking for relevant UI elements 
EXPECTED RESULT 
<describe what the agent should see once the task is done>"`),
      folderName: z
        .string()
        .optional()
        .describe(
          "Optional folder name that the newly discovered test case will be added to",
        ),
      type: z
        .enum(["LOGIN", "COOKIE_BANNER"])
        .optional()
        .describe(`Type of the test case to discover. A login is often used as a prerequisite for other test cases and should discovered first.
          When it is completed it can be used as prerequisite for other test cases. A cookie banner is a test case is used to close the cookie banner of a website.
          Is is also often used as a prerequisite for other test cases. Only set this option for these special test cases. Only one LOGIN or COOKIE_BANNER test case can
          exist per test target at a time.`),
    },
    async (params, { sessionId }) => {
      return handler.execute(params, sessionId);
    },
  );
}

export type BatchGenerationParams = {
  testTargetId: string;
  entryPointUrlPath?: string;
  imageUrls: string[];
  environmentId?: string;
  prerequisiteId?: string;
  baseUrl?: string;
  prompt: string;
};

export class BatchGenerationHandler
  implements ToolHandler<BatchGenerationParams, ToolResponse>
{
  async execute(
    params: BatchGenerationParams,
    sessionId: string | undefined,
  ): Promise<ToolResponse> {
    logger.debug({ params }, "batch generating test cases");
    const res = await batchGeneration({ ...params, sessionId });
    logger.debug({ res }, `Retrieved batch generation for: ${params.prompt}`);
    return {
      content: [
        {
          type: "text" as const,
          text: `Retrieved batch generation for: ${params.prompt}`,
        },
        {
          type: "text" as const,
          text: `Batch generation result: https://app.octomind.dev/testtargets/${params.testTargetId}/batchgenerations/${res.batchGenerationId}`,
        },
      ],
    };
  }
}

export function registerBatchGenerationTool(
  server: McpServer,
  handler: BatchGenerationHandler,
): void {
  server.tool(
    "batchGeneration",
    `the batchGeneration tool can create a batch of test cases on a given test target with a test case description or prompt.
    One can either start from the predefined url for that test case or provide a new entry point url.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      entryPointUrlPath: z
        .string()
        .optional()
        .describe(
          "Optional entry point URL path, if not provided the predefined url of the test target will be used",
        ),
      imageUrls: z.array(z.string()).describe("List of image urls"),
      environmentId: z
        .string()
        .optional()
        .describe(
          "Optional environment id. If not provided the default environment will be used",
        ),
      prerequisiteId: z
        .string()
        .optional()
        .describe(
          "Optional prerequisite test case id. If set all steps of the prerequisite will be executed before the test case discovery starts",
        ),
      baseUrl: z
        .string()
        .optional()
        .describe(
          "Optional base url. If not provided the predefined url of the test target will be used",
        ),
      prompt: z
        .string()
        .describe(`Description or prompt that is used for test case generation. Best results are achieved when the prompt is strctured like: "INTENT 
<describe what you want to test> 
INSTRUCTIONS
<everything important you want the agent to take into account> 
record evidence by checking for relevant UI elements 
EXPECTED RESULT 
<describe what the agent should see once the task is done>"`),
    },
    async (params, { sessionId }) => {
      return handler.execute(params, sessionId);
    },
  );
}
