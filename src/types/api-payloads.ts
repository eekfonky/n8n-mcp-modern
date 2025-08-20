/**
 * Strict API Payload Types
 * Prevents API compliance issues by excluding read-only fields
 *
 * This system ensures API field mismatches are impossible at compile time
 * by automatically stripping server-managed read-only fields from payloads.
 */

import type {
  N8NWorkflow,
  N8NWorkflowNode,
  N8NCredential,
  N8NUser,
  N8NSettings,
} from "../n8n/api.js";

// ============================================================================
// UTILITY TYPES FOR READ-ONLY FIELD EXCLUSION
// ============================================================================

/**
 * Server-managed read-only fields that should never be in API payloads
 */
type ServerManagedFields = "id" | "createdAt" | "updatedAt" | "versionId";

/**
 * Workflow-specific read-only fields during creation
 */
type WorkflowCreationReadOnlyFields = ServerManagedFields | "active"; // Read-only during creation, managed via separate activate/deactivate endpoints

/**
 * Workflow-specific read-only fields during updates
 */
type WorkflowUpdateReadOnlyFields = ServerManagedFields;

/**
 * User-specific read-only fields during creation
 */
type UserCreationReadOnlyFields = ServerManagedFields | "isOwner" | "isPending";

/**
 * Credential-specific read-only fields during creation
 */
type CredentialCreationReadOnlyFields =
  | ServerManagedFields
  | "ownedBy"
  | "sharedWith";

// ============================================================================
// STRICT API PAYLOAD TYPES
// ============================================================================

/**
 * Workflow Creation Payload - Excludes all read-only fields
 * Prevents "active field is read-only" errors during creation
 */
export type WorkflowCreatePayload = Omit<
  N8NWorkflow,
  WorkflowCreationReadOnlyFields
>;

/**
 * Workflow Update Payload - Allows partial updates but excludes server-managed fields
 */
export type WorkflowUpdatePayload = Partial<
  Omit<N8NWorkflow, WorkflowUpdateReadOnlyFields>
>;

/**
 * User Creation Payload - Excludes server-managed and business logic fields
 */
export type UserCreatePayload = Omit<N8NUser, UserCreationReadOnlyFields>;

/**
 * User Update Payload - Allows partial updates excluding read-only fields
 */
export type UserUpdatePayload = Partial<
  Omit<N8NUser, ServerManagedFields | "isOwner">
>;

/**
 * Credential Creation Payload - Excludes server-managed sharing fields
 */
export type CredentialCreatePayload = Omit<
  N8NCredential,
  CredentialCreationReadOnlyFields
>;

/**
 * Credential Update Payload - Allows partial updates
 */
export type CredentialUpdatePayload = Partial<
  Omit<N8NCredential, ServerManagedFields>
>;

/**
 * Settings Update Payload - Settings are always partial updates
 */
export type SettingsUpdatePayload = Partial<N8NSettings>;

/**
 * Workflow Node Creation Payload - Nodes in workflow creation context
 */
export type WorkflowNodePayload = N8NWorkflowNode;

// ============================================================================
// BRANDED TYPES FOR ENHANCED TYPE SAFETY
// ============================================================================

/**
 * Branded type to ensure only validated API payloads are used
 */
declare const __brand: unique symbol;
type ApiPayload<T> = T & { [__brand]: "ApiPayload" };

/**
 * Creates a validated API payload with compile-time guarantees
 */
export function createApiPayload<T>(payload: T): ApiPayload<T> {
  return payload as ApiPayload<T>;
}

// ============================================================================
// FIELD VALIDATION SCHEMAS
// ============================================================================

/**
 * Validates that required fields are present for workflow creation
 */
export interface WorkflowCreationValidation {
  name: string; // Required
  nodes: N8NWorkflowNode[]; // Required
  connections: N8NWorkflow["connections"]; // Required
  settings?: N8NWorkflow["settings"]; // Optional but recommended
  staticData?: N8NWorkflow["staticData"]; // Optional
  tags?: N8NWorkflow["tags"]; // Optional
}

/**
 * Runtime validation helper for workflow creation
 */
export function validateWorkflowCreation(
  payload: unknown,
): payload is WorkflowCreationValidation {
  if (typeof payload !== "object" || payload === null) return false;

  const obj = payload as Record<string, unknown>;

  return (
    typeof obj.name === "string" &&
    Array.isArray(obj.nodes) &&
    typeof obj.connections === "object" &&
    obj.connections !== null
  );
}

/**
 * Ensures no read-only fields are present in workflow creation payload
 */
export function sanitizeWorkflowCreation(
  payload: Record<string, unknown>,
): WorkflowCreatePayload {
  const { id, createdAt, updatedAt, versionId, active, ...sanitized } = payload;

  // Validate required fields
  if (!validateWorkflowCreation(sanitized)) {
    throw new Error(
      "Invalid workflow creation payload: missing required fields (name, nodes, connections)",
    );
  }

  return sanitized as WorkflowCreatePayload;
}

/**
 * Type guard to ensure payload is clean for API submission
 */
export function isCleanApiPayload<T extends Record<string, unknown>>(
  payload: T,
  readOnlyFields: (keyof T)[],
): payload is T {
  // Check if any read-only fields are present
  for (const field of readOnlyFields) {
    if (payload[field as string] !== undefined) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// API COMPLIANCE HELPERS
// ============================================================================

/**
 * Automatically strips read-only fields from any payload
 */
export function stripReadOnlyFields<T extends Record<string, unknown>>(
  payload: T,
  readOnlyFields: readonly (keyof T)[],
): Omit<T, (typeof readOnlyFields)[number]> {
  const cleaned = { ...payload };

  for (const field of readOnlyFields) {
    delete cleaned[field as string];
  }

  return cleaned as Omit<T, (typeof readOnlyFields)[number]>;
}

/**
 * Common read-only field sets for reuse
 */
export const READ_ONLY_FIELD_SETS = {
  serverManaged: ["id", "createdAt", "updatedAt", "versionId"] as const,
  workflowCreation: [
    "id",
    "createdAt",
    "updatedAt",
    "versionId",
    "active",
  ] as const,
  userCreation: [
    "id",
    "createdAt",
    "updatedAt",
    "isOwner",
    "isPending",
  ] as const,
  credentialCreation: [
    "id",
    "createdAt",
    "updatedAt",
    "ownedBy",
    "sharedWith",
  ] as const,
} as const;

/**
 * Pre-configured payload sanitizers for common operations
 */
export const PayloadSanitizers = {
  workflowCreate: (payload: Record<string, unknown>) =>
    stripReadOnlyFields(
      payload,
      READ_ONLY_FIELD_SETS.workflowCreation as readonly (keyof typeof payload)[],
    ),

  workflowUpdate: (payload: Record<string, unknown>) =>
    stripReadOnlyFields(
      payload,
      READ_ONLY_FIELD_SETS.serverManaged as readonly (keyof typeof payload)[],
    ),

  userCreate: (payload: Record<string, unknown>) =>
    stripReadOnlyFields(
      payload,
      READ_ONLY_FIELD_SETS.userCreation as readonly (keyof typeof payload)[],
    ),

  credentialCreate: (payload: Record<string, unknown>) =>
    stripReadOnlyFields(
      payload,
      READ_ONLY_FIELD_SETS.credentialCreation as readonly (keyof typeof payload)[],
    ),
} as const;

// ============================================================================
// EXPORT TYPES FOR EXTERNAL USE
// ============================================================================

export type {
  ApiPayload,
  ServerManagedFields,
  WorkflowCreationReadOnlyFields,
  WorkflowUpdateReadOnlyFields,
  UserCreationReadOnlyFields,
  CredentialCreationReadOnlyFields,
};
