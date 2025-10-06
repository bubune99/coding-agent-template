interface PortAllocation {
  chatId: string
  port: number
  allocatedAt: number
  containerId: string
}

class PortRegistry {
  private allocations = new Map<string, PortAllocation>()
  private usedPorts = new Set<number>()
  private readonly MIN_PORT = 3100
  private readonly MAX_PORT = 3999
  private readonly ALLOCATION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

  allocatePort(chatId: string, containerId: string): number {
    // Check if already allocated
    const existing = this.allocations.get(chatId)
    if (existing) {
      return existing.port
    }

    // Find available port
    let port = this.MIN_PORT
    while (port <= this.MAX_PORT) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port)
        this.allocations.set(chatId, {
          chatId,
          port,
          allocatedAt: Date.now(),
          containerId,
        })
        return port
      }
      port++
    }

    throw new Error("No available ports in range")
  }

  releasePort(chatId: string): void {
    const allocation = this.allocations.get(chatId)
    if (allocation) {
      this.usedPorts.delete(allocation.port)
      this.allocations.delete(chatId)
    }
  }

  getPort(chatId: string): number | null {
    return this.allocations.get(chatId)?.port ?? null
  }

  cleanupExpired(): void {
    const now = Date.now()
    for (const [chatId, allocation] of this.allocations.entries()) {
      if (now - allocation.allocatedAt > this.ALLOCATION_TIMEOUT) {
        this.releasePort(chatId)
      }
    }
  }

  getAllocations(): PortAllocation[] {
    return Array.from(this.allocations.values())
  }
}

export const portRegistry = new PortRegistry()

// Cleanup expired ports every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      portRegistry.cleanupExpired()
    },
    5 * 60 * 1000,
  )
}
