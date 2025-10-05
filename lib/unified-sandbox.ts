/**
 * Unified sandbox interface that works with both Docker and Vercel Sandbox
 */

import { Sandbox } from '@vercel/sandbox'
import { DockerContainer } from './docker/container'
import { createSandbox as createVercelSandbox } from './sandbox/creation'
import { createDockerSandbox } from './docker/creation'
import { executeAgentInSandbox as executeAgentVercel } from './sandbox/agents'
import { executeAgentInDocker } from './docker/agents'
import { pushChangesToBranch as pushChangesVercel, shutdownSandbox } from './sandbox/git'
import { registerSandbox, unregisterSandbox } from './sandbox/sandbox-registry'
import { registerDockerContainer, destroyDockerContainer } from './docker/registry'
import { SandboxConfig, SandboxResult, AgentExecutionResult } from './sandbox/types'
import { AgentType } from './sandbox/agents'
import { TaskLogger } from './utils/task-logger'
import { getExecutionMode } from './execution-mode'

export type UnifiedSandbox = Sandbox | DockerContainer

/**
 * Create a sandbox (Docker or Vercel) based on execution mode
 */
export async function createUnifiedSandbox(config: SandboxConfig, logger: TaskLogger): Promise<SandboxResult> {
  const mode = await getExecutionMode()

  await logger.info(`Using ${mode} execution mode`)

  if (mode === 'docker') {
    return createDockerSandbox(config, logger)
  } else {
    return createVercelSandbox(config, logger)
  }
}

/**
 * Execute an agent in the unified sandbox
 */
export async function executeAgentInUnifiedSandbox(
  sandbox: UnifiedSandbox,
  instruction: string,
  agentType: AgentType,
  logger: TaskLogger,
  selectedModel?: string,
  onCancellationCheck?: () => Promise<boolean>,
): Promise<AgentExecutionResult> {
  const mode = await getExecutionMode()

  if (mode === 'docker') {
    return executeAgentInDocker(
      sandbox as DockerContainer,
      instruction,
      agentType,
      logger,
      selectedModel,
      onCancellationCheck,
    )
  } else {
    return executeAgentVercel(sandbox as Sandbox, instruction, agentType, logger, selectedModel, onCancellationCheck)
  }
}

/**
 * Push changes to branch (unified interface)
 */
export async function pushChangesToBranchUnified(
  sandbox: UnifiedSandbox,
  branchName: string,
  commitMessage: string,
  logger: TaskLogger,
): Promise<{ success: boolean; pushFailed?: boolean; error?: string }> {
  const mode = await getExecutionMode()

  if (mode === 'docker') {
    const container = sandbox as DockerContainer

    // Commit changes
    await logger.info('Committing changes...')
    const addResult = await container.runCommand('git', ['add', '.'])

    if (!addResult.success) {
      await logger.error('Failed to stage changes')
      return { success: false, error: 'Failed to stage changes' }
    }

    const commitResult = await container.runCommand('git', ['commit', '-m', commitMessage])

    if (!commitResult.success) {
      // Check if there are no changes to commit
      if (commitResult.error?.includes('nothing to commit')) {
        await logger.info('No changes to commit')
        return { success: true }
      }
      await logger.error('Failed to commit changes')
      return { success: false, error: 'Failed to commit changes' }
    }

    await logger.success('Changes committed successfully')

    // Push changes
    await logger.info(`Pushing changes to branch: ${branchName}`)
    const pushResult = await container.runCommand('git', ['push', '-u', 'origin', branchName])

    if (!pushResult.success) {
      await logger.error('Failed to push changes to remote')
      return { success: false, pushFailed: true, error: 'Failed to push changes' }
    }

    await logger.success('Changes pushed successfully')
    return { success: true }
  } else {
    return pushChangesVercel(sandbox as Sandbox, branchName, commitMessage, logger)
  }
}

/**
 * Shutdown sandbox (unified interface)
 */
export async function shutdownUnifiedSandbox(
  sandbox: UnifiedSandbox,
  taskId: string,
): Promise<{ success: boolean; error?: string }> {
  const mode = await getExecutionMode()

  if (mode === 'docker') {
    const container = sandbox as DockerContainer
    try {
      await container.destroy()
      destroyDockerContainer(taskId)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  } else {
    unregisterSandbox(taskId)
    return shutdownSandbox(sandbox as Sandbox)
  }
}
