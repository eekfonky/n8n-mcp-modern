/**
 * Core unified interfaces for n8n node types
 *
 * This file consolidates the conflicting N8NNode interfaces that were spread
 * across database/index.ts, n8n/api.ts, and types/index.ts to prevent
 * type confusion and unsafe casting.
 */

/**
 * Core properties shared by all n8n node representations
 * Enhanced with TypeScript 5.9+ const type parameters for better inference
 */
export interface N8NNodeCore {
  /** Unique node type identifier (e.g., 'n8n-nodes-base.httpRequest') */
  readonly name: string
  /** Human-readable display name */
  readonly displayName: string
  /** Node description/purpose */
  readonly description: string
  /** Node type version */
  readonly version: number
  /** Input connection types */
  readonly inputs: readonly string[]
  /** Output connection types */
  readonly outputs: readonly string[]
}

/**
 * Database-specific node representation (for local storage)
 * Used by DatabaseManager for SQLite operations
 */
export interface N8NNodeDatabase extends N8NNodeCore {
  /** Node category for database indexing */
  category: string
  /** Optional icon reference */
  icon?: string | undefined
  /** Node properties (parsed from JSON) */
  properties: Record<string, unknown>
  /** Required credentials (parsed from JSON) */
  credentials?: string[]
  /** Supports webhooks */
  webhooks?: boolean | undefined
  /** Supports polling */
  polling?: boolean | undefined
  /** Last database update timestamp */
  lastUpdated: Date
}

/**
 * API response node representation (from n8n instance)
 * Used by N8NApiClient for live node discovery
 */
export interface N8NNodeAPI extends N8NNodeCore {
  /** Node group categories */
  group: string[]
  /** Optional primary category */
  category?: string
  /** Default parameter values */
  defaults?: Record<string, unknown>
  /** Structured property definitions */
  properties: N8NNodeProperty[]
  /** Available credential types */
  credentials?: N8NNodeCredential[]
}

/**
 * Workflow instance node representation (in actual workflows)
 * Used for workflow creation/editing
 */
export interface N8NWorkflowNode {
  /** Unique node ID within workflow */
  id: string
  /** User-assigned node name */
  name: string
  /** Node type identifier */
  type: string
  /** Node type version */
  typeVersion: number
  /** Visual position [x, y] */
  position: [number, number]
  /** Node configuration parameters */
  parameters: Record<string, unknown>
  /** Assigned credential IDs */
  credentials?: Record<string, string>
  /** Node disabled state */
  disabled?: boolean
  /** User notes */
  notes?: string
  /** Additional workflow-specific properties */
  notesInFlow?: boolean
  color?: string
  continueOnFail?: boolean
  alwaysOutputData?: boolean
  executeOnce?: boolean
  retryOnFail?: boolean
  maxTries?: number
  waitBetweenTries?: number
  onError?: string
}

/**
 * Node property definition (used in API responses)
 */
export interface N8NNodeProperty {
  displayName: string
  name: string
  type: string
  required?: boolean
  default?: unknown
  description?: string
  options?: Array<{
    name: string
    value: string | number | boolean
    description?: string
  }>
  displayOptions?: {
    show?: Record<string, unknown[]>
    hide?: Record<string, unknown[]>
  }
}

/**
 * Node credential definition (used in API responses)
 */
export interface N8NNodeCredential {
  name: string
  required?: boolean
  displayOptions?: {
    show?: Record<string, unknown[]>
    hide?: Record<string, unknown[]>
  }
}

/**
 * Type guards for runtime type checking with TypeScript 5.9+ enhanced narrowing
 */
export function isN8NNodeDatabase(node: unknown): node is N8NNodeDatabase {
  if (node === null || typeof node !== 'object')
    return false

  // Use `satisfies` operator for better type checking
  const candidate = node as Record<string, unknown>

  return 'category' in candidate
    && typeof candidate.category === 'string'
    && 'lastUpdated' in candidate
    && candidate.lastUpdated instanceof Date
    && 'name' in candidate
    && typeof candidate.name === 'string'
    && 'properties' in candidate
    && typeof candidate.properties === 'object'
}

export function isN8NNodeAPI(node: unknown): node is N8NNodeAPI {
  if (node === null || typeof node !== 'object')
    return false

  const candidate = node as Record<string, unknown>

  return 'group' in candidate
    && Array.isArray(candidate.group)
    && candidate.group.every((item): item is string => typeof item === 'string')
    && 'properties' in candidate
    && Array.isArray(candidate.properties)
    && 'name' in candidate
    && typeof candidate.name === 'string'
}

export function isN8NWorkflowNode(node: unknown): node is N8NWorkflowNode {
  if (node === null || typeof node !== 'object')
    return false

  const candidate = node as Record<string, unknown>

  return 'id' in candidate
    && typeof candidate.id === 'string'
    && 'position' in candidate
    && Array.isArray(candidate.position)
    && candidate.position.length === 2
    && candidate.position.every((coord): coord is number => typeof coord === 'number')
    && 'type' in candidate
    && typeof candidate.type === 'string'
}

/**
 * Utility functions for type conversion with TypeScript 5.9+ enhancements
 */
export function convertApiToDatabase(apiNode: N8NNodeAPI): Omit<N8NNodeDatabase, 'lastUpdated'> {
  // Use const assertion for better type inference
  const result = {
    name: apiNode.name,
    displayName: apiNode.displayName,
    description: apiNode.description,
    version: apiNode.version,
    inputs: [...apiNode.inputs] as const,
    outputs: [...apiNode.outputs] as const,
    category: apiNode.category ?? (apiNode.group?.[0] ?? 'Unknown'),
    icon: undefined as string | undefined,
    properties: apiNode.defaults ? { ...apiNode.defaults } : {},
    credentials: apiNode.credentials?.map(c => c.name) ?? ([] as const),
    webhooks: undefined as boolean | undefined,
    polling: undefined as boolean | undefined,
  } as const satisfies Omit<N8NNodeDatabase, 'lastUpdated'>

  // Return mutable version for database operations
  return { ...result }
}

/**
 * Template literal type for n8n node type patterns with TypeScript 5.9+ improvements
 */
export type N8NNodeTypePattern = `${'n8n-nodes-base' | '@n8n' | string}.${string}`

/**
 * Discriminated union helper for better type narrowing
 */
export type N8NNodeVariant
  = | { type: 'database', node: N8NNodeDatabase }
    | { type: 'api', node: N8NNodeAPI }
    | { type: 'workflow', node: N8NWorkflowNode }

/**
 * Enhanced helper function using discriminated unions
 */
export function createNodeVariant<T extends N8NNodeVariant['type']>(
  type: T,
  node: T extends 'database' ? N8NNodeDatabase
    : T extends 'api' ? N8NNodeAPI
      : N8NWorkflowNode,
): Extract<N8NNodeVariant, { type: T }> {
  return { type, node } as Extract<N8NNodeVariant, { type: T }>
}
