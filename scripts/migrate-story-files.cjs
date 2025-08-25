#!/usr/bin/env node

/**
 * Database Migration Script for BMAD-METHOD Story Files
 *
 * This script adds the necessary tables and indexes for story file persistence
 * to existing n8n-mcp-modern database installations.
 *
 * Usage: node scripts/migrate-story-files.cjs [options]
 * Options:
 *   --dry-run    Show SQL commands without executing
 *   --backup     Create backup before migration
 *   --force      Skip confirmation prompts
 */

const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const shouldBackup = args.includes('--backup')
const isForced = args.includes('--force')

// Database configuration
const DB_PATH = path.join(process.cwd(), 'data', 'n8n-mcp.db')
const BACKUP_PATH = path.join(process.cwd(), 'data', `n8n-mcp-backup-${Date.now()}.db`)

// Migration SQL
const MIGRATION_SQL = `
-- Story Files Migration for BMAD-METHOD Integration
-- Version: 1.0.0
-- Date: ${new Date().toISOString()}

BEGIN TRANSACTION;

-- Main story files table
CREATE TABLE IF NOT EXISTS story_files (
    id TEXT PRIMARY KEY,
    version INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- Workflow tracking
    phase TEXT NOT NULL CHECK (phase IN ('planning', 'implementation', 'validation', 'completed')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'handed_over', 'completed', 'archived')),
    
    -- Agent information
    current_agent TEXT NOT NULL,
    previous_agents TEXT DEFAULT '[]', -- JSON array
    next_agent TEXT,
    
    -- Context (stored as JSON)
    context_original TEXT NOT NULL DEFAULT '{}',
    context_current TEXT NOT NULL DEFAULT '{}',
    context_technical TEXT DEFAULT '{}',
    
    -- Work tracking (JSON arrays)
    completed_work TEXT DEFAULT '[]',
    pending_work TEXT DEFAULT '[]',
    blockers TEXT,
    
    -- Handover details
    handover_notes TEXT DEFAULT '',
    acceptance_criteria TEXT, -- JSON array
    rollback_plan TEXT,
    
    -- Metadata
    ttl INTEGER,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    tags TEXT DEFAULT '[]', -- JSON array
    related_stories TEXT DEFAULT '[]' -- JSON array
);

-- Decision records table
CREATE TABLE IF NOT EXISTS story_decisions (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    decision_type TEXT NOT NULL CHECK (decision_type IN ('technical', 'architectural', 'process', 'escalation')),
    description TEXT NOT NULL,
    rationale TEXT NOT NULL,
    alternatives TEXT, -- JSON array
    impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'critical')),
    reversible INTEGER DEFAULT 1 CHECK (reversible IN (0, 1)), -- boolean
    dependencies TEXT, -- JSON array
    outcome TEXT, -- JSON object
    
    FOREIGN KEY (story_id) REFERENCES story_files(id) ON DELETE CASCADE
);

-- Audit trail table
CREATE TABLE IF NOT EXISTS story_audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT DEFAULT '{}', -- JSON object
    
    FOREIGN KEY (story_id) REFERENCES story_files(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_story_phase ON story_files(phase);
CREATE INDEX IF NOT EXISTS idx_story_status ON story_files(status);
CREATE INDEX IF NOT EXISTS idx_story_agent ON story_files(current_agent);
CREATE INDEX IF NOT EXISTS idx_story_updated ON story_files(updated_at);
CREATE INDEX IF NOT EXISTS idx_story_priority ON story_files(priority DESC);
CREATE INDEX IF NOT EXISTS idx_story_ttl ON story_files(ttl);

-- Decision indexes
CREATE INDEX IF NOT EXISTS idx_decision_story ON story_decisions(story_id);
CREATE INDEX IF NOT EXISTS idx_decision_timestamp ON story_decisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_decision_agent ON story_decisions(agent_name);
CREATE INDEX IF NOT EXISTS idx_decision_type ON story_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_decision_impact ON story_decisions(impact);

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_audit_story ON story_audit_trail(story_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON story_audit_trail(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_agent ON story_audit_trail(agent_name);
CREATE INDEX IF NOT EXISTS idx_audit_action ON story_audit_trail(action);

-- Create migration record
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL,
    applied_at INTEGER NOT NULL,
    sql_checksum TEXT
);

INSERT OR IGNORE INTO migrations (name, version, applied_at, sql_checksum) 
VALUES ('story_files_bmad_method', '1.0.0', ${Date.now()}, '${generateSqlChecksum()}');

COMMIT;
`

// Utility functions
function generateSqlChecksum() {
  const crypto = require('node:crypto')
  return crypto.createHash('sha256').update(MIGRATION_SQL).digest('hex').substring(0, 16)
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  console.log(`${prefix} ${message}`)
}

function logError(message, error) {
  log(`${message}: ${error.message}`, 'error')
  if (process.env.DEBUG) {
    console.error(error)
  }
}

function checkDatabaseExists() {
  if (!fs.existsSync(DB_PATH)) {
    log(`Database not found at ${DB_PATH}`, 'error')
    log('Please ensure n8n-mcp-modern has been initialized first', 'info')
    process.exit(1)
  }
  log(`Found database at ${DB_PATH}`)
}

function createBackup() {
  if (!shouldBackup)
    return

  log('Creating database backup...')
  try {
    fs.copyFileSync(DB_PATH, BACKUP_PATH)
    log(`Backup created at ${BACKUP_PATH}`)
  }
  catch (error) {
    logError('Failed to create backup', error)
    process.exit(1)
  }
}

function checkExistingTables() {
  log('Checking for existing story file tables...')

  let Database
  try {
    Database = require('better-sqlite3')
  }
  catch (error) {
    logError('better-sqlite3 not found', error)
    log('Please run: npm install better-sqlite3', 'info')
    process.exit(1)
  }

  const db = new Database(DB_PATH, { readonly: true })

  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('story_files', 'story_decisions', 'story_audit_trail')
    `).all()

    if (tables.length > 0) {
      log(`Found ${tables.length} existing story file tables:`)
      tables.forEach(table => log(`  - ${table.name}`))

      if (!isForced) {
        log('Use --force to proceed with migration anyway', 'warn')
        process.exit(0)
      }
    }
    else {
      log('No existing story file tables found - migration needed')
    }
  }
  finally {
    db.close()
  }
}

function executeMigration() {
  log('Executing migration...')

  if (isDryRun) {
    log('DRY RUN - SQL Commands to be executed:')
    console.log('='.repeat(80))
    console.log(MIGRATION_SQL)
    console.log('='.repeat(80))
    return
  }

  let Database
  try {
    Database = require('better-sqlite3')
  }
  catch (error) {
    logError('better-sqlite3 not found', error)
    process.exit(1)
  }

  const db = new Database(DB_PATH)

  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON')

    // Execute migration
    db.exec(MIGRATION_SQL)

    // Verify tables were created
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('story_files', 'story_decisions', 'story_audit_trail')
    `).all()

    if (tables.length === 3) {
      log('Migration completed successfully!')
      log(`Created ${tables.length} story file tables:`)
      tables.forEach(table => log(`  ✓ ${table.name}`))

      // Verify indexes
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_story_%' OR name LIKE 'idx_decision_%' OR name LIKE 'idx_audit_%'
      `).all()

      log(`Created ${indexes.length} performance indexes`)

      // Check migration record
      const migration = db.prepare(`
        SELECT * FROM migrations WHERE name = 'story_files_bmad_method'
      `).get()

      if (migration) {
        log(`Migration record created: version ${migration.version}`)
      }
    }
    else {
      log('Migration may have failed - not all tables created', 'error')
      process.exit(1)
    }
  }
  catch (error) {
    logError('Migration failed', error)

    if (shouldBackup && fs.existsSync(BACKUP_PATH)) {
      log('Attempting to restore from backup...', 'warn')
      try {
        fs.copyFileSync(BACKUP_PATH, DB_PATH)
        log('Database restored from backup')
      }
      catch (restoreError) {
        logError('Failed to restore backup', restoreError)
      }
    }

    process.exit(1)
  }
  finally {
    db.close()
  }
}

function promptConfirmation() {
  if (isForced || isDryRun)
    return

  const readline = require('node:readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('Proceed with migration? (y/N): ', (answer) => {
      rl.close()
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        log('Migration cancelled')
        process.exit(0)
      }
      resolve()
    })
  })
}

function displayUsage() {
  console.log(`
Database Migration Script for BMAD-METHOD Story Files

Usage: node scripts/migrate-story-files.cjs [options]

Options:
  --dry-run    Show SQL commands without executing them
  --backup     Create database backup before migration  
  --force      Skip confirmation prompts and existing table checks
  --help       Show this help message

Examples:
  node scripts/migrate-story-files.cjs --dry-run
  node scripts/migrate-story-files.cjs --backup
  node scripts/migrate-story-files.cjs --force --backup

This script adds story file persistence tables to support BMAD-METHOD
agentic handover patterns in n8n-mcp-modern.
`)
}

// Main execution
async function main() {
  if (args.includes('--help')) {
    displayUsage()
    return
  }

  log('Starting BMAD-METHOD Story Files Migration')
  log(`Options: dry-run=${isDryRun}, backup=${shouldBackup}, force=${isForced}`)

  try {
    // Pre-migration checks
    checkDatabaseExists()
    checkExistingTables()

    // Create backup if requested
    createBackup()

    // Confirm migration
    await promptConfirmation()

    // Execute migration
    executeMigration()

    if (!isDryRun) {
      log('✅ Migration completed successfully!')
      log('')
      log('Next steps:')
      log('1. Restart n8n-mcp-modern to load story file support')
      log('2. Story files will be automatically created during agent escalations')
      log('3. Use story file metrics to monitor handover performance')

      if (shouldBackup) {
        log(`4. Backup saved at: ${BACKUP_PATH}`)
      }
    }
  }
  catch (error) {
    logError('Migration script failed', error)
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError('Uncaught exception', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled rejection at', new Error(`Promise: ${promise}, reason: ${reason}`))
  process.exit(1)
})

// Run the migration
main().catch((error) => {
  logError('Main execution failed', error)
  process.exit(1)
})
