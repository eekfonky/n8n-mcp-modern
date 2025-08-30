# Docker Deployment Guide - n8n-MCP Modern

Comprehensive guide for deploying n8n-MCP Modern in production using Docker containers with optimal performance and security configurations.

## Quick Start

### Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: '3.8'

services:
  n8n-mcp-modern:
    image: n8n-mcp-modern:latest
    container_name: n8n-mcp-modern
    restart: unless-stopped
    environment:
      # n8n Connection
      - N8N_API_URL=http://n8n:5678
      - N8N_API_KEY=${N8N_API_KEY}
      
      # MCP Configuration
      - MCP_MODE=stdio
      - LOG_LEVEL=info
      - DISABLE_CONSOLE_OUTPUT=false
      
      # Performance Optimization
      - ENABLE_CACHE=true
      - CACHE_TTL=3600
      - MAX_CONCURRENT_REQUESTS=10
      
      # Memory & Performance
      - NODE_OPTIONS=--max-old-space-size=512 --expose-gc
      - ENABLE_DISCOVERY_SCHEDULING=true
      - DISCOVERY_INTERVAL_MINUTES=60
      
      # Error Monitoring
      - LOG_LEVEL=info
      
    ports:
      - "3001:3001"  # Webhook port (if enabled)
    volumes:
      - mcp-data:/app/data
      - ./logs:/app/logs
    networks:
      - n8n-network
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'

  # Example n8n service (optional)
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
    volumes:
      - n8n-data:/home/node/.n8n
    networks:
      - n8n-network

volumes:
  mcp-data:
    driver: local
  n8n-data:
    driver: local

networks:
  n8n-network:
    driver: bridge
```

### Environment Configuration

Create `.env` file:

```bash
# .env
N8N_API_KEY=your_n8n_api_key_here
N8N_PASSWORD=your_secure_password_here

# Optional advanced settings
DISCOVERY_WEBHOOK_SECRET=your_webhook_secret
ENABLE_DISCOVERY_WEBHOOKS=true
ENABLE_SMART_INTERVALS=true
```

## Production Dockerfile

```dockerfile
# Multi-stage production Dockerfile
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY src/ ./src/
COPY data/ ./data/ 2>/dev/null || true

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Production stage
FROM node:22-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=mcp:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:nodejs /app/package*.json ./
COPY --from=builder --chown=mcp:nodejs /app/data ./data

# Create directories with correct permissions
RUN mkdir -p /app/logs /app/data && \
    chown -R mcp:nodejs /app/logs /app/data

# Install production utilities
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Switch to non-root user
USER mcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Set production environment
ENV NODE_ENV=production
ENV MCP_MODE=stdio
ENV LOG_LEVEL=info

# Expose webhook port (if enabled)
EXPOSE 3001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
```

## Build & Deploy Commands

```bash
# Build the Docker image
docker build -t n8n-mcp-modern:latest .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f n8n-mcp-modern

# Scale the service
docker-compose up -d --scale n8n-mcp-modern=2

# Update and restart
docker-compose pull
docker-compose up -d --force-recreate
```

## Production Optimizations

### Memory Configuration

```yaml
# docker-compose.override.yml (production)
version: '3.8'

services:
  n8n-mcp-modern:
    environment:
      # Optimize for production memory usage
      - NODE_OPTIONS=--max-old-space-size=1024 --expose-gc --optimize-for-size
      
      # Enable memory profiling
      - ENABLE_MEMORY_PROFILING=true
      - MEMORY_ALERT_THRESHOLD=85
      
      # Cold start optimization
      - ENABLE_MODULE_PRELOADING=true
      - PARALLEL_PRELOAD=true
      - PRELOAD_TIMEOUT=10000
      
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
```

### Performance Monitoring

```yaml
# Add monitoring stack
services:
  # ... existing services
  
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    networks:
      - n8n-network

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - n8n-network
```

### Security Configuration

```yaml
# Security-hardened configuration
version: '3.8'

services:
  n8n-mcp-modern:
    # ... existing config
    
    # Security options
    security_opt:
      - no-new-privileges:true
    
    # Read-only root filesystem
    read_only: true
    
    # Temporary filesystems
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
      - /var/tmp:noexec,nosuid,size=50m
    
    # Limit capabilities
    cap_drop:
      - ALL
    cap_add:
      - SETGID
      - SETUID
    
    # User namespace
    user: "1001:1001"
    
    environment:
      # Security settings
      - DISABLE_CONSOLE_OUTPUT=true  # In production
      - ENABLE_WEBHOOK_SIGNATURE_VERIFICATION=true
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
      
      # Rate limiting
      - MAX_CONCURRENT_REQUESTS=5
      - REQUEST_TIMEOUT=30000
```

## Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: n8n-mcp

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n-mcp-modern
  namespace: n8n-mcp
  labels:
    app: n8n-mcp-modern
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: n8n-mcp-modern
  template:
    metadata:
      labels:
        app: n8n-mcp-modern
    spec:
      serviceAccountName: n8n-mcp-service-account
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: n8n-mcp-modern
        image: n8n-mcp-modern:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3001
          name: webhooks
        env:
        - name: N8N_API_KEY
          valueFrom:
            secretKeyRef:
              name: n8n-credentials
              key: api-key
        - name: MCP_MODE
          value: "stdio"
        - name: LOG_LEVEL
          value: "info"
        - name: NODE_OPTIONS
          value: "--max-old-space-size=512 --expose-gc"
        resources:
          limits:
            memory: 512Mi
            cpu: 500m
          requests:
            memory: 256Mi
            cpu: 250m
        livenessProbe:
          exec:
            command:
            - node
            - -e
            - "process.exit(0)"
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - node
            - -e
            - "process.exit(0)"
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
        - name: logs-volume
          mountPath: /app/logs
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: n8n-mcp-data
      - name: logs-volume
        persistentVolumeClaim:
          claimName: n8n-mcp-logs

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: n8n-mcp-modern-service
  namespace: n8n-mcp
spec:
  selector:
    app: n8n-mcp-modern
  ports:
  - port: 3001
    targetPort: 3001
    name: webhooks
  type: ClusterIP

---
# k8s/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: n8n-mcp-data
  namespace: n8n-mcp
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: n8n-mcp-logs
  namespace: n8n-mcp
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
```

## Scaling & Load Balancing

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: n8n-mcp-modern-hpa
  namespace: n8n-mcp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: n8n-mcp-modern
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### Load Balancer Configuration

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: n8n-mcp-modern-ingress
  namespace: n8n-mcp
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - mcp.yourdomain.com
    secretName: mcp-tls-secret
  rules:
  - host: mcp.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: n8n-mcp-modern-service
            port:
              number: 3001
```

## Monitoring & Observability

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'n8n-mcp-modern'
    static_configs:
      - targets: ['n8n-mcp-modern:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s
    
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "n8n-MCP Modern Performance",
    "panels": [
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes{job=\"n8n-mcp-modern\"}",
            "legendFormat": "RSS Memory"
          }
        ]
      },
      {
        "title": "CPU Usage",
        "type": "graph", 
        "targets": [
          {
            "expr": "rate(process_cpu_seconds_total{job=\"n8n-mcp-modern\"}[5m])",
            "legendFormat": "CPU Usage"
          }
        ]
      }
    ]
  }
}
```

## Backup & Recovery

### Data Backup Script

```bash
#!/bin/bash
# backup-mcp-data.sh

BACKUP_DIR="/backups/n8n-mcp-modern"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Docker volumes
docker run --rm \
  -v n8n-mcp-modern_mcp-data:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/mcp-data-$DATE.tar.gz" -C /data .

# Backup logs
docker run --rm \
  -v n8n-mcp-modern_logs:/logs:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/mcp-logs-$DATE.tar.gz" -C /logs .

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Disaster Recovery

```bash
#!/bin/bash
# restore-mcp-data.sh

BACKUP_FILE=$1
VOLUME_NAME="n8n-mcp-modern_mcp-data"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

# Stop the service
docker-compose stop n8n-mcp-modern

# Restore data
docker run --rm \
  -v "$VOLUME_NAME":/data \
  -v "$(dirname $BACKUP_FILE)":/backup \
  alpine tar xzf "/backup/$(basename $BACKUP_FILE)" -C /data

# Start the service
docker-compose start n8n-mcp-modern

echo "Restore completed"
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
```bash
# Check memory stats
docker exec n8n-mcp-modern node -e "console.log(process.memoryUsage())"

# Enable memory profiling
docker-compose exec n8n-mcp-modern curl -X POST http://localhost:3001/memory-stats
```

2. **Slow Startup**
```bash
# Analyze startup performance
docker-compose logs n8n-mcp-modern | grep "ready in"

# Check cold start optimization
docker-compose exec n8n-mcp-modern curl -X POST http://localhost:3001/cold-start-report
```

3. **Connection Issues**
```bash
# Test n8n connectivity
docker-compose exec n8n-mcp-modern curl -H "X-N8N-API-KEY: $API_KEY" $N8N_API_URL/workflows

# Check network connectivity
docker network inspect n8n-mcp-modern_n8n-network
```

### Performance Tuning

1. **Memory Optimization**
```bash
# Increase heap size for heavy workloads
NODE_OPTIONS="--max-old-space-size=2048 --expose-gc --optimize-for-size"

# Enable memory profiling
ENABLE_MEMORY_PROFILING=true
MEMORY_ALERT_THRESHOLD=85
```

2. **CPU Optimization**
```bash
# Enable V8 optimization flags
NODE_OPTIONS="--max-old-space-size=1024 --optimize-for-size --turbo-inline-js-wasm"

# Limit concurrent operations
MAX_CONCURRENT_REQUESTS=5
DISCOVERY_INTERVAL_MINUTES=120
```

This comprehensive Docker deployment guide covers all production scenarios from basic Docker Compose setups to enterprise Kubernetes deployments with monitoring, scaling, and disaster recovery capabilities.