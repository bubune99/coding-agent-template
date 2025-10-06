import { DockerContainer } from "@/lib/docker/container"
import type { TaskLogger } from "@/lib/utils/task-logger"

export interface DeploymentResult {
  success: boolean
  previewUrl?: string
  error?: string
  containerId?: string
}

/**
 * Deploy v0-generated code to a Docker container
 */
export async function deployV0CodeToDocker(
  code: string,
  taskId: string,
  logger: TaskLogger,
): Promise<DeploymentResult> {
  let container: DockerContainer | undefined

  try {
    await logger.info("Deploying v0 code to Docker container...")

    // Create a minimal Next.js project structure
    container = new DockerContainer(
      {
        taskId,
        repoUrl: "", // Not cloning a repo
        workDir: "/workspace",
        timeout: 10 * 60 * 1000, // 10 minutes
      },
      logger,
    )

    await container.create()

    // Initialize a Next.js project
    await logger.info("Initializing Next.js project...")
    await container.runCommand("npx", [
      "create-next-app@latest",
      ".",
      "--typescript",
      "--tailwind",
      "--app",
      "--no-git",
      "--yes",
    ])

    // Write the generated code to app/page.tsx
    await logger.info("Writing generated code...")
    await container.writeFile("app/page.tsx", code)

    // Install dependencies
    await logger.info("Installing dependencies...")
    await container.runCommand("npm", ["install"])

    // Start dev server
    await logger.info("Starting dev server...")
    const { url, hostPort } = await container.startDevServer()

    await logger.info(`Deployment successful! Preview available at ${url}`)

    return {
      success: true,
      previewUrl: url,
      containerId: container.getContainerId(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await logger.error(`Deployment failed: ${message}`)

    // Cleanup on error
    if (container) {
      try {
        await container.destroy()
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Extract code from v0 SDK response
 */
export function extractCodeFromV0Response(messages: any[]): string | null {
  // Look for code blocks in the last assistant message
  const lastMessage = messages.findLast((msg: any) => msg.role === "assistant")

  if (!lastMessage) {
    return null
  }

  // Check experimental_content for code blocks
  const content = lastMessage.experimental_content || lastMessage.content

  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === "code" && (part.language === "tsx" || part.language === "typescript")) {
        return part.code
      }
    }
  }

  // Fallback: extract from markdown code blocks
  if (typeof content === "string") {
    const codeBlockRegex = /```(?:tsx|typescript|jsx|javascript)\n([\s\S]*?)```/
    const match = content.match(codeBlockRegex)
    if (match) {
      return match[1]
    }
  }

  return null
}
