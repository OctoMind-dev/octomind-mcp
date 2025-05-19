export const helpInstall = () => {
  const configs = {
    claude: {
      mcpServers: {
        "octomind-mcp": {
          name: "Octomind MCP Server",
          command: "npx",
          args: ["-y", "@octomind/octomind-mcp@latest"],
          env: {
            APIKEY: "your-api-key-here",
          },
        },
      },
    },
    cursor: {
      mcpServers: {
        "octomind-mcp": {
          name: "Octomind MCP Server",
          command: "npx",
          args: ["-y", "@octomind/octomind-mcp@latest"],
          env: {
            APIKEY: "your-api-key-here",
          },
        },
      },
    },
    windsurf: {
      mcpServers: {
        "octomind-mcp": {
          name: "Octomind MCP Server",
          command: "npx",
          args: ["-y", "@octomind/octomind-mcp@latest"],
          environment: {
            APIKEY: "your-api-key-here",
          },
        },
      },
    },
  };

  console.error("Configuration snippets for different clients:\n");
  console.error("Claude Desktop (.claude-config.json):");
  console.error(`${JSON.stringify(configs.claude, null, 2)}\n`);

  console.error("Cursor (cursor.json):");
  console.error(`${JSON.stringify(configs.cursor, null, 2)}\n`);

  console.error("Windsurf (config.json):");
  console.error(`${JSON.stringify(configs.windsurf, null, 2)}\n`);

  console.error("Note: Replace 'your-api-key-here' with your actual API key");
  process.exit(0);
};