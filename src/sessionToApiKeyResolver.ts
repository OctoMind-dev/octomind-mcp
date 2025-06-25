import { getSession } from "./session";
import { theStdioSessionId } from "./tools";

/**
 * for StdioServerTransport the sessionId undefined so we check if there is
 * only one session with StdioServerTransport and return it
 * @param sessionId 
 * @returns 
 */
export const getApiKey = async (sessionId: string | undefined): Promise<string> => {
    if (!sessionId) {
      sessionId = theStdioSessionId;
    }
    const session = await getSession(sessionId);

    return session.apiKey;
  };
