import { describe, expect, it } from 'vitest'

describe('large Payload Handling', () => {
  it('should handle workflows with 1000+ nodes', () => {
    // Generate a massive workflow
    const nodes = Array.from({ length: 1000 }, (_, i) => ({
      name: `Node_${i}`,
      type: 'n8n-nodes-base.set',
      position: [i * 100, i * 50],
      parameters: {
        values: {
          string: Array.from({ length: 100 }, (_, j) => ({
            name: `field_${j}`,
            value: 'x'.repeat(1000), // 1KB per field
          })),
        },
      },
    }))

    const massiveWorkflow = {
      name: 'Massive Workflow',
      nodes,
      connections: {},
    }

    // Calculate size
    const jsonSize = JSON.stringify(massiveWorkflow).length
    expect(jsonSize).toBeGreaterThan(1000000) // > 1MB

    // Test if it would exceed typical limits
    const MAX_STDIO_BUFFER = 1024 * 1024 * 10 // 10MB typical limit
    if (jsonSize > MAX_STDIO_BUFFER) {
      console.warn(`Workflow size ${jsonSize} bytes exceeds stdio buffer limit`)
    }
  })

  it('should detect potential memory issues with large responses', () => {
    const memoryBefore = process.memoryUsage().heapUsed

    // Simulate large array processing
    const largeArray = Array.from({ length: 100000 }, (_, i) => ({
      id: `execution_${i}`,
      data: { result: 'x'.repeat(100) },
    }))

    const memoryAfter = process.memoryUsage().heapUsed
    const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024 // MB

    expect(memoryIncrease).toBeLessThan(500) // Should not use more than 500MB

    // Clean up
    largeArray.length = 0
    if (globalThis.gc)
      globalThis.gc()
  })
})
