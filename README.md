# octomind mcp server for tools, resources and prompts

## config

The server uses 2 environment variables:

- APIKEY the apikey for octomind api
- OCTOMIND_API_URL  base url for the api endpoint to use. defaults to https://app.octomind.dev/api

## tools implemented

- getTestReport
- executeTests


# config

to use the server e.g. in cursor you can configure it like this

```json
{
  "mcpServers": {
    "octomind": {
      "command": "npx",
      "args": ["@octomind/octomind-mcp"],
      "env": {
        "APIKEY": "...."
      }
    }
  }
}
```
