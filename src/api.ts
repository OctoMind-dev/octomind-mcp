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
} from "./types";

const BASE_URL = process.env.OCTOMIND_API_URL || "https://app.octomind.dev/api";

const mintlifyToken = "mint_dsc_3ZNWe13kDZKPFdidzxsnQFyU";
const MINT_SUBDOMAIN = "octomind";
const MINT_SERVER_URL = "https://leaves.mintlify.com";
const DEFAULT_BASE_URL = "https://api.mintlifytrieve.com";
const DOC_BASE_URL = "https://octomind.dev/docs";

const searchFetchPath = `${DEFAULT_BASE_URL}/api/chunk/autocomplete`;

type TrieveData = {
  name: string;
  trieveDatasetId: string; // trieve dataset id
  trieveApiKey: string; // trieve api key
  openApiUrls: string[]; // openapi urls for trieve
};

const trieveFetcher = async (trieve: TrieveData, query: string) => {
  try {
    const response = await axios.post(
      searchFetchPath,
      {
        page_size: 10,
        query,
        search_type: "fulltext",
        extend_results: true,
        score_threshold: 1,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${trieve.trieveApiKey}`,
          "TR-Dataset": trieve.trieveDatasetId,
          "X-API-VERSION": "V2",
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching trieve data:", error);
    throw new Error("Error fetching trieve data");
  }
};

export const trieveConfig = async (): Promise<TrieveData> => {
  try {
    const { data } = await axios.get(
      `${MINT_SERVER_URL}/api/mcp/cli/${MINT_SUBDOMAIN}`,
      {
        headers: {
          "X-API-Key": `${mintlifyToken}`,
        },
      },
    );
    return data;
  } catch (error) {
    console.error("Error fetching trieve result data:", error);
    throw new Error("Error fetching trieve data");
  }
};

export const search = async (
  query: string,
  trieve: TrieveData,
): Promise<SearchResult[]> => {
  const data = await trieveFetcher(trieve, query);
  if (data.chunks === undefined || data.chunks.length === 0) {
    throw new Error("No results found");
  }
  return data.chunks.map((result: any) => {
    const { chunk } = result;
    return {
      title: chunk.metadata.title,
      content: chunk.chunk_html,
      link: `${DOC_BASE_URL}/${chunk.link}`,
    };
  });
};

// Helper function for API calls
const apiCall = async <T>(
  method: "get" | "post" | "put" | "delete" | "patch",
  endpoint: string,
  apiKey: string,
  data?: unknown,
): Promise<T> => {
  if (!apiKey) {
    console.error("API key is required");
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
      },
    });
    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("API Error:", error.response?.data || error.message);
    } else {
      console.error("Error:", error);
    }
    throw new Error(`API request failed. ${JSON.stringify(error, null, 2)}`);
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
    prerequisiteId: options.prerequisiteId,
    externalId: options.externalId,
    assignedTagIds: options.assignedTagIds,
    folderId: options.folderId,
  };

  const response = await apiCall<DiscoveryResponse>(
    "post",
    `/apiKey/v2/test-targets/${options.testTargetId}/discoveries`,
    options.apiKey,
    requestBody,
  );

  return response;
};

/* example notificytion
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
    environmentName: options.environment,
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
): Promise<TestTarget[]> => {
  const requestBody: CreateTestTargetBody = {
    testTarget: {
      app: options.app,
      discoveryUrl: options.discoveryUrl,
      skipAutomaticTestCreation: options.skipAutomaticTestCreation,
    },
  };

  const response = await apiCall<TestTarget[]>(
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
): Promise<void> => {
  await apiCall<void>(
    "delete",
    `/apiKey/v2/test-targets/${options.testTargetId}`,
    options.apiKey,
  );
};
