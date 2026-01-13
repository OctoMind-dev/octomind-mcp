import {
  getOAuthConfig,
  getProtectedResourceMetadata,
  getWWWAuthenticateHeader,
} from "../src/oauth-config";

describe("OAuth Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getOAuthConfig", () => {
    it("should return null when OAUTH_AUTH_SERVER_URL is not set", () => {
      delete process.env.OAUTH_AUTH_SERVER_URL;
      const config = getOAuthConfig();
      expect(config).toBeNull();
    });

    it("should return null when SERVER_BASE_URL is not set", () => {
      process.env.OAUTH_AUTH_SERVER_URL = "https://auth.example.com";
      delete process.env.SERVER_BASE_URL;
      const config = getOAuthConfig();
      expect(config).toBeNull();
    });

    it("should return config with default scopes when OAUTH_SCOPES is not set", () => {
      process.env.OAUTH_AUTH_SERVER_URL = "https://auth.example.com";
      process.env.SERVER_BASE_URL = "https://mcp.example.com";
      delete process.env.OAUTH_SCOPES;

      const config = getOAuthConfig();
      expect(config).toEqual({
        authServerUrl: "https://auth.example.com",
        serverBaseUrl: "https://mcp.example.com",
        scopes: ["octomind:read", "octomind:write"],
      });
    });

    it("should parse custom scopes from OAUTH_SCOPES", () => {
      process.env.OAUTH_AUTH_SERVER_URL = "https://auth.example.com";
      process.env.SERVER_BASE_URL = "https://mcp.example.com";
      process.env.OAUTH_SCOPES = "scope1, scope2, scope3";

      const config = getOAuthConfig();
      expect(config?.scopes).toEqual(["scope1", "scope2", "scope3"]);
    });

    it("should work with PropelAuth test URL", () => {
      process.env.OAUTH_AUTH_SERVER_URL =
        "https://6393987891.propelauthtest.com";
      process.env.SERVER_BASE_URL = "http://localhost:3000";

      const config = getOAuthConfig();
      expect(config).toEqual({
        authServerUrl: "https://6393987891.propelauthtest.com",
        serverBaseUrl: "http://localhost:3000",
        scopes: ["octomind:read", "octomind:write"],
      });
    });
  });

  describe("getProtectedResourceMetadata", () => {
    it("should generate valid RFC 9728 metadata", () => {
      const config = {
        authServerUrl: "https://auth.example.com",
        serverBaseUrl: "https://mcp.example.com",
        scopes: ["read", "write"],
      };

      const metadata = getProtectedResourceMetadata(config);

      expect(metadata).toEqual({
        resource: "https://mcp.example.com",
        authorization_servers: ["https://auth.example.com"],
        scopes_supported: ["read", "write"],
        bearer_methods_supported: ["header"],
        resource_documentation:
          "https://github.com/Octomind-dev/mcp-octomind",
      });
    });
  });

  describe("getWWWAuthenticateHeader", () => {
    it("should generate WWW-Authenticate header without scope", () => {
      const config = {
        authServerUrl: "https://auth.example.com",
        serverBaseUrl: "https://mcp.example.com",
        scopes: ["read", "write"],
      };

      const header = getWWWAuthenticateHeader(config);

      expect(header).toBe(
        'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
      );
    });

    it("should generate WWW-Authenticate header with scope", () => {
      const config = {
        authServerUrl: "https://auth.example.com",
        serverBaseUrl: "https://mcp.example.com",
        scopes: ["read", "write"],
      };

      const header = getWWWAuthenticateHeader(config, "read write");

      expect(header).toBe(
        'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="read write"',
      );
    });
  });
});
