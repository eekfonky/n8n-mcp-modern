# n8n-MCP Modern v6.2.0 Deployment Guide

## Overview

This guide covers production deployment, configuration, and management of n8n-MCP Modern v6.2.0 with its 139 comprehensive tools and 7-agent hierarchical system.

## Prerequisites

### System Requirements
- **Node.js:** 22.0.0 or higher (required)
- **Operating System:** Linux, macOS, or Windows
- **Memory:** Minimum 512MB RAM, 2GB+ recommended for production
- **Storage:** 100MB+ available disk space

### n8n Instance Requirements
- **n8n Version:** 1.0.0 or higher
- **API Access:** REST API enabled with authentication
- **Network:** Accessible from deployment environment
- **Permissions:** API key with workflow management permissions

## Installation Methods

### Method 1: Claude Code Integration (Recommended)

```bash
# Quick setup with environment configuration
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern
```

**Verification:**
```bash
# Test the installation
claude mcp list
# Should show n8n-mcp-modern in the list

# Test functionality
# Use Claude Code to execute: "List my n8n workflows"
```

### Method 2: Global Installation

```bash
# Install globally via npm
npm install -g @eekfonky/n8n-mcp-modern

# Configure with environment variables
export N8N_API_URL="https://your-n8n-instance.com"
export N8N_API_KEY="your-api-key"

# Test installation  
n8n-mcp --help
```

### Method 3: Local Development Setup

```bash
# Clone repository
git clone https://github.com/eekfonky/n8n-mcp-modern.git
cd n8n-mcp-modern

# Install dependencies
npm install

# Build the project
npm run build

# Configure environment
cp .env.example .env
# Edit .env with your n8n instance details

# Add to Claude Code
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- node /absolute/path/to/n8n-mcp-modern/dist/index.js
```

## Configuration

### Environment Variables

#### Required Configuration
```bash
# Core n8n API settings
N8N_API_URL=https://your-n8n-instance.com    # Your n8n instance URL
N8N_API_KEY=your-api-key-here                # n8n API key with workflow permissions
```

#### Optional Performance Settings
```bash
# Logging and debugging
LOG_LEVEL=info                               # Logging verbosity (debug, info, warn, error)
DISABLE_CONSOLE_OUTPUT=false                 # Disable console logging in production

# Performance optimization  
ENABLE_CACHE=true                            # Enable intelligent caching (recommended)
CACHE_TTL=3600                              # Cache time-to-live in seconds
MAX_CONCURRENT_REQUESTS=10                   # API rate limiting

# Advanced features
MCP_MODE=stdio                               # MCP protocol mode (stdio recommended)
MEMORY_OPTIMIZATION=true                     # Enable memory optimization features
```

#### Development & Testing Settings
```bash
# Development only
NODE_ENV=development                         # Environment mode
DEBUG_AGENTS=false                           # Enable agent routing debugging
PERFORMANCE_MONITORING=true                  # Enable performance metrics
```

### MCP Configuration Files

#### Claude Code Configuration (.mcp.json)
```json
{
  "mcpServers": {
    "n8n-mcp-modern": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@eekfonky/n8n-mcp-modern"],
      "env": {
        "N8N_API_URL": "https://your-n8n-instance.com",
        "N8N_API_KEY": "your-api-key-here",
        "LOG_LEVEL": "info",
        "ENABLE_CACHE": "true",
        "MAX_CONCURRENT_REQUESTS": "10"
      }
    }
  }
}
```

#### Project-Specific Configuration (.mcp.json in project directory)
```json
{
  "mcpServers": {
    "n8n-mcp-modern": {
      "type": "stdio", 
      "command": "node",
      "args": ["/path/to/n8n-mcp-modern/dist/index.js"],
      "cwd": "/path/to/n8n-mcp-modern",
      "env": {
        "N8N_API_URL": "https://staging-n8n.company.com",
        "N8N_API_KEY": "staging-api-key",
        "LOG_LEVEL": "debug",
        "PERFORMANCE_MONITORING": "true"
      }
    }
  }
}
```

## n8n API Key Setup

### Creating API Keys in n8n

1. **Log into your n8n instance**
2. **Navigate to Settings → API Keys**
3. **Click "Create API Key"**
4. **Set permissions:**
   - ✅ Workflow: Read, Write, Execute
   - ✅ Execution: Read
   - ✅ Node Types: Read
   - ❌ User management (not needed)

### Docker n8n Configuration

If using Docker, ensure the API endpoint is properly configured:

```yaml
# docker-compose.yml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_API_ENDPOINT_REST=api/v1  # Important for API access
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
    volumes:
      - n8n_data:/home/node/.n8n
```

### API Key Security Best Practices

```bash
# Use separate API keys for different environments
PRODUCTION_N8N_API_KEY=prod-key-here
STAGING_N8N_API_KEY=staging-key-here
DEVELOPMENT_N8N_API_KEY=dev-key-here

# Rotate keys regularly (recommended: every 90 days)
# Monitor API key usage in n8n's API key management section
```

## Production Deployment

### Docker Deployment

Create a production-ready Docker setup:

**Dockerfile:**
```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install n8n-mcp-modern
RUN npm install -g @eekfonky/n8n-mcp-modern

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD node -e "console.log('Health check passed')" || exit 1

EXPOSE 3000
CMD ["n8n-mcp"]
```

**Docker Compose for Production:**
```yaml
version: '3.8'

services:
  n8n-mcp-modern:
    build: .
    environment:
      - N8N_API_URL=${N8N_API_URL}
      - N8N_API_KEY=${N8N_API_KEY}
      - LOG_LEVEL=warn
      - ENABLE_CACHE=true
      - MAX_CONCURRENT_REQUESTS=20
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Kubernetes Deployment

**ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: n8n-mcp-config
data:
  LOG_LEVEL: "info"
  ENABLE_CACHE: "true"
  MAX_CONCURRENT_REQUESTS: "15"
  NODE_ENV: "production"
```

**Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n-mcp-modern
spec:
  replicas: 2
  selector:
    matchLabels:
      app: n8n-mcp-modern
  template:
    metadata:
      labels:
        app: n8n-mcp-modern
    spec:
      containers:
      - name: n8n-mcp-modern
        image: your-registry/n8n-mcp-modern:6.2.0
        env:
        - name: N8N_API_URL
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: api-url
        - name: N8N_API_KEY
          valueFrom:
            secretKeyRef:
              name: n8n-secrets
              key: api-key
        envFrom:
        - configMapRef:
            name: n8n-mcp-config
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - node
            - -e
            - "process.exit(0)"
          initialDelaySeconds: 30
          periodSeconds: 30
```

### Process Management with PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'n8n-mcp-modern',
    script: 'npx',
    args: '@eekfonky/n8n-mcp-modern',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      N8N_API_URL: 'https://your-n8n-instance.com',
      N8N_API_KEY: 'your-api-key',
      LOG_LEVEL: 'warn',
      ENABLE_CACHE: 'true',
      MAX_CONCURRENT_REQUESTS: '15'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000
  }]
}
```

## Monitoring & Observability

### Health Check Endpoints

n8n-MCP Modern provides built-in health monitoring:

```typescript
// Check system health
await tool.execute('get_system_health', { 
  includeDetails: true 
})

// Get performance statistics  
await tool.execute('get_tool_usage_stats', {})

// Validate configuration
await tool.execute('validate_mcp_config', { 
  fix_issues: false 
})
```

### Logging Configuration

**Production Logging Setup:**
```bash
# Environment variables
LOG_LEVEL=warn                    # Reduce log verbosity in production
DISABLE_CONSOLE_OUTPUT=false      # Keep console logs for container environments

# For file-based logging (optional)
LOG_FILE_PATH=/var/log/n8n-mcp/app.log
LOG_ROTATION=daily
MAX_LOG_SIZE=100MB
```

**Log Analysis with ELK Stack:**
```yaml
# docker-compose.yml addition for centralized logging
  filebeat:
    image: docker.elastic.co/beats/filebeat:7.15.0
    volumes:
      - ./logs:/logs:ro
      - ./filebeat.yml:/usr/share/filebeat/filebeat.yml
    depends_on:
      - elasticsearch
```

### Performance Monitoring

**Metrics Collection:**
```typescript
// Built-in performance monitoring
const metrics = await tool.execute('monitor_system_metrics', {
  metrics: ['response_time', 'error_rate', 'throughput'],
  interval: 60,
  alertThresholds: {
    response_time: 2000,  // 2 seconds
    error_rate: 0.05,     // 5%
    throughput: 100       // requests per minute
  }
})
```

**Prometheus Integration:**
```yaml
# Add to docker-compose.yml
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--web.route-prefix=/'
      - '--storage.tsdb.retention.time=30d'
```

## Security & Compliance

### Security Configuration

**API Key Management:**
```bash
# Use environment-specific keys
export PROD_N8N_API_KEY=$(vault kv get -field=api_key secret/n8n/production)
export STAGING_N8N_API_KEY=$(vault kv get -field=api_key secret/n8n/staging)

# Regular key rotation
# Set calendar reminder to rotate keys every 90 days
```

**Network Security:**
```yaml
# docker-compose.yml with network isolation
networks:
  n8n-network:
    driver: bridge
    internal: true
  
services:
  n8n-mcp-modern:
    networks:
      - n8n-network
    # Only expose necessary ports
    ports: []  # No direct external access
```

### Compliance Features

- **Zero Vulnerability Posture:** Regular security audits with `npm audit`
- **Input Validation:** Zod-based schema validation for all inputs  
- **Audit Logging:** Complete action trails for compliance requirements
- **Data Minimization:** Only essential data processed and stored
- **Credential Security:** No credential storage in logs or code

## Troubleshooting

### Common Issues

#### Connection Problems
```bash
# Test n8n API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://your-n8n-instance.com/api/v1/workflows

# Check MCP server status
claude mcp list | grep n8n-mcp-modern

# Validate configuration
# Use Claude Code: "Check n8n-mcp system health"
```

#### Performance Issues
```bash
# Check resource usage
docker stats n8n-mcp-modern

# Analyze performance metrics
# Use built-in tools:
# - analyze_workflow_performance
# - monitor_system_metrics
# - generate_optimization_recommendations
```

#### Authentication Failures
```bash
# Verify API key permissions in n8n
# Check API key hasn't expired
# Ensure N8N_API_ENDPOINT_REST=api/v1 is set for Docker installations
```

### Debug Mode

Enable detailed debugging:

```bash
# Environment setup for debugging
export LOG_LEVEL=debug
export DEBUG_AGENTS=true
export PERFORMANCE_MONITORING=true

# Run with debugging enabled
claude mcp add n8n-mcp-modern \
  --env LOG_LEVEL=debug \
  --env DEBUG_AGENTS=true \
  -- npx -y @eekfonky/n8n-mcp-modern
```

## Upgrade Procedures

### Upgrading from v6.1.x to v6.2.0

```bash
# 1. Stop current MCP server
claude mcp remove n8n-mcp-modern

# 2. Clear cache (optional but recommended)
rm -rf ~/.claude/mcp/servers/n8n-mcp-modern

# 3. Install latest version
claude mcp add n8n-mcp-modern \
  --env N8N_API_URL="https://your-n8n-instance.com" \
  --env N8N_API_KEY="your-api-key" \
  -- npx -y @eekfonky/n8n-mcp-modern

# 4. Verify upgrade
# Use Claude Code: "List available n8n tools" - should show 139+ tools
```

### Rolling Back

```bash
# Install specific version if needed
claude mcp add n8n-mcp-modern \
  -- npx -y @eekfonky/n8n-mcp-modern@6.1.3
```

## Best Practices

### Development Workflow
1. **Use separate API keys** for development, staging, and production
2. **Test against staging n8n instance** before production deployment  
3. **Monitor performance metrics** regularly
4. **Keep API keys secure** and rotate them regularly
5. **Use specific version pinning** in production environments

### Production Operations
1. **Implement health checks** and alerting
2. **Set up centralized logging** for troubleshooting
3. **Monitor resource usage** and scale accordingly
4. **Regular security audits** and dependency updates
5. **Backup configuration** and disaster recovery planning

### Performance Optimization
1. **Enable caching** for frequently accessed data
2. **Tune concurrent request limits** based on n8n instance capacity
3. **Use connection pooling** for high-throughput scenarios
4. **Monitor and optimize** workflow execution patterns
5. **Implement circuit breakers** for fault tolerance

## Support & Resources

- **Documentation:** [GitHub Repository](https://github.com/eekfonky/n8n-mcp-modern)
- **Issues:** [GitHub Issues](https://github.com/eekfonky/n8n-mcp-modern/issues)
- **API Reference:** [API.md](./API.md)
- **Security Guide:** [security-guide.md](./security-guide.md)
- **Architecture:** [architecture.md](./architecture.md)

For additional support, please open an issue on GitHub with your configuration details and error logs.