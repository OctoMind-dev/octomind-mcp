# octomind mcp server: let agents create and manage e2e tests

<img src="images/light.png" alt="Octomind Logo" width="250">

[![smithery badge](https://smithery.ai/badge/@OctoMind-dev/octomind-mcp)](https://smithery.ai/server/@OctoMind-dev/octomind-mcp)

Octomind provides a whole e2e platform for test creation, execution and management including auto-fix.
With this MCP server you can use Octomind tools and resources in your local development environment and 
enable it to create new e2e tests, execute them and more. see https://octomind.dev/ and 
https://octomind.dev/docs/mcp/install-octomind-mcp for more details.

## See it in action together with testrail mcp

[![Video Title](https://img.youtube.com/vi/I7lc9I0S62Y/0.jpg)](https://www.youtube.com/watch?v=I7lc9I0S62Y)

## Configuration

### Environment Variables

The server uses the following environment variables:

- `APIKEY` - The API key for Octomind API (required)
- `OCTOMIND_API_URL` - Base URL for the API endpoint to use (defaults to https://app.octomind.dev/api)
- `REDIS_URL` - Redis connection URL for session storage (optional, format: redis://host:port)
- `SESSION_EXPIRATION_SECONDS` - Time in seconds after which sessions expire (optional, Redis only)

### Command Line Options

The server supports the following command line options:

- `-s, --sse` - Enable SSE transport mode
- `-t, --stream` - Enable Streamable HTTP transport mode
- `-c, --clients` - Show client configuration examples
- `-p, --port <port>` - Port to listen on (default: 3000)
- `-r, --redis-url <url>` - Redis URL for session storage
- `-e, --session-expiration <seconds>` - Session expiration time in seconds

### Session Storage

The server supports two types of session storage:

1. **In-memory storage** (default) - Sessions are stored in memory and will be lost when the server restarts
2. **Redis storage** - Sessions are stored in Redis and can persist across server restarts

For production deployments, it's recommended to use Redis storage with an appropriate session expiration time. The Redis storage option also enables horizontal scaling with multiple server instances.

### Logging Configuration

- `LOG_FILENAME` - The file to write logs to (only for debugging). If not set, logging is disabled
- `LOG_LEVEL` - The log level to use (defaults to info)

## Tools

The following tools are implemented in this MCP server:

- `search` - Search the Octomind documentation for a given query
- `getTestCase` - Retrieve a test case for a given test target and test case ID
- `executeTests` - Trigger test execution for a given test target on a specified URL
- `getEnvironments` - List environments for a test target
- `createEnvironment` - Create a new environment for a test target
- `updateEnvironment` - Update an existing environment
- `deleteEnvironment` - Delete an environment
- `getTestReports` - Retrieve test reports for a test target
- `getTestReport` - Get a specific test report by ID
- `discovery` - Create a test case with a description or prompt
- `getPrivateLocations` - List all private locations configured for the organization
- `getVersion` - Get the current version of the Octomind MCP server

## Installation

You can get configuration snippets for different clients by running:


## Running evals

The evals package loads an mcp client that then runs the index.ts file, so there is no need to rebuild between tests. You can load environment variables by prefixing the npx command. Full documentation can be found [here](https://www.mcpevals.io/docs).

```bash
OPENAI_API_KEY=your-key  npx mcp-eval src/evals/evals.ts src/handlers.ts
```

```bash
npx @octomind/octomind-mcp --clients
```

This will output configuration examples for Claude Desktop, Cursor, and Windsurf. Here are the configuration files for most clients:

### Installing via Smithery

To install octomind-mcp for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@OctoMind-dev/octomind-mcp):

```bash
npx -y @smithery/cli install @OctoMind-dev/octomind-mcp --client claude
```

### Claude Desktop (.claude-config.json)
```json
{
  "mcpServers": {
    "octomind-mcp": {
      "name": "Octomind MCP Server",
      "command": "npx",
      "args": [
        "-y",
        "@octomind/octomind-mcp@latest"
      ],
      "env": {
        "APIKEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor (cursor.json)
```json
{
  "mcpServers": {
    "octomind-mcp": {
      "name": "Octomind MCP Server",
      "command": "npx",
      "args": [
        "-y",
        "@octomind/octomind-mcp@latest"
      ],
      "env": {
        "APIKEY": "your-api-key-here"
      }
    }
  }
}
```

### Windsurf (mcp_config.json)
```json
{
  "mcpServers": {
    "octomind-mcp": {
      "name": "Octomind MCP Server",
      "command": "npx",
      "args": [
        "-y",
        "@octomind/octomind-mcp@latest"
      ],
      "environment": {
        "APIKEY": "your-api-key-here"
      }
    }
  }
}
```

Note: Replace `your-api-key-here` with your actual API key.

To get an APIKEY see here https://octomind.dev/docs/get-started/execution-without-ci#create-an-api-key

# Listings / Integrations

<a href="https://glama.ai/mcp/servers/@OctoMind-dev/octomind-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@OctoMind-dev/octomind-mcp/badge" alt="octomind-mcp MCP server" />
</a>

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/octomind-dev-octomind-mcp-badge.png)](https://mseep.ai/app/octomind-dev-octomind-mcp)

