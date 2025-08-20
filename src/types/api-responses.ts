/**
 * Runtime API Response Validation Schemas
 * Ensures incoming n8n API responses match expected structures
 *
 * This system provides bulletproof protection against:
 * - API contract changes
 * - Malformed responses
 * - Version compatibility issues
 * - Unexpected data structures
 */

import { z } from "zod";

// ============================================================================
// BASE FIELD SCHEMAS - Reusable validation components
// ============================================================================

/**
 * ISO DateTime string with transformation
 */
const DateTimeSchema = z
  .string()
  .datetime()
  .describe("ISO 8601 datetime string");

/**
 * Non-empty ID string
 */
const IdSchema = z.string().min(1).describe("Non-empty identifier string");

/**
 * Non-empty name string
 */
const NameSchema = z.string().min(1).describe("Non-empty name string");

/**
 * Boolean with string coercion
 */
const BooleanSchema = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === "string") {
      return val.toLowerCase() === "true" || val === "1";
    }
    return val;
  })
  .describe("Boolean value with string coercion");

/**
 * Number with string coercion
 */
const NumberSchema = z
  .union([z.number(), z.string()])
  .transform((val) => {
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      if (isNaN(parsed)) {
        throw new Error(`Cannot convert "${val}" to number`);
      }
      return parsed;
    }
    return val;
  })
  .describe("Number with string coercion");

// ============================================================================
// CORE ENTITY RESPONSE SCHEMAS
// ============================================================================

/**
 * Workflow Node Response Schema
 */
export const N8NWorkflowNodeResponseSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  type: z.string().min(1).describe("Node type identifier"),
  typeVersion: NumberSchema,
  position: z.tuple([z.number(), z.number()]).describe("Node position [x, y]"),
  parameters: z.record(z.unknown()).describe("Node parameters"),
  credentials: z.record(z.string()).optional(),
  disabled: BooleanSchema.optional(),
  notes: z.string().optional(),
  notesInFlow: BooleanSchema.optional(),
  color: z.string().optional(),
  continueOnFail: BooleanSchema.optional(),
  alwaysOutputData: BooleanSchema.optional(),
  executeOnce: BooleanSchema.optional(),
  retryOnFail: BooleanSchema.optional(),
  maxTries: NumberSchema.optional(),
  waitBetweenTries: NumberSchema.optional(),
  onError: z
    .enum(["stopWorkflow", "continueRegularOutput", "continueErrorOutput"])
    .optional(),
});

/**
 * Workflow Response Schema
 */
export const N8NWorkflowResponseSchema = z.object({
  id: IdSchema.optional(),
  name: NameSchema,
  active: BooleanSchema,
  nodes: z.array(N8NWorkflowNodeResponseSchema),
  connections: z
    .record(
      z.record(
        z.array(
          z.array(
            z.object({
              node: z.string(),
              type: z.string(),
              index: NumberSchema,
            }),
          ),
        ),
      ),
    )
    .describe("Node connections structure"),
  settings: z.record(z.unknown()).optional(),
  staticData: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  versionId: z.string().optional(),
  createdAt: DateTimeSchema.optional(),
  updatedAt: DateTimeSchema.optional(),
});

/**
 * Execution Response Schema
 */
export const N8NExecutionResponseSchema = z.object({
  id: IdSchema,
  finished: BooleanSchema,
  mode: z.string().describe("Execution mode"),
  retryOf: z.string().optional(),
  retrySuccessId: z.string().optional(),
  startedAt: DateTimeSchema,
  stoppedAt: DateTimeSchema.optional(),
  workflowId: IdSchema,
  data: z.record(z.unknown()).optional().describe("Execution result data"),
});

/**
 * Credential Response Schema
 */
export const N8NCredentialResponseSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  type: z.string().min(1).describe("Credential type"),
  data: z
    .record(z.unknown())
    .optional()
    .describe("Credential data (may be redacted)"),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  ownedBy: z.string().optional(),
  sharedWith: z.array(z.string()).optional(),
});

/**
 * User Response Schema
 */
export const N8NUserResponseSchema = z.object({
  id: IdSchema,
  email: z.string().email().describe("User email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().describe("User role"),
  isOwner: BooleanSchema,
  isPending: BooleanSchema,
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});

/**
 * Node Property Schema
 */
const N8NNodePropertyResponseSchema = z.object({
  displayName: z.string(),
  name: z.string(),
  type: z.string(),
  required: BooleanSchema.optional(),
  default: z.unknown().optional(),
  description: z.string().optional(),
  options: z
    .array(
      z.object({
        name: z.string(),
        value: z.unknown(),
      }),
    )
    .optional(),
});

/**
 * Node Credential Schema
 */
const N8NNodeCredentialResponseSchema = z.object({
  name: z.string(),
  required: BooleanSchema.optional(),
  displayOptions: z.record(z.unknown()).optional(),
});

/**
 * Node Type Response Schema
 */
export const N8NNodeTypeResponseSchema = z.object({
  name: z.string().min(1).describe("Node type name"),
  displayName: z.string().min(1).describe("Human readable name"),
  description: z.string().describe("Node description"),
  version: NumberSchema,
  defaults: z.record(z.unknown()).optional(),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  properties: z.array(N8NNodePropertyResponseSchema),
  credentials: z.array(N8NNodeCredentialResponseSchema).optional(),
  group: z.array(z.string()),
  category: z.string().optional(),
});

/**
 * Settings Response Schema
 */
export const N8NSettingsResponseSchema = z.object({
  endpointWebhook: z.string().url().describe("Webhook endpoint URL"),
  endpointWebhookWaiting: z
    .string()
    .url()
    .describe("Webhook waiting endpoint URL"),
  saveDataErrorExecution: z
    .string()
    .describe("Error execution data saving policy"),
  saveDataSuccessExecution: z
    .string()
    .describe("Success execution data saving policy"),
  saveManualExecutions: BooleanSchema,
  timezone: z.string().describe("System timezone"),
  urlBaseWebhook: z.string().url().describe("Base webhook URL"),
});

/**
 * Health Status Response Schema
 */
export const N8NHealthStatusResponseSchema = z.object({
  status: z.enum(["ok", "error"]).describe("Overall health status"),
  database: z.object({
    status: z.enum(["ok", "error"]),
    latency: NumberSchema.optional(),
  }),
  redis: z
    .object({
      status: z.enum(["ok", "error"]),
      latency: NumberSchema.optional(),
    })
    .optional(),
});

// ============================================================================
// COLLECTION/WRAPPER RESPONSE SCHEMAS
// ============================================================================

/**
 * Generic API Response Wrapper
 */
export const N8NApiResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
): z.ZodObject<{
  data: T;
  nextCursor: z.ZodOptional<z.ZodString>;
}> =>
  z.object({
    data: dataSchema,
    nextCursor: z.string().optional(),
  });

/**
 * Workflow List Response Schema
 */
export const WorkflowListResponseSchema = N8NApiResponseSchema(
  z.array(N8NWorkflowResponseSchema),
);

/**
 * Execution List Response Schema
 */
export const ExecutionListResponseSchema = N8NApiResponseSchema(
  z.array(N8NExecutionResponseSchema),
);

/**
 * Credential List Response Schema
 */
export const CredentialListResponseSchema = N8NApiResponseSchema(
  z.array(N8NCredentialResponseSchema),
);

/**
 * Node Type List Response Schema
 */
export const NodeTypeListResponseSchema = N8NApiResponseSchema(
  z.array(N8NNodeTypeResponseSchema),
);

/**
 * User List Response Schema
 */
export const UserListResponseSchema = N8NApiResponseSchema(
  z.array(N8NUserResponseSchema),
);

// ============================================================================
// SPECIALIZED RESPONSE SCHEMAS
// ============================================================================

/**
 * Version Info Response Schema
 */
export const VersionInfoResponseSchema = z.object({
  version: z.string().describe("n8n version string"),
  build: z.string().optional().describe("Build identifier"),
});

/**
 * Workflow Stats Response Schema
 */
export const WorkflowStatsResponseSchema = z.object({
  executions: NumberSchema.describe("Total execution count"),
  successRate: NumberSchema.describe("Success rate percentage"),
  avgExecutionTime: NumberSchema.describe("Average execution time in ms"),
  lastExecution: DateTimeSchema.optional().describe("Last execution timestamp"),
});

/**
 * Tag List Response Schema
 */
export const TagListResponseSchema = z.array(z.string());

/**
 * Tag Create Response Schema
 */
export const TagCreateResponseSchema = z.object({
  id: IdSchema,
  name: NameSchema,
});

/**
 * Success Response Schema (for operations that return simple success)
 */
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
});

// ============================================================================
// ERROR RESPONSE SCHEMAS
// ============================================================================

/**
 * API Error Response Schema
 */
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().describe("Error code"),
    message: z.string().describe("Error message"),
    details: z.unknown().optional().describe("Additional error details"),
  }),
  success: z.literal(false).optional(),
});

/**
 * Validation Error Response Schema
 */
export const ValidationErrorResponseSchema = z.object({
  error: z.object({
    code: z.literal("VALIDATION_ERROR"),
    message: z.string(),
    fields: z.record(z.array(z.string())).optional(),
  }),
});

// ============================================================================
// UNION AND POLYMORPHIC SCHEMAS
// ============================================================================

/**
 * Generic Success or Error Response
 */
export const SuccessOrErrorResponseSchema = z.union([
  SuccessResponseSchema,
  ApiErrorResponseSchema,
]);

/**
 * Any Workflow Operation Response
 */
export const WorkflowOperationResponseSchema = z.union([
  N8NWorkflowResponseSchema,
  ApiErrorResponseSchema,
]);

/**
 * Any Execution Operation Response
 */
export const ExecutionOperationResponseSchema = z.union([
  N8NExecutionResponseSchema,
  ApiErrorResponseSchema,
]);

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export const ResponseSchemas = {
  // Core entities
  workflow: N8NWorkflowResponseSchema,
  workflowNode: N8NWorkflowNodeResponseSchema,
  execution: N8NExecutionResponseSchema,
  credential: N8NCredentialResponseSchema,
  user: N8NUserResponseSchema,
  nodeType: N8NNodeTypeResponseSchema,
  settings: N8NSettingsResponseSchema,
  healthStatus: N8NHealthStatusResponseSchema,

  // Collections
  workflowList: WorkflowListResponseSchema,
  executionList: ExecutionListResponseSchema,
  credentialList: CredentialListResponseSchema,
  nodeTypeList: NodeTypeListResponseSchema,
  userList: UserListResponseSchema,

  // Specialized
  versionInfo: VersionInfoResponseSchema,
  workflowStats: WorkflowStatsResponseSchema,
  tagList: TagListResponseSchema,
  tagCreate: TagCreateResponseSchema,
  success: SuccessResponseSchema,

  // Errors
  apiError: ApiErrorResponseSchema,
  validationError: ValidationErrorResponseSchema,

  // Unions
  successOrError: SuccessOrErrorResponseSchema,
  workflowOperation: WorkflowOperationResponseSchema,
  executionOperation: ExecutionOperationResponseSchema,
} as const;

// Type exports for external use
export type N8NWorkflowResponse = z.infer<typeof N8NWorkflowResponseSchema>;
export type N8NExecutionResponse = z.infer<typeof N8NExecutionResponseSchema>;
export type N8NCredentialResponse = z.infer<typeof N8NCredentialResponseSchema>;
export type N8NUserResponse = z.infer<typeof N8NUserResponseSchema>;
export type N8NNodeTypeResponse = z.infer<typeof N8NNodeTypeResponseSchema>;
export type N8NSettingsResponse = z.infer<typeof N8NSettingsResponseSchema>;
export type N8NHealthStatusResponse = z.infer<
  typeof N8NHealthStatusResponseSchema
>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type WorkflowStatsResponse = z.infer<typeof WorkflowStatsResponseSchema>;
