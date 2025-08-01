import { randomUUID } from "crypto";

import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

// Create a simple OAuthClientProvider implementation that returns a fixed token
class SimpleOAuthProvider implements OAuthClientProvider {
  private token: string;
  private _redirectUrl: string;
  private _clientMetadata: OAuthClientMetadata;
  private _clientInformation: OAuthClientInformation | undefined;
  private _codeVerifier: string = "";
  private _tokens: OAuthTokens | undefined;

  constructor(token: string) {
    this.token = token;
    this._redirectUrl = "http://localhost:3000/callback";
    this._clientMetadata = {
      client_name: "Simple OAuth Client",
      redirect_uris: [this._redirectUrl],
    };
    this._clientInformation = {
      client_id: "simple-client-id",
      client_secret: "simple-client-secret",
    };
  }

  // Required property for redirect URL
  get redirectUrl(): string | URL {
    return this._redirectUrl;
  }

  // Required property for client metadata
  get clientMetadata(): OAuthClientMetadata {
    return this._clientMetadata;
  }

  // Required method to get client information
  clientInformation():
    | OAuthClientInformation
    | undefined
    | Promise<OAuthClientInformation | undefined> {
    return this._clientInformation;
  }

  // Required method to get the access token
  async getAccessToken(): Promise<string> {
    return this.token;
  }

  // Required method to refresh the token
  async refreshToken(): Promise<string> {
    // In this simple implementation, we just return the same token
    // In a real app, you would implement token refresh logic here
    return this.token;
  }

  // Required method to indicate if the provider is ready
  isReady(): boolean {
    return true;
  }

  // Required method to get tokens
  tokens(): OAuthTokens | undefined | Promise<OAuthTokens | undefined> {
    return this._tokens;
  }

  // Required method to save tokens
  saveTokens(tokens: OAuthTokens): void | Promise<void> {
    this._tokens = tokens;
  }

  // Required method to redirect to authorization URL
  redirectToAuthorization(authorizationUrl: URL): void | Promise<void> {
    console.log(`Would redirect to: ${authorizationUrl.toString()}`);
    // In a real app with a UI, you would redirect the user here
  }

  // Required method to save code verifier
  saveCodeVerifier(codeVerifier: string): void | Promise<void> {
    this._codeVerifier = codeVerifier;
  }

  // Required method to get code verifier
  codeVerifier(): string | Promise<string> {
    return this._codeVerifier;
  }
}

// Minimal function to create and use an MCP client
async function createAndUseMcpClient(serverUrl: string) {
  try {
    // 1. Create the client
    const client = new Client({
      name: "minimal-mcp-client",
      version: "1.0.0",
    });

    // 2. Create the transport with the server URL
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: {
        headers: {
          Authorization: "Bearer test-api-key",
          "X-Session-Id": randomUUID(),
        },
      },
    });
    console.log("Successfully created transport", transport.sessionId);
    // 3. Connect the client to the transport
    // This handles the initialization handshake with the server
    await client.connect(transport);
    console.log(
      "Successfully connected to MCP server",
      client.getServerCapabilities(),
      client.transport?.sessionId,
    );

    // 4. Basic interaction examples
    // List available tools
    const toolsResponse = await client.listTools();
    console.log(
      "Available tools:",
      toolsResponse.tools.map((tool) => tool.name),
    );

    const versionResponse = await client.callTool({
      name: "getVersion",
      arguments: {},
    });
    console.log("Version:", versionResponse);

    // List available resources
    const resourcesResponse = await client.listResources();
    console.log("Available resources:", resourcesResponse.resources);

    // 6. Cleanup when done
    transport.close();
    return client; // Return client in case you want to reuse it
  } catch (error) {
    console.error("Error with MCP client:", error);
    throw error;
  }
}

// Usage example
const serverUrlExample = "https://mcp.preview.octomind.dev/mcp";
createAndUseMcpClient(serverUrlExample)
  .then((client) => {
    console.log("Client operation complete");
  })
  .catch((err) => {
    console.error("Failed to create or use MCP client:", err);
  });
