# NPM Deployment Guide - n8n-MCP Modern

Complete guide for deploying n8n-MCP Modern using NPM in production environments with optimal configuration and monitoring.

## Quick Start

### Global Installation (Recommended for CLI)

```bash
# Install globally from GitHub Packages
npm install -g @eekfonky/n8n-mcp-modern

# Or install from npmjs.com (if published)
npm install -g n8n-mcp-modern

# Verify installation
n8n-mcp --version
```

### Local Project Installation

```bash
# Install in your project
npm install @eekfonky/n8n-mcp-modern

# Or with specific version
npm install @eekfonky/n8n-mcp-modern@6.2.0

# Run directly with npx
npx @eekfonky/n8n-mcp-modern
```

## Production Configuration

### Environment Setup

Create production configuration:

```bash
# Create production directory
mkdir -p /opt/n8n-mcp-modern
cd /opt/n8n-mcp-modern

# Create environment file
cat > .env << 'EOF'
# n8n Connection
N8N_API_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key_here

# MCP Configuration
MCP_MODE=stdio
LOG_LEVEL=info
DISABLE_CONSOLE_OUTPUT=false

# Performance Optimization
ENABLE_CACHE=true
CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=10

# Discovery Scheduling
ENABLE_DISCOVERY_SCHEDULING=true
DISCOVERY_INTERVAL_MINUTES=60
ENABLE_VERSION_DETECTION=true
VERSION_CHECK_INTERVAL_MINUTES=15

# Memory Management
NODE_OPTIONS=--max-old-space-size=1024 --expose-gc
ENABLE_MEMORY_PROFILING=true
MEMORY_ALERT_THRESHOLD=85

# Cold Start Optimization
ENABLE_MODULE_PRELOADING=true
PARALLEL_PRELOAD=true
PRELOAD_TIMEOUT=10000

# Webhook Configuration (optional)
ENABLE_DISCOVERY_WEBHOOKS=false
DISCOVERY_WEBHOOK_PORT=3001
DISCOVERY_WEBHOOK_SECRET=your_secure_webhook_secret

# Smart Intervals (optional)
ENABLE_SMART_INTERVALS=false
ACTIVITY_WINDOW_MINUTES=30
HIGH_ACTIVITY_INTERVAL_MINUTES=15

# Error Monitoring
ENABLE_ERROR_MONITORING=true
ERROR_ALERT_THRESHOLD=10
CRITICAL_ERROR_THRESHOLD=3

# Advanced Features
ENABLE_ADAPTIVE_SCHEDULING=false
MIN_DISCOVERY_INTERVAL_MINUTES=30
MAX_DISCOVERY_INTERVAL_MINUTES=240
MAX_CONCURRENT_DISCOVERY_SESSIONS=1
EOF
```

### Systemd Service (Linux)

```bash
# Create systemd service
sudo tee /etc/systemd/system/n8n-mcp-modern.service << 'EOF'
[Unit]
Description=n8n-MCP Modern Server
Documentation=https://github.com/eekfonky/n8n-mcp-modern
After=network.target
Wants=network.target

[Service]
Type=simple
User=n8n-mcp
Group=n8n-mcp
WorkingDirectory=/opt/n8n-mcp-modern
Environment=NODE_ENV=production
EnvironmentFile=/opt/n8n-mcp-modern/.env
ExecStart=/usr/bin/node /usr/local/lib/node_modules/@eekfonky/n8n-mcp-modern/dist/index.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=n8n-mcp-modern
TimeoutStopSec=30
KillMode=mixed

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/n8n-mcp-modern
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryMax=1G
CPUQuota=100%

[Install]
WantedBy=multi-user.target
EOF

# Create user for service
sudo useradd --system --home /opt/n8n-mcp-modern --shell /bin/false n8n-mcp
sudo chown -R n8n-mcp:n8n-mcp /opt/n8n-mcp-modern

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable n8n-mcp-modern
sudo systemctl start n8n-mcp-modern

# Check status
sudo systemctl status n8n-mcp-modern
```

### PM2 Process Manager (Node.js)

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'n8n-mcp-modern',
    script: '/usr/local/lib/node_modules/@eekfonky/n8n-mcp-modern/dist/index.js',
    cwd: '/opt/n8n-mcp-modern',
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    env: {
      NODE_ENV: 'production',
      MCP_MODE: 'stdio'
    },
    env_production: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=1024 --expose-gc'
    },
    // Monitoring
    monitoring: {
      http: true,
      https: false,
      port: 9615
    },
    // Graceful reload
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    // Auto restart policies
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup

# Monitor processes
pm2 monit
```

## Windows Service (Windows Server)

### Using node-windows

```javascript
// install-service.js
const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'n8n-MCP Modern',
  description: 'n8n Model Context Protocol Server',
  script: path.join(__dirname, 'node_modules', '@eekfonky', 'n8n-mcp-modern', 'dist', 'index.js'),
  env: {
    name: 'NODE_ENV',
    value: 'production'
  },
  workingDirectory: __dirname,
  allowServiceLogon: true
});

// Listen for install event
svc.on('install', () => {
  console.log('n8n-MCP Modern service installed successfully');
  svc.start();
});

// Listen for start event
svc.on('start', () => {
  console.log('n8n-MCP Modern service started successfully');
});

// Install the service
svc.install();
```

```bash
# Install node-windows
npm install -g node-windows

# Install service
node install-service.js

# Manage service
net start "n8n-MCP Modern"
net stop "n8n-MCP Modern"
```

### Using NSSM (Alternative)

```batch
@echo off
REM install-nssm-service.bat

REM Download NSSM from https://nssm.cc/download
REM Extract to C:\nssm

set NSSM_PATH=C:\nssm\win64\nssm.exe
set SERVICE_NAME=n8n-mcp-modern
set NODE_PATH=%ProgramFiles%\nodejs\node.exe
set SCRIPT_PATH=%CD%\node_modules\@eekfonky\n8n-mcp-modern\dist\index.js

REM Install service
%NSSM_PATH% install %SERVICE_NAME% %NODE_PATH% %SCRIPT_PATH%

REM Configure service
%NSSM_PATH% set %SERVICE_NAME% AppDirectory %CD%
%NSSM_PATH% set %SERVICE_NAME% AppEnvironmentExtra NODE_ENV=production
%NSSM_PATH% set %SERVICE_NAME% Description "n8n Model Context Protocol Server"
%NSSM_PATH% set %SERVICE_NAME% Start SERVICE_AUTO_START
%NSSM_PATH% set %SERVICE_NAME% AppStdout %CD%\logs\stdout.log
%NSSM_PATH% set %SERVICE_NAME% AppStderr %CD%\logs\stderr.log
%NSSM_PATH% set %SERVICE_NAME% AppRotateFiles 1
%NSSM_PATH% set %SERVICE_NAME% AppRotateOnline 1
%NSSM_PATH% set %SERVICE_NAME% AppRotateSeconds 86400
%NSSM_PATH% set %SERVICE_NAME% AppRotateBytes 10485760

REM Start service
%NSSM_PATH% start %SERVICE_NAME%

echo Service installed and started successfully
```

## Claude Code Integration

### MCP Configuration for Claude Code

```json
{
  "mcpServers": {
    "n8n-mcp-modern": {
      "command": "npx",
      "args": ["@eekfonky/n8n-mcp-modern"],
      "env": {
        "N8N_API_URL": "http://localhost:5678",
        "N8N_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Project-Specific Integration

```bash
# Add to Claude Code project
claude mcp add n8n-mcp-modern \
  --scope project \
  --env N8N_API_URL=http://localhost:5678 \
  --env N8N_API_KEY=your_api_key_here \
  -- npx -y @eekfonky/n8n-mcp-modern

# Or global installation
claude mcp add n8n-mcp-modern \
  --scope local \
  --env N8N_API_URL=http://localhost:5678 \
  --env N8N_API_KEY=your_api_key_here \
  -- npx -y @eekfonky/n8n-mcp-modern
```

## Load Balancing & High Availability

### Nginx Load Balancer

```nginx
# /etc/nginx/sites-available/n8n-mcp-modern
upstream n8n_mcp_backends {
    least_conn;
    server localhost:3001 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3002 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3003 weight=1 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/mcp.yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/mcp.yourdomain.com.key;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=mcp_limit:10m rate=10r/s;
    limit_req zone=mcp_limit burst=20 nodelay;
    
    # Webhook endpoint
    location /webhook/ {
        proxy_pass http://n8n_mcp_backends;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Health checks
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://n8n_mcp_backends;
        proxy_set_header Host $host;
    }
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

### Multi-Instance PM2 Setup

```javascript
// ecosystem.production.config.js
module.exports = {
  apps: [{
    name: 'n8n-mcp-modern',
    script: '/usr/local/lib/node_modules/@eekfonky/n8n-mcp-modern/dist/index.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    cwd: '/opt/n8n-mcp-modern',
    env_file: '.env',
    max_memory_restart: '1G',
    
    // Load balancing
    instance_var: 'INSTANCE_ID',
    
    // Different ports for each instance
    env: {
      NODE_ENV: 'production',
      DISCOVERY_WEBHOOK_PORT: 3001
    },
    env_instance_0: {
      DISCOVERY_WEBHOOK_PORT: 3001
    },
    env_instance_1: {
      DISCOVERY_WEBHOOK_PORT: 3002
    },
    env_instance_2: {
      DISCOVERY_WEBHOOK_PORT: 3003
    },
    
    // Monitoring
    monitoring: {
      http: true,
      port: 9615
    },
    
    // Graceful reload
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
```

## Monitoring & Observability

### Performance Monitoring Script

```javascript
// monitor.js
const http = require('http');
const fs = require('fs');

class MCPMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      memoryUsage: [],
      responseTime: []
    };
    this.startTime = Date.now();
  }

  async checkHealth() {
    try {
      const response = await this.makeRequest('/health');
      this.metrics.requests++;
      
      if (response.statusCode !== 200) {
        this.metrics.errors++;
        console.error(`Health check failed: ${response.statusCode}`);
      } else {
        console.log(`Health check passed at ${new Date().toISOString()}`);
      }
    } catch (error) {
      this.metrics.errors++;
      console.error(`Health check error: ${error.message}`);
    }
  }

  async getMemoryStats() {
    try {
      const response = await this.makeRequest('/memory-stats');
      if (response.data) {
        this.metrics.memoryUsage.push({
          timestamp: Date.now(),
          ...response.data
        });
        
        // Keep only last 100 entries
        if (this.metrics.memoryUsage.length > 100) {
          this.metrics.memoryUsage.shift();
        }
      }
    } catch (error) {
      console.error(`Memory stats error: ${error.message}`);
    }
  }

  async getColdStartStats() {
    try {
      const response = await this.makeRequest('/cold-start-stats');
      if (response.data) {
        console.log('Cold Start Performance:', {
          cachedModules: response.data.optimization.cachedModules,
          cacheHitRate: response.data.optimization.cacheHitRate,
          averageLoadTime: response.data.optimization.averageLoadTime
        });
      }
    } catch (error) {
      console.error(`Cold start stats error: ${error.message}`);
    }
  }

  makeRequest(path) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path,
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: null });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  generateReport() {
    const uptime = Date.now() - this.startTime;
    const errorRate = this.metrics.requests > 0 
      ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) 
      : 0;

    const report = {
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime / 1000),
      totalRequests: this.metrics.requests,
      totalErrors: this.metrics.errors,
      errorRate: `${errorRate}%`,
      memoryDataPoints: this.metrics.memoryUsage.length
    };

    // Write report to file
    fs.writeFileSync('/opt/n8n-mcp-modern/logs/monitor-report.json', 
      JSON.stringify(report, null, 2));
    
    return report;
  }

  async start() {
    console.log('Starting n8n-MCP Modern monitor...');
    
    // Check health every 30 seconds
    setInterval(() => this.checkHealth(), 30000);
    
    // Get memory stats every 2 minutes
    setInterval(() => this.getMemoryStats(), 120000);
    
    // Get cold start stats every 10 minutes
    setInterval(() => this.getColdStartStats(), 600000);
    
    // Generate report every hour
    setInterval(() => {
      const report = this.generateReport();
      console.log('Hourly Report:', report);
    }, 3600000);

    // Initial checks
    await this.checkHealth();
    await this.getMemoryStats();
    await this.getColdStartStats();
  }
}

// Start monitoring
const monitor = new MCPMonitor();
monitor.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down monitor...');
  const finalReport = monitor.generateReport();
  console.log('Final Report:', finalReport);
  process.exit(0);
});
```

### Cron Jobs for Maintenance

```bash
# Add to crontab (crontab -e)

# Health check every 5 minutes
*/5 * * * * /usr/bin/node /opt/n8n-mcp-modern/monitor.js >> /opt/n8n-mcp-modern/logs/monitor.log 2>&1

# Restart service daily at 3 AM
0 3 * * * /bin/systemctl restart n8n-mcp-modern

# Clear old logs weekly
0 0 * * 0 find /opt/n8n-mcp-modern/logs -name "*.log" -mtime +7 -delete

# Update npm package monthly
0 2 1 * * cd /opt/n8n-mcp-modern && npm update @eekfonky/n8n-mcp-modern && systemctl restart n8n-mcp-modern

# Generate performance report daily
0 6 * * * /usr/bin/node -e "require('/opt/n8n-mcp-modern/monitor.js')" > /opt/n8n-mcp-modern/logs/daily-report-$(date +\%Y\%m\%d).log
```

## Backup & Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup-mcp-npm.sh

BACKUP_DIR="/backup/n8n-mcp-modern"
DATE=$(date +%Y%m%d_%H%M%S)
MCP_DIR="/opt/n8n-mcp-modern"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Stop service
sudo systemctl stop n8n-mcp-modern

# Backup data directory
tar -czf "$BACKUP_DIR/data-$DATE.tar.gz" -C "$MCP_DIR" data/

# Backup logs
tar -czf "$BACKUP_DIR/logs-$DATE.tar.gz" -C "$MCP_DIR" logs/

# Backup configuration
cp "$MCP_DIR/.env" "$BACKUP_DIR/env-$DATE"
cp "$MCP_DIR/ecosystem.config.js" "$BACKUP_DIR/ecosystem-$DATE.js" 2>/dev/null || true

# Start service
sudo systemctl start n8n-mcp-modern

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "env-*" -mtime +30 -delete
find "$BACKUP_DIR" -name "ecosystem-*" -mtime +30 -delete

echo "Backup completed: $DATE"
```

## Troubleshooting

### Common Issues & Solutions

1. **Service Won't Start**
```bash
# Check service logs
sudo journalctl -u n8n-mcp-modern -f

# Check PM2 logs
pm2 logs n8n-mcp-modern

# Check permissions
sudo chown -R n8n-mcp:n8n-mcp /opt/n8n-mcp-modern
```

2. **High Memory Usage**
```bash
# Monitor memory
node -e "setInterval(() => console.log(process.memoryUsage()), 5000)"

# Force garbage collection
NODE_OPTIONS="--max-old-space-size=1024 --expose-gc"

# Check memory leaks
curl -X POST http://localhost:3001/check-memory-leaks
```

3. **Performance Issues**
```bash
# Check cold start performance
curl -X POST http://localhost:3001/cold-start-report

# Analyze startup bottlenecks  
curl -X POST http://localhost:3001/analyze-startup-bottlenecks

# Clear optimization cache
curl -X POST http://localhost:3001/clear-optimization-cache
```

### Performance Optimization

```bash
# Production environment variables for optimal performance
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc --optimize-for-size"
export UV_THREADPOOL_SIZE=16
export ENABLE_MODULE_PRELOADING=true
export PARALLEL_PRELOAD=true
export ENABLE_CACHE=true
export MAX_CONCURRENT_REQUESTS=5
```

This comprehensive NPM deployment guide covers everything from basic installations to enterprise-grade deployments with monitoring, scaling, and production optimizations.