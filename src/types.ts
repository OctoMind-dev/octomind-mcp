import { z, type ZodEffects, type ZodString } from "zod";
import { validate } from "uuid";

export const uuidValidation = (
  message = "id must be a valid UUID",
): ZodEffects<ZodString, string, string> =>
  z.string().refine((val) => validate(val), message);

export const discoveryBody = z.object({
  name: z.string(),
  entryPointUrlPath: z.string().optional(),
  prerequisiteId: uuidValidation(
    "expected prerequisiteId to be a valid uuid",
  ).optional(),
  externalId: z.string().optional(),
  assignedTagIds: z.array(uuidValidation()).optional(),
  prompt: z.string(),
  folderName: z.string().optional(),
});

export type SearchResult = {
  title: string;
  content: string;
  link: string;
};

export type DiscoveryBody = z.infer<typeof discoveryBody>;

export type DiscoveryResponse = {
  discoveryId: string;
  testCaseId: string;
};

export interface DiscoveryOptions {
  apiKey: string;
  name: string;
  prompt: string;
  testTargetId: string;
  entryPointUrlPath?: string;
  prerequisiteName?: string;
  externalId?: string;
  tagNames?: string[];
  folderName?: string;
  json?: boolean;
}

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

export const notificationSchema = z.object({
  id: z.string(),
  testTargetId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  type: z.string(),
  payload: z.any(),
  ack: z.string().nullable(),
});

export type Notification = z.infer<typeof notificationSchema>;

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
  environmentName?: string;
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

export interface GetTestReportsOptions {
  apiKey: string;
  testTargetId: string;
  key?: {
    createdAt: string;
  };
  filter?: Array<{
    key: string;
    operator: "EQUALS";
    value: string;
  }>;
  json?: boolean;
}

export interface TestReportsResponse {
  data: TestReport[];
  key?: {
    createdAt: string;
  };
  hasNextPage: boolean;
}

export interface TestTarget {
  id: string;
  app: string;
  environments: Environment[];
  skipAutomaticTestCreation: boolean;
}

export interface CreateTestTargetBody {
  testTarget: {
    app: string;
    discoveryUrl: string;
    skipAutomaticTestCreation?: boolean;
  };
}

export interface CreateTestTargetOptions {
  apiKey: string;
  app: string;
  discoveryUrl: string;
  skipAutomaticTestCreation?: boolean;
  json?: boolean;
}

export interface UpdateTestTargetOptions {
  apiKey: string;
  testTargetId: string;
  app?: string;
  discoveryUrl?: string;
  skipAutomaticTestCreation?: boolean;
  testIdAttribute?: string;
  testRailIntegration?: {
    domain: string;
    username: string;
    projectId: string;
    apiKey: string;
  };
  timeoutPerStep?: number;
  json?: boolean;
}

export interface DeleteTestTargetOptions {
  apiKey: string;
  testTargetId: string;
  json?: boolean;
}
