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

async function installCursorCLI(container: DockerContainer, logger: TaskLogger): Promise<{ success: boolean }> {
  await logger.info('Installing Cursor CLI...')

  const cursorInstall = await container.runCommand('npm', ['install', '-g', '@cursor/cli'])

  if (cursorInstall.success) {
    await logger.info('Cursor CLI installed successfully')
    return { success: true }
  } else {
    await logger.error('Failed to install Cursor CLI')
    return { success: false }
  }
}

export async function executeCursorInDocker(
  container: DockerContainer,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
): Promise<AgentExecutionResult> {
  try {
    const cliCheck = await runAndLogCommand(container, 'which', ['cursor'], logger)

    if (!cliCheck.success) {
      const installResult = await installCursorCLI(container, logger)

      if (!installResult.success) {
        return {
          success: false,
          error: 'Failed to install Cursor CLI',
          cliName: 'cursor',
          changesDetected: false,
        }
      }

      const verifyCheck = await runAndLogCommand(container, 'which', ['cursor'], logger)
      if (!verifyCheck.success) {
        return {
          success: false,
          error: 'Cursor CLI installation completed but CLI still not found',
          cliName: 'cursor',
          changesDetected: false,
        }
      }
    }

    if (!process.env.CURSOR_API_KEY) {
      return {
        success: false,
        error: 'CURSOR_API_KEY environment variable is required',
        cliName: 'cursor',
        changesDetected: false,
      }
    }

    await logger.info('Executing Cursor CLI...')

    const envPrefix = `CURSOR_API_KEY="${process.env.CURSOR_API_KEY}"`
    const fullCommand = `${envPrefix} cursor "${instruction}"`

    const redactedCommand = fullCommand.replace(process.env.CURSOR_API_KEY!, '[REDACTED]')
    await logger.command(redactedCommand)

    const result = await container.runCommand('sh', ['-c', fullCommand])

    if (!result) {
      const errorMsg = 'Cursor CLI execution failed - no result returned'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'cursor',
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
        output: `Cursor CLI executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`,
        agentResponse: result.output || 'No detailed response available',
        cliName: 'cursor',
        changesDetected: !!hasChanges,
        error: undefined,
      }
    } else {
      return {
        success: false,
        error: `Cursor CLI failed (exit code ${result.exitCode}): ${result.error || 'No error message'}`,
        agentResponse: result.output,
        cliName: 'cursor',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Cursor CLI in Docker'
    return {
      success: false,
      error: errorMessage,
      cliName: 'cursor',
      changesDetected: false,
    }
  }
}
