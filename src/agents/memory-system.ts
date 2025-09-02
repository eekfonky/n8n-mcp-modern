/**
 * Agent Memory System - Semantic search and knowledge management
 * Implements A-MEM inspired memory architecture with Zettelkasten linking
 * Phase 2 Section 2.2: Memory System Implementation
 */

import type { AgentMemory, MemoryRelationship } from '../database/dynamic-agent-db.js'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { DynamicAgentDB } from '../database/dynamic-agent-db.js'

// Memory system configuration schema
const MemorySystemConfigSchema = z.object({
  maxMemoriesPerAgent: z.number().min(100).max(10000).default(5000),
  semanticSearchThreshold: z.number().min(0.1).max(1.0).default(0.7),
  memoryDecayRate: z.number().min(0.01).max(0.99).default(0.95),
  relationshipStrengthThreshold: z.number().min(0.1).max(1.0).default(0.5),
  enableAutoLinking: z.boolean().default(true),
  vectorDimensions: z.number().min(128).max(1024).default(384),
})

type MemorySystemConfig = z.infer<typeof MemorySystemConfigSchema>

// Memory creation input schema
const CreateMemoryInputSchema = z.object({
  agentName: z.string().min(1),
  memoryType: z.enum([
    // Core workflow patterns
    'workflow_pattern',
    'workflow_template',
    'workflow_snippet',
    'node_configuration',
    'node_pattern',
    'integration_pattern',

    // User interaction patterns
    'user_preference',
    'user_query',
    'user_feedback',
    'user_context',

    // Problem solving patterns
    'error_solution',
    'troubleshooting_guide',
    'debug_strategy',
    'workaround_solution',

    // Knowledge and learning
    'discovery_result',
    'knowledge_base',
    'learning_outcome',
    'best_practice',
    'anti_pattern',

    // Performance and optimization
    'performance_insight',
    'optimization_rule',
    'efficiency_tip',
    'resource_usage',

    // Security and validation
    'validation_rule',
    'security_pattern',
    'credential_pattern',
    'permission_rule',

    // Collaboration and delegation
    'delegation_outcome',
    'collaboration_pattern',
    'team_preference',
    'handoff_instruction',

    // Testing and development
    'test_pattern',
    'test_case',
    'test_data',
    'mock_configuration',

    // API and integration specific
    'api_pattern',
    'webhook_pattern',
    'connection_config',
    'data_mapping',

    // Monitoring and analytics
    'usage_pattern',
    'metric_definition',
    'alert_rule',
    'dashboard_config',

    // Legacy test support
    'response_format',
    'performance_test',
    'load_test',
  ]),
  content: z.string().min(10),
  tags: z.array(z.string()).optional(),
  parentMemoryId: z.number().optional(),
  expiresAt: z.date().optional(),
})

type CreateMemoryInput = z.infer<typeof CreateMemoryInputSchema>

// Semantic search result with relevance scoring
interface SemanticSearchResult {
  memory: AgentMemory
  relevanceScore: number
  relationshipCount: number
  lastAccessedDays: number
}

// Memory evolution tracking
interface MemoryEvolution {
  memoryId: number
  evolutionType: 'strengthened' | 'weakened' | 'linked' | 'superseded'
  reason: string
  confidence: number
  timestamp: Date
}

/**
 * Advanced Memory System for Dynamic Agents
 *
 * Features:
 * - Semantic search with vector embeddings
 * - Automatic memory relationship discovery
 * - Memory evolution and strengthening
 * - Zettelkasten-style knowledge linking
 * - Performance analytics and insights
 */
export class AgentMemorySystem {
  private db: DynamicAgentDB
  private config: MemorySystemConfig
  private evolutionLog: MemoryEvolution[] = []
  private embeddingCache = new Map<string, number[]>()
  private static readonly CACHE_MAX_SIZE = 1000
  private static readonly CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

  constructor(db: DynamicAgentDB, config?: Partial<MemorySystemConfig>) {
    this.db = db
    this.config = MemorySystemConfigSchema.parse(config ?? {})
  }

  /**
   * Store a new memory with automatic semantic processing
   */
  async storeMemory(input: CreateMemoryInput): Promise<number> {
    // Validate input
    const validatedInput = CreateMemoryInputSchema.parse(input)

    // Generate content hash for deduplication
    const contentHash = createHash('sha256')
      .update(validatedInput.content)
      .digest('hex')

    // Create embeddings for semantic search (mock implementation)
    const embeddings = await this.generateEmbeddings(validatedInput.content)

    // Prepare memory object
    const memory: AgentMemory = {
      agentName: validatedInput.agentName,
      memoryType: validatedInput.memoryType,
      content: validatedInput.content,
      contentHash,
      embeddings,
      tags: validatedInput.tags ?? [],
      relevanceScore: 1.0,
      usageCount: 0,
      parentMemoryId: validatedInput.parentMemoryId ?? undefined,
      relatedMemoryIds: [],
      expiresAt: validatedInput.expiresAt ?? undefined,
    }

    // Store in database
    const memoryId = await this.db.storeMemory(memory)

    // Auto-link to related memories if enabled
    if (this.config.enableAutoLinking) {
      await this.autoLinkMemory(memoryId, memory)
    }

    // Log memory creation
    this.logEvolution(memoryId, 'strengthened', 'Memory created', 1.0)

    return memoryId
  }

  /**
   * Semantic search across agent memories
   */
  async searchMemories(
    agentName: string,
    query: string,
    options: {
      memoryTypes?: AgentMemory['memoryType'][]
      minRelevance?: number
      limit?: number
      includeSimilar?: boolean
    } = {},
  ): Promise<SemanticSearchResult[]> {
    // Generate query embeddings
    const queryEmbeddings = await this.generateEmbeddings(query)

    // Search database with semantic scoring
    const searchOptions: Record<string, unknown> = {}
    if (options.memoryTypes?.[0]) {
      searchOptions.memoryType = options.memoryTypes[0]
    }
    searchOptions.limit = options.limit ?? 20
    searchOptions.minRelevance = options.minRelevance ?? this.config.semanticSearchThreshold

    const memories = await this.db.queryMemories(agentName, query, searchOptions)

    // Calculate semantic similarity and enrich results
    const results: SemanticSearchResult[] = []

    for (const memory of memories) {
      const memoryEmbeddings = Array.isArray(memory.embeddings)
        ? memory.embeddings
        : memory.embeddings
          ? Array.from(memory.embeddings)
          : []

      let relevanceScore = this.calculateSemanticSimilarity(
        queryEmbeddings,
        memoryEmbeddings,
      )

      // Fallback: If embeddings are not available (either array empty), use the database relevance score
      // This ensures that text-matched results from database queries are not filtered out
      if (queryEmbeddings.length === 0 || memoryEmbeddings.length === 0) {
        relevanceScore = memory.relevanceScore || 1.0
      }

      // Enhanced fallback: If semantic score is low but we got this result from FTS text search,
      // use a combination of semantic score and database relevance to ensure text matches aren't filtered out
      if (relevanceScore < (options.minRelevance ?? this.config.semanticSearchThreshold) && (memory.relevanceScore ?? 0) >= 1.0) {
        // Give significant weight to database text matching for FTS results
        relevanceScore = Math.max(relevanceScore, (options.minRelevance ?? this.config.semanticSearchThreshold) * 1.1)
      }

      // Use the lower of configured threshold or user-specified threshold
      const effectiveThreshold = Math.min(
        this.config.semanticSearchThreshold,
        options.minRelevance ?? this.config.semanticSearchThreshold,
      )

      if (relevanceScore >= effectiveThreshold) {
        // Get relationship count for this memory (sequential by design for semantic search)
        // eslint-disable-next-line no-await-in-loop
        const relationshipCount = memory.id ? await this.getMemoryRelationshipCount(memory.id) : 0

        // Calculate days since last access
        const lastAccessedDays = memory.lastAccessed
          ? Math.floor((Date.now() - memory.lastAccessed.getTime()) / (1000 * 60 * 60 * 24))
          : 0

        results.push({
          memory,
          relevanceScore,
          relationshipCount,
          lastAccessedDays,
        })

        // Update usage tracking (sequential by design for semantic consistency)
        if (memory.id) {
          // eslint-disable-next-line no-await-in-loop
          await this.updateMemoryUsage(memory.id)
        }
      }
    }

    // Sort by relevance and relationship strength
    results.sort((a, b) => {
      const scoreA = a.relevanceScore + (a.relationshipCount * 0.1)
      const scoreB = b.relevanceScore + (b.relationshipCount * 0.1)
      return scoreB - scoreA
    })

    return results.slice(0, options.limit ?? 20)
  }

  /**
   * Create relationships between memories
   */
  async linkMemories(
    sourceId: number,
    targetId: number,
    relationshipType: MemoryRelationship['relationshipType'],
    strength: number = 1.0,
    createdBy: string,
  ): Promise<void> {
    const relationship: MemoryRelationship = {
      sourceMemoryId: sourceId,
      targetMemoryId: targetId,
      relationshipType,
      strength: Math.max(0.1, Math.min(1.0, strength)),
      createdBy,
    }

    await this.db.createMemoryRelationship(relationship)

    // Log relationship creation
    this.logEvolution(sourceId, 'linked', `Linked to memory ${targetId} with ${relationshipType}`, strength)
  }

  /**
   * Get related memories using Zettelkasten-style traversal
   */
  async getRelatedMemories(
    memoryId: number,
    depth: number = 2,
    minStrength: number = 0.5,
  ): Promise<AgentMemory[]> {
    const visited = new Set<number>()
    const related: AgentMemory[] = []

    await this.traverseMemoryGraph(memoryId, depth, minStrength, visited, related)

    return related
  }

  /**
   * Strengthen memory based on usage patterns
   */
  async strengthenMemory(memoryId: number, factor: number = 1.1): Promise<void> {
    const memory = await this.db.getMemoryById(memoryId)
    if (!memory)
      return

    const newRelevance = Math.min(1.0, (memory.relevanceScore ?? 1.0) * factor)
    await this.db.updateMemoryRelevance(memoryId, newRelevance)

    this.logEvolution(memoryId, 'strengthened', `Relevance updated from ${memory.relevanceScore} to ${newRelevance}`, factor)
  }

  /**
   * Memory consolidation - merge similar memories
   */
  async consolidateMemories(agentName: string): Promise<number> {
    const allMemories = await this.db.queryMemories(agentName, '', { limit: 1000 })
    const consolidated = new Set<number>()
    let mergeCount = 0

    for (const memory of allMemories) {
      if (!memory.id || consolidated.has(memory.id))
        continue

      // Find similar memories (sequential by design for consolidation integrity)
      // eslint-disable-next-line no-await-in-loop
      const similar = await this.findSimilarMemories(memory, 0.9)

      if (similar.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await this.mergeSimilarMemories(memory, similar)
        similar.forEach((sim) => {
          if (sim.id) {
            consolidated.add(sim.id)
          }
        })
        mergeCount++
      }
    }

    return mergeCount
  }

  /**
   * Get memory analytics for an agent
   */
  async getMemoryAnalytics(agentName: string): Promise<{
    totalMemories: number
    memoryTypeDistribution: Record<string, number>
    averageRelevance: number
    topTags: Array<{ tag: string, count: number }>
    relationshipStats: {
      totalRelationships: number
      strongRelationships: number
      averageStrength: number
    }
    evolutionSummary: Record<string, number>
  }> {
    const memories = await this.db.queryMemories(agentName, '', { limit: 10000 })

    // Memory type distribution
    const typeDistribution: Record<string, number> = {}
    let totalRelevance = 0
    const tagCounts: Record<string, number> = {}

    for (const memory of memories) {
      typeDistribution[memory.memoryType] = (typeDistribution[memory.memoryType] ?? 0) + 1
      totalRelevance += memory.relevanceScore ?? 0

      for (const tag of memory.tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }

    // Top tags
    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    // Relationship statistics
    const relationshipStats = await this.getRelationshipStatistics(agentName)

    // Evolution summary
    const evolutionSummary: Record<string, number> = {}
    for (const evolution of this.evolutionLog) {
      evolutionSummary[evolution.evolutionType]
        = (evolutionSummary[evolution.evolutionType] ?? 0) + 1
    }

    return {
      totalMemories: memories.length,
      memoryTypeDistribution: typeDistribution,
      averageRelevance: memories.length > 0 ? totalRelevance / memories.length : 0,
      topTags,
      relationshipStats,
      evolutionSummary,
    }
  }

  // Private helper methods

  private async generateEmbeddings(content: string): Promise<number[]> {
    // Enhanced mock implementation with caching - in production, use actual embedding service
    // like OpenAI embeddings, sentence-transformers, or local models

    // Check cache first
    const cacheKey = createHash('md5').update(content).digest('hex')
    const cachedEmbedding = this.embeddingCache.get(cacheKey)
    if (cachedEmbedding) {
      return [...cachedEmbedding] // Return a copy to prevent modification
    }

    // Preprocessing: extract meaningful features
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2) // Remove short words

    if (words.length === 0) {
      const emptyEmbedding = Array.from({ length: this.config.vectorDimensions }, () => 0)
      this.cacheEmbedding(cacheKey, emptyEmbedding)
      return emptyEmbedding
    }

    const embedding = Array.from({ length: this.config.vectorDimensions }, () => 0)

    // Multi-layered embedding approach for better semantic representation
    const uniqueWords = [...new Set(words)]
    const wordFreqs = new Map<string, number>()

    // Calculate word frequencies
    for (const word of words) {
      wordFreqs.set(word, (wordFreqs.get(word) || 0) + 1)
    }

    // Generate embeddings with multiple hash functions for better distribution
    for (const word of uniqueWords) {
      const freq = wordFreqs.get(word) || 1
      const normalizedFreq = freq / words.length

      // Use multiple hash functions to distribute semantic features
      const hash1 = this.simpleHash(word)
      const hash2 = this.simpleHash(word.split('').reverse().join('')) // Reversed hash
      const hash3 = this.simpleHash(word + content.length.toString()) // Context-aware hash

      // Distribute across multiple dimensions
      const indices = [
        Math.abs(hash1) % this.config.vectorDimensions,
        Math.abs(hash2) % this.config.vectorDimensions,
        Math.abs(hash3) % this.config.vectorDimensions,
      ]

      for (const index of indices) {
        if (embedding[index] !== undefined) {
          embedding[index] += normalizedFreq * (1 + Math.log(freq)) / Math.sqrt(uniqueWords.length)
        }
      }
    }

    // Add positional encoding (simplified version)
    for (let i = 0; i < Math.min(10, words.length); i++) {
      const word = words[i]
      if (word) {
        const positionHash = this.simpleHash(word + i.toString())
        const index = Math.abs(positionHash) % this.config.vectorDimensions
        if (embedding[index] !== undefined) {
          embedding[index] += 0.1 * (1 - i / words.length) // Positional weight
        }
      }
    }

    // Normalize vector with improved normalization
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    let finalEmbedding: number[]
    if (magnitude === 0) {
      finalEmbedding = Array.from({ length: this.config.vectorDimensions }, () => 1 / Math.sqrt(this.config.vectorDimensions))
    }
    else {
      finalEmbedding = embedding.map(val => val / magnitude)
    }

    // Cache the result
    this.cacheEmbedding(cacheKey, finalEmbedding)
    return finalEmbedding
  }

  private cacheEmbedding(key: string, embedding: number[]): void {
    // Implement LRU-style cache with size limit
    if (this.embeddingCache.size >= AgentMemorySystem.CACHE_MAX_SIZE) {
      // Remove oldest entries (simple FIFO for now)
      const keysToRemove = Array.from(this.embeddingCache.keys()).slice(0, 100)
      for (const keyToRemove of keysToRemove) {
        this.embeddingCache.delete(keyToRemove)
      }
    }

    // Store a copy to prevent external modification
    this.embeddingCache.set(key, [...embedding])
  }

  private calculateSemanticSimilarity(embedding1: number[], embedding2: number[]): number {
    // Enhanced cosine similarity calculation with better handling
    if (!embedding1 || !embedding2 || embedding1.length === 0 || embedding2.length === 0) {
      return 0
    }

    if (embedding1.length !== embedding2.length) {
      return 0
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0
    let validDimensions = 0

    for (let i = 0; i < embedding1.length; i++) {
      const val1 = embedding1[i]
      const val2 = embedding2[i]

      // Skip invalid values
      if (typeof val1 !== 'number' || typeof val2 !== 'number'
        || Number.isNaN(val1) || Number.isNaN(val2) || !Number.isFinite(val1) || !Number.isFinite(val2)) {
        continue
      }

      dotProduct += val1 * val2
      norm1 += val1 * val1
      norm2 += val2 * val2
      validDimensions++
    }

    // Need at least some valid dimensions for meaningful comparison
    if (validDimensions < Math.min(5, embedding1.length * 0.1)) {
      return 0
    }

    const magnitude1 = Math.sqrt(norm1)
    const magnitude2 = Math.sqrt(norm2)

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0
    }

    const similarity = dotProduct / (magnitude1 * magnitude2)

    // Clamp to [0, 1] range and handle floating point precision issues
    return Math.max(0, Math.min(1, similarity))
  }

  private async autoLinkMemory(memoryId: number, memory: AgentMemory): Promise<void> {
    // Find potentially related memories
    const candidates = await this.db.queryMemories(
      memory.agentName,
      memory.content.slice(0, 100),
      { limit: 50, minRelevance: 0.3 },
    )

    for (const candidate of candidates) {
      if (candidate.id === memoryId)
        continue

      // Calculate relationship strength
      const memoryEmbeddings = Array.isArray(memory.embeddings)
        ? memory.embeddings
        : memory.embeddings
          ? Array.from(memory.embeddings)
          : []

      const candidateEmbeddings = Array.isArray(candidate.embeddings)
        ? candidate.embeddings
        : candidate.embeddings
          ? Array.from(candidate.embeddings)
          : []

      const similarity = this.calculateSemanticSimilarity(
        memoryEmbeddings,
        candidateEmbeddings,
      )

      if (similarity >= this.config.relationshipStrengthThreshold) {
        const relationshipType = this.determineRelationshipType(memory, candidate)
        if (candidate.id) {
          // eslint-disable-next-line no-await-in-loop
          await this.linkMemories(
            memoryId,
            candidate.id,
            relationshipType,
            similarity,
            'system',
          )
        }
      }
    }
  }

  private determineRelationshipType(
    memory1: AgentMemory,
    memory2: AgentMemory,
  ): MemoryRelationship['relationshipType'] {
    // Simple heuristic-based relationship type detection
    if (memory1.memoryType === memory2.memoryType) {
      return 'similar_to'
    }

    if (memory1.memoryType === 'error_solution' && memory2.memoryType === 'workflow_pattern') {
      return 'caused_by'
    }

    if (memory1.memoryType === 'workflow_pattern' && memory2.memoryType === 'node_configuration') {
      return 'builds_on'
    }

    return 'similar_to'
  }

  private async getMemoryRelationshipCount(memoryId: number): Promise<number> {
    const relationships = await this.db.getMemoryRelationships(memoryId)
    return relationships.length
  }

  private async updateMemoryUsage(memoryId: number): Promise<void> {
    const memory = await this.db.getMemoryById(memoryId)
    if (memory) {
      await this.db.incrementMemoryUsage(memoryId)
    }
  }

  private async traverseMemoryGraph(
    memoryId: number,
    depth: number,
    minStrength: number,
    visited: Set<number>,
    results: AgentMemory[],
  ): Promise<void> {
    if (depth <= 0 || visited.has(memoryId))
      return

    visited.add(memoryId)
    const relationships = await this.db.getMemoryRelationships(memoryId)

    for (const rel of relationships) {
      if (rel.strength >= minStrength) {
        const targetId = rel.targetMemoryId
        if (!visited.has(targetId)) {
          // eslint-disable-next-line no-await-in-loop
          const targetMemory = await this.db.getMemoryById(targetId)
          if (targetMemory) {
            results.push(targetMemory)
            // eslint-disable-next-line no-await-in-loop
            await this.traverseMemoryGraph(targetId, depth - 1, minStrength, visited, results)
          }
        }
      }
    }
  }

  private async findSimilarMemories(
    memory: AgentMemory,
    threshold: number,
  ): Promise<AgentMemory[]> {
    const candidates = await this.db.queryMemories(
      memory.agentName,
      memory.content.slice(0, 50),
      { limit: 100 },
    )

    return candidates.filter((candidate) => {
      if (candidate.id === memory.id)
        return false

      const memoryEmbeddings = Array.isArray(memory.embeddings)
        ? memory.embeddings
        : memory.embeddings
          ? Array.from(memory.embeddings)
          : []

      const candidateEmbeddings = Array.isArray(candidate.embeddings)
        ? candidate.embeddings
        : candidate.embeddings
          ? Array.from(candidate.embeddings)
          : []

      const similarity = this.calculateSemanticSimilarity(
        memoryEmbeddings,
        candidateEmbeddings,
      )

      return similarity >= threshold
    })
  }

  private async mergeSimilarMemories(
    primary: AgentMemory,
    similar: AgentMemory[],
  ): Promise<void> {
    // Combine content and tags
    const combinedContent = [primary.content, ...similar.map(m => m.content)].join('\n\n')
    const combinedTags = [...new Set([...(primary.tags ?? []), ...similar.flatMap(m => m.tags ?? [])])]

    // Update primary memory
    if (primary.id) {
      await this.db.updateMemoryContent(primary.id, combinedContent)
      await this.db.updateMemoryTags(primary.id, combinedTags)

      // Mark similar memories as superseded (sequential by design for data integrity)
      for (const sim of similar) {
        if (sim.id) {
          // eslint-disable-next-line no-await-in-loop
          await this.db.supersedMemory(sim.id, primary.id)
        }
      }

      this.logEvolution(primary.id, 'strengthened', `Merged with ${similar.length} similar memories`, 1.0)
    }
  }

  private async getRelationshipStatistics(agentName: string): Promise<{
    totalRelationships: number
    strongRelationships: number
    averageStrength: number
  }> {
    const relationships = await this.db.getAgentRelationships(agentName)

    const strongRelationships = relationships.filter((r: { strength: number }) => r.strength >= 0.7).length
    const averageStrength = relationships.length > 0
      ? relationships.reduce((sum: number, r: { strength: number }) => sum + r.strength, 0) / relationships.length
      : 0

    return {
      totalRelationships: relationships.length,
      strongRelationships,
      averageStrength,
    }
  }

  private logEvolution(
    memoryId: number,
    evolutionType: MemoryEvolution['evolutionType'],
    reason: string,
    confidence: number,
  ): void {
    this.evolutionLog.push({
      memoryId,
      evolutionType,
      reason,
      confidence,
      timestamp: new Date(),
    })

    // Keep only recent evolution logs
    if (this.evolutionLog.length > 1000) {
      this.evolutionLog.splice(0, this.evolutionLog.length - 1000)
    }
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash
  }
}

/**
 * Factory function for creating memory system instance
 */
export async function createMemorySystem(
  config?: Partial<MemorySystemConfig>,
): Promise<AgentMemorySystem> {
  const db = new DynamicAgentDB()
  await db.initialize()

  return new AgentMemorySystem(db, config)
}
