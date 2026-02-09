import { logger } from "./logger";
import { getHttpEnv } from "./env";

export interface OAuthConfig {
  authServerUrl: string;
  serverBaseUrl: string;
  scopes: string[];
  jwksUrl: string;
  authEndpoint: string;
  tokenEndpoint: string;
}

/**
 * Get OAuth configuration from environment variables
 */
export const getOAuthConfig = (): OAuthConfig => {
  logger.debug("Loading OAuth configuration from environment variables");
  const {
    oauthAuthServerUrl: authServerUrl,
    serverBaseUrl,
    oauthScopes,
  } = getHttpEnv();

  logger.debug(
    `OAUTH_AUTH_SERVER_URL: ${authServerUrl ? authServerUrl : "(not set)"}`,
  );
  logger.debug(
    `SERVER_BASE_URL: ${serverBaseUrl ? serverBaseUrl : "(not set)"}`,
  );

  const scopes = oauthScopes;

  logger.debug(`OAUTH_SCOPES: ${scopes.join(", ")}`);
  logger.info(
    `OAuth configured with auth server: ${authServerUrl}, scopes: ${scopes.join(", ")}`,
  );

  return {
    jwksUrl: `${authServerUrl}/.well-known/jwks.json`,
    authEndpoint: `${authServerUrl}/oauth/2.1/authorize`,
    tokenEndpoint: `${authServerUrl}/oauth/2.1/token`,
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
    authorization_servers: [`${config.authServerUrl}/oauth/2.1`],
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
