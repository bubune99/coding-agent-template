import { DockerContainer } from './container'

/**
 * Registry to track active Docker containers for cleanup
 */
const containerRegistry = new Map<string, DockerContainer>()

export function registerDockerContainer(taskId: string, container: DockerContainer): void {
  containerRegistry.set(taskId, container)
}

export function unregisterDockerContainer(taskId: string): void {
  containerRegistry.delete(taskId)
}

export function getDockerContainer(taskId: string): DockerContainer | undefined {
  return containerRegistry.get(taskId)
}

export async function destroyDockerContainer(taskId: string): Promise<void> {
  const container = containerRegistry.get(taskId)
  if (container) {
    await container.destroy()
    containerRegistry.delete(taskId)
  }
}

export async function destroyAllDockerContainers(): Promise<void> {
  const promises = Array.from(containerRegistry.values()).map((container) => container.destroy())
  await Promise.all(promises)
  containerRegistry.clear()
}
