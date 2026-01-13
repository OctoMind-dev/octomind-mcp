import { logger } from "./logger";

export interface OAuthConfig {
  authServerUrl: string;
  serverBaseUrl: string;
  scopes: string[];
}

/**
 * Get OAuth configuration from environment variables
 */
export const getOAuthConfig = (): OAuthConfig | null => {
  logger.debug("Loading OAuth configuration from environment variables");
  const authServerUrl = process.env.OAUTH_AUTH_SERVER_URL;
  const serverBaseUrl = process.env.SERVER_BASE_URL;

  logger.debug(
    `OAUTH_AUTH_SERVER_URL: ${authServerUrl ? authServerUrl : "(not set)"}`,
  );
  logger.debug(`SERVER_BASE_URL: ${serverBaseUrl ? serverBaseUrl : "(not set)"}`);

  // OAuth is optional - if not configured, fall back to API key auth
  if (!authServerUrl) {
    logger.debug("OAuth not configured - using API key authentication only");
    return null;
  }

  if (!serverBaseUrl) {
    logger.warn(
      "OAUTH_AUTH_SERVER_URL is set but SERVER_BASE_URL is not - OAuth discovery will not work properly",
    );
    return null;
  }

  const scopes = process.env.OAUTH_SCOPES
    ? process.env.OAUTH_SCOPES.split(",").map((s) => s.trim())
    : ["octomind:read", "octomind:write"];

  logger.debug(`OAUTH_SCOPES: ${scopes.join(", ")}`);
  logger.info(
    `OAuth configured with auth server: ${authServerUrl}, scopes: ${scopes.join(", ")}`,
  );

  return {
    authServerUrl,
    serverBaseUrl,
    scopes,
  };
};

/**
 * Generate Protected Resource Metadata according to RFC 9728
 * https://datatracker.ietf.org/doc/html/rfc9728
 */
export const getProtectedResourceMetadata = (config: OAuthConfig) => {
  return {
    resource: config.serverBaseUrl,
    authorization_servers: [config.authServerUrl],
    scopes_supported: config.scopes,
    bearer_methods_supported: ["header"],
    resource_documentation: "https://github.com/Octomind-dev/mcp-octomind",
  };
};

/**
 * Generate WWW-Authenticate header value for 401 responses
 */
export const getWWWAuthenticateHeader = (
  config: OAuthConfig,
  scope?: string,
): string => {
  const resourceMetadataUrl = `${config.serverBaseUrl}/.well-known/oauth-protected-resource`;
  const scopeParam = scope ? `, scope="${scope}"` : "";
  return `Bearer resource_metadata="${resourceMetadataUrl}"${scopeParam}`;
};
