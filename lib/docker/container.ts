import { promisify } from "util"
import { exec } from "child_process"
import type { TaskLogger } from "@/lib/utils/task-logger"

const execAsync = promisify(exec)

export interface DockerContainerConfig {
  taskId: string
  repoUrl: string
  branchName?: string
  workDir?: string
  timeout?: number
  env?: Record<string, string>
}

export interface CommandResult {
  success: boolean
  exitCode?: number
  output?: string
  error?: string
  command?: string
}

export class DockerContainer {
  private containerId?: string
  private containerName: string
  private config: DockerContainerConfig
  private logger: TaskLogger
  private workDir: string

  constructor(config: DockerContainerConfig, logger: TaskLogger) {
    this.config = config
    this.logger = logger
    this.containerName = `coding-agent-${config.taskId}`
    this.workDir = config.workDir || "/workspace"
  }

  /**
   * Create and start a Docker container
   */
  async create(): Promise<void> {
    try {
      await this.logger.info("Creating Docker container...")

      // Check if Docker is available
      try {
        await execAsync("docker --version")
      } catch (error) {
        throw new Error("Docker is not installed or not running. Please install Docker Desktop.")
      }

      // Pull Node.js image if not exists
      await this.logger.info("Pulling Node.js Docker image...")
      try {
        await execAsync("docker pull node:22-slim")
      } catch (error) {
        await this.logger.error("Failed to pull Docker image, but continuing...")
      }

      // Build environment variables string
      const envVars = this.buildEnvVars()

      // Create container with mounted volume for workspace
      const createCommand = [
        "docker",
        "run",
        "-d", // Detached mode
        "--name",
        this.containerName,
        ...envVars,
        "--workdir",
        this.workDir,
        "-v",
        `${this.containerName}-workspace:${this.workDir}`, // Named volume for persistence
        "node:22-slim",
        "tail",
        "-f",
        "/dev/null", // Keep container running
      ].join(" ")

      const { stdout } = await execAsync(createCommand)
      this.containerId = stdout.trim()

      await this.logger.info(`Docker container created: ${this.containerId.substring(0, 12)}`)

      // Install essential tools
      await this.installEssentialTools()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await this.logger.error(`Failed to create Docker container: ${message}`)
      throw error
    }
  }

  /**
   * Install essential tools in the container
   */
  private async installEssentialTools(): Promise<void> {
    await this.logger.info("Installing essential tools...")

    // Update apt and install git, curl, python3
    const installCmd = `apt-get update && apt-get install -y git curl python3 python3-pip && rm -rf /var/lib/apt/lists/*`

    const result = await this.runCommand("sh", ["-c", installCmd])

    if (result.success) {
      await this.logger.info("Essential tools installed")
    } else {
      await this.logger.error("Failed to install essential tools, continuing anyway...")
    }
  }

  /**
   * Build environment variables for Docker
   */
  private buildEnvVars(): string[] {
    const envVars: string[] = []
    const env = this.config.env || {}

    // Add provided env vars
    for (const [key, value] of Object.entries(env)) {
      envVars.push("-e", `${key}=${value}`)
    }

    // Add essential env vars from process if not already set
    const essentialVars = [
      "ANTHROPIC_API_KEY",
      "GITHUB_TOKEN",
      "OPENAI_API_KEY",
      "CURSOR_API_KEY",
      "GEMINI_API_KEY",
      "NPM_TOKEN",
    ]

    for (const key of essentialVars) {
      if (!env[key] && process.env[key]) {
        envVars.push("-e", `${key}=${process.env[key]}`)
      }
    }

    return envVars
  }

  /**
   * Run a command in the container
   */
  async runCommand(command: string, args: string[] = []): Promise<CommandResult> {
    if (!this.containerId) {
      throw new Error("Container not created. Call create() first.")
    }

    try {
      const fullCommand = args.length > 0 ? `${command} ${args.join(" ")}` : command
      const execCommand = `docker exec ${this.containerId} ${fullCommand}`

      const { stdout, stderr } = await execAsync(execCommand, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: this.config.timeout || 5 * 60 * 1000, // 5 minutes default
      })

      return {
        success: true,
        exitCode: 0,
        output: stdout,
        error: stderr,
        command: fullCommand,
      }
    } catch (error: any) {
      return {
        success: false,
        exitCode: error.code || 1,
        output: error.stdout || "",
        error: error.stderr || error.message,
        command: args.length > 0 ? `${command} ${args.join(" ")}` : command,
      }
    }
  }

  /**
   * Clone repository into the container
   */
  async cloneRepo(authenticatedRepoUrl: string, branchName?: string): Promise<void> {
    await this.logger.info(`Cloning repository into container...`)

    // Clone the repository
    const cloneArgs = ["clone", "--depth", "1"]
    if (branchName) {
      cloneArgs.push("-b", branchName)
    }
    cloneArgs.push(authenticatedRepoUrl, this.workDir)

    const result = await this.runCommand("git", cloneArgs)

    if (result.success) {
      await this.logger.info("Repository cloned successfully")
    } else {
      throw new Error(`Failed to clone repository: ${result.error}`)
    }
  }

  /**
   * Get the container working directory
   */
  getWorkDir(): string {
    return this.workDir
  }

  /**
   * Get container ID
   */
  getContainerId(): string | undefined {
    return this.containerId
  }

  /**
   * Destroy the container
   */
  async destroy(): Promise<void> {
    if (!this.containerId) {
      return
    }

    try {
      await this.logger.info("Stopping and removing Docker container...")

      // Stop and remove container
      await execAsync(`docker stop ${this.containerId}`)
      await execAsync(`docker rm ${this.containerId}`)

      // Optionally remove the volume (commented out to preserve data)
      // await execAsync(`docker volume rm ${this.containerName}-workspace`)

      await this.logger.info("Docker container destroyed")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await this.logger.error(`Failed to destroy container: ${message}`)
    }
  }

  /**
   * Check if Docker is available
   */
  static async isDockerAvailable(): Promise<boolean> {
    try {
      await execAsync("docker --version")
      return true
    } catch {
      return false
    }
  }

  /**
   * Start a Next.js dev server in the container
   */
  async startDevServer(port = 3000): Promise<{ url: string; port: number; hostPort: number }> {
    if (!this.containerId) {
      throw new Error("Container not created. Call create() first.")
    }

    try {
      await this.logger.info(`Starting dev server on port ${port}...`)

      const hostPort = await this.findAvailablePort()

      await execAsync(`docker stop ${this.containerId}`)
      await execAsync(`docker rm ${this.containerId}`)

      const envVars = this.buildEnvVars()
      const createCommand = [
        "docker",
        "run",
        "-d",
        "--name",
        this.containerName,
        "-p",
        `${hostPort}:${port}`, // Port forwarding
        ...envVars,
        "--workdir",
        this.workDir,
        "-v",
        `${this.containerName}-workspace:${this.workDir}`,
        "node:22-slim",
        "tail",
        "-f",
        "/dev/null",
      ].join(" ")

      const { stdout } = await execAsync(createCommand)
      this.containerId = stdout.trim()

      await this.logger.info(`Container recreated with port forwarding: ${hostPort}:${port}`)

      await this.runCommand("sh", ["-c", "npm run dev > /tmp/dev.log 2>&1 &"])

      const url = `http://localhost:${hostPort}`
      await this.waitForServerReady(url)

      await this.logger.info(`Dev server ready at ${url}`)

      return { url, port, hostPort }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await this.logger.error(`Failed to start dev server: ${message}`)
      throw error
    }
  }

  /**
   * Find an available port on the host machine
   */
  private async findAvailablePort(): Promise<number> {
    const minPort = 3001
    const maxPort = 9999
    const port = minPort + Math.floor(Math.random() * (maxPort - minPort))
    return port
  }

  /**
   * Wait for the dev server to be ready
   */
  private async waitForServerReady(url: string, timeout = 120000): Promise<void> {
    const startTime = Date.now()
    const checkInterval = 2000 // Check every 2 seconds

    await this.logger.info("Waiting for dev server to be ready...")

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (response.ok || response.status === 404) {
          // Server is responding (404 is fine, means server is up)
          await this.logger.info("Dev server is ready!")
          return
        }
      } catch (error) {
        // Server not ready yet, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval))
    }

    throw new Error(`Dev server failed to start within ${timeout}ms`)
  }

  /**
   * Write a file to the container
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.containerId) {
      throw new Error("Container not created. Call create() first.")
    }

    try {
      // Escape single quotes in content
      const escapedContent = content.replace(/'/g, "'\\''")

      // Write file using echo
      const result = await this.runCommand("sh", ["-c", `echo '${escapedContent}' > ${filePath}`])

      if (!result.success) {
        throw new Error(`Failed to write file: ${result.error}`)
      }

      await this.logger.info(`File written: ${filePath}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      await this.logger.error(`Failed to write file ${filePath}: ${message}`)
      throw error
    }
  }

  /**
   * Read a file from the container
   */
  async readFile(filePath: string): Promise<string> {
    if (!this.containerId) {
      throw new Error("Container not created. Call create() first.")
    }

    const result = await this.runCommand("cat", [filePath])

    if (!result.success) {
      throw new Error(`Failed to read file: ${result.error}`)
    }

    return result.output || ""
  }

  /**
   * Check if a file exists in the container
   */
  async fileExists(filePath: string): Promise<boolean> {
    if (!this.containerId) {
      throw new Error("Container not created. Call create() first.")
    }

    const result = await this.runCommand("test", ["-f", filePath])
    return result.success
  }
}
