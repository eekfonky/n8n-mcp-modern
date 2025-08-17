#!/usr/bin/env node
/**
 * n8n-MCP Modern - Main Entry Point
 * Modern n8n MCP server built with official TypeScript SDK
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './server/config.js';
import { logger } from './server/logger.js';

/**
 * Main MCP Server Implementation
 */
class N8NMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: '@lexinet/n8n-mcp-modern',
        version: '4.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupErrorHandlers();
  }

  private setupTools(): void {
    // Tool setup will be implemented here
    logger.info('Setting up MCP tools...');
    
    // TODO: Implement the 87+ MCP tools from the agents and tools directories
    // For now, just log that the server is ready - tools will be implemented later
    logger.info('Tool handlers ready for implementation');
  }

  private setupErrorHandlers(): void {
    this.server.onerror = (error) => {
      logger.error('MCP Server error:', error);
    };

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    logger.info('Starting n8n-MCP Modern server...');
    logger.info(`Mode: ${config.mcpMode}`);
    logger.info(`Log Level: ${config.logLevel}`);
    
    if (config.n8nApiUrl) {
      logger.info(`n8n API URL: ${config.n8nApiUrl}`);
    } else {
      logger.info('No n8n API configured - running in offline mode');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('n8n-MCP Modern server started successfully');
  }
}

/**
 * Start the server
 */
async function main(): Promise<void> {
  try {
    const server = new N8NMcpServer();
    await server.start();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export { N8NMcpServer };