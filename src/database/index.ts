/**
 * Database layer for n8n MCP Modern
 * SQLite database for storing n8n node metadata and tool information
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { logger } from '../server/logger.js';
import { config } from '../server/config.js';

/**
 * n8n Node metadata
 */
export interface N8NNode {
  name: string;
  displayName: string;
  description: string;
  version: number;
  category: string;
  icon?: string;
  inputs: string[];
  outputs: string[];
  properties: Record<string, any>;
  credentials?: string[];
  webhooks?: boolean;
  polling?: boolean;
  lastUpdated: Date;
}

/**
 * Tool usage statistics
 */
export interface ToolUsage {
  toolName: string;
  usageCount: number;
  lastUsed: Date;
  averageExecutionTime: number;
  successRate: number;
}

/**
 * Agent routing information
 */
export interface AgentRoute {
  toolName: string;
  agentName: string;
  priority: number;
  capabilities: string[];
}

/**
 * Database manager class
 */
export class DatabaseManager {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor() {
    this.dbPath = config.databaseInMemory ? ':memory:' : config.databasePath;
  }

  /**
   * Initialize database connection and schema
   */
  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      if (!config.databaseInMemory) {
        const dataDir = join(process.cwd(), 'data');
        if (!existsSync(dataDir)) {
          mkdirSync(dataDir, { recursive: true });
        }
      }

      // Open database connection
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');

      // Create schema
      await this.createSchema();
      
      // Initialize with default data
      await this.initializeDefaultData();

      logger.info(`Database initialized: ${this.dbPath}`);
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create database schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const schemas = [
      // n8n nodes table
      `CREATE TABLE IF NOT EXISTS nodes (
        name TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        description TEXT,
        version INTEGER DEFAULT 1,
        category TEXT NOT NULL,
        icon TEXT,
        inputs TEXT, -- JSON array
        outputs TEXT, -- JSON array
        properties TEXT, -- JSON object
        credentials TEXT, -- JSON array
        webhooks BOOLEAN DEFAULT FALSE,
        polling BOOLEAN DEFAULT FALSE,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Tool usage statistics
      `CREATE TABLE IF NOT EXISTS tool_usage (
        tool_name TEXT PRIMARY KEY,
        usage_count INTEGER DEFAULT 0,
        last_used DATETIME,
        total_execution_time INTEGER DEFAULT 0, -- milliseconds
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0
      )`,

      // Agent routing table
      `CREATE TABLE IF NOT EXISTS agent_routes (
        tool_name TEXT,
        agent_name TEXT,
        priority INTEGER DEFAULT 1,
        capabilities TEXT, -- JSON array
        PRIMARY KEY (tool_name, agent_name)
      )`,

      // Create indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_nodes_category ON nodes(category)`,
      `CREATE INDEX IF NOT EXISTS idx_nodes_updated ON nodes(last_updated)`,
      `CREATE INDEX IF NOT EXISTS idx_usage_count ON tool_usage(usage_count DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_agent_priority ON agent_routes(priority DESC)`
    ];

    for (const schema of schemas) {
      this.db.exec(schema);
    }

    logger.debug('Database schema created');
  }

  /**
   * Initialize with default n8n node data
   */
  private async initializeDefaultData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const nodeCount = this.db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
    
    if (nodeCount.count === 0) {
      logger.info('Initializing database with default n8n nodes...');
      
      // Core n8n nodes that are commonly used
      const defaultNodes: Omit<N8NNode, 'lastUpdated'>[] = [
        {
          name: 'n8n-nodes-base.httpRequest',
          displayName: 'HTTP Request',
          description: 'Makes HTTP requests to any URL',
          version: 1,
          category: 'Communication',
          inputs: ['main'],
          outputs: ['main'],
          properties: {
            method: 'GET',
            url: '',
            authentication: 'none'
          }
        },
        {
          name: 'n8n-nodes-base.webhook',
          displayName: 'Webhook',
          description: 'Receives webhooks and starts workflows',
          version: 1,
          category: 'Trigger',
          inputs: [],
          outputs: ['main'],
          properties: {
            path: '',
            httpMethod: 'GET'
          },
          webhooks: true
        },
        {
          name: 'n8n-nodes-base.cron',
          displayName: 'Cron',
          description: 'Triggers workflows on a schedule',
          version: 1,
          category: 'Trigger',
          inputs: [],
          outputs: ['main'],
          properties: {
            cronExpression: '0 0 * * *'
          },
          polling: true
        },
        {
          name: 'n8n-nodes-base.set',
          displayName: 'Set',
          description: 'Sets values in the workflow data',
          version: 1,
          category: 'Data Transformation',
          inputs: ['main'],
          outputs: ['main'],
          properties: {
            values: {}
          }
        },
        {
          name: 'n8n-nodes-base.if',
          displayName: 'IF',
          description: 'Conditional routing based on expressions',
          version: 1,
          category: 'Logic',
          inputs: ['main'],
          outputs: ['main', 'main'],
          properties: {
            conditions: []
          }
        }
      ];

      const insertNode = this.db.prepare(`
        INSERT INTO nodes (
          name, display_name, description, version, category, icon,
          inputs, outputs, properties, credentials, webhooks, polling
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const node of defaultNodes) {
        insertNode.run(
          node.name,
          node.displayName,
          node.description,
          node.version,
          node.category,
          null, // icon
          JSON.stringify(node.inputs || []),
          JSON.stringify(node.outputs || []),
          JSON.stringify(node.properties || {}),
          JSON.stringify([]), // credentials
          node.webhooks ? 1 : 0,
          node.polling ? 1 : 0
        );
      }

      logger.info(`Initialized ${defaultNodes.length} default n8n nodes`);
    }
  }

  /**
   * Get all nodes
   */
  getNodes(category?: string): N8NNode[] {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM nodes';
    let params: any[] = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY display_name';

    const rows = this.db.prepare(query).all(...params) as any[];
    
    return rows.map(row => ({
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      version: row.version,
      category: row.category,
      icon: row.icon,
      inputs: JSON.parse(row.inputs || '[]'),
      outputs: JSON.parse(row.outputs || '[]'),
      properties: JSON.parse(row.properties || '{}'),
      credentials: JSON.parse(row.credentials || '[]'),
      webhooks: Boolean(row.webhooks),
      polling: Boolean(row.polling),
      lastUpdated: new Date(row.last_updated)
    }));
  }

  /**
   * Search nodes by name or description
   */
  searchNodes(query: string): N8NNode[] {
    if (!this.db) throw new Error('Database not initialized');

    const searchQuery = `
      SELECT * FROM nodes 
      WHERE display_name LIKE ? OR description LIKE ? OR name LIKE ?
      ORDER BY display_name
    `;
    
    const searchTerm = `%${query}%`;
    const rows = this.db.prepare(searchQuery).all(searchTerm, searchTerm, searchTerm) as any[];
    
    return rows.map(row => ({
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      version: row.version,
      category: row.category,
      icon: row.icon,
      inputs: JSON.parse(row.inputs || '[]'),
      outputs: JSON.parse(row.outputs || '[]'),
      properties: JSON.parse(row.properties || '{}'),
      credentials: JSON.parse(row.credentials || '[]'),
      webhooks: Boolean(row.webhooks),
      polling: Boolean(row.polling),
      lastUpdated: new Date(row.last_updated)
    }));
  }

  /**
   * Record tool usage
   */
  recordToolUsage(toolName: string, executionTime: number, success: boolean): void {
    if (!this.db) throw new Error('Database not initialized');

    const upsertUsage = this.db.prepare(`
      INSERT INTO tool_usage (tool_name, usage_count, last_used, total_execution_time, success_count, error_count)
      VALUES (?, 1, datetime('now'), ?, ?, ?)
      ON CONFLICT(tool_name) DO UPDATE SET
        usage_count = usage_count + 1,
        last_used = datetime('now'),
        total_execution_time = total_execution_time + ?,
        success_count = success_count + ?,
        error_count = error_count + ?
    `);

    const successCount = success ? 1 : 0;
    const errorCount = success ? 0 : 1;

    upsertUsage.run(
      toolName,
      executionTime,
      successCount,
      errorCount,
      executionTime,
      successCount,
      errorCount
    );
  }

  /**
   * Get tool usage statistics
   */
  getToolUsage(): ToolUsage[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare(`
      SELECT 
        tool_name,
        usage_count,
        last_used,
        CASE 
          WHEN usage_count > 0 THEN total_execution_time / usage_count 
          ELSE 0 
        END as average_execution_time,
        CASE 
          WHEN usage_count > 0 THEN (success_count * 100.0) / usage_count 
          ELSE 0 
        END as success_rate
      FROM tool_usage
      ORDER BY usage_count DESC
    `).all() as any[];

    return rows.map(row => ({
      toolName: row.tool_name,
      usageCount: row.usage_count,
      lastUsed: new Date(row.last_used),
      averageExecutionTime: row.average_execution_time,
      successRate: row.success_rate
    }));
  }

  /**
   * Get agent routing for a tool
   */
  getAgentRoute(toolName: string): AgentRoute | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare(`
      SELECT * FROM agent_routes 
      WHERE tool_name = ? 
      ORDER BY priority DESC 
      LIMIT 1
    `).get(toolName) as any;

    if (!row) return null;

    return {
      toolName: row.tool_name,
      agentName: row.agent_name,
      priority: row.priority,
      capabilities: JSON.parse(row.capabilities || '[]')
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    try {
      if (!this.db) return false;
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rebuild database from scratch
   */
  async rebuild(): Promise<void> {
    logger.info('Rebuilding database...');
    
    if (this.db) {
      this.db.close();
    }

    // Delete existing database file
    if (!config.databaseInMemory && existsSync(this.dbPath)) {
      const fs = await import('fs');
      fs.unlinkSync(this.dbPath);
    }

    // Reinitialize
    await this.initialize();
    logger.info('Database rebuilt successfully');
  }
}

// Export singleton instance
export const database = new DatabaseManager();