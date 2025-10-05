import { DockerContainer } from '../container'
import { AgentExecutionResult } from '@/lib/sandbox/types'
import { redactSensitiveInfo } from '@/lib/utils/logging'
import { TaskLogger } from '@/lib/utils/task-logger'

async function runAndLogCommand(container: DockerContainer, command: string, args: string[], logger: TaskLogger) {
  const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command
  const redactedCommand = redactSensitiveInfo(fullCommand)

  await logger.command(redactedCommand)

  const result = await container.runCommand(command, args)

  if (result && result.output && result.output.trim()) {
    const redactedOutput = redactSensitiveInfo(result.output.trim())
    await logger.info(redactedOutput)
  }

  if (result && !result.success && result.error) {
    const redactedError = redactSensitiveInfo(result.error)
    await logger.error(redactedError)
  }

  return result
}

async function installOpenCodeCLI(container: DockerContainer, logger: TaskLogger): Promise<{ success: boolean }> {
  await logger.info('Installing OpenCode CLI...')

  const opencodeInstall = await container.runCommand('npm', ['install', '-g', 'opencode'])

  if (opencodeInstall.success) {
    await logger.info('OpenCode CLI installed successfully')
    return { success: true }
  } else {
    await logger.error('Failed to install OpenCode CLI')
    return { success: false }
  }
}

export async function executeOpenCodeInDocker(
  container: DockerContainer,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
): Promise<AgentExecutionResult> {
  try {
    const cliCheck = await runAndLogCommand(container, 'which', ['opencode'], logger)

    if (!cliCheck.success) {
      const installResult = await installOpenCodeCLI(container, logger)

      if (!installResult.success) {
        return {
          success: false,
          error: 'Failed to install OpenCode CLI',
          cliName: 'opencode',
          changesDetected: false,
        }
      }

      const verifyCheck = await runAndLogCommand(container, 'which', ['opencode'], logger)
      if (!verifyCheck.success) {
        return {
          success: false,
          error: 'OpenCode CLI installation completed but CLI still not found',
          cliName: 'opencode',
          changesDetected: false,
        }
      }
    }

    await logger.info('Executing OpenCode CLI...')

    const fullCommand = `opencode "${instruction}"`
    await logger.command(fullCommand)

    const result = await container.runCommand('sh', ['-c', fullCommand])

    if (!result) {
      const errorMsg = 'OpenCode CLI execution failed - no result returned'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'opencode',
        changesDetected: false,
      }
    }

    if (result.output && result.output.trim()) {
      const redactedOutput = redactSensitiveInfo(result.output.trim())
      await logger.info(redactedOutput)
    }

    if (!result.success && result.error) {
      const redactedError = redactSensitiveInfo(result.error)
      await logger.error(redactedError)
    }

    const gitStatusCheck = await runAndLogCommand(container, 'git', ['status', '--porcelain'], logger)
    const hasChanges = gitStatusCheck.success && gitStatusCheck.output?.trim()

    if (result.success || result.exitCode === 0) {
      return {
        success: true,
        output: `OpenCode CLI executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`,
        agentResponse: result.output || 'No detailed response available',
        cliName: 'opencode',
        changesDetected: !!hasChanges,
        error: undefined,
      }
    } else {
      return {
        success: false,
        error: `OpenCode CLI failed (exit code ${result.exitCode}): ${result.error || 'No error message'}`,
        agentResponse: result.output,
        cliName: 'opencode',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute OpenCode CLI in Docker'
    return {
      success: false,
      error: errorMessage,
      cliName: 'opencode',
      changesDetected: false,
    }
  }
}
