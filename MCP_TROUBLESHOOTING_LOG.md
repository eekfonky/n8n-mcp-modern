# N8N MCP Server Troubleshooting Log

**Date:** 2025-08-25  
**Context:** West Linton Play Park Project  
**Environment:** Claude Code CLI  
**Issue:** N8N MCP server tools not accessible despite configuration

## Configuration Analysis

### Current .mcp.json Configuration
Located at: `/home/chris/Code/west-linton-play-park/.mcp.json`

```json
{
  "mcpServers": {
    "n8n-mcp-modern": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@eekfonky/n8n-mcp-modern"
      ],
      "env": {
        "N8N_API_URL": "https://n8n.srv925321.hstgr.cloud",
        "N8N_API_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo",
        "OPENROUTER_API_KEY": "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",
        "ENABLE_AGENT_HANDOVERS": "true",
        "LOG_LEVEL": "info",
        "ENABLE_CACHE": "true"
      }
    },
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase"],
      "env": {
        "SUPABASE_URL": "https://dmgnrakqkfkjvyeviijg.supabase.co",
        "SUPABASE_ANON_KEY": "[REDACTED]",
        "SUPABASE_SERVICE_ROLE_KEY": "[REDACTED]"
      }
    }
  }
}
```

## Attempted MCP Tool Calls

### Test 1: Basic Workflow Retrieval
**Command:** `mcp__n8n-mcp-modern__get_n8n_workflows`  
**Result:** `{"success": false, "error": "Cannot read properties of undefined (reading 'slice')"}`  
**Analysis:** Tool exists but returns JavaScript runtime error suggesting internal data handling issue

### Test 2: System Health Check
**Command:** `mcp__n8n-mcp-modern__get_system_health`  
**Result:** Partial success - returned health report but with errors in workflow operations  
**Health Score:** 80/100  
**Performance Metrics:** HTTP operations working, but workflow operations failing

### Test 3: Config Validation
**Command:** `mcp__n8n-mcp-modern__validate_mcp_config`  
**Result:** `{"status": "healthy", "apiStatus": "connected"}` but recommendations suggest connection issues

### Test 4: Tool Listing
**Command:** `mcp__n8n-mcp-modern__list_available_tools`  
**Result:** `"Not connected"` despite config validation showing "connected"

### Test 5: Tool Name Verification
**Command:** `mcp__n8n-mcp-modern__get_n8n_workflows` (retry)  
**Result:** `Error: No such tool available: mcp__n8n-mcp-modern__get_n8n_workflows`  
**Analysis:** Tool names may have changed or tool registration failed

### Test 6: MCP Resource Check
**Command:** `ListMcpResourcesTool` with server "n8n-mcp-modern"  
**Result:** `[]` (empty array)  
**Analysis:** Server not providing any resources despite being configured

## Direct API Verification

To verify the n8n instance and API credentials work correctly, direct API calls were tested:

### Test 1: Wrong Header Format
```bash
curl -H "Authorization: Bearer [API_KEY]" "https://n8n.srv925321.hstgr.cloud/api/v1/workflows"
```
**Result:** `{"message":"'X-N8N-API-KEY' header required"}`

### Test 2: Correct Header Format
```bash
curl -H "X-N8N-API-KEY: [API_KEY]" "https://n8n.srv925321.hstgr.cloud/api/v1/workflows"
```
**Result:** ✅ SUCCESS - Retrieved workflow list with complete data

### Test 3: Workflow Deletion
```bash
curl -X DELETE -H "X-N8N-API-KEY: [API_KEY]" "https://n8n.srv925321.hstgr.cloud/api/v1/workflows/IYF3rg7ozYRV7nLV"
```
**Result:** ✅ SUCCESS - Workflow deleted successfully

## Problem Analysis

### Root Cause Assessment
1. **MCP Server Connection Issue**: Despite configuration appearing correct, the MCP server is not properly connected or initialized
2. **Tool Registration Failure**: Tools are not being registered properly in Claude Code environment
3. **Runtime Errors**: JavaScript errors suggest internal data handling issues within the MCP server
4. **API vs MCP Mismatch**: Direct API calls work perfectly, but MCP wrapper fails

### Potential Causes
1. **Package Version Issues**: `@eekfonky/n8n-mcp-modern` may have compatibility issues
2. **Environment Variable Propagation**: Environment variables may not be properly passed to MCP server
3. **Process Initialization**: MCP server process may be failing to start properly
4. **Tool Name Changes**: Tool names may have changed in recent versions
5. **Dependency Issues**: Missing or incompatible Node.js dependencies

## Recommended Solutions

### Immediate Actions
1. **Verify Package Installation**: Ensure `@eekfonky/n8n-mcp-modern` is properly installed
2. **Check Process Logs**: Review MCP server startup logs for errors
3. **Test Environment Variables**: Verify environment variables are accessible within MCP context
4. **Update Package**: Try latest version of `@eekfonky/n8n-mcp-modern`

### Configuration Adjustments
1. **Alternative Package**: Consider switching to different n8n MCP implementation
2. **Manual Tool Registration**: Implement custom tool registration if available
3. **Fallback Strategy**: Use direct API calls with wrapper functions

### Debugging Steps
1. **Enable Debug Logging**: Set `LOG_LEVEL: "debug"` in MCP configuration
2. **Process Monitoring**: Monitor MCP server process status
3. **Tool Enumeration**: Use MCP protocol to enumerate available tools
4. **Connection Testing**: Test MCP server connection independently

## Current Workaround

Successfully using direct n8n API calls with proper authentication headers:
- ✅ List workflows: `GET /api/v1/workflows`
- ✅ Delete workflows: `DELETE /api/v1/workflows/{id}`  
- ✅ Create workflows: `POST /api/v1/workflows`
- ✅ Execute workflows: `POST /api/v1/workflows/{id}/execute`

## Impact Assessment

**High Priority Issues:**
- MCP integration broken - affects automation workflows
- Tool consistency - some operations require fallback to direct API
- Development workflow disruption

**Medium Priority Issues:**
- Documentation discrepancy between expected vs actual tool names
- Error handling in MCP server needs improvement

**Low Priority Issues:**
- Performance metrics suggest some inefficiency but functionality works

## Next Steps

1. **Investigate MCP server logs** for startup errors
2. **Test alternative n8n MCP packages** if available
3. **Create wrapper functions** for direct API calls as interim solution
4. **Update project documentation** to reflect current state
5. **Report issues** to `@eekfonky/n8n-mcp-modern` maintainer

---

**Generated by:** Claude Code AI Assistant  
**For:** LLM Analysis and Debugging  
**Status:** Investigation Required