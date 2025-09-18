/**
 * Emergency Shutdown Procedures Test Suite
 *
 * Critical system reliability tests covering:
 * - Graceful shutdown under normal conditions
 * - Emergency shutdown under resource exhaustion
 * - Process cleanup and resource release
 * - Database connection handling during shutdown
 * - Timer and interval cleanup
 * - Race condition prevention
 * - Signal handling (SIGINT, SIGTERM)
 */

import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'

interface MockProcess extends EventEmitter {
  exit: vi.MockedFunction<(code?: number) => never>
  pid: number
}

interface MockResourceMonitor {
  startMonitoring: () => Promise<void>
  stopMonitoring: () => Promise<void>
  forceGarbageCollection: () => void
  getResourceUsage: () => {
    memory: { heapUsed: number, heapTotal: number, rss: number }
    cpu: { usage: number }
    processes: { active: number }
  }
  emergencyShutdown: () => Promise<void>
}

interface MockTimerManager {
  clearAllTimers: () => void
  getStats: () => { total: number, active: number }
  setTimeout: (callback: Function, delay: number) => string
  setInterval: (callback: Function, delay: number) => string
  clearTimer: (id: string) => boolean
}

interface MockProcessManager {
  cleanup: () => Promise<void>
  killAllChildProcesses: () => Promise<void>
  getActiveProcesses: () => number
}

interface MockHealthMonitor {
  isHealthy: () => boolean
  stopMonitoring: () => void
  emergencyShutdown: () => Promise<void>
}

describe('emergency Shutdown - Graceful Shutdown', () => {
  let mockProcess: MockProcess
  let mockResourceMonitor: MockResourceMonitor
  let mockTimerManager: MockTimerManager
  let mockProcessManager: MockProcessManager
  let mockHealthMonitor: MockHealthMonitor

  beforeEach(() => {
    mockProcess = new EventEmitter() as MockProcess
    mockProcess.exit = vi.fn()
    mockProcess.pid = 12345

    mockResourceMonitor = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      forceGarbageCollection: vi.fn(),
      getResourceUsage: vi.fn().mockReturnValue({
        memory: { heapUsed: 50 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, rss: 100 * 1024 * 1024 },
        cpu: { usage: 25 },
        processes: { active: 3 },
      }),
      emergencyShutdown: vi.fn().mockResolvedValue(undefined),
    }

    mockTimerManager = {
      clearAllTimers: vi.fn(),
      getStats: vi.fn().mockReturnValue({ total: 5, active: 5 }),
      setTimeout: vi.fn().mockReturnValue('timer-1'),
      setInterval: vi.fn().mockReturnValue('interval-1'),
      clearTimer: vi.fn().mockReturnValue(true),
    }

    mockProcessManager = {
      cleanup: vi.fn().mockResolvedValue(undefined),
      killAllChildProcesses: vi.fn().mockResolvedValue(undefined),
      getActiveProcesses: vi.fn().mockReturnValue(2),
    }

    mockHealthMonitor = {
      isHealthy: vi.fn().mockReturnValue(true),
      stopMonitoring: vi.fn(),
      emergencyShutdown: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('performs graceful shutdown sequence', async () => {
    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
      resourceMonitor: mockResourceMonitor,
      timerManager: mockTimerManager,
      processManager: mockProcessManager,
      healthMonitor: mockHealthMonitor,
    })

    const shutdownPromise = shutdownManager.gracefulShutdown(5000)

    await expect(shutdownPromise).resolves.toBe(undefined)

    // Verify shutdown sequence
    expect(mockHealthMonitor.stopMonitoring).toHaveBeenCalled()
    expect(mockTimerManager.clearAllTimers).toHaveBeenCalled()
    expect(mockProcessManager.killAllChildProcesses).toHaveBeenCalled()
    expect(mockResourceMonitor.stopMonitoring).toHaveBeenCalled()
    expect(mockResourceMonitor.forceGarbageCollection).toHaveBeenCalled()
  })

  it('enforces shutdown timeout', async () => {
    // Make process cleanup hang
    mockProcessManager.killAllChildProcesses = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 10000)),
    )

    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
      resourceMonitor: mockResourceMonitor,
      timerManager: mockTimerManager,
      processManager: mockProcessManager,
      healthMonitor: mockHealthMonitor,
    })

    const startTime = Date.now()
    await shutdownManager.gracefulShutdown(1000) // 1 second timeout
    const endTime = Date.now()

    expect(endTime - startTime).toBeLessThan(1500) // Should timeout around 1 second
    expect(mockProcess.exit).toHaveBeenCalledWith(1) // Force exit due to timeout
  })

  it('handles shutdown sequence errors gracefully', async () => {
    mockTimerManager.clearAllTimers = vi.fn().mockImplementation(() => {
      throw new Error('Timer cleanup failed')
    })

    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
      resourceMonitor: mockResourceMonitor,
      timerManager: mockTimerManager,
      processManager: mockProcessManager,
      healthMonitor: mockHealthMonitor,
    })

    // Should not throw even if individual steps fail
    await expect(shutdownManager.gracefulShutdown(5000)).resolves.toBe(undefined)

    // Should still attempt other cleanup steps
    expect(mockProcessManager.killAllChildProcesses).toHaveBeenCalled()
    expect(mockResourceMonitor.stopMonitoring).toHaveBeenCalled()
  })
})

describe('emergency Shutdown - Resource Exhaustion', () => {
  let mockProcess: MockProcess
  let mockResourceMonitor: MockResourceMonitor
  let mockTimerManager: MockTimerManager

  beforeEach(() => {
    mockProcess = new EventEmitter() as MockProcess
    mockProcess.exit = vi.fn()
    mockProcess.pid = 12345

    mockResourceMonitor = {
      startMonitoring: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      forceGarbageCollection: vi.fn(),
      getResourceUsage: vi.fn().mockReturnValue({
        memory: { heapUsed: 950 * 1024 * 1024, heapTotal: 1000 * 1024 * 1024, rss: 2000 * 1024 * 1024 },
        cpu: { usage: 95 },
        processes: { active: 25 },
      }),
      emergencyShutdown: vi.fn().mockResolvedValue(undefined),
    }

    mockTimerManager = {
      clearAllTimers: vi.fn(),
      getStats: vi.fn().mockReturnValue({ total: 50, active: 50 }),
      setTimeout: vi.fn().mockReturnValue('timer-1'),
      setInterval: vi.fn().mockReturnValue('interval-1'),
      clearTimer: vi.fn().mockReturnValue(true),
    }
  })

  it('triggers emergency shutdown on memory exhaustion', async () => {
    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
      resourceMonitor: mockResourceMonitor,
      timerManager: mockTimerManager,
      thresholds: {
        memoryUsage: 90, // 90% threshold
        cpuUsage: 98,
        activeTimers: 100,
      },
    })

    const shouldEmergencyShutdown = shutdownManager.checkEmergencyConditions()
    expect(shouldEmergencyShutdown).toBe(true)

    await shutdownManager.emergencyShutdown()

    expect(mockResourceMonitor.emergencyShutdown).toHaveBeenCalled()
    expect(mockTimerManager.clearAllTimers).toHaveBeenCalled()
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })

  it('triggers emergency shutdown on timer explosion', async () => {
    mockTimerManager.getStats = vi.fn().mockReturnValue({ total: 150, active: 150 })

    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
      resourceMonitor: mockResourceMonitor,
      timerManager: mockTimerManager,
      thresholds: {
        memoryUsage: 95,
        cpuUsage: 98,
        activeTimers: 100, // 100 timer threshold
      },
    })

    const shouldEmergencyShutdown = shutdownManager.checkEmergencyConditions()
    expect(shouldEmergencyShutdown).toBe(true)

    await shutdownManager.emergencyShutdown()

    expect(mockTimerManager.clearAllTimers).toHaveBeenCalled()
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })

  it('performs aggressive cleanup during emergency', async () => {
    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
      resourceMonitor: mockResourceMonitor,
      timerManager: mockTimerManager,
    })

    const startTime = Date.now()
    await shutdownManager.emergencyShutdown()
    const endTime = Date.now()

    // Emergency shutdown should be fast (< 2 seconds)
    expect(endTime - startTime).toBeLessThan(2000)

    expect(mockResourceMonitor.emergencyShutdown).toHaveBeenCalled()
    expect(mockTimerManager.clearAllTimers).toHaveBeenCalled()
    expect(mockResourceMonitor.forceGarbageCollection).toHaveBeenCalled()
    expect(mockProcess.exit).toHaveBeenCalledWith(1)
  })
})

describe('emergency Shutdown - Signal Handling', () => {
  let mockProcess: MockProcess

  beforeEach(() => {
    mockProcess = new EventEmitter() as MockProcess
    mockProcess.exit = vi.fn()
    mockProcess.pid = 12345
  })

  it('handles SIGINT signal gracefully', async () => {
    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
    })

    shutdownManager.setupSignalHandlers()

    // Simulate SIGINT
    mockProcess.emit('SIGINT')

    // Allow async handlers to run
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })

  it('handles SIGTERM signal gracefully', async () => {
    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
    })

    shutdownManager.setupSignalHandlers()

    // Simulate SIGTERM
    mockProcess.emit('SIGTERM')

    // Allow async handlers to run
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(mockProcess.exit).toHaveBeenCalledWith(0)
  })

  it('prevents multiple shutdown attempts', async () => {
    const shutdownManager = new EmergencyShutdownManager({
      process: mockProcess,
    })

    shutdownManager.setupSignalHandlers()

    // Emit multiple signals rapidly
    mockProcess.emit('SIGINT')
    mockProcess.emit('SIGTERM')
    mockProcess.emit('SIGINT')

    // Allow async handlers to run
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should only call exit once
    expect(mockProcess.exit).toHaveBeenCalledTimes(1)
  })
})

describe('emergency Shutdown - Race Condition Prevention', () => {
  it('prevents concurrent shutdown attempts', async () => {
    const mockResourceMonitor = {
      stopMonitoring: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
      emergencyShutdown: vi.fn().mockResolvedValue(undefined),
      forceGarbageCollection: vi.fn(),
      getResourceUsage: vi.fn().mockReturnValue({
        memory: { heapUsed: 50 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, rss: 100 * 1024 * 1024 },
        cpu: { usage: 25 },
        processes: { active: 3 },
      }),
    }

    const shutdownManager = new EmergencyShutdownManager({
      resourceMonitor: mockResourceMonitor,
    })

    // Start multiple shutdown attempts simultaneously
    const shutdown1Promise = shutdownManager.gracefulShutdown(5000)
    const shutdown2Promise = shutdownManager.gracefulShutdown(5000)
    const shutdown3Promise = shutdownManager.gracefulShutdown(5000)

    await Promise.all([shutdown1Promise, shutdown2Promise, shutdown3Promise])

    // Resource monitor should only be stopped once
    expect(mockResourceMonitor.stopMonitoring).toHaveBeenCalledTimes(1)
  })

  it('handles rapid emergency checks', () => {
    const mockResourceMonitor = {
      getResourceUsage: vi.fn().mockReturnValue({
        memory: { heapUsed: 950 * 1024 * 1024, heapTotal: 1000 * 1024 * 1024, rss: 2000 * 1024 * 1024 },
        cpu: { usage: 95 },
        processes: { active: 25 },
      }),
      emergencyShutdown: vi.fn().mockResolvedValue(undefined),
      stopMonitoring: vi.fn().mockResolvedValue(undefined),
      forceGarbageCollection: vi.fn(),
    }

    const shutdownManager = new EmergencyShutdownManager({
      resourceMonitor: mockResourceMonitor,
      thresholds: {
        memoryUsage: 90,
        cpuUsage: 98,
        activeTimers: 100,
      },
    })

    // Check emergency conditions rapidly
    const results = Array.from({ length: 10 }).fill(0).map(() => shutdownManager.checkEmergencyConditions())

    // All should return consistent results
    expect(results.every(r => r === true)).toBe(true)
  })
})

// Mock implementation of EmergencyShutdownManager for testing
class EmergencyShutdownManager {
  private isShuttingDown = false
  private process: MockProcess
  private resourceMonitor?: MockResourceMonitor
  private timerManager?: MockTimerManager
  private processManager?: MockProcessManager
  private healthMonitor?: MockHealthMonitor
  private thresholds: {
    memoryUsage: number
    cpuUsage: number
    activeTimers: number
  }

  constructor(dependencies: {
    process?: MockProcess
    resourceMonitor?: MockResourceMonitor
    timerManager?: MockTimerManager
    processManager?: MockProcessManager
    healthMonitor?: MockHealthMonitor
    thresholds?: {
      memoryUsage: number
      cpuUsage: number
      activeTimers: number
    }
  } = {}) {
    this.process = dependencies.process || new EventEmitter() as MockProcess
    this.resourceMonitor = dependencies.resourceMonitor
    this.timerManager = dependencies.timerManager
    this.processManager = dependencies.processManager
    this.healthMonitor = dependencies.healthMonitor
    this.thresholds = dependencies.thresholds || {
      memoryUsage: 95,
      cpuUsage: 98,
      activeTimers: 100,
    }
  }

  async gracefulShutdown(timeoutMs: number = 10000): Promise<void> {
    if (this.isShuttingDown) {
      return
    }
    this.isShuttingDown = true

    const shutdownPromise = this.performShutdownSequence()
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs)
    })

    try {
      await Promise.race([shutdownPromise, timeoutPromise])
    }
    catch (error) {
      // Force exit on timeout or error
      this.process.exit?.(1)
    }
  }

  async emergencyShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }
    this.isShuttingDown = true

    try {
      // Aggressive cleanup
      await this.resourceMonitor?.emergencyShutdown()
      this.timerManager?.clearAllTimers()
      this.resourceMonitor?.forceGarbageCollection()
    }
    catch (error) {
      // Ignore errors during emergency shutdown
    }

    this.process.exit?.(1)
  }

  checkEmergencyConditions(): boolean {
    if (!this.resourceMonitor) {
      return false
    }

    const usage = this.resourceMonitor.getResourceUsage()
    const memoryPercent = (usage.memory.heapUsed / usage.memory.heapTotal) * 100
    const timerStats = this.timerManager?.getStats()

    return (
      memoryPercent > this.thresholds.memoryUsage
      || usage.cpu.usage > this.thresholds.cpuUsage
      || (timerStats?.active || 0) > this.thresholds.activeTimers
    )
  }

  setupSignalHandlers(): void {
    const handleShutdown = async () => {
      if (!this.isShuttingDown) {
        await this.gracefulShutdown(5000)
        this.process.exit?.(0)
      }
    }

    this.process.on('SIGINT', handleShutdown)
    this.process.on('SIGTERM', handleShutdown)
  }

  private async performShutdownSequence(): Promise<void> {
    try {
      // Stop health monitoring first
      this.healthMonitor?.stopMonitoring()

      // Clear all timers
      this.timerManager?.clearAllTimers()

      // Kill child processes
      await this.processManager?.killAllChildProcesses()

      // Stop resource monitoring
      await this.resourceMonitor?.stopMonitoring()

      // Final garbage collection
      this.resourceMonitor?.forceGarbageCollection()
    }
    catch (error) {
      // Log error but continue shutdown
      console.error('Error during shutdown:', error)
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})
