export interface ExecutionContext {
  source:
    | "manual"
    | "github"
    | "azureDevOps"
    | "discovery"
    | "scheduled"
    | "proposal";
  description?: string;
  triggeredBy?: {
    type: "USER" | "INITIAL";
    userId?: string;
  };
}

export interface TestTargetExecutionRequest {
  testTargetId: string;
  url: string;
  context: ExecutionContext;
  environmentName?: string;
  tags?: string[];
  variablesToOverwrite?: Record<string, string[]>;
}

export interface TestResult {
  id: string;
  testTargetId: string;
  testCaseId: string;
  status: "WAITING" | "PASSED" | "FAILED" | "ERROR";
  errorMessage?: string;
  traceUrl?: string;
}

export interface TestReport {
  id: string;
  testTargetId: string;
  status: "WAITING" | "PASSED" | "FAILED";
  executionUrl: string;
  testResults: TestResult[];
}

export interface TestReportResponse {
  testReportUrl: string;
  testReport: TestReport;
}

export interface RegisterRequest {
  name: string;
  registrationData: {
    proxypass: string;
    proxyuser: string;
    address: string;
  };
}

export interface UnregisterRequest {
  name: string;
}

export interface SuccessResponse {
  success: boolean;
}

export interface ExecuteTestsOptions {
  apiKey: string;
  testTargetId: string;
  url: string;
  environment?: string;
  description?: string;
  json?: boolean;
  tags?: string[];
  variablesToOverwrite?: Record<string, string[]>;
}

export interface GetTestReportOptions {
  apiKey: string;
  testTargetId: string;
  reportId: string;
  json?: boolean;
}

export interface RegisterLocationOptions {
  apiKey: string;
  name: string;
  proxypass: string;
  proxyuser: string;
  address: string;
  json?: boolean;
}

export interface UnregisterLocationOptions {
  apiKey: string;
  name: string;
  json?: boolean;
}

export interface ListPrivateLocationsOptions {
  apiKey: string;
  json?: boolean;
}

export interface PrivateLocationInfo {
  status: "OFFLINE" | "ONLINE";
  address: string;
  name: string;
}

export interface Environment {
  id: string;
  name: string;
  testTargetId: string;
  updatedAt: string;
  type: string;
  discoveryUrl: string;
  additionalHeaderFields?: Record<string, string>;
  testAccount?: {
    username: string;
    password: string;
    otpInitializerKey?: string;
    updatedAt: string;
  };
  basicAuth?: {
    username: string;
    password: string;
    updatedAt: string;
  };
  privateLocation?: {
    id: string;
    name: string;
    status: string;
    type: string;
  };
}

export interface ListEnvironmentsOptions {
  apiKey: string;
  testTargetId: string;
  json?: boolean;
}

export interface CreateEnvironmentOptions {
  apiKey: string;
  testTargetId: string;
  name: string;
  discoveryUrl: string;
  testAccount?: {
    username: string;
    password: string;
    otpInitializerKey?: string;
  };
  basicAuth?: {
    username: string;
    password: string;
  };
  privateLocationName?: string;
  additionalHeaderFields?: Record<string, string>;
  json?: boolean;
}

export interface UpdateEnvironmentOptions {
  apiKey: string;
  testTargetId: string;
  environmentId: string;
  name?: string;
  discoveryUrl?: string;
  testAccount?: {
    username: string;
    password: string;
    otpInitializerKey?: string;
  };
  basicAuth?: {
    username: string;
    password: string;
  };
  privateLocationName?: string;
  additionalHeaderFields?: Record<string, string>;
  json?: boolean;
}

export interface DeleteEnvironmentOptions {
  apiKey: string;
  testTargetId: string;
  environmentId: string;
  json?: boolean;
}
