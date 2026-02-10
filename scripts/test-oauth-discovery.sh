#!/bin/bash

# Test OAuth Discovery Flow
# This script tests the OAuth discovery endpoints

set -e

PORT=${PORT:-3000}
BASE_URL="http://localhost:${PORT}"

echo "Testing OAuth Discovery Flow"
echo "=============================="
echo ""

# Test 1: Protected Resource Metadata (root)
echo "1. Testing /.well-known/oauth-protected-resource"
echo "   GET ${BASE_URL}/.well-known/oauth-protected-resource"
echo ""
curl -s "${BASE_URL}/.well-known/oauth-protected-resource" | jq '.'
echo ""
echo ""

# Test 2: Protected Resource Metadata (sub-path)
echo "2. Testing /.well-known/oauth-protected-resource/mcp"
echo "   GET ${BASE_URL}/.well-known/oauth-protected-resource/mcp"
echo ""
curl -s "${BASE_URL}/.well-known/oauth-protected-resource/mcp" | jq '.'
echo ""
echo ""

# Test 3: Unauthorized request to /mcp (should return 401 with WWW-Authenticate header)
echo "3. Testing unauthorized request to /mcp"
echo "   POST ${BASE_URL}/mcp (without Authorization header)"
echo ""
echo "Response headers:"
curl -s -i -X POST "${BASE_URL}/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  2>&1 | grep -i "www-authenticate" || echo "No WWW-Authenticate header found"
echo ""
echo ""

echo "OAuth Discovery Flow Test Complete!"
echo ""
echo "To run this test:"
echo "1. Start the server with OAuth configured:"
echo "   OAUTH_AUTH_SERVER_URL=https://6393987891.propelauthtest.com \\"
echo "   SERVER_BASE_URL=http://localhost:3000 \\"
echo "   pnpm octomind-mcp --mode streaming --port 3000"
echo ""
echo "2. In another terminal, run:"
echo "   bash scripts/test-oauth-discovery.sh"
