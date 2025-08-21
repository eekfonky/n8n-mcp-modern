#!/usr/bin/env tsx

/**
 * Comprehensive Test Runner
 * Orchestrates all test suites with detailed reporting
 */

import { exec, spawn } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

interface TestSuite {
  name: string;
  command: string;
  timeout: number;
  critical: boolean;
  description: string;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
  coverage?: number;
}

class TestRunner {
  private results: TestResult[] = [];
  private startTime = Date.now();

  private testSuites: TestSuite[] = [
    {
      name: "Unit Tests",
      command:
        "npx vitest run src/tests/security.test.ts src/tests/tool-execution.test.ts src/tests/tools/",
      timeout: 60000,
      critical: true,
      description: "Core functionality and security tests",
    },
    {
      name: "Integration Tests",
      command:
        "npx vitest run src/tests/mcp-integration.test.ts src/tests/agent-routing.test.ts src/tests/agents/",
      timeout: 120000,
      critical: true,
      description: "MCP protocol and agent system integration",
    },
    {
      name: "Live N8N Tests",
      command: "npx vitest run src/tests/tools/n8n-integration.test.ts",
      timeout: 180000,
      critical: false,
      description: "Live n8n API integration (requires credentials)",
    },
    {
      name: "E2E Tests",
      command: "npx vitest run src/tests/e2e/",
      timeout: 300000,
      critical: true,
      description: "End-to-end server functionality",
    },
    {
      name: "Performance Benchmarks",
      command: "npx vitest run src/tests/performance/",
      timeout: 180000,
      critical: false,
      description: "Performance and benchmark tests",
    },
  ];

  async runSuite(suite: TestSuite): Promise<TestResult> {
    console.log(`\n🧪 Running ${suite.name}...`);
    console.log(`   ${suite.description}`);

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(suite.command, {
        timeout: suite.timeout,
        env: {
          ...process.env,
          NODE_ENV: "test",
          LOG_LEVEL: "error",
          DISABLE_CONSOLE_OUTPUT: "true",
        },
      });

      const duration = Date.now() - startTime;
      const passed = !stderr || !stderr.includes("FAILED");

      console.log(`   ✅ ${suite.name} completed in ${duration}ms`);

      return {
        suite: suite.name,
        passed,
        duration,
        output: stdout,
        error: stderr || undefined,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ ${suite.name} failed after ${duration}ms`);

      return {
        suite: suite.name,
        passed: false,
        duration,
        output: error.stdout || "",
        error: error.stderr || error.message,
      };
    }
  }

  async runCoverage(): Promise<void> {
    console.log("\n📊 Generating coverage report...");

    try {
      await execAsync("npx vitest run --coverage", {
        timeout: 120000,
        env: {
          ...process.env,
          NODE_ENV: "test",
        },
      });
      console.log("   ✅ Coverage report generated");
    } catch (error) {
      console.log("   ⚠️  Coverage generation failed");
    }
  }

  async buildAndTypecheck(): Promise<boolean> {
    console.log("\n🔨 Building and type checking...");

    try {
      // Type check
      await execAsync("npm run typecheck", { timeout: 60000 });
      console.log("   ✅ TypeScript validation passed");

      // Build
      await execAsync("npm run build", { timeout: 120000 });
      console.log("   ✅ Build successful");

      return true;
    } catch (error: any) {
      console.log("   ❌ Build or typecheck failed");
      console.log(`   Error: ${error.message}`);
      return false;
    }
  }

  async lint(): Promise<boolean> {
    console.log("\n🔍 Running linter...");

    try {
      await execAsync("npm run lint", { timeout: 60000 });
      console.log("   ✅ Linting passed");
      return true;
    } catch (error: any) {
      console.log("   ❌ Linting failed");
      console.log(`   Error: ${error.message}`);
      return false;
    }
  }

  async validateEnvironment(): Promise<boolean> {
    console.log("\n🔧 Validating environment...");

    const checks = [
      {
        name: "Node.js version",
        check: () =>
          process.version.startsWith("v22") ||
          process.version.startsWith("v20"),
      },
      { name: "Package.json exists", check: () => existsSync("package.json") },
      { name: "Dist directory", check: () => existsSync("dist") || true }, // Will be created by build
      { name: "Database file", check: () => existsSync("data/nodes.db") },
      { name: "Test files", check: () => existsSync("src/tests") },
    ];

    let allPassed = true;

    for (const check of checks) {
      const passed = check.check();
      console.log(`   ${passed ? "✅" : "❌"} ${check.name}`);
      if (!passed) allPassed = false;
    }

    // Check optional n8n credentials
    const hasN8NCredentials =
      process.env.N8N_API_URL && process.env.N8N_API_KEY;
    console.log(
      `   ${hasN8NCredentials ? "✅" : "⚠️ "} N8N credentials (optional for live tests)`,
    );

    return allPassed;
  }

  generateReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const criticalFailed = this.results.filter(
      (r) =>
        !r.passed && this.testSuites.find((s) => s.name === r.suite)?.critical,
    ).length;

    console.log("\n" + "=".repeat(60));
    console.log("🧪 TEST RESULTS SUMMARY");
    console.log("=".repeat(60));

    this.results.forEach((result) => {
      const suite = this.testSuites.find((s) => s.name === result.suite);
      const critical = suite?.critical ? "🔴" : "🟡";
      const status = result.passed ? "✅" : "❌";

      console.log(
        `${status} ${critical} ${result.suite} (${result.duration}ms)`,
      );

      if (!result.passed && result.error) {
        console.log(`     Error: ${result.error.substring(0, 100)}...`);
      }
    });

    console.log("\n📊 Statistics:");
    console.log(`   Total Suites: ${this.results.length}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Critical Failures: ${criticalFailed}`);
    console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    // Generate JSON report
    this.saveJsonReport();

    if (criticalFailed > 0) {
      console.log("\n❌ CRITICAL TESTS FAILED - Build should not proceed");
      process.exit(1);
    } else if (failed > 0) {
      console.log("\n⚠️  Some non-critical tests failed");
      process.exit(0);
    } else {
      console.log("\n🎉 ALL TESTS PASSED!");
      process.exit(0);
    }
  }

  saveJsonReport(): void {
    const reportDir = "test-reports";
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        total: this.results.length,
        passed: this.results.filter((r) => r.passed).length,
        failed: this.results.filter((r) => !r.passed).length,
        criticalFailed: this.results.filter(
          (r) =>
            !r.passed &&
            this.testSuites.find((s) => s.name === r.suite)?.critical,
        ).length,
      },
      suites: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        hasN8NCredentials: !!(
          process.env.N8N_API_URL && process.env.N8N_API_KEY
        ),
      },
    };

    const reportPath = join(reportDir, `test-report-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 JSON report saved: ${reportPath}`);
  }

  async run(): Promise<void> {
    console.log("🚀 Starting comprehensive test suite...\n");

    // Validate environment
    const envValid = await this.validateEnvironment();
    if (!envValid) {
      console.log("\n❌ Environment validation failed");
      process.exit(1);
    }

    // Lint code
    const lintPassed = await this.lint();
    if (!lintPassed) {
      console.log("\n❌ Linting must pass before running tests");
      process.exit(1);
    }

    // Build and typecheck
    const buildPassed = await this.buildAndTypecheck();
    if (!buildPassed) {
      console.log("\n❌ Build must succeed before running tests");
      process.exit(1);
    }

    // Run test suites
    for (const suite of this.testSuites) {
      const result = await this.runSuite(suite);
      this.results.push(result);
    }

    // Generate coverage (non-blocking)
    await this.runCoverage();

    // Generate final report
    this.generateReport();
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🧪 N8N MCP Test Runner

Usage: npm run test:all [options]

Options:
  --help, -h     Show this help message
  --coverage     Generate coverage report only
  --quick        Run only critical tests
  --live         Run only live integration tests

Test Suites:
  - Unit Tests: Core functionality and security
  - Integration Tests: MCP protocol and agents
  - Live N8N Tests: Real n8n API integration
  - E2E Tests: End-to-end server functionality
  - Performance: Benchmarks and load tests

Environment Variables:
  N8N_API_URL    - n8n instance URL for live tests
  N8N_API_KEY    - n8n API key for live tests
  LOG_LEVEL      - Logging level (default: error for tests)
    `);
    process.exit(0);
  }

  if (args.includes("--coverage")) {
    execAsync("npx vitest run --coverage")
      .then(() => {
        console.log("Coverage report generated");
        process.exit(0);
      })
      .catch((error) => {
        console.error("Coverage generation failed:", error);
        process.exit(1);
      });
  }

  const runner = new TestRunner();

  if (args.includes("--quick")) {
    runner["testSuites"] = runner["testSuites"].filter((s) => s.critical);
  }

  if (args.includes("--live")) {
    runner["testSuites"] = runner["testSuites"].filter(
      (s) => s.name === "Live N8N Tests",
    );
  }

  runner.run().catch(console.error);
}

export default TestRunner;
