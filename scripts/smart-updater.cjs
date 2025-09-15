#!/usr/bin/env node

/**
 * Smart Updater
 *
 * Simplified auto-update utility with user consent and safe update strategies.
 * Replaces the complex 369-line auto-update.cjs with user-friendly approach.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class SmartUpdater {
  constructor() {
    this.packageName = '@eekfonky/n8n-mcp-modern';
    this.projectRoot = path.resolve(__dirname, '..');
    this.interactive = !process.argv.includes('--non-interactive');
    this.force = process.argv.includes('--force');
    this.dryRun = process.argv.includes('--dry-run');
    this.autoConsent = process.argv.includes('--auto-consent');
    this.currentVersion = null;
    this.latestVersion = null;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warning' ? '⚠️' : 'ℹ️';
    const dryRunPrefix = this.dryRun ? '[DRY RUN] ' : '';
    console.log(`${prefix} ${dryRunPrefix}[${timestamp}] ${message}`);
  }

  async exec(command, options = {}) {
    try {
      if (this.dryRun && (command.includes('npm install') || command.includes('npm update'))) {
        this.log(`Would execute: ${command}`, 'info');
        return { success: true, output: 'dry-run-simulation' };
      }

      const result = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        ...options
      });
      return { success: true, output: result.trim() };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: (error.stdout || error.stderr || '').trim()
      };
    }
  }

  prompt(question) {
    if (!this.interactive || this.autoConsent) return true;

    process.stdout.write(`${question} (y/n): `);
    const response = require('child_process').execSync('read -r line; echo "$line"', {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit']
    }).trim().toLowerCase();

    return response === 'y' || response === 'yes';
  }

  async getCurrentVersion() {
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        this.currentVersion = pkg.version;
        return pkg.version;
      }

      // Try to get version from installed package
      const result = await this.exec(`npm list ${this.packageName} --depth=0`);
      if (result.success) {
        const match = result.output.match(/@([0-9]+\.[0-9]+\.[0-9]+[^\s]*)/);
        if (match) {
          this.currentVersion = match[1];
          return match[1];
        }
      }
    } catch (error) {
      // Ignore errors
    }

    this.log('Could not determine current version', 'warning');
    return 'unknown';
  }

  async getLatestVersion() {
    this.log('Checking for latest version...');

    try {
      const result = await this.exec(`npm view ${this.packageName} version`);
      if (result.success) {
        this.latestVersion = result.output.trim();
        return this.latestVersion;
      }
    } catch (error) {
      this.log(`Failed to check latest version: ${error.message}`, 'error');
    }

    return null;
  }

  compareVersions(current, latest) {
    if (current === 'unknown') return 'unknown';

    try {
      const currentParts = current.split('.').map(n => parseInt(n, 10));
      const latestParts = latest.split('.').map(n => parseInt(n, 10));

      for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;

        if (currentPart < latestPart) return 'outdated';
        if (currentPart > latestPart) return 'newer';
      }

      return 'current';
    } catch (error) {
      this.log(`Version comparison failed: ${error.message}`, 'warning');
      return 'unknown';
    }
  }

  async createBackup() {
    if (this.dryRun) {
      this.log('Would create backup before update', 'info');
      return true;
    }

    this.log('Creating backup before update...');

    try {
      const backupDir = path.join(this.projectRoot, 'update-backups');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `pre-update-${timestamp}`);

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Backup critical files
      const filesToBackup = [
        'package.json',
        'package-lock.json',
        'config-templates',
        '.env'
      ];

      let backedUpCount = 0;
      for (const file of filesToBackup) {
        const sourcePath = path.join(this.projectRoot, file);
        if (fs.existsSync(sourcePath)) {
          const destPath = path.join(backupPath, file);
          const destDir = path.dirname(destPath);

          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          if (fs.statSync(sourcePath).isDirectory()) {
            await this.exec(`cp -r "${sourcePath}" "${destPath}"`);
          } else {
            fs.copyFileSync(sourcePath, destPath);
          }
          backedUpCount++;
        }
      }

      if (backedUpCount > 0) {
        this.log(`Backup created: ${backupPath}`, 'success');
        return backupPath;
      } else {
        this.log('No files to backup', 'info');
        return true;
      }

    } catch (error) {
      this.log(`Backup creation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async performUpdate() {
    this.log('Performing package update...');

    try {
      // Determine if globally or locally installed
      const globalCheck = await this.exec(`npm list -g ${this.packageName}`);
      const isGlobal = globalCheck.success;

      const updateCommand = isGlobal
        ? `npm update -g ${this.packageName}`
        : `npm update ${this.packageName}`;

      const result = await this.exec(updateCommand);

      if (result.success) {
        this.log('Package updated successfully!', 'success');
        return true;
      } else {
        this.log(`Update failed: ${result.error}`, 'error');
        return false;
      }

    } catch (error) {
      this.log(`Update execution failed: ${error.message}`, 'error');
      return false;
    }
  }

  async verifyUpdate() {
    if (this.dryRun) {
      this.log('Would verify update success', 'info');
      return true;
    }

    this.log('Verifying update...');

    try {
      // Check new version
      const newVersion = await this.getCurrentVersion();
      if (newVersion && newVersion !== this.currentVersion) {
        this.log(`Update verified: ${this.currentVersion} → ${newVersion}`, 'success');

        // Basic functionality test
        const testResult = await this.exec('n8n-mcp --version');
        if (testResult.success) {
          this.log('Functionality test passed', 'success');
          return true;
        } else {
          this.log('Functionality test failed', 'warning');
          return false;
        }
      } else {
        this.log('Version unchanged after update', 'warning');
        return false;
      }

    } catch (error) {
      this.log(`Update verification failed: ${error.message}`, 'error');
      return false;
    }
  }

  async rollback(backupPath) {
    if (!backupPath || this.dryRun) {
      this.log('Rollback not available or in dry-run mode', 'warning');
      return false;
    }

    this.log('Rolling back update...');

    try {
      // Restore backed up files
      const result = await this.exec(`cp -r "${backupPath}/"* "${this.projectRoot}/"`);

      if (result.success) {
        this.log('Rollback completed', 'success');
        return true;
      } else {
        this.log(`Rollback failed: ${result.error}`, 'error');
        return false;
      }

    } catch (error) {
      this.log(`Rollback execution failed: ${error.message}`, 'error');
      return false;
    }
  }

  async checkUpdateConsent() {
    if (this.force || this.autoConsent) return true;

    console.log('\n🔄 Update Available');
    console.log(`Current version: ${this.currentVersion}`);
    console.log(`Latest version: ${this.latestVersion}`);
    console.log('');

    const consent = this.prompt('Proceed with update?');
    if (!consent) {
      this.log('Update cancelled by user', 'info');
      return false;
    }

    const backupConsent = this.prompt('Create backup before update?');
    return { update: true, backup: backupConsent };
  }

  async run() {
    this.log('Starting smart update check...');

    try {
      // Get current version
      const currentVersion = await this.getCurrentVersion();
      this.log(`Current version: ${currentVersion}`);

      // Get latest version
      const latestVersion = await this.getLatestVersion();
      if (!latestVersion) {
        this.log('Could not check for updates. Please try again later.', 'error');
        process.exit(1);
      }

      this.log(`Latest version: ${latestVersion}`);

      // Compare versions
      const comparison = this.compareVersions(currentVersion, latestVersion);

      if (comparison === 'current') {
        this.log('You are already running the latest version!', 'success');
        return;
      }

      if (comparison === 'newer') {
        this.log('You are running a newer version than released', 'info');
        if (!this.force) return;
      }

      if (comparison === 'outdated' || this.force) {
        // Get user consent
        const consent = await this.checkUpdateConsent();
        if (!consent) return;

        let backupPath = null;

        // Create backup if requested
        if (typeof consent === 'object' && consent.backup) {
          backupPath = await this.createBackup();
          if (!backupPath) {
            this.log('Backup failed. Update cancelled for safety.', 'error');
            return;
          }
        }

        // Perform update
        const updateSuccess = await this.performUpdate();

        if (updateSuccess) {
          // Verify update
          const verifySuccess = await this.verifyUpdate();

          if (verifySuccess) {
            this.log('Update completed successfully!', 'success');
            this.log('Please restart any running MCP clients to use the new version.', 'info');

            // Run health check if available
            const healthScript = path.join(__dirname, 'health-checker.cjs');
            if (fs.existsSync(healthScript)) {
              this.log('Running post-update health check...', 'info');
              await this.exec(`node ${healthScript} --quick`);
            }

          } else {
            this.log('Update verification failed!', 'error');

            if (backupPath && this.prompt('Rollback to previous version?')) {
              await this.rollback(backupPath);
            }
          }

        } else {
          this.log('Update failed!', 'error');

          if (backupPath && this.prompt('Rollback changes?')) {
            await this.rollback(backupPath);
          }
        }

      } else {
        this.log('Version status unknown. Use --force to update anyway.', 'warning');
      }

    } catch (error) {
      this.log(`Update process failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Command line interface
if (require.main === module) {
  const updater = new SmartUpdater();
  updater.run().catch(error => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
}

module.exports = SmartUpdater;