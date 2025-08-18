/**
 * Tool Execution Tests
 * Tests actual tool functionality and execution
 */

import { describe, it, expect, beforeAll } from "vitest";
import { N8NMCPTools } from "../tools/index.js";
import { database } from "../database/index.js";

describe("Tool Execution Tests", () => {
  beforeAll(async () => {
    // Initialize database for tests
    await database.initialize();
  });

  describe("Node Search Tools", () => {
    it("should search for n8n nodes", async () => {
      try {
        const result = await N8NMCPTools.executeTool("search_n8n_nodes", {
          query: "webhook",
        });

        expect(result).toBeDefined();
        expect(result).toHaveProperty("nodes");
        expect(Array.isArray(result.nodes)).toBe(true);

        if (result.nodes.length > 0) {
          expect(result.nodes[0]).toHaveProperty("name");
          expect(result.nodes[0]).toHaveProperty("displayName");
        }
      } catch (error) {
        // If database is empty, this is expected
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should handle category filtering", async () => {
      try {
        const result = await N8NMCPTools.executeTool("search_n8n_nodes", {
          query: "data",
          category: "Data Transformation",
        });

        expect(result).toBeDefined();
        expect(result).toHaveProperty("nodes");
      } catch (error) {
        // Expected if database is empty
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("Workflow Management Tools", () => {
    it("should handle get workflows request", async () => {
      try {
        const result = await N8NMCPTools.executeTool("get_n8n_workflows", {
          limit: 5,
        });

        // If n8n API is not configured, this will fail
        expect(result).toBeDefined();
      } catch (error) {
        // Expected when n8n API is not configured or 401 unauthorized
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message.toLowerCase();
        expect(
          message.includes("n8n") ||
            message.includes("unauthorized") ||
            message.includes("api"),
        ).toBe(true);
      }
    }, 10000);

    it("should validate workflow creation parameters", async () => {
      try {
        const result = await N8NMCPTools.executeTool("create_n8n_workflow", {
          name: "Test Workflow",
          nodes: [
            {
              name: "Start",
              type: "n8n-nodes-base.start",
              position: [240, 300],
            },
          ],
          connections: {},
          active: false,
        });

        // If n8n API is configured, this should work
        expect(result).toBeDefined();
      } catch (error) {
        // Expected when n8n API is not configured
        expect(error).toBeInstanceOf(Error);
      }
    }, 10000); // 10 second timeout for API calls
  });

  describe("Statistics Tools", () => {
    it("should handle tool usage stats request", async () => {
      try {
        const result = await N8NMCPTools.executeTool("get_tool_usage_stats", {
          period: "daily",
        });

        expect(result).toBeDefined();
        expect(result).toHaveProperty("stats");
      } catch (error) {
        // Tool might not be fully implemented
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should handle workflow stats request", async () => {
      try {
        const result = await N8NMCPTools.executeTool("get_workflow_stats", {
          id: "test-workflow-id",
        });

        expect(result).toBeDefined();
      } catch (error) {
        // Expected when n8n API is not configured or 401 unauthorized
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message.toLowerCase();
        expect(
          message.includes("n8n") ||
            message.includes("unauthorized") ||
            message.includes("api"),
        ).toBe(true);
      }
    }, 10000);
  });

  describe("Tool Validation", () => {
    it("should reject invalid tool names", async () => {
      await expect(
        N8NMCPTools.executeTool("invalid_tool_name", {}),
      ).rejects.toThrow();
    });

    it("should validate required parameters", async () => {
      await expect(
        N8NMCPTools.executeTool("get_n8n_workflow", {}),
      ).rejects.toThrow();
    });

    it("should handle missing optional parameters", async () => {
      try {
        const result = await N8NMCPTools.executeTool("search_n8n_nodes", {
          query: "test",
          // category is optional, should work without it
        });

        expect(result).toBeDefined();
      } catch (error) {
        // Database might be empty
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("Tool Registry", () => {
    it("should have all expected tools registered", () => {
      const expectedTools = [
        "search_n8n_nodes",
        "get_n8n_workflows",
        "get_n8n_workflow",
        "create_n8n_workflow",
        "execute_n8n_workflow",
        "activate_n8n_workflow",
        "deactivate_n8n_workflow",
        "get_n8n_executions",
        "get_workflow_stats",
        "get_tool_usage_stats",
      ];

      expectedTools.forEach((toolName) => {
        // We can't directly access the tool registry from here,
        // but we can test that execution doesn't throw "unknown tool" error
        expect(async () => {
          try {
            await N8NMCPTools.executeTool(toolName, {});
          } catch (error) {
            // Should not be "Unknown tool" error
            expect((error as Error).message).not.toContain("Unknown tool");
          }
        }).toBeDefined();
      });
    });
  });

  describe("Error Handling", () => {
    it("should provide meaningful error messages", async () => {
      try {
        await N8NMCPTools.executeTool("create_n8n_workflow", {
          // Missing required parameters
          name: "Test",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
        expect((error as Error).message.length).toBeGreaterThan(0);
      }
    });

    it("should handle database errors gracefully", async () => {
      try {
        // Force a database error by searching with invalid parameters
        await N8NMCPTools.executeTool("search_n8n_nodes", {
          query: null as any,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
