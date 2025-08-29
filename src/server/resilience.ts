/**
 * Lightweight resilience module for n8n-MCP-Modern
 * Minimal implementation for API calls without complex circuit breaker overhead
 */

/**
 * Simple retry handler with exponential backoff
 */
class SimpleRetryHandler {
  constructor(private maxRetries = 3, private baseDelay = 1000) {}

  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn()
      }
      catch (error) {
        lastError = error as Error

        if (attempt === this.maxRetries) {
          throw lastError
        }

        // Exponential backoff with jitter
        const delay = this.baseDelay * 2 ** attempt + Math.random() * 100
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }
}

/**
 * Lightweight circuit breaker that just passes through
 */
class SimpleCircuitBreaker {
  constructor(private name: string) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return await fn()
  }
}

// Export instances for compatibility
export const n8nApiCircuitBreaker = new SimpleCircuitBreaker('n8n-api')
export const retryHandler = new SimpleRetryHandler(3, 1000)
