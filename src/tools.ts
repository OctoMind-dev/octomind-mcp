import { randomUUID } from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  createEnvironment,
  createTestTarget,
  deleteEnvironment,
  deleteTestTarget,
  executeTests,
  getTestCase,
  getTestCases,
  getTestReport,
  getTestReports,
  listEnvironments,
  listPrivateLocations,
  listTestTargets,
  patchTestCase,
  updateEnvironment,
  updateTestCaseElement,
  updateTestTarget,
} from "./api";
import { DiscoveryHandler, registerDiscoveryTool } from "./handlers";
import { logger } from "./logger";
import { clearTestReports, reloadTestReports } from "./resources";
import { search, trieveConfig } from "./search";
import { getSession, setSession } from "./session";
import { version } from "./version";

export const theStdioSessionId = randomUUID();

export const getLastTestTargetId = async (
  sessionId: string,
): Promise<string | undefined> => {
  const session = await getSession(sessionId);
  return session?.currentTestTargetId;
};

export const setLastTestTargetId = async (
  server: McpServer,
  testTargetId: string | undefined,
  sessionId?: string,
): Promise<void> => {
  const session = await getSession(sessionId || theStdioSessionId);
  if (testTargetId !== session.currentTestTargetId) {
    logger.debug("Setting last test target id to %s", testTargetId);
    session.currentTestTargetId = testTargetId;
    await setSession(session);
    if (!testTargetId) {
      await clearTestReports(session, server);
    } else {
      await reloadTestReports(session, server);
    }
  }
};

// Wrapper for tool calls to return error objects instead of throwing
const safeToolCall = async (
  fn: (...args: any[]) => Promise<any>,
  ...callbackArgs: any[]
) => {
  try {
    return await fn(...callbackArgs);
  } catch (error: any) {
    return {
      content: [
        {
          text: `Error: ${error?.message || String(error)}`,
          type: "text",
        },
      ],
    };
  }
};

export const registerTools = async (server: McpServer): Promise<void> => {
  const trieve = await trieveConfig();
  if (trieve) {
    server.tool(
      "search",
      `the search tool can be used to search the octomind documentation for a given query.
    The search results are returned as a list of links to the documentation.`,
      {
        query: z.string().describe("Search query"),
      },
      ({ query: searchQuery }, { sessionId }) =>
        safeToolCall(
          async (query: string, _sessionId: string | undefined) => {
            logger.debug("Search query", query);
            const results = await search(query, trieve);
            logger.debug("Search results", results);
            const c = results.map((result) => {
              const { title, content, link } = result;
              const text = `Title: ${title}\nContent: ${content}\nLink: ${link}`;
              return {
                type: "text",
                text,
              };
            });
            return {
              content: c.map((content) => ({
                ...content,
                type: "text",
              })),
            };
          },
          searchQuery,
          sessionId,
        ),
    );
  }

  server.tool(
    "getTestCase",
    `the getTestCase tool can retrieve a test case for a given test target and test case id.
    A test case id is unique to the test target. The test case includes a set of interactions and assertions.
    it is the result of a discovery or a manual creation.`,
    {
      testCaseId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test case"),
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
    },
    (
      { testCaseId: toolTestCaseId, testTargetId: toolTestTargetId },
      { sessionId: toolSessionId },
    ) =>
      safeToolCall(
        async (
          testCaseId: string,
          testTargetId: string,
          sessionId: string | undefined,
        ) => {
          const res = await getTestCase({
            testCaseId,
            testTargetId,
            sessionId,
          });
          logger.debug("Retrieved test case", res);
          await setLastTestTargetId(server, testTargetId, sessionId);
          return {
            content: [
              {
                text: `Retrieved test case: ${testCaseId} for test target: ${testTargetId}`,
                type: "text",
              },
              {
                type: "text",
                text: JSON.stringify(res),
              },
            ],
          };
        },
        toolTestCaseId,
        toolTestTargetId,
        toolSessionId,
      ),
  );

  // Test execution
  server.tool(
    "executeTests",
    `the executeTests tool can trigger a set of tests for a given test target.
    The test target id is unique to the test target. The tests are executed on the provided url.
    The context object is used to provide information about the source of the test execution.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      url: z.string().url().describe("URL where the tests will be executed"),
      description: z
        .string()
        .optional()
        .describe("Optional description of the test execution"),
      environmentName: z
        .string()
        .default("default")
        .describe("Name of the environment to use for test execution"),
      variablesToOverwrite: z
        .record(z.array(z.string()))
        .optional()
        .describe("Optional variables to override during test execution"),
      tags: z
        .array(z.string())
        .default([])
        .describe("List of tags used for filtering the tests to execute"),
    },
    (
      {
        testTargetId: toolTestTargetId,
        url: toolUrl,
        description: toolDescription,
        environmentName: toolEnvironmentName,
        variablesToOverwrite: toolVariablesToOverwrite,
        tags: toolTags,
      },
      { sessionId: toolSessionId },
    ) =>
      safeToolCall(
        async (
          testTargetId: string,
          url: string,
          description: string | undefined,
          environmentName: string,
          variablesToOverwrite: Record<string, string[]> | undefined,
          tags: string[],
          sessionId: string | undefined,
        ) => {
          logger.debug({ testTargetId }, "Executing tests");
          const res = await executeTests({
            sessionId,
            json: true,
            description: description || "triggered by MCP Tool",
            testTargetId,
            url,
            environmentName,
            variablesToOverwrite,
            tags,
          });
          logger.debug({ res }, "Executed tests");
          await setLastTestTargetId(server, testTargetId, sessionId);
          return {
            content: [
              {
                type: "text",
                text: `Executing tests for target: ${testTargetId} on URL: ${url}`,
              },
              {
                type: "text",
                text: JSON.stringify(res),
              },
            ],
          };
        },
        toolTestTargetId,
        toolUrl,
        toolDescription,
        toolEnvironmentName,
        toolVariablesToOverwrite,
        toolTags,
        toolSessionId,
      ),
  );

  // Environment endpoints
  server.tool(
    "getEnvironments",
    `the getEnvironments tool can retrieve environments for a given test target.
   an environment represents a specific setup or deployments for a test target. It include a test account when necsesary
    to login, a header configuration, a discovery url and a set of variables.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
    },
    ({ testTargetId: toolTestTargetId }, { sessionId: toolSessionId }) =>
      safeToolCall(
        async (testTargetId: string, sessionId: string | undefined) => {
          logger.debug({ testTargetId }, "Retrieving environments");
          const res = await listEnvironments({
            sessionId,
            testTargetId,
          });
          logger.debug({ res }, "Retrieved environments");
          await setLastTestTargetId(server, testTargetId, sessionId);
          return {
            content: [
              {
                type: "text",
                text: `Retrieved environments for test target: ${testTargetId}`,
              },
              {
                type: "text",
                text: JSON.stringify(res),
              },
            ],
          };
        },
        toolTestTargetId,
        toolSessionId,
      ),
  );

  server.tool(
    "createEnvironment",
    `the createEnvironment tool can create an environment for a given test target.
    an environment represents a specific setup or deployments for a test target. It include a test account when necsesary
    to login, a header configuration, a discovery url and a set of variables.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      name: z.string().describe("Name of the environment"),
      discoveryUrl: z.string().url().describe("URL used for test discovery"),
      testAccount: z
        .object({
          username: z
            .string()
            .describe(
              "Username for test account, if discovery needs authentication",
            ),
          password: z
            .string()
            .describe(
              "Password for test account, if discovery needs authentication",
            ),
          otpInitializerKey: z
            .string()
            .optional()
            .describe(
              "Optional OTP initializer key, if discovery needs authentication with otp",
            ),
        })
        .optional()
        .describe(
          "Optional test account credentials, if discovery needs authentication",
        ),
      basicAuth: z
        .object({
          username: z
            .string()
            .describe(
              "Username for basic auth, if discovery needs authentication ",
            ),
          password: z
            .string()
            .describe(
              "Password for basic auth, if discovery needs authentication",
            ),
        })
        .optional()
        .describe(
          "Optional basic authentication credentials, if discovery needs authentication",
        ),
      privateLocationName: z.string().default("US Proxy").optional().describe(
        "Optional name of the private location, if discovery \
        needs to discover in a private location e.g. behind a firewall or VPN",
      ),
      additionalHeaderFields: z.record(z.string()).optional().describe(
        "Optional additional HTTP header fields, \
        if discovery needs additional headers to be set",
      ),
    },
    async (
      {
        testTargetId,
        name,
        discoveryUrl,
        testAccount,
        privateLocationName,
        additionalHeaderFields,
      },
      { sessionId },
    ) => {
      logger.debug({ testTargetId }, "Creating environment");
      const res = await createEnvironment({
        sessionId,
        testTargetId,
        name,
        discoveryUrl,
        testAccount,
        privateLocationName,
        additionalHeaderFields,
      });
      logger.debug({ res }, "Created environment");
      await setLastTestTargetId(server, testTargetId, sessionId);
      return {
        content: [
          {
            text: `Created environment for test target: ${testTargetId}`,
            type: "text",
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  server.tool(
    "updateEnvironment",
    `the updateEnvironment tool can update an environment for a given test target.
    An environment represents a specific setup or deployments for a test target. It includes a test account when necessary
    to login, a header configuration or a discovery url.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      environmentId: z
        .string()
        .uuid()
        .describe("Unique identifier of the environment"),
      name: z
        .string()
        .optional()
        .describe("Optional new name for the environment"),
      discoveryUrl: z
        .string()
        .url()
        .optional()
        .describe("Optional new discovery URL"),
      testAccount: z
        .object({
          username: z
            .string()
            .describe(
              "Username for test account, if discovery needs authentication",
            ),
          password: z
            .string()
            .describe(
              "Password for test account, if discovery needs authentication",
            ),
          otpInitializerKey: z
            .string()
            .optional()
            .describe(
              "Optional OTP initializer key, if discovery needs authentication with otp",
            ),
        })
        .optional()
        .describe(
          "Optional test account credentials, if discovery needs authentication",
        ),
      basicAuth: z
        .object({
          username: z
            .string()
            .describe(
              "Username for basic auth, if discovery needs authentication ",
            ),
          password: z
            .string()
            .describe(
              "Password for basic auth, if discovery needs authentication",
            ),
        })
        .optional()
        .describe(
          "Optional basic authentication credentials, if discovery needs authentication",
        ),
      privateLocationName: z
        .string()
        .optional()
        .describe(
          "Optional name of the private location, if discovery needs to discover in a private location e.g. behind a firewall or VPN",
        ),
      additionalHeaderFields: z
        .record(z.string())
        .optional()
        .describe(
          "Optional additional HTTP header fields, if discovery needs additional headers to be set",
        ),
    },
    async (
      {
        testTargetId,
        environmentId,
        name,
        discoveryUrl,
        testAccount,
        privateLocationName,
        additionalHeaderFields,
      },
      { sessionId },
    ) => {
      logger.debug({ testTargetId }, "Updating environment");
      const res = await updateEnvironment({
        sessionId,
        testTargetId,
        environmentId,
        name,
        discoveryUrl,
        testAccount,
        privateLocationName,
        additionalHeaderFields,
      });
      logger.debug({ res }, "Updated environment");
      await setLastTestTargetId(server, testTargetId, sessionId);
      return {
        content: [
          {
            text: `Updated environment for test target: ${testTargetId}`,
            type: "text",
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  server.tool(
    "deleteEnvironment",
    `deleteEnvironment tool can delete an environment for a given test target.
    The environment id is unique to the test target. The call is not reversible.
    an environment represents a specific setup or deployments for a test target. It include a test account when necsesary
    to login, a header configuration, a discovery url and a set of variables.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      environmentId: z
        .string()
        .uuid()
        .describe("Unique identifier of the environment to delete"),
    },
    async ({ testTargetId, environmentId }, { sessionId }) => {
      logger.debug({ testTargetId }, "Deleting environment");
      const res = await deleteEnvironment({
        sessionId,
        testTargetId,
        environmentId,
      });
      logger.debug({ res }, "Deleted environment");
      await setLastTestTargetId(server, testTargetId, sessionId);
      return {
        content: [
          {
            type: "text",
            text: `Deleted environment: ${environmentId} for test target: ${testTargetId}`,
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  // Test reports
  server.tool(
    "getTestReports",
    `the getTestReports tool can retrieve test reports for a given test target.
    Test reports are generated when set of tests are executed. The test report id is unique to the test target.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      key: z
        .object({
          createdAt: z
            .string()
            .datetime()
            .describe("Creation timestamp for filtering reports"),
        })
        .optional()
        .describe("Optional key for filtering test reports"),
      filter: z
        .array(
          z.object({
            key: z.string().describe("Filter key"),
            operator: z
              .enum(["EQUALS"])
              .describe("Filter operator, currently only EQUALS is supported"),
            value: z.string().describe("Filter value"),
          }),
        )
        .optional()
        .describe("Optional filters for test reports"),
    },
    async ({ testTargetId, key, filter }, { sessionId }) => {
      logger.debug({ testTargetId }, "Retrieving test reports");
      const res = await getTestReports({
        sessionId,
        json: true,
        testTargetId,
        key,
        filter,
      });
      logger.debug({ res }, "Retrieved test reports");
      await setLastTestTargetId(server, testTargetId, sessionId);
      return {
        content: [
          {
            type: "text",
            text: `Retrieved test reports for test target: ${testTargetId}`,
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  server.tool(
    "getTestReport",
    `the getTestReport tool can retrieve a test report for a given test target and test report id.
    A test report id is generated when a set of test are executed on
    a test target. The test report id is unique to the test target.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      testReportId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test report"),
    },
    async ({ testTargetId, testReportId }, { sessionId }) => {
      logger.debug({ testTargetId }, "Retrieving test report");
      const res = await getTestReport({
        sessionId,
        json: true,
        reportId: testReportId,
        testTargetId,
      });
      await setLastTestTargetId(server, testTargetId, sessionId);
      logger.debug({ res }, "Retrieved test report");
      return {
        content: [
          {
            type: "text",
            text: `Retrieved test report: ${testReportId} for test target: ${testTargetId}`,
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  const discoveryHandler = new DiscoveryHandler();
  registerDiscoveryTool(server, discoveryHandler);
  // Private location endpoints
  server.tool(
    "getPrivateLocations",
    `the getPrivateLocations tool can retrieve all private locations configured for that org. 
    A private location is a server that can be used to access a test target behind a firewall or VPN.`,
    {},
    async ({}, { sessionId }) => {
      const res = await listPrivateLocations({ sessionId });
      logger.debug({ res }, "Retrieved all private locations");
      return {
        content: [
          {
            type: "text",
            text: "Retrieved all private locations",
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  server.tool(
    "getTestTargets",
    `the getTestTargets tool can retrieve all test targets or projects.
    Test targets represent applications or services that can be tested using Octomind.`,
    {},
    async ({}, { sessionId }) => {
      const res = await listTestTargets({ sessionId });
      logger.debug({ res }, "Retrieved all test targets");
      return {
        content: [
          {
            type: "text",
            text: "Retrieved all test targets",
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  server.tool(
    "createTestTarget",
    `the createTestTarget tool can create a new test target or project.
    A test target represents an application or service that can be tested using Octomind.`,
    {
      app: z
        .string()
        .describe("The app name or project name of the test target"),
      discoveryUrl: z
        .string()
        .url()
        .describe("The discovery URL of the test target"),
    },
    async ({ app, discoveryUrl }, { sessionId }) => {
      logger.debug({ app, discoveryUrl }, "Creating test target");
      const res = await createTestTarget({
        sessionId,
        app,
        discoveryUrl,
      });
      logger.debug({ res }, "Created test target");
      await setLastTestTargetId(server, res.id, sessionId);
      return {
        content: [
          {
            type: "text",
            text: `Created test target with app name: ${app}`,
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  server.tool(
    "updateTestTarget",
    `the updateTestTarget tool can update an existing test target.
    A test target represents an application or service that can be tested using Octomind.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target to update"),
      app: z
        .string()
        .optional()
        .describe("The app name or project name of the test target"),
      discoveryUrl: z
        .string()
        .url()
        .optional()
        .describe("The discovery URL of the test target"),
      skipAutomaticTestCreation: z
        .boolean()
        .optional()
        .describe(
          "Skip automatic test creation right after the test target is created",
        ),
      testIdAttribute: z
        .string()
        .optional()
        .describe("The attribute name of the test ID"),
      testRailIntegration: z
        .object({
          domain: z.string().describe("The domain of the TestRail instance"),
          username: z
            .string()
            .describe("The username for the TestRail instance"),
          projectId: z
            .string()
            .describe("The project ID for the TestRail instance"),
          apiKey: z.string().describe("The TestRail API key"),
        })
        .optional()
        .describe("TestRail integration configuration"),
      timeoutPerStep: z
        .number()
        .min(5000)
        .max(30000)
        .optional()
        .describe("The timeout per step in milliseconds"),
    },
    async (
      {
        testTargetId,
        discoveryUrl,
        testIdAttribute,
        testRailIntegration,
        timeoutPerStep,
      },
      { sessionId },
    ) => {
      logger.debug({ testTargetId }, "Updating test target");
      const res = await updateTestTarget({
        sessionId,
        testTargetId,
        discoveryUrl,
        testIdAttribute,
        testRailIntegration,
        timeoutPerStep,
      });
      logger.debug({ res }, "Updated test target");
      await setLastTestTargetId(server, testTargetId, sessionId);
      return {
        content: [
          {
            type: "text",
            text: `Updated test target: ${testTargetId}`,
          },
          {
            type: "text",
            text: JSON.stringify(res),
          },
        ],
      };
    },
  );

  server.tool(
    "deleteTestTarget",
    `the deleteTestTarget tool can delete an existing test target.
    This operation cannot be undone.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target to delete"),
    },
    async ({ testTargetId }, { sessionId }) => {
      logger.debug({ testTargetId }, "Deleting test target");
      await deleteTestTarget({
        sessionId,
        testTargetId,
      });
      await setLastTestTargetId(server, undefined, sessionId);
      return {
        content: [
          {
            type: "text",
            text: `Deleted test target: ${testTargetId}`,
          },
        ],
      };
    },
  );

  // Version information
  server.tool(
    "getVersion",
    "Returns the current version of the Octomind MCP server",
    {},
    async () => {
      logger.debug(`Retrieving version -> ${version}`);
      return {
        content: [
          {
            type: "text",
            text: `Octomind MCP Server version: ${version}`,
          },
        ],
      };
    },
  );

  const testCaseFilterSchema = z.object({
    description: z.string().optional(),
    runStatus: z.enum(["ON", "OFF"]).optional(),
    folderId: z.string().optional(),
    externalId: z.string().optional(),
    status: z
      .enum(["ENABLED", "DISABLED", "DRAFT", "OUTDATED", "PROVISIONAL"])
      .optional(),
  });
  type TestCaseFilter = z.infer<typeof testCaseFilterSchema>;

  server.tool(
    "getTestCases",
    `the getTestCases tool can retrieve test cases for a given test target with optional filtering.
    Test cases can be filtered by various criteria such as status, description, or tags.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      filter: testCaseFilterSchema
        .omit({
          status: true,
        })
        .optional()
        .describe(
          'Filter criteria for test cases, these are by default connected by AND. Includes description, runStatus, folderId and externalId. Example: "{ description: "create node", runStatus: "ON" }"',
        ),
    },
    (
      { testTargetId: toolTestTargetId, filter: testCaseFilter },
      { sessionId: toolSessionId },
    ) =>
      safeToolCall(
        async (
          testTargetId: string,
          filter: TestCaseFilter | undefined,
          sessionId: string | undefined,
        ) => {
          const filterWithFallback = filter ?? {};
          filterWithFallback.status = "ENABLED";

          const res = await getTestCases({
            sessionId,
            testTargetId,
            filter: JSON.stringify(filterWithFallback),
          });
          logger.debug("Retrieved test cases", res);
          await setLastTestTargetId(server, testTargetId, sessionId);
          return {
            content: [
              {
                text: `Retrieved ${res.length} test cases for test target: ${testTargetId}${filter ? ` with filter: ${filter}` : ""}`,
                type: "text",
              },
              {
                type: "text",
                text: JSON.stringify(res, null, 2),
              },
            ],
          };
        },
        toolTestTargetId,
        testCaseFilter,
        toolSessionId,
      ),
  );

  // Update Test Case
  server.tool(
    "updateTestCase",
    `the updateTestCase tool can update specific properties of a test case.
    This allows modifying test case details such as description, status, or folderName.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      testCaseId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test case to update"),
      description: z
        .string()
        .nullish()
        .describe("Optional new description for the test case"),
      entryPointUrlPath: z
        .string()
        .nullish()
        .describe("Optional new entry point URL path"),
      runStatus: z
        .enum(["ON", "OFF"])
        .nullish()
        .describe("Optional new run status for the test case"),
      folderName: z
        .string()
        .nullish()
        .describe("Optional folder name to organize the test case"),
      interactionStatus: z
        .enum(["NEW", "OPENED"])
        .nullish()
        .describe("Optional new interaction status"),
      assignedTagNames: z
        .array(z.string())
        .nullish()
        .describe("Optional list of tag names to assign to the test case"),
      externalId: z
        .string()
        .nullish()
        .describe(
          "Optional external identifier for integration with external systems",
        ),
    },
    async (
      {
        testTargetId,
        testCaseId,
        description,
        entryPointUrlPath,
        runStatus,
        folderName,
        interactionStatus,
        assignedTagNames,
        externalId,
      },
      { sessionId },
    ) => {
      const res = await patchTestCase({
        sessionId,
        testTargetId,
        testCaseId,
        description: description ?? undefined,
        entryPointUrlPath: entryPointUrlPath ?? undefined,
        runStatus: runStatus ?? undefined,
        folderName: folderName ?? undefined,
        interactionStatus: interactionStatus ?? undefined,
        assignedTagNames: assignedTagNames ?? undefined,
        externalId: externalId ?? undefined,
      });
      logger.debug("Updated test case", res);
      await setLastTestTargetId(server, testTargetId, sessionId);
      return {
        content: [
          {
            text: `Updated test case: ${testCaseId} for test target: ${testTargetId}`,
            type: "text",
          },
          {
            type: "text",
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "updateTestCaseElement",
    `the updateTestCaseElement tool can update a specific element within a test case.
    Test case elements represent individual steps in a test case, such as interactions (clicks, text input)
    or assertions (checking if elements are visible, have text, etc.). Each element has selectors that
    identify the target element on the page and an action to perform or assertion to verify. You can only update the locatorLine
    of the element in question, for everything else the user currently needs to use the octomind ui.`,
    {
      testTargetId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test target"),
      testCaseId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test case containing the element"),
      elementId: z
        .string()
        .uuid()
        .describe("Unique identifier of the test case element to update"),
      locatorLine: z
        .string()
        .describe(
          "a valid playwright locator line, e.g. \"locator('body')\", or \"getByRole('button', { name: 'some button'}).filter({ hasText: 'some text' })\"",
        ),
    },
    async (
      { testTargetId, testCaseId, elementId, locatorLine },
      { sessionId },
    ) => {
      logger.debug(
        { testTargetId, testCaseId, elementId },
        "Updating test case element",
      );
      const res = await updateTestCaseElement({
        sessionId,
        testTargetId,
        testCaseId,
        elementId,
        locatorLine,
      });
      logger.debug({ res }, "Updated test case element");
      await setLastTestTargetId(server, testTargetId, sessionId);
      return {
        content: [
          {
            text: `Updated test case element: ${elementId} in test case: ${testCaseId} for test target: ${testTargetId}`,
            type: "text",
          },
          {
            type: "text",
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    },
  );
};
