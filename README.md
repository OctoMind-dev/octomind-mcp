# octomind mcp server for tools, resources and prompts

## config

The server uses 2 environment variables:

- APIKEY the apikey for octomind api
- OCTOMIND_API_URL  base url for the api endpoint to use. defaults to https://app.octomind.dev/api
- TESTTARGET_ID the id of the test target to use for notifications and resource (optional, will be set 
  when you first ask for a test report etc.)

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

This will output configuration examples for Claude Desktop, Cursor, and Windsurf. Here are the configuration files for each client:

### Claude Desktop (.claude-config.json)
```json
{
  "mcpServers": {
    "octomind-mcp": {
      "name": "Octomind MCP Server",
      "command": "npx",
      "args": [
        "@octomind/octomind-mcp"
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
        "@octomind/octomind-mcp"
      ],
      "env": {
        "APIKEY": "your-api-key-here"
      }
    }
  }
}
```

### Windsurf (config.json)
```json
{
  "mcpServers": {
    "octomind-mcp": {
      "name": "Octomind MCP Server",
      "command": "npx",
      "args": [
        "@octomind/octomind-mcp"
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