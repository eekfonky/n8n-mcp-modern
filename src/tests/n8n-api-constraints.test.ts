/**
 * Test n8n API Constraints Compliance
 * Ensures workflow creation follows n8n API rules (active parameter is read-only)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { N8NMCPTools } from "../tools/index.js";
import * as n8nApiModule from "../n8n/api.js";

// Mock the n8n API
vi.mock("../n8n/api.js", () => ({
  n8nApi: {
    createWorkflow: vi.fn(),
    activateWorkflow: vi.fn(),
  },
}));

// Mock the database
vi.mock("../database/index.js", () => ({
  database: {
    recordToolUsage: vi.fn(),
  },
}));

describe("n8n API Constraints Compliance", () => {
  const mockCreateWorkflow = vi.fn();
  const mockActivateWorkflow = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockCreateWorkflow.mockResolvedValue({
      id: "test-workflow-id",
      active: false,
    });
    mockActivateWorkflow.mockResolvedValue({
      id: "test-workflow-id",
      active: true,
    });

    // Mock the n8nApi object
    vi.mocked(n8nApiModule).n8nApi = {
      createWorkflow: mockCreateWorkflow,
      activateWorkflow: mockActivateWorkflow,
    } as any;
  });

  it("should create workflow without active parameter (CRITICAL n8n API constraint)", async () => {
    const testArgs = {
      name: "Test Workflow",
      nodes: [
        {
          id: "test-node",
          name: "Test Node",
          type: "n8n-nodes-base.start",
          typeVersion: 1,
          position: [100, 200],
          parameters: {},
        },
      ],
      connections: {},
      active: true, // This should NOT be passed to createWorkflow
    };

    // Execute the tool
    await N8NMCPTools.executeTool("create_n8n_workflow", testArgs);

    // Verify createWorkflow was called WITHOUT active parameter
    expect(mockCreateWorkflow).toHaveBeenCalledWith({
      name: "Test Workflow",
      nodes: expect.any(Array),
      connections: {},
      settings: expect.any(Object),
      // CRITICAL: active should NOT be here
    });

    // Verify the call arguments don't contain 'active'
    const createWorkflowArgs = mockCreateWorkflow.mock.calls[0][0];
    expect(createWorkflowArgs).not.toHaveProperty("active");

    // Verify separate activation call was made
    expect(mockActivateWorkflow).toHaveBeenCalledWith("test-workflow-id");
  });

  it("should skip activation when active=false", async () => {
    const testArgs = {
      name: "Test Workflow Inactive",
      nodes: [
        {
          id: "test-node",
          name: "Test Node",
          type: "n8n-nodes-base.start",
          typeVersion: 1,
          position: [100, 200],
          parameters: {},
        },
      ],
      connections: {},
      active: false,
    };

    await N8NMCPTools.executeTool("create_n8n_workflow", testArgs);

    // Verify createWorkflow was called
    expect(mockCreateWorkflow).toHaveBeenCalled();

    // Verify activation was NOT called
    expect(mockActivateWorkflow).not.toHaveBeenCalled();
  });

  it("should handle workflow creation when active parameter is omitted", async () => {
    const testArgs = {
      name: "Test Workflow No Active",
      nodes: [
        {
          id: "test-node",
          name: "Test Node",
          type: "n8n-nodes-base.start",
          typeVersion: 1,
          position: [100, 200],
          parameters: {},
        },
      ],
      connections: {},
      // active parameter omitted entirely
    };

    await N8NMCPTools.executeTool("create_n8n_workflow", testArgs);

    // Verify createWorkflow was called
    expect(mockCreateWorkflow).toHaveBeenCalled();

    // Verify activation was NOT called (since active was undefined)
    expect(mockActivateWorkflow).not.toHaveBeenCalled();
  });

  it("should preserve all other workflow properties correctly", async () => {
    const testArgs = {
      name: "Complex Test Workflow",
      nodes: [
        {
          id: "node1",
          name: "Start Node",
          type: "n8n-nodes-base.start",
          typeVersion: 1,
          position: [100, 200],
          parameters: { test: "value" },
          disabled: true,
          notes: "Test notes",
          color: "#ff6b6b",
        },
      ],
      connections: {
        node1: { main: [[{ node: "node2", type: "main", index: 0 }]] },
      },
      settings: {
        saveDataErrorExecution: "none",
        timezone: "UTC",
      },
      staticData: { test: "data" },
      tags: ["test", "automation"],
      active: true,
    };

    await N8NMCPTools.executeTool("create_n8n_workflow", testArgs);

    // Verify all properties except 'active' were passed correctly
    const createWorkflowArgs = mockCreateWorkflow.mock.calls[0][0];

    expect(createWorkflowArgs).toEqual({
      name: "Complex Test Workflow",
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: "node1",
          name: "Start Node",
          disabled: true,
          notes: "Test notes",
          color: "#ff6b6b",
        }),
      ]),
      connections: testArgs.connections,
      settings: expect.objectContaining({
        saveDataErrorExecution: "none",
        timezone: "UTC",
      }),
      staticData: { test: "data" },
      tags: ["test", "automation"],
    });

    // Confirm 'active' is still not present
    expect(createWorkflowArgs).not.toHaveProperty("active");

    // Verify separate activation
    expect(mockActivateWorkflow).toHaveBeenCalledWith("test-workflow-id");
  });
});
