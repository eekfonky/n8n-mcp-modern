#!/usr/bin/env node

/**
 * Comprehensive Health Checker
 *
 * Consolidates health checking functionality from multiple scripts.
 * Provides installation integrity checks, API connectivity tests,
 * and MCP server functionality validation.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class HealthChecker {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    this.jsonOutput = process.argv.includes('--json');
    this.quick = process.argv.includes('--quick');
    this.results = {
      overall: 'unknown',
      checks: {},
      timestamp: new Date().toISOString()
    };
  }

  log(message, level = 'info') {
    if (this.jsonOutput) return;
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} ${message}`);
  }

  async exec(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        stdio: this.verbose ? 'inherit' : 'pipe',
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

  recordResult(checkName, passed, details = {}) {
    this.results.checks[checkName] = {
      passed,
      details,
      timestamp: new Date().toISOString()
    };

    if (passed) {
      this.log(`${checkName}: PASSED`, 'success');
    } else {
      this.log(`${checkName}: FAILED`, 'error');
      if (details.error) {
        this.log(`  Error: ${details.error}`, 'error');
      }
      if (details.suggestion) {
        this.log(`  Suggestion: ${details.suggestion}`, 'info');
      }
    }

    return passed;
  }

  async checkInstallationIntegrity() {
    this.log('Checking installation integrity...');

    const requiredFiles = [
      'dist/index.js',
      'agents/',
      'config-templates/',
      'package.json'
    ];

    const missingFiles = [];
    const fileDetails = {};

    for (const file of requiredFiles) {
      const fullPath = path.join(this.projectRoot, file);
      const exists = fs.existsSync(fullPath);

      fileDetails[file] = exists;
      if (!exists) {
        missingFiles.push(file);
      }
    }

    // Check main executable permissions
    const mainEntry = path.join(this.projectRoot, 'dist/index.js');
    let executableCheck = false;
    if (fs.existsSync(mainEntry)) {
      try {
        fs.accessSync(mainEntry, fs.constants.X_OK);
        executableCheck = true;
      } catch (error) {
        // Not executable
      }
    }

    const passed = missingFiles.length === 0 && executableCheck;
    return this.recordResult('installation_integrity', passed, {
      missingFiles,
      executableCheck,
      fileDetails,
      error: missingFiles.length > 0 ? `Missing files: ${missingFiles.join(', ')}` : null,
      suggestion: 'Try reinstalling with: npm run install'
    });
  }

  async checkBinaryAvailability() {
    this.log('Checking binary availability...');

    const binaryCheck = await this.exec('which n8n-mcp');
    const versionCheck = binaryCheck.success ? await this.exec('n8n-mcp --version') : { success: false };

    const passed = binaryCheck.success && versionCheck.success;
    return this.recordResult('binary_availability', passed, {
      binaryPath: binaryCheck.output,
      version: versionCheck.output,
      error: !binaryCheck.success ? 'n8n-mcp binary not found in PATH' : null,
      suggestion: 'Ensure the package is installed globally or PATH is configured'
    });
  }

  async checkDatabaseStatus() {
    this.log('Checking database status...');

    const dbPath = path.join(this.projectRoot, 'data/nodes.db');
    const exists = fs.existsSync(dbPath);
    let readable = false;
    let size = 0;

    if (exists) {
      try {
        const stats = fs.statSync(dbPath);
        size = stats.size;
        fs.accessSync(dbPath, fs.constants.R_OK);
        readable = true;
      } catch (error) {
        // Not readable
      }
    }

    const passed = exists && readable && size > 0;
    return this.recordResult('database_status', passed, {
      exists,
      readable,
      size,
      path: dbPath,
      error: !exists ? 'Database file not found' : size === 0 ? 'Database file is empty' : null,
      suggestion: exists ? 'Database will be initialized on first run' : 'Run the application to create database'
    });
  }

  async checkN8nApiConnectivity() {
    if (this.quick) {
      this.log('Skipping N8N API check (quick mode)...');
      return this.recordResult('n8n_api_connectivity', true, { skipped: true });
    }

    this.log('Checking N8N API connectivity...');

    const apiUrl = process.env.N8N_API_URL;
    const apiKey = process.env.N8N_API_KEY;

    if (!apiUrl || !apiKey) {
      return this.recordResult('n8n_api_connectivity', false, {
        error: 'N8N_API_URL or N8N_API_KEY not configured',
        suggestion: 'Set environment variables or run: npm run config'
      });
    }

    try {
      const testUrl = new URL('/api/v1/workflows', apiUrl);
      const curlCmd = `curl -s -H "X-N8N-API-KEY: ${apiKey}" "${testUrl.toString()}" --max-time 10`;
      const result = await this.exec(curlCmd);

      if (result.success) {
        // Try to parse response to verify it's valid JSON
        try {
          JSON.parse(result.output);
          return this.recordResult('n8n_api_connectivity', true, {
            apiUrl: apiUrl,
            responseLength: result.output.length
          });
        } catch (parseError) {
          return this.recordResult('n8n_api_connectivity', false, {
            error: 'Invalid JSON response from API',
            suggestion: 'Check N8N server status and API configuration'
          });
        }
      } else {
        return this.recordResult('n8n_api_connectivity', false, {
          error: `API request failed: ${result.error}`,
          suggestion: 'Verify N8N server is running and API credentials are correct'
        });
      }
    } catch (error) {
      return this.recordResult('n8n_api_connectivity', false, {
        error: `API connectivity test failed: ${error.message}`,
        suggestion: 'Check network connectivity and N8N server status'
      });
    }
  }

  async checkMcpServerFunctionality() {
    if (this.quick) {
      this.log('Skipping MCP server test (quick mode)...');
      return this.recordResult('mcp_server_functionality', true, { skipped: true });
    }

    this.log('Testing MCP server functionality...');

    try {
      // Test MCP server can start and respond
      const testResult = await this.exec('timeout 5 node dist/index.js --test-mode 2>/dev/null || echo "timeout"');

      const passed = testResult.success && !testResult.output.includes('timeout');
      return this.recordResult('mcp_server_functionality', passed, {
        testOutput: testResult.output,
        error: !passed ? 'MCP server failed to start or respond' : null,
        suggestion: 'Check application logs and configuration'
      });
    } catch (error) {
      return this.recordResult('mcp_server_functionality', false, {
        error: `MCP server test failed: ${error.message}`,
        suggestion: 'Try running: node dist/index.js manually to see detailed errors'
      });
    }
  }

  async checkAgentSystem() {
    this.log('Checking agent system...');

    const agentsDir = path.join(this.projectRoot, 'agents');
    const exists = fs.existsSync(agentsDir);
    let agentCount = 0;
    let agentFiles = [];

    if (exists) {
      try {
        const files = fs.readdirSync(agentsDir);
        agentFiles = files.filter(f => f.endsWith('.md'));
        agentCount = agentFiles.length;
      } catch (error) {
        // Directory not readable
      }
    }

    const passed = exists && agentCount > 0;
    return this.recordResult('agent_system', passed, {
      agentsDirectory: exists,
      agentCount,
      agentFiles: agentFiles.slice(0, 5), // First 5 for brevity
      error: !exists ? 'Agents directory not found' : agentCount === 0 ? 'No agent files found' : null,
      suggestion: 'Ensure agents directory contains the required agent definition files'
    });
  }

  generateRepairSuggestions() {
    const failedChecks = Object.entries(this.results.checks)
      .filter(([_, check]) => !check.passed)
      .map(([name, check]) => ({ name, ...check }));

    if (failedChecks.length === 0) {
      return [];
    }

    const suggestions = [
      '🔧 Repair Suggestions:',
      ''
    ];

    for (const check of failedChecks) {
      suggestions.push(`❌ ${check.name}:`);
      if (check.details.error) {
        suggestions.push(`   Error: ${check.details.error}`);
      }
      if (check.details.suggestion) {
        suggestions.push(`   Fix: ${check.details.suggestion}`);
      }
      suggestions.push('');
    }

    suggestions.push('General troubleshooting:');
    suggestions.push('• Run: npm run install (reinstall package)');
    suggestions.push('• Run: npm run config (reconfigure settings)');
    suggestions.push('• Check: https://github.com/eekfonky/n8n-mcp-modern/issues');

    return suggestions;
  }

  async run() {
    this.log('Starting comprehensive health check...');

    const checks = [
      this.checkInstallationIntegrity(),
      this.checkBinaryAvailability(),
      this.checkDatabaseStatus(),
      this.checkN8nApiConnectivity(),
      this.checkMcpServerFunctionality(),
      this.checkAgentSystem()
    ];

    await Promise.all(checks);

    // Calculate overall result
    const totalChecks = Object.keys(this.results.checks).length;
    const passedChecks = Object.values(this.results.checks).filter(check => check.passed).length;
    const skippedChecks = Object.values(this.results.checks).filter(check => check.details.skipped).length;

    this.results.overall = passedChecks === totalChecks ? 'healthy' :
                          passedChecks >= (totalChecks - skippedChecks) * 0.7 ? 'warning' :
                          'unhealthy';

    // Output results
    if (this.jsonOutput) {
      console.log(JSON.stringify(this.results, null, 2));
    } else {
      console.log('\n📊 Health Check Summary:');
      console.log(`Overall Status: ${this.results.overall.toUpperCase()}`);
      console.log(`Passed: ${passedChecks}/${totalChecks} checks`);

      if (this.results.overall !== 'healthy') {
        const suggestions = this.generateRepairSuggestions();
        console.log('\n' + suggestions.join('\n'));
      } else {
        console.log('\n✅ All systems are healthy and ready to use!');
      }
    }

    process.exit(this.results.overall === 'healthy' ? 0 : 1);
  }
}

// Run health checker
if (require.main === module) {
  const checker = new HealthChecker();
  checker.run().catch(error => {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  });
}

module.exports = HealthChecker;