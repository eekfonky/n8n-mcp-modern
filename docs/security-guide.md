# Security Guide for n8n-MCP-Modern

## Overview

This guide provides comprehensive security best practices for deploying and operating the n8n-MCP-Modern server.

## Secrets Management

### Development Environment

1. **Create a `.env` file** (never commit this to git):

```bash
cp .env.example .env
```

2. **Set your n8n API credentials**:

```bash
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your-secure-api-key-here
```

3. **Secure file permissions**:

```bash
chmod 600 .env  # Only owner can read/write
```

### Production Environment

#### Option 1: Environment Variables (Recommended)

```bash
# Export variables in your shell profile or systemd service
export N8N_API_URL="https://your-n8n-instance.com"
export N8N_API_KEY="your-secure-api-key-here"
```

#### Option 2: Docker Secrets

```yaml
# docker-compose.yml
version: '3.8'
services:
  n8n-mcp:
    image: n8n-mcp-modern:latest
    secrets:
      - n8n_api_key
    environment:
      N8N_API_KEY_FILE: /run/secrets/n8n_api_key

secrets:
  n8n_api_key:
    external: true
```

#### Option 3: System Keyring (macOS/Linux)

```bash
# macOS - Using Keychain
security add-generic-password -a "$USER" -s "n8n-mcp-api-key" -w "your-api-key"

# Linux - Using Secret Service
secret-tool store --label="n8n MCP API Key" service n8n-mcp username api-key

# Retrieve in your script
export N8N_API_KEY=$(security find-generic-password -a "$USER" -s "n8n-mcp-api-key" -w)
```

## Access Control

### File System Permissions

```bash
# Secure installation directory
chmod 750 /opt/n8n-mcp-modern
chown $USER:$USER /opt/n8n-mcp-modern

# Secure database file
chmod 600 data/nodes.db

# Secure log directory
chmod 750 logs/
```

### Process Isolation

```bash
# Run as non-root user
useradd -r -s /bin/false n8n-mcp
chown -R n8n-mcp:n8n-mcp /opt/n8n-mcp-modern

# Use systemd with restricted permissions
# /etc/systemd/system/n8n-mcp.service
[Service]
User=n8n-mcp
Group=n8n-mcp
PrivateTmp=true
NoNewPrivileges=true
```

## Network Security

### Local-Only Binding

The MCP server binds to localhost only by default. Keep it this way unless absolutely necessary:

```javascript
// This is the default and most secure configuration
MCP_MODE = stdio // Uses standard I/O, no network exposure
```

### TLS/HTTPS Configuration

All external API calls use HTTPS by default. Ensure your n8n instance has valid TLS certificates:

```bash
# Verify TLS certificate
openssl s_client -connect your-n8n-instance.com:443 -servername your-n8n-instance.com
```

## API Key Security

### Key Generation Best Practices

1. **Use strong, unique API keys**:

```bash
# Generate a secure API key
openssl rand -hex 32
```

2. **Rotate keys regularly**:

- Set up a key rotation schedule (e.g., every 90 days)
- Keep one previous key active during transition

3. **Never share API keys**:

- Each user/service should have its own key
- Never commit keys to version control
- Don't log API keys

### Key Storage in Claude Code

When using with Claude Code, store your API key securely:

1. **Never paste API keys directly in chat**
2. **Use environment variables**:

```bash
# Set before starting Claude Code
export N8N_API_KEY="your-key"
claude-code
```

3. **Or use the .env file** (for development only):

```bash
echo "N8N_API_KEY=your-key" >> .env
chmod 600 .env
```

## Audit Logging

The security module provides comprehensive audit logging:

### Viewing Security Events

```typescript
// Access recent security events programmatically
import { securityAudit } from './server/security.js'

const recentEvents = securityAudit.getRecentEvents(100)
const deniedAccess = securityAudit.getEventsByType(SecurityEventType.ACCESS_DENIED)
```

### Log Analysis

Monitor logs for security events:

```bash
# Watch for security alerts
tail -f logs/app.log | grep "Security"

# Find failed authentication attempts
grep "API_KEY_INVALID" logs/app.log

# Monitor rate limiting
grep "Rate limit exceeded" logs/app.log
```

## Input Validation

All inputs are validated using Zod schemas:

1. **Configuration validation** - All environment variables are validated
2. **Tool input validation** - Each tool has strict input schemas
3. **API response validation** - n8n API responses are validated
4. **Sanitization** - Inputs are sanitized to prevent injection attacks

## Rate Limiting

Built-in rate limiting protects against abuse:

- **Default:** 100 requests per minute per identifier
- **Configurable:** Adjust via `MAX_CONCURRENT_REQUESTS` environment variable
- **Monitoring:** Rate limit violations are logged as security events

## Security Checklist

Before deploying to production, ensure:

- [ ] API keys are stored securely (not in code or logs)
- [ ] File permissions are restrictive (600 for secrets, 750 for directories)
- [ ] Process runs as non-root user
- [ ] TLS/HTTPS is used for all external connections
- [ ] Audit logging is enabled and monitored
- [ ] Rate limiting is configured appropriately
- [ ] Input validation is working correctly
- [ ] Dependencies are up-to-date (run `npm audit`)
- [ ] Security headers are set (if using HTTP mode)
- [ ] Backup procedures are in place
- [ ] Incident response plan is documented

## Incident Response

### If API Key is Compromised

1. **Immediately rotate the key** in your n8n instance
2. **Update all configurations** with the new key
3. **Review audit logs** for unauthorized access
4. **Check for any malicious workflows** created in n8n
5. **Document the incident** for future reference

### Security Contact

Report security vulnerabilities to: [Create a security issue on GitHub](https://github.com/eekfonky/n8n-mcp-modern/security)

## Compliance

### Data Protection

- **No PII storage:** The MCP server doesn't store personal information
- **Local processing:** All data processing happens locally
- **No telemetry:** No usage data is sent to external services
- **Audit trails:** Security events are logged locally

### Standards Alignment

- **OWASP Top 10:** Protected against common vulnerabilities
- **CIS Controls:** Implements relevant security controls
- **Zero Trust:** Assumes no implicit trust
- **Least Privilege:** Minimal permissions by default

## Updates and Patches

### Keeping Secure

1. **Monitor for updates**:

```bash
npm outdated
npm audit
```

2. **Apply security patches**:

```bash
npm audit fix
npm update
```

3. **Subscribe to security advisories**:

- Watch the GitHub repository
- Enable Dependabot alerts
- Monitor npm security advisories

## Additional Resources

- [OWASP Security Practices](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [GitHub Packages Security](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [Docker Security](https://docs.docker.com/engine/security/)

---

Remember: Security is a continuous process, not a one-time setup. Regularly review and update your security practices.
