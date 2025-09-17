-- Enhanced database schema for dynamic node discovery and workflow management

-- Node registry table
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT,
    description TEXT,
    schema JSON,
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version TEXT,
    is_community BOOLEAN DEFAULT FALSE,
    capabilities JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Node relationships for workflow patterns
CREATE TABLE IF NOT EXISTS node_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node TEXT NOT NULL,
    to_node TEXT NOT NULL,
    connection_type TEXT,
    workflow_pattern TEXT,
    success_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_node) REFERENCES nodes(id),
    FOREIGN KEY (to_node) REFERENCES nodes(id)
);

-- Workflow templates and patterns
CREATE TABLE IF NOT EXISTS workflow_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    pattern_json JSON NOT NULL,
    usage_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Node configurations for common use cases
CREATE TABLE IF NOT EXISTS node_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    use_case TEXT NOT NULL,
    configuration JSON NOT NULL,
    rating REAL DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id)
);

-- Discovery sessions for tracking API discovery runs
CREATE TABLE IF NOT EXISTS discovery_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    n8n_instance_url TEXT NOT NULL,
    nodes_discovered INTEGER DEFAULT 0,
    nodes_new INTEGER DEFAULT 0,
    nodes_updated INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Agent memory for learning and pattern recognition
CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    memory_type TEXT NOT NULL,
    context TEXT,
    data JSON NOT NULL,
    relevance_score REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_category ON nodes(category);
CREATE INDEX IF NOT EXISTS idx_nodes_is_community ON nodes(is_community);
CREATE INDEX IF NOT EXISTS idx_node_connections_from ON node_connections(from_node);
CREATE INDEX IF NOT EXISTS idx_node_connections_to ON node_connections(to_node);
CREATE INDEX IF NOT EXISTS idx_workflow_patterns_usage ON workflow_patterns(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_node_configurations_node_id ON node_configurations(node_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);

-- Views for common queries
CREATE VIEW IF NOT EXISTS popular_nodes AS
SELECT
    n.*,
    COALESCE(SUM(nc.usage_count), 0) as total_usage
FROM nodes n
LEFT JOIN node_configurations nc ON n.id = nc.node_id
GROUP BY n.id
ORDER BY total_usage DESC;

CREATE VIEW IF NOT EXISTS successful_patterns AS
SELECT
    wp.*,
    wp.success_rate * wp.usage_count as weighted_score
FROM workflow_patterns wp
WHERE wp.success_rate > 0.7
ORDER BY weighted_score DESC;