-- Migration: 003_update_notifications.sql
-- Description: Update notification system for seamless server upgrades
-- Created: Phase 4 - Seamless Installation & Upgrade System
-- Security: Basic integrity with version tracking

-- =============================================================================
-- UPDATE NOTIFICATION SYSTEM
-- =============================================================================

-- Track available updates for components
CREATE TABLE IF NOT EXISTS update_notifications (
    id TEXT PRIMARY KEY, -- Component identifier (e.g., 'n8n-mcp-modern', 'n8n-server')
    component_name TEXT NOT NULL DEFAULT 'n8n-mcp-modern',
    current_version TEXT NOT NULL,
    latest_version TEXT NOT NULL,
    update_available BOOLEAN NOT NULL DEFAULT 0,
    
    -- Detection and notification tracking
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notified BOOLEAN NOT NULL DEFAULT 0,
    notified_at TIMESTAMP,
    dismissed BOOLEAN NOT NULL DEFAULT 0,
    dismissed_at TIMESTAMP,
    
    -- Update metadata
    update_priority TEXT CHECK (update_priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    security_update BOOLEAN NOT NULL DEFAULT 0,
    breaking_changes BOOLEAN NOT NULL DEFAULT 0,
    release_notes_url TEXT,
    
    -- Auto-update preferences
    auto_update_enabled BOOLEAN NOT NULL DEFAULT 0,
    scheduled_update_at TIMESTAMP,
    update_attempted_at TIMESTAMP,
    update_status TEXT CHECK (update_status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
    update_error TEXT,
    
    -- Tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_update_notifications_available (update_available),
    INDEX idx_update_notifications_detected (detected_at DESC),
    INDEX idx_update_notifications_priority (update_priority),
    INDEX idx_update_notifications_security (security_update),
    INDEX idx_update_notifications_status (update_status)
);

-- Update history for tracking successful and failed updates
CREATE TABLE IF NOT EXISTS update_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id TEXT NOT NULL, -- References update_notifications.id
    component_name TEXT NOT NULL,
    
    -- Version information
    from_version TEXT NOT NULL,
    to_version TEXT NOT NULL,
    
    -- Update execution
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    initiated_by TEXT NOT NULL DEFAULT 'system', -- 'system', 'user', 'agent', 'scheduler'
    completed_at TIMESTAMP,
    
    -- Outcome
    success BOOLEAN NOT NULL DEFAULT 0,
    error_message TEXT,
    error_code TEXT,
    rollback_required BOOLEAN NOT NULL DEFAULT 0,
    rollback_completed BOOLEAN NOT NULL DEFAULT 0,
    
    -- Update method and details
    update_method TEXT NOT NULL DEFAULT 'npm', -- 'npm', 'git', 'docker', 'manual'
    update_details TEXT, -- JSON details about the update process
    backup_location TEXT, -- Path to backup if created
    
    -- Performance metrics
    duration_seconds INTEGER,
    download_size_bytes INTEGER,
    memory_usage_mb INTEGER,
    
    INDEX idx_update_history_component (component_id),
    INDEX idx_update_history_success (success),
    INDEX idx_update_history_initiated (initiated_at DESC),
    INDEX idx_update_history_method (update_method)
);

-- Update preferences and configuration
CREATE TABLE IF NOT EXISTS update_preferences (
    id TEXT PRIMARY KEY DEFAULT 'system',
    
    -- Global update settings
    auto_check_enabled BOOLEAN NOT NULL DEFAULT 1,
    check_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (check_interval_minutes >= 15),
    auto_install_enabled BOOLEAN NOT NULL DEFAULT 0,
    
    -- Update policies
    security_updates_auto BOOLEAN NOT NULL DEFAULT 1,
    minor_updates_auto BOOLEAN NOT NULL DEFAULT 0,
    major_updates_auto BOOLEAN NOT NULL DEFAULT 0,
    
    -- Notification preferences
    notify_on_available BOOLEAN NOT NULL DEFAULT 1,
    notify_on_security BOOLEAN NOT NULL DEFAULT 1,
    notification_channels TEXT, -- JSON array of channels: ['log', 'mcp_tool', 'webhook']
    
    -- Maintenance windows
    maintenance_window_start TIME, -- HH:MM format
    maintenance_window_end TIME,   -- HH:MM format
    maintenance_days TEXT,         -- JSON array of weekdays: ['monday', 'tuesday']
    
    -- Backup preferences
    backup_before_update BOOLEAN NOT NULL DEFAULT 1,
    backup_retention_days INTEGER NOT NULL DEFAULT 7,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default update preferences
INSERT OR IGNORE INTO update_preferences (id) VALUES ('system');

-- =============================================================================
-- TRIGGERS FOR UPDATE NOTIFICATIONS
-- =============================================================================

-- Update timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_update_notifications_timestamp 
    AFTER UPDATE ON update_notifications
    FOR EACH ROW
    BEGIN
        UPDATE update_notifications 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- Update timestamp trigger for preferences
CREATE TRIGGER IF NOT EXISTS update_update_preferences_timestamp 
    AFTER UPDATE ON update_preferences
    FOR EACH ROW
    BEGIN
        UPDATE update_preferences 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;

-- Auto-set notified_at when notification is marked as sent
CREATE TRIGGER IF NOT EXISTS set_notified_timestamp
    AFTER UPDATE ON update_notifications
    FOR EACH ROW
    WHEN NEW.notified = 1 AND OLD.notified = 0
    BEGIN
        UPDATE update_notifications
        SET notified_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END;

-- Auto-set dismissed_at when notification is dismissed
CREATE TRIGGER IF NOT EXISTS set_dismissed_timestamp
    AFTER UPDATE ON update_notifications
    FOR EACH ROW
    WHEN NEW.dismissed = 1 AND OLD.dismissed = 0
    BEGIN
        UPDATE update_notifications
        SET dismissed_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Active update notifications (available and not dismissed)
CREATE VIEW IF NOT EXISTS active_update_notifications AS
SELECT 
    id,
    component_name,
    current_version,
    latest_version,
    update_priority,
    security_update,
    breaking_changes,
    detected_at,
    (datetime('now') - datetime(detected_at)) / 86400.0 as days_since_detected
FROM update_notifications
WHERE update_available = 1 
  AND dismissed = 0
ORDER BY 
    CASE update_priority 
        WHEN 'critical' THEN 4 
        WHEN 'high' THEN 3 
        WHEN 'medium' THEN 2 
        ELSE 1 
    END DESC,
    security_update DESC,
    detected_at ASC;

-- Recent update history with success rates
CREATE VIEW IF NOT EXISTS update_statistics AS
SELECT 
    component_name,
    COUNT(*) as total_updates,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_updates,
    ROUND(AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END), 3) as success_rate,
    AVG(duration_seconds) as avg_duration_seconds,
    MAX(initiated_at) as last_update_attempt,
    MAX(CASE WHEN success = 1 THEN initiated_at END) as last_successful_update
FROM update_history
WHERE initiated_at > datetime('now', '-30 days')
GROUP BY component_name;

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert initial notification for current server (will be updated by scheduler)
INSERT OR IGNORE INTO update_notifications (
    id, 
    component_name, 
    current_version, 
    latest_version, 
    update_available,
    update_priority
) VALUES (
    'n8n-mcp-modern', 
    'n8n-mcp-modern', 
    '7.0.1', 
    '7.0.1', 
    0,
    'medium'
);

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;