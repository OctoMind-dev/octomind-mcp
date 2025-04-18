# octomind mcp server: let agents create and manage e2e tests

<img src="images/light.svg" alt="Octomind Logo" width="150">

<a href="https://glama.ai/mcp/servers/@OctoMind-dev/octomind-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@OctoMind-dev/octomind-mcp/badge" alt="octomind-mcp MCP server" />
</a>

[![smithery badge](https://smithery.ai/badge/@OctoMind-dev/octomind-mcp)](https://smithery.ai/server/@OctoMind-dev/octomind-mcp)

Octomind provides a whole e2e platform for test creation, execution and management including auto-fix.
With this MCP server you can use Octomind tools and resources in your local development environment and 
enable it to create new e2e tests, execute them and more. see https://octomind.dev/ and 
https://octomind.dev/docs/mcp/install-octomind-mcp for more details.

## config

The server uses 2 environment variables:

- APIKEY the apikey for octomind api
- OCTOMIND_API_URL  base url for the api endpoint to use. defaults to https://app.octomind.dev/api
- LOG_FILENAME the file to write logs to (only for debugging). If not set, logging is disabled
- LOG_LEVEL the log level to use. defaults to info

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