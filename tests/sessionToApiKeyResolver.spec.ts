import { getApiKey } from "@/sessionToApiKeyResolver";
import { theStdioSessionId } from "@/tools";
import { getSession, Session } from "@/session";

jest.mock("@/session");

const mockedStioSession: Session = {
  apiKey: "test-key",
  sessionId: theStdioSessionId,
  testReportIds: [],
  testCaseIds: [],
  tracesForTestReport: {},
};

describe("getApiKey", () => {
  it("uses the stdio sessionId if no sessionId given", async () => {
    jest.mocked(getSession).mockResolvedValue(mockedStioSession);
    const apiKey = await getApiKey(undefined);
    expect(getSession).toHaveBeenCalledWith(theStdioSessionId);
    expect(apiKey).toBe("test-key");
  });
});
