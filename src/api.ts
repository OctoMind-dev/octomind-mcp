import axios from "axios";
import {
  ExecuteTestsOptions,
  GetTestReportOptions,
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
  RegisterRequest,
  UnregisterRequest,
  SuccessResponse,
  Environment,
  TestReport,
} from "./types";

const BASE_URL = "https://app.octomind.dev/api";

// Helper function for API calls
const apiCall = async <T>(
  method: "get" | "post" | "put" | "delete" | "patch",
  endpoint: string,
  apiKey: string,
  data?: unknown,
): Promise<T> => {
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
    throw new Error("API request failed");
  }
};

const outputResult = (result: unknown): void => {
  console.log(JSON.stringify(result, null, 2));
};

export const executeTests = async (
  options: ExecuteTestsOptions,
): Promise<TestReportResponse|undefined> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

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

  if (options.json) {
    outputResult(response);
    return response;
  }

  console.log("Test execution started successfully!");
  console.log("Test Report URL:", response.testReportUrl);
  console.log("Report Status:", response.testReport.status);

  if (response.testReport.testResults.length > 0) {
    console.log("\nTest Results:");
    response.testReport.testResults.forEach((result) => {
      console.log(`- Test ${result.testCaseId}: ${result.status}`);
      if (result.errorMessage) {
        console.log(`  Error: ${result.errorMessage}`);
      }
      if (result.traceUrl) {
        console.log(`  Trace: ${result.traceUrl}`);
      }
    });
  }
};

export const getTestReport = async (
  options: GetTestReportOptions,
): Promise<TestReport|undefined> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

  const response = await apiCall<TestReport>(
    "get",
    `/apiKey/v2/test-targets/${options.testTargetId}/test-reports/${options.reportId}`,
    options.apiKey,
  );

  if (options.json) {
    outputResult(response);
    return response;
  }

  console.log("Test Report Details:");
  console.log("Status:", response.status);
  console.log("Execution URL:", response.executionUrl);

  if (response.testResults.length > 0) {
    console.log("\nTest Results:");
    response.testResults.forEach((result) => {
      console.log(`- Test ${result.testCaseId}: ${result.status}`);
      if (result.errorMessage) {
        console.log(`  Error: ${result.errorMessage}`);
      }
      if (result.traceUrl) {
        console.log(`  Trace: ${result.traceUrl}`);
      }
    });
  }
};

export const registerLocation = async (
  options: RegisterLocationOptions,
): Promise<void> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

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

  if (options.json) {
    outputResult(response);
    return;
  }

  console.log("Registration result:", response.success ? "Success" : "Failed");
};

export const unregisterLocation = async (
  options: UnregisterLocationOptions,
): Promise<void> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

  const requestBody: UnregisterRequest = {
    name: options.name,
  };

  const response = await apiCall<SuccessResponse>(
    "put",
    "/apiKey/v1/private-location/unregister",
    options.apiKey,
    requestBody,
  );

  if (options.json) {
    outputResult(response);
    return;
  }

  console.log(
    "Unregistration result:",
    response.success ? "Success" : "Failed",
  );
};

export const listPrivateLocations = async (
  options: ListPrivateLocationsOptions,
): Promise<void> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

  const response = await apiCall<PrivateLocationInfo[]>(
    "get",
    "/apiKey/v1/private-location",
    options.apiKey,
  );

  if (options.json) {
    outputResult(response);
    return;
  }

  console.log("Private Locations:");
  response.forEach((location) => {
    console.log(`- Name: ${location.name}`);
    console.log(`  Status: ${location.status}`);
    console.log(`  Address: ${location.address}`);
  });
};

export const listEnvironments = async (
  options: ListEnvironmentsOptions,
): Promise<void> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

  const response = await apiCall<Environment[]>(
    "get",
    `/apiKey/v2/test-targets/${options.testTargetId}/environments`,
    options.apiKey,
  );

  if (options.json) {
    outputResult(response);
    return;
  }

  console.log("Environments:");
  response.forEach((environment) => {
    console.log(`- Name: ${environment.name}`);
    console.log(`  ID: ${environment.id}`);
    console.log(`  Discovery URL: ${environment.discoveryUrl}`);
    console.log(`  Updated At: ${environment.updatedAt}`);
  });
};

export const createEnvironment = async (
  options: CreateEnvironmentOptions,
): Promise<void> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

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

  if (options.json) {
    outputResult(response);
    return;
  }

  console.log("Environment created successfully!");
  console.log(`- Name: ${response.name}`);
  console.log(`  ID: ${response.id}`);
  console.log(`  Discovery URL: ${response.discoveryUrl}`);
  console.log(`  Updated At: ${response.updatedAt}`);
};

export const updateEnvironment = async (
  options: UpdateEnvironmentOptions,
): Promise<void> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

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

  if (options.json) {
    outputResult(response);
    return;
  }

  console.log("Environment updated successfully!");
  console.log(`- Name: ${response.name}`);
  console.log(`  ID: ${response.id}`);
  console.log(`  Discovery URL: ${response.discoveryUrl}`);
  console.log(`  Updated At: ${response.updatedAt}`);
};

export const deleteEnvironment = async (
  options: DeleteEnvironmentOptions,
): Promise<void> => {
  if (!options.apiKey) {
    console.error("API key is required");
    throw new Error("API key is required");
  }

  await apiCall(
    "delete",
    `/apiKey/v2/test-targets/${options.testTargetId}/environments/${options.environmentId}`,
    options.apiKey,
  );

  if (options.json) {
    outputResult({ success: true });
    return;
  }

  console.log("Environment deleted successfully!");
};
