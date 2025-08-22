/**
 * Core unified interfaces for n8n node types
 * 
 * This file consolidates the conflicting N8NNode interfaces that were spread
 * across database/index.ts, n8n/api.ts, and types/index.ts to prevent
 * type confusion and unsafe casting.
 */

/**
 * Core properties shared by all n8n node representations
 */
export interface N8NNodeCore {
  /** Unique node type identifier (e.g., 'n8n-nodes-base.httpRequest') */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Node description/purpose */
  description: string;
  /** Node type version */
  version: number;
  /** Input connection types */
  inputs: string[];
  /** Output connection types */
  outputs: string[];
}

/**
 * Database-specific node representation (for local storage)
 * Used by DatabaseManager for SQLite operations
 */
export interface N8NNodeDatabase extends N8NNodeCore {
  /** Node category for database indexing */
  category: string;
  /** Optional icon reference */
  icon?: string | undefined;
  /** Node properties (parsed from JSON) */
  properties: Record<string, unknown>;
  /** Required credentials (parsed from JSON) */
  credentials?: string[];
  /** Supports webhooks */
  webhooks?: boolean | undefined;
  /** Supports polling */
  polling?: boolean | undefined;
  /** Last database update timestamp */
  lastUpdated: Date;
}

/**
 * API response node representation (from n8n instance)
 * Used by N8NApiClient for live node discovery
 */
export interface N8NNodeAPI extends N8NNodeCore {
  /** Node group categories */
  group: string[];
  /** Optional primary category */
  category?: string;
  /** Default parameter values */
  defaults?: Record<string, unknown>;
  /** Structured property definitions */
  properties: N8NNodeProperty[];
  /** Available credential types */
  credentials?: N8NNodeCredential[];
}

/**
 * Workflow instance node representation (in actual workflows)
 * Used for workflow creation/editing
 */
export interface N8NWorkflowNode {
  /** Unique node ID within workflow */
  id: string;
  /** User-assigned node name */
  name: string;
  /** Node type identifier */
  type: string;
  /** Node type version */
  typeVersion: number;
  /** Visual position [x, y] */
  position: [number, number];
  /** Node configuration parameters */
  parameters: Record<string, unknown>;
  /** Assigned credential IDs */
  credentials?: Record<string, string>;
  /** Node disabled state */
  disabled?: boolean;
  /** User notes */
  notes?: string;
  /** Additional workflow-specific properties */
  notesInFlow?: boolean;
  color?: string;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  onError?: string;
}

/**
 * Node property definition (used in API responses)
 */
export interface N8NNodeProperty {
  displayName: string;
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  options?: Array<{
    name: string;
    value: string | number | boolean;
    description?: string;
  }>;
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };
}

/**
 * Node credential definition (used in API responses)
 */
export interface N8NNodeCredential {
  name: string;
  required?: boolean;
  displayOptions?: {
    show?: Record<string, unknown[]>;
    hide?: Record<string, unknown[]>;
  };
}

/**
 * Type guards for runtime type checking
 */
export function isN8NNodeDatabase(node: unknown): node is N8NNodeDatabase {
  return node !== null && typeof node === 'object' && 'category' in node && typeof (node as { category: unknown }).category === 'string' && 'lastUpdated' in node && (node as { lastUpdated: unknown }).lastUpdated instanceof Date;
}

export function isN8NNodeAPI(node: unknown): node is N8NNodeAPI {
  return node !== null && typeof node === 'object' && 'group' in node && Array.isArray((node as { group: unknown }).group) && 'properties' in node && Array.isArray((node as { properties: unknown }).properties);
}

export function isN8NWorkflowNode(node: unknown): node is N8NWorkflowNode {
  return node !== null && typeof node === 'object' && 'id' in node && typeof (node as { id: unknown }).id === 'string' && 'position' in node && Array.isArray((node as { position: unknown }).position) && (node as { position: unknown[] }).position.length === 2;
}

/**
 * Utility functions for type conversion
 */
export function convertApiToDatabase(apiNode: N8NNodeAPI): Omit<N8NNodeDatabase, 'lastUpdated'> {
  return {
    name: apiNode.name,
    displayName: apiNode.displayName,
    description: apiNode.description,
    version: apiNode.version,
    inputs: apiNode.inputs,
    outputs: apiNode.outputs,
    category: apiNode.category ?? (apiNode.group?.[0] ?? 'Unknown'),
    icon: undefined as string | undefined, // Not provided by API
    properties: apiNode.defaults ?? {},
    credentials: apiNode.credentials?.map(c => c.name) ?? [],
    webhooks: undefined, // Would need to check properties
    polling: undefined,  // Would need to check properties
  };
}