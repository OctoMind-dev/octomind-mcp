import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "./logger";
import { discovery } from "./api";
import { DiscoveryOptions } from "./types";
import { getSession } from "./session";

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
  async execute(params: DiscoveryParams, apiKey: string): Promise<ToolResponse> {
    logger.debug({ params }, "Discovering test case");

    const discoveryOptions: DiscoveryOptions = {
      apiKey,
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
        .describe("Description or prompt used for test case generation"),
      folderName: z
        .string()
        .optional()
        .describe(
          "Optional folder name that the newly discovered test case will be added to",
        ),
    },
    async (params, {sessionId}) => {
      if (!sessionId) {
        throw new Error("Unauthorized");
      }
      const session = await getSession(sessionId);
      if (!session) {
        throw new Error("Unauthorized");
      }
      return await handler.execute(params, session.apiKey);
    },
  );
}
