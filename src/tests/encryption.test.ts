/**
 * Encryption Module Tests
 * Validates the encryption/decryption functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { DataEncryption } from "../server/encryption.js";

describe("Data Encryption", () => {
  let encryption: DataEncryption;
  const testSaltPath = join(process.cwd(), "data", ".salt");

  beforeEach(() => {
    // Clean up any existing salt file
    if (existsSync(testSaltPath)) {
      unlinkSync(testSaltPath);
    }
  });

  afterEach(() => {
    // Clean up test salt file
    if (existsSync(testSaltPath)) {
      unlinkSync(testSaltPath);
    }
  });

  it("should initialize with master key", () => {
    encryption = new DataEncryption();
    encryption.initialize("test-master-key-123");

    expect(encryption).toBeInstanceOf(DataEncryption);
  });

  it("should encrypt and decrypt strings correctly", () => {
    encryption = new DataEncryption();
    encryption.initialize("test-master-key-123");

    const testData = "sensitive-api-key-12345";
    const encrypted = encryption.encrypt(testData);

    // Verify encrypted data structure
    expect(encrypted).toHaveProperty("encrypted");
    expect(encrypted).toHaveProperty("iv");
    expect(encrypted).toHaveProperty("salt");
    expect(encrypted).toHaveProperty("authTag");
    expect(encrypted).toHaveProperty("algorithm");

    // Verify data is actually encrypted (different from original)
    expect(encrypted.encrypted).not.toBe(testData);

    // Verify decryption works (returns Buffer, so convert to string)
    const decrypted = encryption.decrypt(encrypted);
    expect(decrypted.toString("utf8")).toBe(testData);
  });

  it("should encrypt and decrypt buffers correctly", () => {
    encryption = new DataEncryption();
    encryption.initialize("test-master-key-123");

    const testData = Buffer.from("binary-data-test", "utf8");
    const encrypted = encryption.encrypt(testData);

    const decryptedBuffer = encryption.decrypt(encrypted);
    expect(Buffer.isBuffer(decryptedBuffer)).toBe(true);
    expect(decryptedBuffer.toString("utf8")).toBe("binary-data-test");
  });

  it("should handle different data sizes", () => {
    encryption = new DataEncryption();
    encryption.initialize("test-master-key-123");

    // Small data
    const small = "x";
    const encryptedSmall = encryption.encrypt(small);
    expect(encryption.decrypt(encryptedSmall).toString("utf8")).toBe(small);

    // Large data
    const large = "x".repeat(10000);
    const encryptedLarge = encryption.encrypt(large);
    expect(encryption.decrypt(encryptedLarge).toString("utf8")).toBe(large);
  });

  it("should create and reuse persistent salt", () => {
    // First initialization
    const encryption1 = new DataEncryption();
    encryption1.initialize("test-key");
    const encrypted1 = encryption1.encrypt("test");

    // Second initialization should reuse salt
    const encryption2 = new DataEncryption();
    encryption2.initialize("test-key");

    // Both should be able to decrypt each other's data
    const encrypted2 = encryption2.encrypt("test");

    expect(encryption1.decrypt(encrypted2).toString("utf8")).toBe("test");
    expect(encryption2.decrypt(encrypted1).toString("utf8")).toBe("test");
  });

  it("should throw error when not initialized", () => {
    const uninitializedEncryption = new DataEncryption();

    expect(() => {
      uninitializedEncryption.encrypt("test");
    }).toThrow("Encryption not initialized");
  });

  it("should throw error for invalid encrypted data", () => {
    encryption = new DataEncryption();
    encryption.initialize("test-master-key-123");

    const invalidData = {
      encrypted: "invalid",
      iv: "invalid",
      salt: "invalid",
      authTag: "invalid",
      algorithm: "aes-256-gcm",
    };

    expect(() => {
      encryption.decrypt(invalidData);
    }).toThrow();
  });

  it("should handle different master keys correctly", () => {
    const encryption1 = new DataEncryption();
    encryption1.initialize("key1");
    const encrypted = encryption1.encrypt("test-data");

    const encryption2 = new DataEncryption();
    encryption2.initialize("key2");

    // Different master key should not be able to decrypt
    expect(() => {
      encryption2.decrypt(encrypted);
    }).toThrow();
  });

  it("should validate configuration parameters", () => {
    const customConfig = {
      algorithm: "aes-256-gcm",
      keyLength: 32,
      ivLength: 16,
      saltLength: 32,
      iterations: 100000,
    };

    const encryption = new DataEncryption(customConfig);
    encryption.initialize("test-key");

    const testData = "config-test";
    const encrypted = encryption.encrypt(testData);
    const decrypted = encryption.decrypt(encrypted);

    expect(decrypted.toString("utf8")).toBe(testData);
  });
});
