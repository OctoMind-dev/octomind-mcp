import { z } from "zod";

export type RunMode = "http" | "stdio";

const isHttpModeFromArgv = (argv: string[]): boolean => {
  return (
    argv.includes("--stream") ||
    argv.includes("-t") ||
    argv.includes("--sse") ||
    argv.includes("-s")
  );
};

export const runMode: RunMode = isHttpModeFromArgv(process.argv)
  ? "http"
  : "stdio";

const oauthScopesSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .refine((scopes) => scopes.length > 0, {
    message: "OAUTH_SCOPES must contain at least one scope",
  });

const httpEnvSchema = z.object({
  OAUTH_AUTH_SERVER_URL: z.string().trim().url(),
  OAUTH_SCOPES: oauthScopesSchema,
  SERVER_BASE_URL: z.string().trim().url(),
});

const stdioEnvSchema = z.object({
  APIKEY: z.string().trim().min(1),
});

const formatZodError = (error: z.ZodError): string => {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
};

export const getHttpEnv = () => {
  const parsed = httpEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables (HTTP mode):\n${formatZodError(parsed.error)}`,
    );
  }

  return {
    oauthAuthServerUrl: parsed.data.OAUTH_AUTH_SERVER_URL,
    oauthScopes: parsed.data.OAUTH_SCOPES,
    serverBaseUrl: parsed.data.SERVER_BASE_URL,
  };
};

export const getStdioEnv = () => {
  const parsed = stdioEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables (stdio mode):\n${formatZodError(parsed.error)}`,
    );
  }

  return {
    apiKey: parsed.data.APIKEY,
  };
};

export const env = runMode === "http" ? getHttpEnv() : getStdioEnv();
