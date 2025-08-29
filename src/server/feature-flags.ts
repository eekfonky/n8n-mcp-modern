/**
 * Feature Flags for n8n-MCP Modern Optimization
 *
 * Enables/disables features during the optimization process to safely
 * test performance improvements and architecture changes.
 *
 * Philosophy: Progressive feature rollback with safety mechanisms
 */

import process from 'node:process'
import { logger } from './logger.js'

export interface FeatureFlags {
  // Intelligence Layer Controls
  intelligenceLayer: {
    enabled: boolean
    complexityAssessment: boolean
    intentClassification: boolean
    nodeRecommendations: boolean
    templateSuggestions: boolean
  }

  // Performance Optimizations
  performance: {
    enableDebouncing: boolean
    useSimplifiedRouting: boolean
    limitMetricsArrays: boolean
    enableCaching: boolean
    useMcpSdkBuiltins: boolean
  }

  // Architecture Simplifications
  architecture: {
    useSimplifiedToolPipeline: boolean
    enableLegacyAgentRouting: boolean
    reducedMonitoring: boolean
    skipComplexAnalysis: boolean
  }

  // Safety & Debugging
  debugging: {
    logPerformanceComparisons: boolean
    enableRollbackTriggers: boolean
    validateFunctionality: boolean
  }
}

/**
 * Production-safe default configuration
 * Gradually disables complex features for optimization
 */
const DEFAULT_FLAGS: FeatureFlags = {
  intelligenceLayer: {
    enabled: true, // Start with intelligence enabled, gradually disable
    complexityAssessment: true,
    intentClassification: true,
    nodeRecommendations: true,
    templateSuggestions: true,
  },
  performance: {
    enableDebouncing: false, // Will enable in Phase 3
    useSimplifiedRouting: false, // Will enable in Phase 2
    limitMetricsArrays: false, // Will enable in Phase 2
    enableCaching: false, // Will enable in Phase 3
    useMcpSdkBuiltins: false, // Will enable in Phase 3
  },
  architecture: {
    useSimplifiedToolPipeline: false, // Will enable in Phase 2
    enableLegacyAgentRouting: false, // Fallback option
    reducedMonitoring: false, // Will enable in Phase 2
    skipComplexAnalysis: false, // Will enable in Phase 2
  },
  debugging: {
    logPerformanceComparisons: true, // Always enabled during optimization
    enableRollbackTriggers: true, // Safety mechanism
    validateFunctionality: true, // Always validate
  },
}

/**
 * Environment-based feature flag configuration
 */
function loadFeatureFlags(): FeatureFlags {
  const envOverrides = {
    // Intelligence Layer Environment Overrides
    DISABLE_INTELLIGENCE: process.env.DISABLE_INTELLIGENCE === 'true',
    DISABLE_COMPLEXITY_ASSESSMENT: process.env.DISABLE_COMPLEXITY_ASSESSMENT === 'true',

    // Performance Environment Overrides
    ENABLE_SIMPLIFIED_ROUTING: process.env.ENABLE_SIMPLIFIED_ROUTING === 'true',
    ENABLE_PIPELINE_OPTIMIZATION: process.env.ENABLE_PIPELINE_OPTIMIZATION === 'true',
    LIMIT_MEMORY_ARRAYS: process.env.LIMIT_MEMORY_ARRAYS === 'true',

    // Architecture Environment Overrides
    USE_LEGACY_ROUTING: process.env.USE_LEGACY_ROUTING === 'true',
    ENABLE_REDUCED_MONITORING: process.env.ENABLE_REDUCED_MONITORING === 'true',

    // Debugging Environment Overrides
    DISABLE_PERFORMANCE_LOGGING: process.env.DISABLE_PERFORMANCE_LOGGING === 'true',
  }

  const flags: FeatureFlags = {
    intelligenceLayer: {
      enabled: !envOverrides.DISABLE_INTELLIGENCE,
      complexityAssessment: !envOverrides.DISABLE_COMPLEXITY_ASSESSMENT,
      intentClassification: !envOverrides.DISABLE_INTELLIGENCE,
      nodeRecommendations: !envOverrides.DISABLE_INTELLIGENCE,
      templateSuggestions: !envOverrides.DISABLE_INTELLIGENCE,
    },
    performance: {
      enableDebouncing: DEFAULT_FLAGS.performance.enableDebouncing,
      useSimplifiedRouting: envOverrides.ENABLE_SIMPLIFIED_ROUTING,
      limitMetricsArrays: envOverrides.LIMIT_MEMORY_ARRAYS,
      enableCaching: DEFAULT_FLAGS.performance.enableCaching,
      useMcpSdkBuiltins: DEFAULT_FLAGS.performance.useMcpSdkBuiltins,
    },
    architecture: {
      useSimplifiedToolPipeline: envOverrides.ENABLE_PIPELINE_OPTIMIZATION,
      enableLegacyAgentRouting: envOverrides.USE_LEGACY_ROUTING,
      reducedMonitoring: envOverrides.ENABLE_REDUCED_MONITORING,
      skipComplexAnalysis: envOverrides.ENABLE_SIMPLIFIED_ROUTING || envOverrides.DISABLE_INTELLIGENCE,
    },
    debugging: {
      logPerformanceComparisons: !envOverrides.DISABLE_PERFORMANCE_LOGGING,
      enableRollbackTriggers: DEFAULT_FLAGS.debugging.enableRollbackTriggers,
      validateFunctionality: DEFAULT_FLAGS.debugging.validateFunctionality,
    },
  }

  return flags
}

// Global feature flags instance
export const featureFlags: FeatureFlags = loadFeatureFlags()

/**
 * Phase-specific configurations for systematic optimization
 */
export const PHASE_CONFIGURATIONS = {
  // Phase 2: SIMPLIFICATION
  phase2: {
    ...DEFAULT_FLAGS,
    intelligenceLayer: {
      enabled: false, // Disable intelligence layer
      complexityAssessment: false,
      intentClassification: false,
      nodeRecommendations: false,
      templateSuggestions: false,
    },
    architecture: {
      useSimplifiedToolPipeline: true, // Reduce pipeline complexity
      enableLegacyAgentRouting: false,
      reducedMonitoring: true, // Reduce monitoring overhead
      skipComplexAnalysis: true, // Skip complex routing analysis
    },
    performance: {
      ...DEFAULT_FLAGS.performance,
      limitMetricsArrays: true, // Prevent memory leaks
    },
  },

  // Phase 3: MODERNIZATION
  phase3: {
    ...DEFAULT_FLAGS,
    intelligenceLayer: {
      enabled: false, // Keep intelligence disabled
      complexityAssessment: false,
      intentClassification: false,
      nodeRecommendations: false,
      templateSuggestions: false,
    },
    performance: {
      enableDebouncing: true, // Enable MCP SDK optimizations
      useSimplifiedRouting: true,
      limitMetricsArrays: true,
      enableCaching: true,
      useMcpSdkBuiltins: true,
    },
    architecture: {
      useSimplifiedToolPipeline: true,
      enableLegacyAgentRouting: false,
      reducedMonitoring: true,
      skipComplexAnalysis: true,
    },
  },

  // Phase 4: SELECTIVE ENHANCEMENT
  phase4: {
    ...DEFAULT_FLAGS,
    intelligenceLayer: {
      enabled: false, // Intelligence layer remains simplified
      complexityAssessment: false,
      intentClassification: false,
      nodeRecommendations: true, // Re-enable basic node recommendations only
      templateSuggestions: false,
    },
    performance: {
      enableDebouncing: true,
      useSimplifiedRouting: true,
      limitMetricsArrays: true,
      enableCaching: true,
      useMcpSdkBuiltins: true,
    },
    architecture: {
      useSimplifiedToolPipeline: true,
      enableLegacyAgentRouting: false,
      reducedMonitoring: false, // Re-enable comprehensive monitoring
      skipComplexAnalysis: true, // Keep analysis simple
    },
  },
} as const

/**
 * Apply phase-specific configuration
 */
export function applyPhaseConfiguration(phase: keyof typeof PHASE_CONFIGURATIONS): void {
  const phaseConfig = PHASE_CONFIGURATIONS[phase]
  Object.assign(featureFlags, phaseConfig)

  logger.info(`Applied ${phase} configuration:`, {
    intelligenceEnabled: featureFlags.intelligenceLayer.enabled,
    simplifiedPipeline: featureFlags.architecture.useSimplifiedToolPipeline,
    reducedMonitoring: featureFlags.architecture.reducedMonitoring,
  })
}

/**
 * Runtime feature flag helpers
 */
export const isIntelligenceEnabled = (): boolean => featureFlags.intelligenceLayer.enabled
export const isSimplifiedPipelineEnabled = (): boolean => featureFlags.architecture.useSimplifiedToolPipeline
export const shouldLimitMemoryArrays = (): boolean => featureFlags.performance.limitMetricsArrays
export const shouldUseReducedMonitoring = (): boolean => featureFlags.architecture.reducedMonitoring

/**
 * Performance comparison logging
 */
export function logPerformanceComparison(
  operation: string,
  beforeTime: number,
  afterTime: number,
  details?: Record<string, unknown>,
): void {
  if (!featureFlags.debugging.logPerformanceComparisons)
    return

  const improvement = ((beforeTime - afterTime) / beforeTime * 100).toFixed(1)
  logger.info(`🚀 Performance: ${operation}`, {
    before: `${beforeTime.toFixed(2)}ms`,
    after: `${afterTime.toFixed(2)}ms`,
    improvement: `${improvement}%`,
    ...details,
  })
}

export default featureFlags
