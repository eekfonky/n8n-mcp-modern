/**
 * Data encryption module for n8n-MCP-Modern
 * Implements encryption for data at rest and sensitive information
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

/**
 * Encryption configuration
 */
interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  saltLength: 32,
  iterations: 100000
};

/**
 * Encrypted data structure
 */
interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
  algorithm: string;
}

/**
 * Data encryption service
 */
export class DataEncryption {
  private config: EncryptionConfig;
  private masterKey: Buffer | null = null;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize encryption with a master key
   */
  initialize(passphrase: string): void {
    const salt = this.getOrCreateSalt();
    this.masterKey = scryptSync(passphrase, salt, this.config.keyLength);
    logger.info('Encryption service initialized');
  }

  /**
   * Get or create a persistent salt
   */
  private getOrCreateSalt(): Buffer {
    const saltPath = join(process.cwd(), 'data', '.salt');
    
    if (existsSync(saltPath)) {
      return readFileSync(saltPath);
    }
    
    const salt = randomBytes(this.config.saltLength);
    writeFileSync(saltPath, salt);
    return salt;
  }

  /**
   * Encrypt data
   */
  encrypt(data: string | Buffer): EncryptedData {
    if (!this.masterKey) {
      throw new Error('Encryption not initialized');
    }

    const iv = randomBytes(this.config.ivLength);
    const salt = randomBytes(this.config.saltLength);
    const key = scryptSync(this.masterKey, salt, this.config.keyLength);
    
    const cipher = createCipheriv(this.config.algorithm, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(typeof data === 'string' ? Buffer.from(data) : data),
      cipher.final()
    ]);
    
    const authTag = (cipher as unknown as { getAuthTag(): Buffer }).getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64'),
      algorithm: this.config.algorithm
    };
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedData: EncryptedData): Buffer {
    if (!this.masterKey) {
      throw new Error('Encryption not initialized');
    }

    const key = scryptSync(
      this.masterKey,
      Buffer.from(encryptedData.salt, 'base64'),
      this.config.keyLength
    );
    
    const decipher = createDecipheriv(
      encryptedData.algorithm,
      key,
      Buffer.from(encryptedData.iv, 'base64')
    );
    
    (decipher as unknown as { setAuthTag(tag: Buffer): void }).setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData.encrypted, 'base64')),
      decipher.final()
    ]);

    return decrypted;
  }

  /**
   * Encrypt a file
   */
  encryptFile(inputPath: string, outputPath: string): void {
    const data = readFileSync(inputPath);
    const encrypted = this.encrypt(data);
    writeFileSync(outputPath, JSON.stringify(encrypted, null, 2));
    logger.info(`File encrypted: ${inputPath} -> ${outputPath}`);
  }

  /**
   * Decrypt a file
   */
  decryptFile(inputPath: string, outputPath: string): void {
    const encryptedData = JSON.parse(readFileSync(inputPath, 'utf8')) as EncryptedData;
    const decrypted = this.decrypt(encryptedData);
    writeFileSync(outputPath, decrypted);
    logger.info(`File decrypted: ${inputPath} -> ${outputPath}`);
  }

  /**
   * Secure string comparison (timing-attack resistant)
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

/**
 * SQLite encryption helper
 */
export class SQLiteEncryption {
  /**
   * Get SQLite encryption pragma commands
   */
  static getEncryptionPragma(key: string): string[] {
    return [
      `PRAGMA key = '${key}'`,
      'PRAGMA cipher_page_size = 4096',
      'PRAGMA kdf_iter = 64000',
      'PRAGMA cipher_hmac_algorithm = HMAC_SHA256',
      'PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA256'
    ];
  }

  /**
   * Check if SQLite database is encrypted
   */
  static async isDatabaseEncrypted(dbPath: string): Promise<boolean> {
    try {
      const header = readFileSync(dbPath).slice(0, 16);
      // SQLite header is "SQLite format 3\0" if unencrypted
      return !header.toString().startsWith('SQLite format 3');
    } catch {
      return false;
    }
  }
}

/**
 * Backup encryption service
 */
export class BackupEncryption {
  private encryption: DataEncryption;

  constructor(passphrase?: string) {
    this.encryption = new DataEncryption();
    if (passphrase) {
      this.encryption.initialize(passphrase);
    }
  }

  /**
   * Create encrypted backup
   */
  async createEncryptedBackup(sourcePath: string, backupPath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${backupPath}/backup-${timestamp}.enc`;
    
    try {
      this.encryption.encryptFile(sourcePath, backupFile);
      logger.info(`Encrypted backup created: ${backupFile}`);
    } catch (error) {
      logger.error('Backup encryption failed:', error);
      throw error;
    }
  }

  /**
   * Restore from encrypted backup
   */
  async restoreEncryptedBackup(backupFile: string, targetPath: string): Promise<void> {
    try {
      this.encryption.decryptFile(backupFile, targetPath);
      logger.info(`Backup restored from: ${backupFile}`);
    } catch (error) {
      logger.error('Backup restoration failed:', error);
      throw error;
    }
  }
}

/**
 * Sensitive data masking utilities
 */
export class DataMasking {
  /**
   * Mask sensitive string (show first/last few characters)
   */
  static maskString(value: string, showChars = 4): string {
    if (value.length <= showChars * 2) {
      return '*'.repeat(value.length);
    }
    
    const start = value.substring(0, showChars);
    const end = value.substring(value.length - showChars);
    const masked = '*'.repeat(Math.max(4, value.length - showChars * 2));
    
    return `${start}${masked}${end}`;
  }

  /**
   * Mask API key
   */
  static maskApiKey(apiKey: string): string {
    if (apiKey.length < 20) return '*'.repeat(apiKey.length);
    return `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}`;
  }

  /**
   * Mask email
   */
  static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return DataMasking.maskString(email);
    
    const maskedLocal = DataMasking.maskString(local ?? '', 2);
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Remove sensitive data from objects
   */
  static sanitizeObject(obj: unknown, sensitiveKeys: string[] = ['password', 'apiKey', 'secret', 'token']): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => DataMasking.sanitizeObject(item, sensitiveKeys));
    }
    
    const sanitized: Record<string, unknown> = { ...obj as Record<string, unknown> };
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = DataMasking.sanitizeObject(sanitized[key], sensitiveKeys);
      }
    }
    
    return sanitized;
  }
}

// Export singleton instance
export const dataEncryption = new DataEncryption();
export const backupEncryption = new BackupEncryption();