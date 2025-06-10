import axios from "axios";
import {
  ExecuteTestsOptions,
  GetTestReportOptions,
  GetTestReportsOptions,
  RegisterLocationOptions,
  UnregisterLocationOptions,
  ListPrivateLocationsOptions,
  PrivateLocationInfo,
  ListEnvironmentsOptions,
  CreateEnvironmentOptions,
  UpdateEnvironmentOptions,
  DeleteEnvironmentOptions,
  TestTargetExecutionRequest,
  TestReportResponse,
  TestReportsResponse,
  RegisterRequest,
  UnregisterRequest,
  SuccessResponse,
  Environment,
  TestReport,
  DiscoveryOptions,
  DiscoveryResponse,
  Notification,
  notificationSchema,
  SearchResult,
  TestTarget,
  CreateTestTargetOptions,
  UpdateTestTargetOptions,
  DeleteTestTargetOptions,
  CreateTestTargetBody,
  GetTestCasesOptions,
  TestCaseListItem,
  PatchTestCaseOptions,
} from "./types";
import { version } from "./version";
import { logger } from "./logger";

const BASE_URL = process.env.OCTOMIND_API_URL || "https://app.octomind.dev/api";

// Helper function for API calls
export const apiCall = async <T>(
  method: "get" | "post" | "put" | "delete" | "patch",
  endpoint: string,
  apiKey: string,
  data?: unknown,
): Promise<T> => {
  if (!apiKey) {
    logger.error("API key is required");
    throw new Error("API key is required");
  }

  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${endpoint}`,
      data,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        "User-Agent": `axios 1.8.4 (Octomind MCP Server ${version})`,
      },
    });
    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const filteredError = {
        ...error,
        config: {
          ...error.config,
          headers: {
            ...error.config?.headers,
            "X-API-Key": "<hidden>",
          },
          transformRequest: undefined,
          transformResponse: undefined,
          transitional: undefined,
          adapter: undefined,
        },
        request: {
          host: error.request?.host,
          method: error.request?.method,
          path: error.request?.path,
        },
        response: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          headers: error.response?.headers,
          data: error.response?.data,
        },
       
      };
      logger.error({error: filteredError}, `API Error: ${filteredError.message}`);
      throw new Error(`API request failed. ${JSON.stringify(filteredError, null, 2)}`);
    } else {
      logger.error("Error:", error);
      throw error;
    }
  }
};

export type TestCaseElement = {
  id: string;
  index: number;
  ignoreFailure: boolean;
  interaction: any;
  assertion: any;
  selectors: any[];
};

export type TestCase = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  description: string;
  status: string;
  testTargetId: string;
  discovery: any;
  elements: TestCaseElement[];
};

export const getTestCase = async (
  apiKey: string,
  testCaseId: string,
  testTargetId: string,
): Promise<TestCase> => {
  const response = await apiCall<TestCase>(
    "get",
    `/apiKey/v2/test-targets/${testTargetId}/test-cases/${testCaseId}`,
    apiKey,
  );

  return response;
};

export const discovery = async (
  options: DiscoveryOptions,
): Promise<DiscoveryResponse> => {
  const requestBody = {
    name: options.name,
    prompt: options.prompt,
    entryPointUrlPath: options.entryPointUrlPath,
    prerequisiteName: options.prerequisiteName,
    externalId: options.externalId,
    tagNames: options.tagNames,
    folderName: options.folderName,
  };

  const response = await apiCall<DiscoveryResponse>(
    "post",
    `/apiKey/v2/test-targets/${options.testTargetId}/discoveries`,
    options.apiKey,
    requestBody,
  );

  return response;
};

/* example notification
    {
        "id": "ee8ffcdf-1df8-4b37-b789-9694dd37e6b3",
        "testTargetId": "edea1e1a-5152-4c1a-ac11-8b7d0cff9a6b",
        "createdAt": "2025-03-06T13:23:13.205Z",
        "updatedAt": "2025-03-06T13:29:14.285Z",
        "payload": {
            "testCaseId": "c1ec6d3d-36e8-40eb-b77a-5c7ca4f29605"
        },
        "type": "VALIDATION_PASSED",
        "ack": "IN_WEB_APP"
    },
    */
export const getNotifications = async (
  apiKey: string,
  testTargetId: string,
): Promise<Notification[]> => {
  const raw = await apiCall<Notification[]>(
    "get",
    `/apiKey/v2/test-targets/${testTargetId}/notifications`,
    apiKey,
  );
  const response = raw.map((n) => notificationSchema.parse(n));
  return response;
};

export const executeTests = async (
  options: ExecuteTestsOptions,
): Promise<TestReportResponse> => {
  const requestBody: TestTargetExecutionRequest = {
    testTargetId: options.testTargetId,
    url: options.url,
    context: {
      source: "manual",
      description: options.description || "CLI execution",
      triggeredBy: {
        type: "USER",
        userId: "cli-user",
      },
    },
    environmentName: options.environmentName,
    tags: options.tags,
    variablesToOverwrite: options.variablesToOverwrite,
  };

  const response = await apiCall<TestReportResponse>(
    "post",
    "/apiKey/v2/execute",
    options.apiKey,
    requestBody,
  );
  return response;
};

export const getTestReport = async (
  options: GetTestReportOptions,
): Promise<TestReport> => {
  const response = await apiCall<TestReport>(
    "get",
    `/apiKey/v2/test-targets/${options.testTargetId}/test-reports/${options.reportId}`,
    options.apiKey,
  );

  return response;
};

export const registerLocation = async (
  options: RegisterLocationOptions,
): Promise<SuccessResponse> => {
  const requestBody: RegisterRequest = {
    name: options.name,
    registrationData: {
      proxypass: options.proxypass,
      proxyuser: options.proxyuser,
      address: options.address,
    },
  };

  const response = await apiCall<SuccessResponse>(
    "put",
    "/apiKey/v1/private-location/register",
    options.apiKey,
    requestBody,
  );

  return response;
};

export const unregisterLocation = async (
  options: UnregisterLocationOptions,
): Promise<SuccessResponse> => {
  const requestBody: UnregisterRequest = {
    name: options.name,
  };

  const response = await apiCall<SuccessResponse>(
    "put",
    "/apiKey/v1/private-location/unregister",
    options.apiKey,
    requestBody,
  );

  return response;
};

export const listPrivateLocations = async (
  options: ListPrivateLocationsOptions,
): Promise<PrivateLocationInfo[]> => {
  const response = await apiCall<PrivateLocationInfo[]>(
    "get",
    "/apiKey/v1/private-location",
    options.apiKey,
  );

  return response;
};

export const listEnvironments = async (
  options: ListEnvironmentsOptions,
): Promise<Environment[]> => {
  const response = await apiCall<Environment[]>(
    "get",
    `/apiKey/v2/test-targets/${options.testTargetId}/environments`,
    options.apiKey,
  );

  return response;
};

export const createEnvironment = async (
  options: CreateEnvironmentOptions,
): Promise<Environment> => {
  const requestBody = {
    name: options.name,
    discoveryUrl: options.discoveryUrl,
    testAccount: options.testAccount,
    basicAuth: options.basicAuth,
    privateLocationName: options.privateLocationName,
    additionalHeaderFields: options.additionalHeaderFields,
  };

  const response = await apiCall<Environment>(
    "post",
    `/apiKey/v2/test-targets/${options.testTargetId}/environments`,
    options.apiKey,
    requestBody,
  );

  return response;
};

export const updateEnvironment = async (
  options: UpdateEnvironmentOptions,
): Promise<Environment> => {
  const requestBody = {
    name: options.name,
    discoveryUrl: options.discoveryUrl,
    testAccount: options.testAccount,
    basicAuth: options.basicAuth,
    privateLocationName: options.privateLocationName,
    additionalHeaderFields: options.additionalHeaderFields,
  };

  const response = await apiCall<Environment>(
    "patch",
    `/apiKey/v2/test-targets/${options.testTargetId}/environments/${options.environmentId}`,
    options.apiKey,
    requestBody,
  );
  return response;
};

export const deleteEnvironment = async (
  options: DeleteEnvironmentOptions,
): Promise<SuccessResponse> => {
  await apiCall(
    "delete",
    `/apiKey/v2/test-targets/${options.testTargetId}/environments/${options.environmentId}`,
    options.apiKey,
  );

  return { success: true };
};

export const getTestReports = async (
  options: GetTestReportsOptions,
): Promise<TestReportsResponse> => {
  const queryParams = new URLSearchParams();

  if (options.key) {
    queryParams.append("key", JSON.stringify(options.key));
  }

  if (options.filter) {
    queryParams.append("filter", JSON.stringify(options.filter));
  }

  const queryString = queryParams.toString();
  const endpoint = `/apiKey/v2/test-targets/${options.testTargetId}/test-reports${queryString ? `?${queryString}` : ""}`;

  const response = await apiCall<TestReportsResponse>(
    "get",
    endpoint,
    options.apiKey,
  );

  return response;
};

export const listTestTargets = async (
  apiKey: string,
): Promise<TestTarget[]> => {
  const response = await apiCall<TestTarget[]>(
    "get",
    "/apiKey/v2/test-targets",
    apiKey,
  );
  return response;
};

export const createTestTarget = async (
  options: CreateTestTargetOptions,
): Promise<TestTarget> => {
  const requestBody: CreateTestTargetBody = {
    testTarget: {
      app: options.app,
      discoveryUrl: options.discoveryUrl,
      skipAutomaticTestCreation: options.skipAutomaticTestCreation,
    },
  };

  const response = await apiCall<TestTarget>(
    "post",
    "/apiKey/v2/test-targets",
    options.apiKey,
    requestBody,
  );

  return response;
};

export const updateTestTarget = async (
  options: UpdateTestTargetOptions,
): Promise<TestTarget> => {
  const requestBody = {
    app: options.app,
    discoveryUrl: options.discoveryUrl,
    skipAutomaticTestCreation: options.skipAutomaticTestCreation,
    testIdAttribute: options.testIdAttribute,
    testRailIntegration: options.testRailIntegration,
    timeoutPerStep: options.timeoutPerStep,
  };

  const response = await apiCall<TestTarget>(
    "patch",
    `/apiKey/v2/test-targets/${options.testTargetId}`,
    options.apiKey,
    requestBody,
  );

  return response;
};

export const deleteTestTarget = async (
  options: DeleteTestTargetOptions,
): Promise<SuccessResponse> => {
  const res = await apiCall<SuccessResponse>(
    "delete",
    `/apiKey/v2/test-targets/${options.testTargetId}`,
    options.apiKey,
  );

  return res;
};

export const getTestCases = async (
  options: GetTestCasesOptions,
): Promise<TestCaseListItem[]> => {
  const queryParams = options.filter
    ? `?filter=${encodeURIComponent(options.filter)}`
    : "";
  const response = await apiCall<TestCaseListItem[]>(
    "get",
    `/apiKey/v2/test-targets/${options.testTargetId}/test-cases${queryParams}`,
    options.apiKey,
  );

  return response;
};

export const patchTestCase = async (
  options: PatchTestCaseOptions,
): Promise<TestCase> => {
  const requestBody = {
    elements: options.elements,
    description: options.description,
    entryPointUrlPath: options.entryPointUrlPath,
    status: options.status,
    runStatus: options.runStatus,
    folderName: options.folderName,
    interactionStatus: options.interactionStatus,
    createBackendDiscoveryPrompt: options.createBackendDiscoveryPrompt,
    assignedTagNames: options.assignedTagNames,
    externalId: options.externalId,
  };

  const response = await apiCall<TestCase>(
    "patch",
    `/apiKey/v2/test-targets/${options.testTargetId}/test-cases/${options.testCaseId}`,
    options.apiKey,
    requestBody,
  );

  return response;
};
