#!/usr/bin/env node
/**
 * Bundle Size Analysis for n8n-MCP Modern
 * Uses native Node.js tools for zero-dependency analysis
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

const COLORS = {
  GREEN: '\x1B[32m',
  RED: '\x1B[31m',
  YELLOW: '\x1B[33m',
  BLUE: '\x1B[34m',
  RESET: '\x1B[0m',
  BOLD: '\x1B[1m',
}

function colorLog(color, message) {
  console.log(`${color}${message}${COLORS.RESET}`)
}

function formatBytes(bytes) {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function analyzeDependencies() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const deps = packageJson.dependencies || {}
  const devDeps = packageJson.devDependencies || {}
  const optionalDeps = packageJson.optionalDependencies || {}

  console.log(`\n${COLORS.BOLD}📦 Dependency Analysis${COLORS.RESET}`)
  console.log('====================')

  console.log(`Runtime Dependencies: ${Object.keys(deps).length}`)
  Object.keys(deps).forEach((dep) => {
    console.log(`  ✅ ${dep}@${deps[dep]}`)
  })

  console.log(`\nOptional Dependencies: ${Object.keys(optionalDeps).length}`)
  Object.keys(optionalDeps).forEach((dep) => {
    console.log(`  🔧 ${dep}@${optionalDeps[dep]}`)
  })

  console.log(`\nDev Dependencies: ${Object.keys(devDeps).length}`)
  const devDepList = Object.keys(devDeps)
  if (devDepList.length <= 10) {
    devDepList.forEach((dep) => {
      console.log(`  🛠️  ${dep}`)
    })
  }
  else {
    console.log(`  🛠️  ${devDepList.slice(0, 10).join(', ')}, ... and ${devDepList.length - 10} more`)
  }

  return {
    runtime: Object.keys(deps).length,
    optional: Object.keys(optionalDeps).length,
    dev: Object.keys(devDeps).length,
  }
}

function analyzeSourceFiles() {
  const srcFiles = []

  function walkDir(dir) {
    try {
      const files = readdirSync(dir)
      for (const file of files) {
        const fullPath = join(dir, file)
        const stat = statSync(fullPath)

        if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
          walkDir(fullPath)
        }
        else if (file.endsWith('.ts') || file.endsWith('.js')) {
          srcFiles.push({
            path: fullPath,
            size: stat.size,
            type: file.endsWith('.ts') ? 'typescript' : 'javascript',
          })
        }
      }
    }
    catch (error) {
      // Directory might not exist, skip
    }
  }

  walkDir('src')
  walkDir('tests')
  walkDir('.')

  srcFiles.sort((a, b) => b.size - a.size)

  console.log(`\n${COLORS.BOLD}📄 Source File Analysis${COLORS.RESET}`)
  console.log('========================')

  const totalSize = srcFiles.reduce((sum, file) => sum + file.size, 0)
  console.log(`Total Source Size: ${formatBytes(totalSize)}`)

  const typeScript = srcFiles.filter(f => f.type === 'typescript')
  const javaScript = srcFiles.filter(f => f.type === 'javascript')

  console.log(`TypeScript files: ${typeScript.length} (${formatBytes(typeScript.reduce((s, f) => s + f.size, 0))})`)
  console.log(`JavaScript files: ${javaScript.length} (${formatBytes(javaScript.reduce((s, f) => s + f.size, 0))})`)

  console.log('\nLargest Files:')
  srcFiles.slice(0, 10).forEach((file, i) => {
    const icon = file.size > 10000 ? '🔴' : file.size > 5000 ? '🟡' : '🟢'
    console.log(`  ${icon} ${file.path.replace(`${process.cwd()}/`, '')} (${formatBytes(file.size)})`)
  })

  return { totalSize, typeScript: typeScript.length, javaScript: javaScript.length }
}

function analyzeCompiledBundle() {
  let bundleStats = {}

  try {
    const distFiles = []

    function walkDist(dir) {
      try {
        const files = readdirSync(dir)
        for (const file of files) {
          const fullPath = join(dir, file)
          const stat = statSync(fullPath)

          if (stat.isDirectory()) {
            walkDist(fullPath)
          }
          else {
            distFiles.push({
              path: fullPath,
              size: stat.size,
              type: file.split('.').pop(),
            })
          }
        }
      }
      catch (error) {
        // Directory might not exist
      }
    }

    walkDist('dist')

    if (distFiles.length > 0) {
      console.log(`\n${COLORS.BOLD}🏗️  Compiled Bundle Analysis${COLORS.RESET}`)
      console.log('=============================')

      const totalBundleSize = distFiles.reduce((sum, file) => sum + file.size, 0)
      console.log(`Total Bundle Size: ${formatBytes(totalBundleSize)}`)

      const jsFiles = distFiles.filter(f => f.type === 'js')
      const mapFiles = distFiles.filter(f => f.type === 'map')
      const otherFiles = distFiles.filter(f => f.type !== 'js' && f.type !== 'map')

      console.log(`JavaScript files: ${jsFiles.length} (${formatBytes(jsFiles.reduce((s, f) => s + f.size, 0))})`)
      if (mapFiles.length > 0) {
        console.log(`Source maps: ${mapFiles.length} (${formatBytes(mapFiles.reduce((s, f) => s + f.size, 0))})`)
      }
      if (otherFiles.length > 0) {
        console.log(`Other files: ${otherFiles.length} (${formatBytes(otherFiles.reduce((s, f) => s + f.size, 0))})`)
      }

      bundleStats = {
        totalSize: totalBundleSize,
        jsSize: jsFiles.reduce((s, f) => s + f.size, 0),
        files: distFiles.length,
      }
    }
    else {
      console.log(`\n${COLORS.YELLOW}⚠️  No compiled bundle found. Run 'npm run build' first.${COLORS.RESET}`)
    }
  }
  catch (error) {
    console.log(`\n${COLORS.YELLOW}⚠️  Bundle analysis failed: ${error.message}${COLORS.RESET}`)
  }

  return bundleStats
}

function analyzeNodeModules() {
  let nodeModulesSize = 0
  let packageCount = 0

  try {
    const nodeModulesPath = 'node_modules'
    const packages = readdirSync(nodeModulesPath)

    function getDirectorySize(dir) {
      let size = 0
      try {
        const files = readdirSync(dir)
        for (const file of files) {
          const fullPath = join(dir, file)
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            size += getDirectorySize(fullPath)
          }
          else {
            size += stat.size
          }
        }
      }
      catch (error) {
        // Skip inaccessible directories
      }
      return size
    }

    // Sample a few packages to estimate total size (full scan would be too slow)
    const samplePackages = packages.slice(0, Math.min(20, packages.length))
    let sampleSize = 0

    for (const pkg of samplePackages) {
      if (!pkg.startsWith('.')) {
        const pkgPath = join(nodeModulesPath, pkg)
        sampleSize += getDirectorySize(pkgPath)
        packageCount++
      }
    }

    // Estimate total size based on sample
    const totalPackages = packages.filter(p => !p.startsWith('.')).length
    nodeModulesSize = Math.round((sampleSize / samplePackages.length) * totalPackages)

    console.log(`\n${COLORS.BOLD}📚 node_modules Analysis${COLORS.RESET}`)
    console.log('========================')
    console.log(`Installed packages: ~${totalPackages}`)
    console.log(`Estimated total size: ${formatBytes(nodeModulesSize)} (sampled)`)
  }
  catch (error) {
    console.log(`\n${COLORS.YELLOW}⚠️  node_modules analysis failed: ${error.message}${COLORS.RESET}`)
  }

  return { size: nodeModulesSize, packages: packageCount }
}

function generateRecommendations(analysis) {
  console.log(`\n${COLORS.BOLD}💡 Optimization Recommendations${COLORS.RESET}`)
  console.log('=================================')

  const recommendations = []

  // Dependency recommendations
  if (analysis.dependencies.runtime > 5) {
    recommendations.push(`🔍 Consider reducing runtime dependencies (current: ${analysis.dependencies.runtime}, target: ≤5)`)
  }
  else {
    recommendations.push(`✅ Runtime dependencies are minimal (${analysis.dependencies.runtime}/5)`)
  }

  // Source size recommendations
  if (analysis.source.totalSize > 100000) {
    recommendations.push(`📝 Source files are large (${formatBytes(analysis.source.totalSize)}), consider refactoring`)
  }
  else {
    recommendations.push(`✅ Source size is reasonable (${formatBytes(analysis.source.totalSize)})`)
  }

  // Bundle size recommendations
  if (analysis.bundle.totalSize && analysis.bundle.totalSize > 5000000) {
    recommendations.push(`📦 Bundle is large (${formatBytes(analysis.bundle.totalSize)}), consider code splitting`)
  }
  else if (analysis.bundle.totalSize) {
    recommendations.push(`✅ Bundle size is good (${formatBytes(analysis.bundle.totalSize)})`)
  }

  // node_modules recommendations
  if (analysis.nodeModules.size > 500000000) {
    recommendations.push(`🗂️  node_modules is very large (${formatBytes(analysis.nodeModules.size)}), audit dependencies`)
  }

  recommendations.forEach(rec => console.log(`  ${rec}`))

  return recommendations
}

async function main() {
  const startTime = performance.now()

  colorLog(COLORS.BOLD, '\n📊 n8n-MCP Modern Bundle Analysis')
  colorLog(COLORS.BOLD, '==================================')

  const analysis = {
    dependencies: analyzeDependencies(),
    source: analyzeSourceFiles(),
    bundle: analyzeCompiledBundle(),
    nodeModules: analyzeNodeModules(),
  }

  const recommendations = generateRecommendations(analysis)

  // Performance targets
  console.log(`\n${COLORS.BOLD}🎯 Lightweight Targets${COLORS.RESET}`)
  console.log('=======================')

  const targets = [
    { name: 'Runtime Dependencies', value: analysis.dependencies.runtime, target: 5, unit: '' },
    { name: 'Source Size', value: analysis.source.totalSize, target: 50000, unit: 'bytes' },
    { name: 'Bundle Size', value: analysis.bundle.totalSize || 0, target: 5000000, unit: 'bytes' },
  ]

  targets.forEach((target) => {
    const status = target.value <= target.target ? '✅' : '❌'
    const valueStr = target.unit === 'bytes' ? formatBytes(target.value) : target.value
    const targetStr = target.unit === 'bytes' ? formatBytes(target.target) : target.target
    console.log(`  ${status} ${target.name}: ${valueStr} (target: ≤${targetStr})`)
  })

  const analysisTime = Math.round(performance.now() - startTime)
  console.log(`\n⏱️  Analysis completed in ${analysisTime}ms`)

  // Generate summary for CI/CD
  const summary = {
    timestamp: new Date().toISOString(),
    dependencies: analysis.dependencies.runtime,
    sourceSize: analysis.source.totalSize,
    bundleSize: analysis.bundle.totalSize || 0,
    recommendations: recommendations.length,
    analysisTime,
  }

  console.log(`\n📋 Summary: ${JSON.stringify(summary)}`)
}

main().catch(console.error)
