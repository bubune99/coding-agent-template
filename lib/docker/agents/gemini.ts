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

async function installGeminiCLI(container: DockerContainer, logger: TaskLogger): Promise<{ success: boolean }> {
  await logger.info('Installing Gemini CLI...')

  const geminiInstall = await container.runCommand('npm', ['install', '-g', '@google/gemini-cli'])

  if (geminiInstall.success) {
    await logger.info('Gemini CLI installed successfully')
    return { success: true }
  } else {
    await logger.error('Failed to install Gemini CLI')
    return { success: false }
  }
}

export async function executeGeminiInDocker(
  container: DockerContainer,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
): Promise<AgentExecutionResult> {
  try {
    const cliCheck = await runAndLogCommand(container, 'which', ['gemini'], logger)

    if (!cliCheck.success) {
      const installResult = await installGeminiCLI(container, logger)

      if (!installResult.success) {
        return {
          success: false,
          error: 'Failed to install Gemini CLI',
          cliName: 'gemini',
          changesDetected: false,
        }
      }

      const verifyCheck = await runAndLogCommand(container, 'which', ['gemini'], logger)
      if (!verifyCheck.success) {
        return {
          success: false,
          error: 'Gemini CLI installation completed but CLI still not found',
          cliName: 'gemini',
          changesDetected: false,
        }
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        error: 'GEMINI_API_KEY environment variable is required',
        cliName: 'gemini',
        changesDetected: false,
      }
    }

    await logger.info('Executing Gemini CLI...')

    const modelToUse = selectedModel || 'gemini-pro'
    const envPrefix = `GEMINI_API_KEY="${process.env.GEMINI_API_KEY}"`
    const fullCommand = `${envPrefix} gemini --model "${modelToUse}" "${instruction}"`

    const redactedCommand = fullCommand.replace(process.env.GEMINI_API_KEY!, '[REDACTED]')
    await logger.command(redactedCommand)

    const result = await container.runCommand('sh', ['-c', fullCommand])

    if (!result) {
      const errorMsg = 'Gemini CLI execution failed - no result returned'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'gemini',
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
        output: `Gemini CLI executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`,
        agentResponse: result.output || 'No detailed response available',
        cliName: 'gemini',
        changesDetected: !!hasChanges,
        error: undefined,
      }
    } else {
      return {
        success: false,
        error: `Gemini CLI failed (exit code ${result.exitCode}): ${result.error || 'No error message'}`,
        agentResponse: result.output,
        cliName: 'gemini',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Gemini CLI in Docker'
    return {
      success: false,
      error: errorMessage,
      cliName: 'gemini',
      changesDetected: false,
    }
  }
}
