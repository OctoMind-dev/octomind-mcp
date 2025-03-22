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
} from "./types";

const BASE_URL = process.env.OCTOMIND_API_URL || "https://app.octomind.dev/api";

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
    throw new Error("API request failed", error);
  }
};

const outputResult = (result: unknown): void => {
  console.log(JSON.stringify(result, null, 2));
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
  return(response);
};

export const getTestReport = async (
  options: GetTestReportOptions,
): Promise<TestReport> => {

  const response = await apiCall<TestReport>(
    "get",
    `/apiKey/v2/test-targets/${options.testTargetId}/test-reports/${options.reportId}`,
    options.apiKey,
  );

  return(response);
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

  return(response);
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

  return(response);
};

export const listPrivateLocations = async (
  options: ListPrivateLocationsOptions,
): Promise<PrivateLocationInfo[]> => {
  const response = await apiCall<PrivateLocationInfo[]>(
    "get",
    "/apiKey/v1/private-location",
    options.apiKey,
  );

  return(response);

};

export const listEnvironments = async (
  options: ListEnvironmentsOptions,
): Promise<Environment[]> => {

  const response = await apiCall<Environment[]>(
    "get",
    `/apiKey/v2/test-targets/${options.testTargetId}/environments`,
    options.apiKey,
  );

  return(response);

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

  return(response);
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
  return(response);

};

export const deleteEnvironment = async (
  options: DeleteEnvironmentOptions,
): Promise<SuccessResponse> => {

  await apiCall(
    "delete",
    `/apiKey/v2/test-targets/${options.testTargetId}/environments/${options.environmentId}`,
    options.apiKey,
  );

  return({ success: true });
};

export const getTestReports = async (
  options: GetTestReportsOptions,
): Promise<TestReportsResponse> => {
  const queryParams = new URLSearchParams();

  if (options.key) {
    queryParams.append('key', JSON.stringify(options.key));
  }

  if (options.filter) {
    queryParams.append('filter', JSON.stringify(options.filter));
  }

  const queryString = queryParams.toString();
  const endpoint = `/apiKey/v2/test-targets/${options.testTargetId}/test-reports${queryString ? `?${queryString}` : ''}`;

  const response = await apiCall<TestReportsResponse>(
    "get",
    endpoint,
    options.apiKey,
  );

  return response;
};
