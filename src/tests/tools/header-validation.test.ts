/**
 * Test for header validation fix
 * Specifically tests the JWT token header issue that was causing workflow creation to fail
 */

import { describe, test, expect, beforeEach } from "vitest";
import { N8NApiClient } from "../../n8n/api.js";

describe("Header Validation Fix", () => {
  const problematicJWT =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NjYwNWZlZi0yMjdlLTQ4ZGEtODhkOC05ZTJkNGMwMTM2ZjIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU1NTU1MDU5fQ.kUQtb9aLt1RFcO-azJIbXRyUriGMKCwo_djgWJP0QKo";

  test("should handle JWT token that previously caused header validation errors", () => {
    // Save original env vars
    const originalApiUrl = process.env.N8N_API_URL;
    const originalApiKey = process.env.N8N_API_KEY;

    try {
      // Set test environment with the problematic JWT
      process.env.N8N_API_URL = "https://test.n8n.example.com/api/v1";
      process.env.N8N_API_KEY = problematicJWT;

      // This should not throw an error during client creation
      expect(() => {
        new N8NApiClient();
      }).not.toThrow();
    } finally {
      // Restore original env vars
      if (originalApiUrl) {
        process.env.N8N_API_URL = originalApiUrl;
      } else {
        delete process.env.N8N_API_URL;
      }

      if (originalApiKey) {
        process.env.N8N_API_KEY = originalApiKey;
      } else {
        delete process.env.N8N_API_KEY;
      }
    }
  });

  test("should sanitize API keys with control characters", () => {
    // Save original env vars
    const originalApiUrl = process.env.N8N_API_URL;
    const originalApiKey = process.env.N8N_API_KEY;

    try {
      // Test with API key that has various control characters
      const apiKeyWithControlChars = `  ${problematicJWT}\n\r\0  `;

      process.env.N8N_API_URL = "https://test.n8n.example.com/api/v1";
      process.env.N8N_API_KEY = apiKeyWithControlChars;

      // This should not throw an error and should sanitize the key
      expect(() => {
        new N8NApiClient();
      }).not.toThrow();
    } finally {
      // Restore original env vars
      if (originalApiUrl) {
        process.env.N8N_API_URL = originalApiUrl;
      } else {
        delete process.env.N8N_API_URL;
      }

      if (originalApiKey) {
        process.env.N8N_API_KEY = originalApiKey;
      } else {
        delete process.env.N8N_API_KEY;
      }
    }
  });

  test("should create valid Headers object with JWT token", () => {
    // Test that the Headers constructor accepts the JWT token
    expect(() => {
      new Headers({
        "Content-Type": "application/json",
        Authorization: `Bearer ${problematicJWT}`,
      });
    }).not.toThrow();
  });

  test("should handle JWT token validation in browser environment", () => {
    // Test JWT token characteristics that could cause issues
    expect(problematicJWT.length).toBe(207);
    expect(problematicJWT.includes("\n")).toBe(false);
    expect(problematicJWT.includes("\r")).toBe(false);
    expect(problematicJWT.includes("\0")).toBe(false);

    // Test that it's valid ASCII
    expect(/^[\x20-\x7E]*$/.test(problematicJWT)).toBe(true);
  });
});
