import axios, { get } from "axios";
import {
  createEnvironment,
  deleteEnvironment,
  executeTests,
  getNotifications,
  getTestReport,
  listEnvironments,
  listPrivateLocations,
  registerLocation,
  unregisterLocation,
  updateEnvironment,
} from "../src/api";
import {
  CreateEnvironmentOptions,
  DeleteEnvironmentOptions,
  ExecuteTestsOptions,
  GetTestReportOptions,
  ListEnvironmentsOptions,
  ListPrivateLocationsOptions,
  RegisterLocationOptions,
  UnregisterLocationOptions,
  UpdateEnvironmentOptions,
} from "../src/types";

jest.mock("axios");
const mockedAxios = jest.mocked(axios);

describe("API calls", () => {
  const apiKey = "test-api-key";
  const BASE_URL = "https://app.octomind.dev";
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("executeTests", async () => {
    const options: ExecuteTestsOptions = {
      apiKey,
      testTargetId: "test-target-id",
      url: "https://example.com",
      environment: "default",
      description: "Test description",
      json: true,
    };

    mockedAxios.mockResolvedValue({
      data: {
        testReportUrl: "https://example.com",
        testReport: { status: "PASSED", testResults: [] },
      },
    });

    await executeTests(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: `${BASE_URL}/api/apiKey/v2/execute`,
        data: expect.any(Object),
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("getNotifications", async () => {
    mockedAxios.mockResolvedValue({
      data: [
        {
          id: "8116fa3b-09de-4c44-b283-1b8f067c3360",
          testTargetId: "7c2cb4a3-92b6-405e-9869-da0b6c64737e",
          createdAt: "2025-03-20T21:45:41.413Z",
          updatedAt: "2025-03-20T21:45:41.413Z",
          payload: { testCaseId: "27440e7b-db95-4a97-bc8b-873e0313b5bc" },
          type: "VALIDATION_PASSED",
          ack: null,
        },
      ],
    });

    const res = await getNotifications(apiKey, "testTargetId");

    expect(res[0].createdAt.getTime()).toBe(1742507141413);
  });

  it("getTestReport", async () => {
    const options: GetTestReportOptions = {
      apiKey,
      testTargetId: "test-target-id",
      reportId: "test-report-id",
      json: true,
    };

    mockedAxios.mockResolvedValue({
      data: {
        status: "PASSED",
        executionUrl: "https://example.com",
        testResults: [],
      },
    });

    await getTestReport(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: `${BASE_URL}/api/apiKey/v2/test-targets/test-target-id/test-reports/test-report-id`,
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("registerLocation", async () => {
    const options: RegisterLocationOptions = {
      apiKey,
      name: "test-location",
      proxypass: "password",
      proxyuser: "user",
      address: "address",
      json: true,
    };

    mockedAxios.mockResolvedValue({ data: { success: true } });

    await registerLocation(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "put",
        url: `${BASE_URL}/api/apiKey/v1/private-location/register`,
        data: expect.any(Object),
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("unregisterLocation", async () => {
    const options: UnregisterLocationOptions = {
      apiKey,
      name: "test-location",
      json: true,
    };

    mockedAxios.mockResolvedValue({ data: { success: true } });

    await unregisterLocation(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "put",
        url: `${BASE_URL}/api/apiKey/v1/private-location/unregister`,
        data: expect.any(Object),
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("listPrivateLocations", async () => {
    const options: ListPrivateLocationsOptions = {
      apiKey,
      json: true,
    };

    mockedAxios.mockResolvedValue({
      data: [{ name: "location1", status: "ONLINE", address: "address1" }],
    });

    await listPrivateLocations(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: `${BASE_URL}/api/apiKey/v1/private-location`,
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("listEnvironments", async () => {
    const options: ListEnvironmentsOptions = {
      apiKey,
      testTargetId: "test-target-id",
      json: true,
    };

    mockedAxios.mockResolvedValue({
      data: [
        {
          id: "env1",
          name: "env1",
          discoveryUrl: "https://example.com",
          updatedAt: "2023-01-01",
        },
      ],
    });

    await listEnvironments(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: `${BASE_URL}/api/apiKey/v2/test-targets/test-target-id/environments`,
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("createEnvironment", async () => {
    const options: CreateEnvironmentOptions = {
      apiKey,
      testTargetId: "test-target-id",
      name: "env1",
      discoveryUrl: "https://example.com",
      json: true,
    };

    mockedAxios.mockResolvedValue({
      data: {
        id: "env1",
        name: "env1",
        discoveryUrl: "https://example.com",
        updatedAt: "2023-01-01",
      },
    });

    await createEnvironment(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: `${BASE_URL}/api/apiKey/v2/test-targets/test-target-id/environments`,
        data: expect.any(Object),
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("updateEnvironment", async () => {
    const options: UpdateEnvironmentOptions = {
      apiKey,
      testTargetId: "test-target-id",
      environmentId: "env1",
      name: "env1-updated",
      discoveryUrl: "https://example.com",
      json: true,
    };

    mockedAxios.mockResolvedValue({
      data: {
        id: "env1",
        name: "env1-updated",
        discoveryUrl: "https://example.com",
        updatedAt: "2023-01-01",
      },
    });

    await updateEnvironment(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "patch",
        url: `${BASE_URL}/api/apiKey/v2/test-targets/test-target-id/environments/env1`,
        data: expect.any(Object),
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("deleteEnvironment", async () => {
    const options: DeleteEnvironmentOptions = {
      apiKey,
      testTargetId: "test-target-id",
      environmentId: "env1",
      json: true,
    };

    mockedAxios.mockResolvedValue({ data: { success: true } });

    await deleteEnvironment(options);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "delete",
        url: `${BASE_URL}/api/apiKey/v2/test-targets/test-target-id/environments/env1`,
        headers: expect.objectContaining({
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
