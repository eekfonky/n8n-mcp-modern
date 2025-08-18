# Multi-stage build for optimal image size and security
# Stage 1: Builder
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine AS runtime

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/data ./data
COPY --from=builder --chown=nodejs:nodejs /app/agents ./agents

# Create necessary directories with correct permissions
RUN mkdir -p logs data/.cache && \
    chown -R nodejs:nodejs logs data

# Switch to non-root user
USER nodejs

# Expose metrics port (optional)
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Labels for metadata
LABEL org.opencontainers.image.title="n8n-MCP-Modern" \
      org.opencontainers.image.description="Modern n8n MCP server with zero legacy dependencies" \
      org.opencontainers.image.version="4.1.0" \
      org.opencontainers.image.authors="Enhanced by eekfonky" \
      org.opencontainers.image.source="https://github.com/eekfonky/n8n-mcp-modern" \
      org.opencontainers.image.licenses="MIT"