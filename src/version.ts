/**
 * Centralized version management
 * Single source of truth for package version
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

// Read version from package.json at build time
const packageJsonPath = join(process.cwd(), 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

export const VERSION = packageJson.version as string

// Validate version format
if (!VERSION || !/^\d+\.\d+\.\d+/.test(VERSION)) {
  throw new Error(`Invalid version format in package.json: ${VERSION}`)
}
