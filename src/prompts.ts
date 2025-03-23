import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

export const registerPrompts = (server: McpServer): void => {
  server.prompt(
    "Create Login Test Case",
    `Create a login test case for the given test target. A login test case is used to verify that a user can successfully login to a system.
        For a login to work with this prompt you should provide the a test account in the environment you want to use for discovery`,
    (_extra: RequestHandlerExtra) => {
      return {
        description: "Create a login test case for the given test target.",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Log in with the following credentials:
{"user_name":"$OCTO_USERNAME","password":"$OCTO_PASSWORD"}

These credentials are only valid for username/password logins, not for social logins like Facebook, Google, etc.

Your task is to log in only (no workarounds):
- Do not proceed with any additional steps after logging in.
- Do not attempt to use any social login, register, sign up, or reset the password.
- If you encounter captchas, bot protection, or technical issues, abort the task.`,
            },
          },
        ],
      };
    },
  );
};
