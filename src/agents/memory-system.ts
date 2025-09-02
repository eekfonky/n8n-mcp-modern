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
    'workflow_pattern',
    'node_configuration',
    'user_preference',
    'error_solution',
    'delegation_outcome',
    'discovery_result',
    'validation_rule',
    'performance_insight',
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

      const relevanceScore = this.calculateSemanticSimilarity(
        queryEmbeddings,
        memoryEmbeddings,
      )

      if (relevanceScore >= this.config.semanticSearchThreshold) {
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
    // Mock implementation - in production, use actual embedding service
    // like OpenAI embeddings, sentence-transformers, or local models
    const words = content.toLowerCase().split(/\s+/)
    const embedding = Array.from({ length: this.config.vectorDimensions }, () => 0)

    // Simple hash-based pseudo-embeddings for demonstration
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      if (word) {
        const hash = this.simpleHash(word)
        const index = Math.abs(hash) % this.config.vectorDimensions
        if (embedding[index] !== undefined) {
          embedding[index] += 1 / Math.sqrt(words.length)
        }
      }
    }

    // Normalize vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0)
  }

  private calculateSemanticSimilarity(embedding1: number[], embedding2: number[]): number {
    // Cosine similarity calculation
    if (embedding1.length !== embedding2.length)
      return 0

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      const val1 = embedding1[i] ?? 0
      const val2 = embedding2[i] ?? 0
      dotProduct += val1 * val2
      norm1 += val1 * val1
      norm2 += val2 * val2
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)
    return magnitude > 0 ? dotProduct / magnitude : 0
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
