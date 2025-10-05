import { UnifiedSandbox } from '../unified-sandbox'
import { TaskLogger } from '../utils/task-logger'
import { getExecutionMode } from '../execution-mode'
import { DockerContainer } from '../docker/container'
import { Sandbox } from '@vercel/sandbox'

export interface VersionMetadata {
  commitHash: string
  timestamp: Date
  attemptNumber: number
  message: string
  isStable: boolean
  testResults?: {
    passed: boolean
    testsPassed: number
    testsFailed: number
  }
}

export class VersionController {
  private versions: VersionMetadata[] = []
  private sandbox: UnifiedSandbox
  private logger: TaskLogger

  constructor(sandbox: UnifiedSandbox, logger: TaskLogger) {
    this.sandbox = sandbox
    this.logger = logger
  }

  /**
   * Create a version snapshot (git commit)
   */
  async createVersion(
    attemptNumber: number,
    message: string,
    isStable: boolean = false,
    testResults?: { passed: boolean; testsPassed: number; testsFailed: number },
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    try {
      await this.logger.info(`Creating version snapshot: ${message}`)

      const mode = getExecutionMode()

      // Stage all changes
      const addResult = await this.runGitCommand(['add', '.'])
      if (!addResult.success) {
        return { success: false, error: 'Failed to stage changes' }
      }

      // Create commit
      const commitMessage = `[Attempt ${attemptNumber}] ${message}`
      const commitResult = await this.runGitCommand(['commit', '-m', commitMessage])

      if (!commitResult.success) {
        // Check if there's nothing to commit
        if (commitResult.error?.includes('nothing to commit')) {
          await this.logger.info('No changes to commit')
          // Get current commit hash
          const hashResult = await this.runGitCommand(['rev-parse', 'HEAD'])
          const commitHash = hashResult.output?.trim() || 'unknown'

          return { success: true, commitHash }
        }

        return { success: false, error: `Failed to commit: ${commitResult.error}` }
      }

      // Get commit hash
      const hashResult = await this.runGitCommand(['rev-parse', 'HEAD'])
      const commitHash = hashResult.output?.trim() || 'unknown'

      // Record version metadata
      const version: VersionMetadata = {
        commitHash,
        timestamp: new Date(),
        attemptNumber,
        message,
        isStable,
        testResults,
      }

      this.versions.push(version)

      await this.logger.success(`Version created: ${commitHash.substring(0, 8)}`)

      return { success: true, commitHash }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  /**
   * Rollback to a specific commit
   */
  async rollbackToVersion(commitHash: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.logger.info(`Rolling back to commit ${commitHash.substring(0, 8)}...`)

      // Hard reset to specific commit
      const resetResult = await this.runGitCommand(['reset', '--hard', commitHash])

      if (!resetResult.success) {
        return { success: false, error: `Failed to rollback: ${resetResult.error}` }
      }

      await this.logger.success(`Successfully rolled back to ${commitHash.substring(0, 8)}`)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  /**
   * Rollback to last stable version
   */
  async rollbackToLastStable(): Promise<{ success: boolean; error?: string }> {
    const lastStable = this.getLastStableVersion()

    if (!lastStable) {
      return { success: false, error: 'No stable version found' }
    }

    await this.logger.info(`Rolling back to last stable version (attempt ${lastStable.attemptNumber})`)
    return this.rollbackToVersion(lastStable.commitHash)
  }

  /**
   * Get last stable version
   */
  getLastStableVersion(): VersionMetadata | null {
    for (let i = this.versions.length - 1; i >= 0; i--) {
      if (this.versions[i].isStable) {
        return this.versions[i]
      }
    }
    return null
  }

  /**
   * Get all versions
   */
  getVersionHistory(): VersionMetadata[] {
    return [...this.versions]
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommitHash(): Promise<string | null> {
    const result = await this.runGitCommand(['rev-parse', 'HEAD'])
    return result.success ? result.output?.trim() || null : null
  }

  /**
   * Check if working directory is clean
   */
  async isWorkingDirectoryClean(): Promise<boolean> {
    const result = await this.runGitCommand(['status', '--porcelain'])
    return result.success && !result.output?.trim()
  }

  /**
   * Get file changes in current working directory
   */
  async getChangedFiles(): Promise<string[]> {
    const result = await this.runGitCommand(['status', '--porcelain'])

    if (!result.success || !result.output) {
      return []
    }

    // Parse git status output
    // Format: "XY filename"
    return result.output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.substring(3).trim())
  }

  /**
   * Helper to run git commands
   */
  private async runGitCommand(
    args: string[],
  ): Promise<{ success: boolean; output?: string; error?: string; exitCode?: number }> {
    const mode = getExecutionMode()

    if (mode === 'docker') {
      const container = this.sandbox as DockerContainer
      return container.runCommand('git', args)
    } else {
      const vercelSandbox = this.sandbox as Sandbox
      const cmd = await vercelSandbox.runCommand('git', args)
      const stdout = await cmd.stdout()
      const stderr = await cmd.stderr()

      return {
        success: cmd.exitCode === 0,
        output: stdout,
        error: stderr,
        exitCode: cmd.exitCode,
      }
    }
  }
}
