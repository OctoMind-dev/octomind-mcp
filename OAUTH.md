# OAuth Configuration

The Octomind MCP server supports OAuth 2.1 authentication following the [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization).

## Configuration

OAuth is **optional**. If not configured, the server falls back to API key authentication.

### Environment Variables

To enable OAuth support, set the following environment variables. You can either:
- Create a `.env` file in the project root (recommended for development)
- Set environment variables directly in your shell or deployment environment

```bash
# Required: Your OAuth authorization server URL (e.g., PropelAuth)
OAUTH_AUTH_SERVER_URL=https://6393987891.propelauthtest.com

# Required: Your MCP server's public base URL
SERVER_BASE_URL=https://your-mcp-server.com

# Optional: Comma-separated list of OAuth scopes (defaults to octomind:read,octomind:write)
OAUTH_SCOPES=octomind:read,octomind:write
```

**Note**: The server automatically loads environment variables from a `.env` file if present. See `.env.example` for a complete configuration template.

### PropelAuth Setup

For development/testing with PropelAuth:

1. Set `OAUTH_AUTH_SERVER_URL` to your PropelAuth test URL (e.g., `https://6393987891.propelauthtest.com`)
2. Set `SERVER_BASE_URL` to your server's URL (e.g., `http://localhost:3000` for local dev)
3. The server will automatically expose OAuth discovery endpoints

## OAuth Discovery Flow

When OAuth is configured, the server exposes the following endpoints:

### Protected Resource Metadata (RFC 9728)

- `GET /.well-known/oauth-protected-resource` - Root metadata endpoint
- `GET /.well-known/oauth-protected-resource/mcp` - MCP-specific metadata endpoint

Example response:
```json
{
  "resource": "https://your-mcp-server.com",
  "authorization_servers": ["https://6393987891.propelauthtest.com"],
  "scopes_supported": ["octomind:read", "octomind:write"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://github.com/Octomind-dev/mcp-octomind"
}
```

### WWW-Authenticate Headers

When a request is made without authentication, the server returns a `401 Unauthorized` response with a `WWW-Authenticate` header:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://your-mcp-server.com/.well-known/oauth-protected-resource"
```

This header tells OAuth clients where to find the authorization server information.

## Token Handling

The server accepts OAuth tokens in the `Authorization` header:

```http
Authorization: Bearer <access-token>
```

**Note**: Currently, the server forwards the token to the Octomind API without local validation. Token validation is performed by the upstream API.

## MCP Client Integration

MCP clients that support OAuth will:

1. Attempt to connect to the MCP server
2. Receive a `401 Unauthorized` with `WWW-Authenticate` header
3. Fetch the Protected Resource Metadata
4. Discover the authorization server
5. Initiate OAuth flow with PropelAuth
6. Use the obtained access token for subsequent requests

## Testing

To test the OAuth discovery flow:

```bash
# Option 1: Using .env file (recommended)
# 1. Copy .env.example to .env
cp .env.example .env

# 2. Edit .env and set your OAuth configuration
# 3. Start the server
pnpm octomind-mcp -t --port 3002

# Option 2: Using environment variables directly
OAUTH_AUTH_SERVER_URL=https://6393987891.propelauthtest.com \
SERVER_BASE_URL=http://localhost:3000 \
pnpm octomind-mcp -t --port 3000

# Test the metadata endpoint
curl http://localhost:3000/.well-known/oauth-protected-resource

# Test unauthorized request
curl -v http://localhost:3000/mcp
# Should return 401 with WWW-Authenticate header
```

## Backwards Compatibility

The server maintains full backwards compatibility with API key authentication. If OAuth environment variables are not set, the server operates in API key mode only.
