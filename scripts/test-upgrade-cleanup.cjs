#!/usr/bin/env node
/**
 * Test script to verify upgrade cleanup behavior
 * Creates test files and directories to simulate upgrade scenarios
 */

const fs = require('node:fs')
const path = require('node:path')
const { performUpgradeCleanup } = require('./upgrade-cleanup.cjs')

function createTestFiles() {
  const packageRoot = path.join(__dirname, '..')

  // Create test legacy files
  const testFiles = [
    { path: 'data/nodes.db-wal', content: 'test wal file' },
    { path: 'data/nodes.db-shm', content: 'test shm file' },
    { path: '.n8n-mcp.config.old', content: 'old config' },
    { path: 'data/legacy-nodes.db', content: 'legacy db' },
    { path: 'dist/temp/old-build.js', content: 'old build artifact' },
    { path: 'agents/README-old.md', content: '# Old README' },
    { path: '.npmrc.old', content: 'registry=old-registry' },
  ]

  console.log('🔧 Creating test files for upgrade cleanup simulation...')

  for (const file of testFiles) {
    const fullPath = path.join(packageRoot, file.path)
    const dir = path.dirname(fullPath)

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Create test file
    fs.writeFileSync(fullPath, file.content)
    console.log(`   ✅ Created: ${file.path}`)
  }

  console.log('\n🧪 Running upgrade cleanup...')
  return testFiles.map(f => path.join(packageRoot, f.path))
}

function verifyCleanup(expectedFiles) {
  console.log('\n🔍 Verifying cleanup results...')

  let cleaned = 0
  let remaining = 0

  for (const filePath of expectedFiles) {
    const relativePath = path.relative(path.join(__dirname, '..'), filePath)

    if (!fs.existsSync(filePath)) {
      console.log(`   ✅ Cleaned: ${relativePath}`)
      cleaned++
    }
    else {
      console.log(`   ❌ Remaining: ${relativePath}`)
      remaining++
    }
  }

  console.log(`\n📊 Results: ${cleaned} cleaned, ${remaining} remaining`)
  return { cleaned, remaining }
}

function runUpgradeCleanupTest() {
  console.log('🚀 Starting n8n-MCP Modern upgrade cleanup test\n')

  try {
    // Phase 1: Create test files
    const testFiles = createTestFiles()

    // Phase 2: Run cleanup
    const results = performUpgradeCleanup()

    // Phase 3: Verify results
    const verification = verifyCleanup(testFiles)

    // Phase 4: Summary
    console.log('\n📋 Test Summary:')
    console.log(`   SQLite cleanup: ${results.sqlite.cleaned ? 'PASS' : 'N/A'}`)
    console.log(`   Legacy cleanup: ${results.legacy.cleaned ? 'PASS' : 'N/A'}`)
    console.log(`   Cache cleanup: ${results.cache.cleaned ? 'PASS' : 'N/A'}`)
    console.log(`   Database validation: ${results.database.valid ? 'PASS' : 'FAIL'}`)
    console.log(`   Config migration: ${results.config.migrated ? 'PASS' : 'N/A'}`)

    const testPassed = verification.cleaned > 0 && results.database.valid
    console.log(`\n🎯 Overall Test Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`)

    return testPassed
  }
  catch (error) {
    console.error(`\n❌ Test failed with error: ${error.message}`)
    return false
  }
}

// Run test if called directly
if (require.main === module) {
  const success = runUpgradeCleanupTest()
  process.exit(success ? 0 : 1)
}

module.exports = { runUpgradeCleanupTest }
