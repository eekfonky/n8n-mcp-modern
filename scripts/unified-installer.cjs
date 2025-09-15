#!/usr/bin/env node

/**
 * Unified N8N MCP Modern Installer
 *
 * Provides multiple installation strategies with automatic fallbacks:
 * 1. Primary: Install from npmjs.org (no authentication required)
 * 2. Fallback: Install from GitHub Packages (with authentication)
 * 3. Emergency: Install from source (git clone + build)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class UnifiedInstaller {
  constructor() {
    this.packageName = '@eekfonky/n8n-mcp-modern';
    this.githubRepo = 'https://github.com/eekfonky/n8n-mcp-modern.git';
    this.isGlobal = process.argv.includes('--global') || process.argv.includes('-g');
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    this.skipHealth = process.argv.includes('--skip-health');
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async exec(command, options = {}) {
    if (this.verbose) {
      this.log(`Executing: ${command}`, 'info');
    }

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: this.verbose ? 'inherit' : 'pipe',
        ...options
      });
      return { success: true, output: result };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || error.stderr
      };
    }
  }

  async checkInstallation() {
    this.log('Checking existing installation...');

    const globalCheck = await this.exec('npm list -g @eekfonky/n8n-mcp-modern');
    const localCheck = await this.exec('npm list @eekfonky/n8n-mcp-modern');

    if (globalCheck.success || localCheck.success) {
      this.log('Existing installation found. Use --force to reinstall.', 'info');
      return true;
    }

    return false;
  }

  async installFromNpmjs() {
    this.log('Attempting installation from npmjs.org...');

    const installCmd = this.isGlobal
      ? `npm install -g ${this.packageName}`
      : `npm install ${this.packageName}`;

    const result = await this.exec(installCmd);

    if (result.success) {
      this.log('Successfully installed from npmjs.org!', 'success');
      return true;
    } else {
      this.log(`NPM installation failed: ${result.error}`, 'error');
      return false;
    }
  }

  async installFromGithub() {
    this.log('Attempting fallback installation from GitHub Packages...');

    // Check for GitHub authentication
    const authCheck = await this.exec('npm whoami --registry=https://npm.pkg.github.com');
    if (!authCheck.success) {
      this.log('GitHub Packages requires authentication. Please run:', 'error');
      this.log('npm login --registry=https://npm.pkg.github.com', 'info');
      return false;
    }

    const installCmd = this.isGlobal
      ? `npm install -g ${this.packageName} --registry=https://npm.pkg.github.com`
      : `npm install ${this.packageName} --registry=https://npm.pkg.github.com`;

    const result = await this.exec(installCmd);

    if (result.success) {
      this.log('Successfully installed from GitHub Packages!', 'success');
      return true;
    } else {
      this.log(`GitHub installation failed: ${result.error}`, 'error');
      return false;
    }
  }

  async installFromSource() {
    this.log('Attempting emergency installation from source...');

    const tempDir = path.join(os.tmpdir(), 'n8n-mcp-modern-install');

    try {
      // Clean up any existing temp directory
      if (fs.existsSync(tempDir)) {
        await this.exec(`rm -rf ${tempDir}`);
      }

      // Clone repository
      this.log('Cloning repository...');
      const cloneResult = await this.exec(`git clone ${this.githubRepo} ${tempDir}`);
      if (!cloneResult.success) {
        throw new Error(`Failed to clone repository: ${cloneResult.error}`);
      }

      // Install dependencies and build
      this.log('Building from source...');
      const buildResult = await this.exec('npm install && npm run build', { cwd: tempDir });
      if (!buildResult.success) {
        throw new Error(`Failed to build: ${buildResult.error}`);
      }

      // Install the built package
      const installCmd = this.isGlobal
        ? `npm install -g ${tempDir}`
        : `npm install ${tempDir}`;

      const installResult = await this.exec(installCmd);
      if (!installResult.success) {
        throw new Error(`Failed to install built package: ${installResult.error}`);
      }

      this.log('Successfully installed from source!', 'success');
      return true;

    } catch (error) {
      this.log(`Source installation failed: ${error.message}`, 'error');
      return false;
    } finally {
      // Cleanup
      if (fs.existsSync(tempDir)) {
        await this.exec(`rm -rf ${tempDir}`);
      }
    }
  }

  async performHealthCheck() {
    if (this.skipHealth) {
      this.log('Skipping health check as requested.');
      return true;
    }

    this.log('Performing installation health check...');

    try {
      // Check if binary is available
      const binaryCheck = await this.exec('which n8n-mcp');
      if (!binaryCheck.success) {
        this.log('Warning: n8n-mcp binary not found in PATH', 'error');
        return false;
      }

      // Test basic functionality
      const testResult = await this.exec('n8n-mcp --version');
      if (testResult.success) {
        this.log('Health check passed!', 'success');
        return true;
      } else {
        this.log('Health check failed: Binary not responding properly', 'error');
        return false;
      }
    } catch (error) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  async setupMcpConfig() {
    this.log('Setting up MCP configuration...');

    // Check if config-manager script exists
    const configScript = path.join(__dirname, 'config-manager.cjs');
    if (fs.existsSync(configScript)) {
      const configResult = await this.exec(`node ${configScript} --setup`);
      if (configResult.success) {
        this.log('MCP configuration setup completed!', 'success');
      } else {
        this.log('MCP configuration setup failed. Run manually with: npm run config', 'error');
      }
    } else {
      this.log('Config manager not found. Please run: npm run config', 'info');
    }
  }

  async install() {
    this.log(`Starting unified installation (${this.isGlobal ? 'global' : 'local'})...`);

    // Check for existing installation
    if (!process.argv.includes('--force')) {
      const exists = await this.checkInstallation();
      if (exists) return;
    }

    // Try installation strategies in order
    const strategies = [
      { name: 'npmjs.org', method: this.installFromNpmjs.bind(this) },
      { name: 'GitHub Packages', method: this.installFromGithub.bind(this) },
      { name: 'Source', method: this.installFromSource.bind(this) }
    ];

    for (const strategy of strategies) {
      this.log(`Trying installation strategy: ${strategy.name}...`);
      const success = await strategy.method();

      if (success) {
        // Perform health check
        const healthy = await this.performHealthCheck();
        if (healthy) {
          // Setup MCP configuration
          await this.setupMcpConfig();

          this.log('Installation completed successfully!', 'success');
          this.log('Next steps:', 'info');
          this.log('1. Run: npm run config (to setup MCP configuration)', 'info');
          this.log('2. Run: npm run health (to verify installation)', 'info');
          this.log('3. Add to your MCP client configuration', 'info');
          return;
        }
      }

      this.log(`${strategy.name} installation failed, trying next strategy...`, 'error');
    }

    this.log('All installation strategies failed!', 'error');
    this.log('Please check the error messages above and try again.', 'error');
    this.log('For support, visit: https://github.com/eekfonky/n8n-mcp-modern/issues', 'info');
    process.exit(1);
  }
}

// Run installer
if (require.main === module) {
  const installer = new UnifiedInstaller();
  installer.install().catch(error => {
    console.error('❌ Installation failed:', error);
    process.exit(1);
  });
}

module.exports = UnifiedInstaller;