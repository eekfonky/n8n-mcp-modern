-- Migration: 002_dynamic_agents.sql
-- Description: Dynamic Agent Infrastructure - Memory, Sessions, and Learning
-- Created: Phase 2 - System-Wide Dynamic Infrastructure
-- Security: Encrypted storage with integrity checks

-- =============================================================================
-- AGENT MEMORY SYSTEM (Inspired by A-MEM)
-- =============================================================================

-- Agent memories with semantic embeddings and Zettelkasten-style linking
CREATE TABLE IF NOT EXISTS agent_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'workflow_pattern',
        'node_configuration', 
        'user_preference',
        'error_solution',
        'delegation_outcome',
        'discovery_result',
        'validation_rule',
        'performance_insight'
    )),
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL, -- SHA-256 for deduplication
    embeddings BLOB, -- Vector embeddings for semantic search
    tags TEXT, -- JSON array of tags for categorization
    relevance_score REAL DEFAULT 1.0 CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
    usage_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration for temporary memories
    
    -- Integrity and security
    encrypted_content TEXT, -- AES encrypted content for sensitive data
    signature TEXT, -- HMAC signature for tamper detection
    
    -- Relationships and linking (Zettelkasten-style)
    parent_memory_id INTEGER REFERENCES agent_memories(id),
    related_memory_ids TEXT, -- JSON array of related memory IDs
    
    UNIQUE(agent_name, content_hash), -- Prevent duplicate memories
    INDEX idx_agent_memories_agent_name (agent_name),
    INDEX idx_agent_memories_type (memory_type),
    INDEX idx_agent_memories_relevance (relevance_score DESC),
    INDEX idx_agent_memories_accessed (last_accessed DESC),
    INDEX idx_agent_memories_expires (expires_at),
    INDEX idx_agent_memories_hash (content_hash)
);

-- Memory relationships for semantic linking
CREATE TABLE IF NOT EXISTS memory_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_memory_id INTEGER NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,
    target_memory_id INTEGER NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'similar_to',
        'caused_by',
        'leads_to',
        'contradicts',
        'builds_on',
        'alternative_to',
        'prerequisite_for'
    )),
    strength REAL DEFAULT 1.0 CHECK (strength >= 0.0 AND strength <= 1.0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL, -- Agent that created the relationship
    
    UNIQUE(source_memory_id, target_memory_id, relationship_type),
    INDEX idx_memory_relationships_source (source_memory_id),
    INDEX idx_memory_relationships_target (target_memory_id),
    INDEX idx_memory_relationships_strength (strength DESC)
);

-- =============================================================================
-- AGENT SESSION MANAGEMENT
-- =============================================================================

-- Persistent agent sessions for stateful conversations
CREATE TABLE IF NOT EXISTS agent_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    agent_name TEXT NOT NULL,
    session_type TEXT NOT NULL CHECK (session_type IN (
        'iterative_building',
        'consultation',
        'collaboration',
        'delegation',
        'learning'
    )),
    state_data TEXT, -- JSON serialized state
    context_data TEXT, -- JSON serialized context
    metadata TEXT, -- JSON additional metadata
    
    -- Session lifecycle
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    
    -- Security and integrity
    encrypted_state BLOB, -- AES encrypted state for sensitive data
    state_signature TEXT, -- HMAC signature for state integrity
    
    -- Performance tracking
    operations_count INTEGER DEFAULT 0,
    memory_usage_bytes INTEGER DEFAULT 0,
    
    -- Relationships
    parent_session_id TEXT REFERENCES agent_sessions(session_id),
    child_session_ids TEXT, -- JSON array of child session IDs
    
    INDEX idx_agent_sessions_id (session_id),
    INDEX idx_agent_sessions_agent (agent_name),
    INDEX idx_agent_sessions_active (last_active DESC),
    INDEX idx_agent_sessions_expires (expires_at),
    INDEX idx_agent_sessions_type (session_type)
);

-- Session operations log for audit and learning
CREATE TABLE IF NOT EXISTS session_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL,
    operation_data TEXT, -- JSON operation details
    success BOOLEAN NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    memory_impact_bytes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_session_operations_session (session_id),
    INDEX idx_session_operations_type (operation_type),
    INDEX idx_session_operations_success (success),
    INDEX idx_session_operations_created (created_at DESC)
);

-- =============================================================================
-- SHARED KNOWLEDGE DISCOVERY
-- =============================================================================

-- Shared discoveries between agents for collective learning
CREATE TABLE IF NOT EXISTS shared_discoveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discovery_type TEXT NOT NULL CHECK (discovery_type IN (
        'node_pattern',
        'workflow_template',
        'error_solution',
        'performance_optimization',
        'security_pattern',
        'integration_method',
        'validation_rule',
        'best_practice'
    )),
    discovery_key TEXT NOT NULL, -- Unique identifier for the discovery
    
    -- Discovery content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content_data TEXT, -- JSON structured discovery data
    node_types TEXT, -- JSON array of related n8n node types
    tags TEXT, -- JSON array of tags
    
    -- Quality metrics
    success_rate REAL DEFAULT 1.0 CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
    usage_count INTEGER DEFAULT 0,
    confidence_score REAL DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    
    -- Provenance
    created_by TEXT NOT NULL, -- Agent that created the discovery
    validated_by TEXT, -- JSON array of agents that validated it
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    superseded_by INTEGER REFERENCES shared_discoveries(id),
    
    UNIQUE(discovery_type, discovery_key),
    INDEX idx_shared_discoveries_type (discovery_type),
    INDEX idx_shared_discoveries_key (discovery_key),
    INDEX idx_shared_discoveries_success (success_rate DESC),
    INDEX idx_shared_discoveries_usage (usage_count DESC),
    INDEX idx_shared_discoveries_confidence (confidence_score DESC),
    INDEX idx_shared_discoveries_created_by (created_by),
    INDEX idx_shared_discoveries_used (last_used DESC)
);

-- Discovery relationships for pattern linking
CREATE TABLE IF NOT EXISTS discovery_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_discovery_id INTEGER NOT NULL REFERENCES shared_discoveries(id) ON DELETE CASCADE,
    target_discovery_id INTEGER NOT NULL REFERENCES shared_discoveries(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'depends_on',
        'conflicts_with',
        'enhances',
        'replaces',
        'combines_with'
    )),
    strength REAL DEFAULT 1.0 CHECK (strength >= 0.0 AND strength <= 1.0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(source_discovery_id, target_discovery_id, relationship_type),
    INDEX idx_discovery_relationships_source (source_discovery_id),
    INDEX idx_discovery_relationships_target (target_discovery_id)
);

-- =============================================================================
-- DELEGATION HISTORY AND LEARNING
-- =============================================================================

-- Track delegation patterns for adaptive routing
CREATE TABLE IF NOT EXISTS delegation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    delegation_type TEXT NOT NULL CHECK (delegation_type IN (
        'strategic_planning',
        'technical_implementation',
        'security_validation',
        'performance_optimization',
        'error_resolution',
        'knowledge_lookup',
        'workflow_generation',
        'node_selection'
    )),
    
    -- Task context
    task_description TEXT NOT NULL,
    task_complexity TEXT CHECK (task_complexity IN ('low', 'medium', 'high')),
    estimated_duration_minutes INTEGER,
    
    -- Outcome metrics
    success BOOLEAN NOT NULL,
    actual_duration_minutes INTEGER,
    user_satisfaction REAL CHECK (user_satisfaction >= 1.0 AND user_satisfaction <= 5.0),
    quality_score REAL CHECK (quality_score >= 0.0 AND quality_score <= 1.0),
    
    -- Context and metadata
    context_data TEXT, -- JSON context information
    error_details TEXT, -- If delegation failed
    lessons_learned TEXT, -- Insights for future delegations
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_delegation_history_from (from_agent),
    INDEX idx_delegation_history_to (to_agent),
    INDEX idx_delegation_history_type (delegation_type),
    INDEX idx_delegation_history_success (success),
    INDEX idx_delegation_history_created (created_at DESC),
    INDEX idx_delegation_history_pair (from_agent, to_agent)
);

-- Delegation routing suggestions based on learned patterns
CREATE TABLE IF NOT EXISTS delegation_routing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_pattern TEXT NOT NULL, -- Regex or keyword pattern for task matching
    delegation_type TEXT NOT NULL,
    recommended_agent TEXT NOT NULL,
    confidence_score REAL NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    
    -- Performance statistics
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_duration_minutes REAL,
    avg_quality_score REAL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    
    INDEX idx_delegation_routing_pattern (task_pattern),
    INDEX idx_delegation_routing_type (delegation_type),
    INDEX idx_delegation_routing_agent (recommended_agent),
    INDEX idx_delegation_routing_confidence (confidence_score DESC)
);

-- =============================================================================
-- PERFORMANCE AND ANALYTICS
-- =============================================================================

-- Agent performance metrics for optimization
CREATE TABLE IF NOT EXISTS agent_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'response_time',
        'task_success_rate',
        'user_satisfaction',
        'memory_usage',
        'delegation_accuracy',
        'learning_rate'
    )),
    metric_value REAL NOT NULL,
    metric_context TEXT, -- JSON context for the metric
    measurement_period TEXT NOT NULL, -- 'hourly', 'daily', 'weekly'
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_agent_performance_agent (agent_name),
    INDEX idx_agent_performance_type (metric_type),
    INDEX idx_agent_performance_measured (measured_at DESC),
    UNIQUE(agent_name, metric_type, measurement_period, measured_at)
);

-- System-wide analytics for insights
CREATE TABLE IF NOT EXISTS system_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'agent_collaboration',
        'knowledge_discovery',
        'system_optimization',
        'error_pattern',
        'usage_spike',
        'performance_degradation'
    )),
    event_data TEXT NOT NULL, -- JSON event details
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    agents_involved TEXT, -- JSON array of agent names
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_system_analytics_type (event_type),
    INDEX idx_system_analytics_severity (severity),
    INDEX idx_system_analytics_created (created_at DESC)
);

-- =============================================================================
-- TRIGGERS AND MAINTENANCE
-- =============================================================================

-- Update timestamps trigger for agent_memories
CREATE TRIGGER IF NOT EXISTS update_agent_memories_timestamp 
    AFTER UPDATE ON agent_memories
    FOR EACH ROW
    BEGIN
        UPDATE agent_memories 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- Update last_active trigger for agent_sessions
CREATE TRIGGER IF NOT EXISTS update_session_activity
    AFTER UPDATE ON agent_sessions
    FOR EACH ROW
    WHEN NEW.state_data != OLD.state_data OR NEW.context_data != OLD.context_data
    BEGIN
        UPDATE agent_sessions
        SET last_active = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END;

-- Cleanup expired sessions trigger
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
    AFTER INSERT ON agent_sessions
    BEGIN
        DELETE FROM agent_sessions 
        WHERE expires_at < CURRENT_TIMESTAMP;
    END;

-- Automatic memory relevance decay (simulate forgetting)
CREATE TRIGGER IF NOT EXISTS memory_relevance_decay
    AFTER UPDATE ON agent_memories
    FOR EACH ROW
    WHEN NEW.last_accessed != OLD.last_accessed
    BEGIN
        UPDATE agent_memories
        SET relevance_score = CASE
            WHEN (julianday('now') - julianday(last_accessed)) > 30 
            THEN MAX(0.1, relevance_score * 0.95)
            ELSE relevance_score
        END
        WHERE id = NEW.id;
    END;

-- =============================================================================
-- INITIAL DATA AND CONFIGURATION
-- =============================================================================

-- Create initial agent memory entries for bootstrapping
INSERT OR IGNORE INTO agent_memories (agent_name, memory_type, content, content_hash, tags) VALUES
('system', 'validation_rule', 'Always validate node types against approved whitelist before adding to workflows', 
 'hash_validation_rule_001', '["security", "validation", "nodes"]'),
 
('system', 'security_pattern', 'Use AES-256-GCM encryption for all sensitive session data with unique IVs',
 'hash_security_pattern_001', '["security", "encryption", "sessions"]'),
 
('system', 'performance_insight', 'Batch database operations when possible to reduce I/O overhead',
 'hash_performance_001', '["performance", "database", "optimization"]'),

('n8n-builder', 'workflow_pattern', 'HTTP Request → Set → Conditional → Notification is a common pattern for API processing',
 'hash_workflow_pattern_001', '["workflow", "http", "processing"]'),

('n8n-orchestrator', 'best_practice', 'Always delegate security validation to n8n-scriptguard for complex workflows',
 'hash_best_practice_001', '["delegation", "security", "collaboration"]');

-- Create initial delegation routing suggestions
INSERT OR IGNORE INTO delegation_routing (task_pattern, delegation_type, recommended_agent, confidence_score, created_by) VALUES
('security|validate|credential', 'security_validation', 'n8n-scriptguard', 0.95, 'system'),
('performance|optimize|speed', 'performance_optimization', 'n8n-node-expert', 0.90, 'system'),
('workflow|generate|create', 'workflow_generation', 'n8n-builder', 0.95, 'system'),
('authenticate|oauth|login', 'technical_implementation', 'n8n-connector', 0.90, 'system'),
('documentation|help|guide', 'knowledge_lookup', 'n8n-guide', 0.85, 'system');

-- =============================================================================
-- SCHEMA VALIDATION AND CONSTRAINTS
-- =============================================================================

-- Ensure referential integrity
PRAGMA foreign_keys = ON;

-- Optimize query performance
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;

-- Create views for common queries
CREATE VIEW IF NOT EXISTS active_agent_sessions AS
SELECT 
    session_id,
    agent_name,
    session_type,
    started_at,
    last_active,
    expires_at,
    operations_count,
    (expires_at > CURRENT_TIMESTAMP) as is_active
FROM agent_sessions
WHERE expires_at > CURRENT_TIMESTAMP
ORDER BY last_active DESC;

CREATE VIEW IF NOT EXISTS top_discoveries AS
SELECT 
    d.id,
    d.discovery_type,
    d.title,
    d.description,
    d.success_rate,
    d.usage_count,
    d.confidence_score,
    d.created_by,
    COUNT(dr.target_discovery_id) as relationship_count
FROM shared_discoveries d
LEFT JOIN discovery_relationships dr ON d.id = dr.source_discovery_id
WHERE d.superseded_by IS NULL
GROUP BY d.id
ORDER BY d.usage_count DESC, d.confidence_score DESC
LIMIT 100;

CREATE VIEW IF NOT EXISTS delegation_insights AS
SELECT 
    from_agent,
    to_agent,
    delegation_type,
    COUNT(*) as total_delegations,
    AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
    AVG(actual_duration_minutes) as avg_duration,
    AVG(quality_score) as avg_quality
FROM delegation_history
WHERE created_at > datetime('now', '-30 days')
GROUP BY from_agent, to_agent, delegation_type
HAVING total_delegations >= 3
ORDER BY success_rate DESC, avg_quality DESC;