import { spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import { TaskLogger } from '@/lib/utils/task-logger'

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
    this.workDir = config.workDir || '/workspace'
  }

  /**
   * Create and start a Docker container
   */
  async create(): Promise<void> {
    try {
      await this.logger.info('Creating Docker container...')

      // Check if Docker is available
      try {
        await execAsync('docker --version')
      } catch (error) {
        throw new Error('Docker is not installed or not running. Please install Docker Desktop.')
      }

      // Pull Node.js image if not exists
      await this.logger.info('Pulling Node.js Docker image...')
      try {
        await execAsync('docker pull node:22-slim')
      } catch (error) {
        await this.logger.error('Failed to pull Docker image, but continuing...')
      }

      // Build environment variables string
      const envVars = this.buildEnvVars()

      // Create container with mounted volume for workspace
      const createCommand = [
        'docker',
        'run',
        '-d', // Detached mode
        '--name',
        this.containerName,
        ...envVars,
        '--workdir',
        this.workDir,
        '-v',
        `${this.containerName}-workspace:${this.workDir}`, // Named volume for persistence
        'node:22-slim',
        'tail',
        '-f',
        '/dev/null', // Keep container running
      ].join(' ')

      const { stdout } = await execAsync(createCommand)
      this.containerId = stdout.trim()

      await this.logger.info(`Docker container created: ${this.containerId.substring(0, 12)}`)

      // Install essential tools
      await this.installEssentialTools()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.logger.error(`Failed to create Docker container: ${message}`)
      throw error
    }
  }

  /**
   * Install essential tools in the container
   */
  private async installEssentialTools(): Promise<void> {
    await this.logger.info('Installing essential tools...')

    // Update apt and install git, curl, python3
    const installCmd = `apt-get update && apt-get install -y git curl python3 python3-pip && rm -rf /var/lib/apt/lists/*`

    const result = await this.runCommand('sh', ['-c', installCmd])

    if (result.success) {
      await this.logger.info('Essential tools installed')
    } else {
      await this.logger.error('Failed to install essential tools, continuing anyway...')
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
      envVars.push('-e', `${key}=${value}`)
    }

    // Add essential env vars from process if not already set
    const essentialVars = [
      'ANTHROPIC_API_KEY',
      'GITHUB_TOKEN',
      'OPENAI_API_KEY',
      'CURSOR_API_KEY',
      'GEMINI_API_KEY',
      'NPM_TOKEN',
    ]

    for (const key of essentialVars) {
      if (!env[key] && process.env[key]) {
        envVars.push('-e', `${key}=${process.env[key]}`)
      }
    }

    return envVars
  }

  /**
   * Run a command in the container
   */
  async runCommand(command: string, args: string[] = []): Promise<CommandResult> {
    if (!this.containerId) {
      throw new Error('Container not created. Call create() first.')
    }

    try {
      const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command
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
        output: error.stdout || '',
        error: error.stderr || error.message,
        command: args.length > 0 ? `${command} ${args.join(' ')}` : command,
      }
    }
  }

  /**
   * Clone repository into the container
   */
  async cloneRepo(authenticatedRepoUrl: string, branchName?: string): Promise<void> {
    await this.logger.info(`Cloning repository into container...`)

    // Clone the repository
    const cloneArgs = ['clone', '--depth', '1']
    if (branchName) {
      cloneArgs.push('-b', branchName)
    }
    cloneArgs.push(authenticatedRepoUrl, this.workDir)

    const result = await this.runCommand('git', cloneArgs)

    if (result.success) {
      await this.logger.info('Repository cloned successfully')
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
      await this.logger.info('Stopping and removing Docker container...')

      // Stop and remove container
      await execAsync(`docker stop ${this.containerId}`)
      await execAsync(`docker rm ${this.containerId}`)

      // Optionally remove the volume (commented out to preserve data)
      // await execAsync(`docker volume rm ${this.containerName}-workspace`)

      await this.logger.info('Docker container destroyed')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.logger.error(`Failed to destroy container: ${message}`)
    }
  }

  /**
   * Check if Docker is available
   */
  static async isDockerAvailable(): Promise<boolean> {
    try {
      await execAsync('docker --version')
      return true
    } catch {
      return false
    }
  }
}
