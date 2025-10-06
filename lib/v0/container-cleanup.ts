import type { DockerContainer } from "@/lib/docker/container"
import { portRegistry } from "./port-registry"

interface ContainerInfo {
  chatId: string
  container: DockerContainer
  createdAt: number
  lastAccessedAt: number
}

class ContainerCleanupService {
  private containers = new Map<string, ContainerInfo>()
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private readonly MAX_CONTAINERS = 10

  registerContainer(chatId: string, container: DockerContainer): void {
    this.containers.set(chatId, {
      chatId,
      container,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    })

    // Enforce max containers limit
    if (this.containers.size > this.MAX_CONTAINERS) {
      this.cleanupOldest()
    }
  }

  updateAccess(chatId: string): void {
    const info = this.containers.get(chatId)
    if (info) {
      info.lastAccessedAt = Date.now()
    }
  }

  async cleanupContainer(chatId: string): Promise<void> {
    const info = this.containers.get(chatId)
    if (!info) return

    try {
      await info.container.destroy()
      portRegistry.releasePort(chatId)
      this.containers.delete(chatId)
      console.log(`[v0] Cleaned up container for chat ${chatId}`)
    } catch (error) {
      console.error(`[v0] Error cleaning up container for chat ${chatId}:`, error)
    }
  }

  async cleanupIdle(): Promise<void> {
    const now = Date.now()
    const toCleanup: string[] = []

    for (const [chatId, info] of this.containers.entries()) {
      if (now - info.lastAccessedAt > this.IDLE_TIMEOUT) {
        toCleanup.push(chatId)
      }
    }

    await Promise.all(toCleanup.map((chatId) => this.cleanupContainer(chatId)))
  }

  private async cleanupOldest(): Promise<void> {
    let oldest: ContainerInfo | null = null
    for (const info of this.containers.values()) {
      if (!oldest || info.createdAt < oldest.createdAt) {
        oldest = info
      }
    }

    if (oldest) {
      await this.cleanupContainer(oldest.chatId)
    }
  }

  getContainer(chatId: string): DockerContainer | null {
    const info = this.containers.get(chatId)
    if (info) {
      this.updateAccess(chatId)
      return info.container
    }
    return null
  }

  async cleanupAll(): Promise<void> {
    const chatIds = Array.from(this.containers.keys())
    await Promise.all(chatIds.map((chatId) => this.cleanupContainer(chatId)))
  }
}

export const containerCleanup = new ContainerCleanupService()

// Cleanup idle containers every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      containerCleanup.cleanupIdle()
    },
    10 * 60 * 1000,
  )
}
