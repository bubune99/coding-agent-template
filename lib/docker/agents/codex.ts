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

async function installCodexCLI(container: DockerContainer, logger: TaskLogger): Promise<{ success: boolean }> {
  await logger.info('Installing Codex CLI...')

  // Codex CLI is installed via npm
  const codexInstall = await container.runCommand('npm', ['install', '-g', '@openai/codex-cli'])

  if (codexInstall.success) {
    await logger.info('Codex CLI installed successfully')
    return { success: true }
  } else {
    await logger.error('Failed to install Codex CLI')
    return { success: false }
  }
}

export async function executeCodexInDocker(
  container: DockerContainer,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
): Promise<AgentExecutionResult> {
  try {
    // Check if Codex CLI is available
    const cliCheck = await runAndLogCommand(container, 'which', ['codex'], logger)

    if (!cliCheck.success) {
      // Install Codex CLI
      const installResult = await installCodexCLI(container, logger)

      if (!installResult.success) {
        return {
          success: false,
          error: 'Failed to install Codex CLI',
          cliName: 'codex',
          changesDetected: false,
        }
      }

      // Verify installation
      const verifyCheck = await runAndLogCommand(container, 'which', ['codex'], logger)
      if (!verifyCheck.success) {
        return {
          success: false,
          error: 'Codex CLI installation completed but CLI still not found',
          cliName: 'codex',
          changesDetected: false,
        }
      }
    }

    // Check if AI_GATEWAY_API_KEY is available (Codex uses OpenAI)
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OPENAI_API_KEY or AI_GATEWAY_API_KEY environment variable is required',
        cliName: 'codex',
        changesDetected: false,
      }
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY

    // Execute Codex CLI
    await logger.info('Executing Codex CLI...')

    const envPrefix = `OPENAI_API_KEY="${apiKey}"`
    const fullCommand = `${envPrefix} codex "${instruction}"`

    const redactedCommand = fullCommand.replace(apiKey!, '[REDACTED]')
    await logger.command(redactedCommand)

    const result = await container.runCommand('sh', ['-c', fullCommand])

    if (!result) {
      const errorMsg = 'Codex CLI execution failed - no result returned'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'codex',
        changesDetected: false,
      }
    }

    // Log the output
    if (result.output && result.output.trim()) {
      const redactedOutput = redactSensitiveInfo(result.output.trim())
      await logger.info(redactedOutput)
    }

    if (!result.success && result.error) {
      const redactedError = redactSensitiveInfo(result.error)
      await logger.error(redactedError)
    }

    // Check if any files were modified
    const gitStatusCheck = await runAndLogCommand(container, 'git', ['status', '--porcelain'], logger)
    const hasChanges = gitStatusCheck.success && gitStatusCheck.output?.trim()

    if (result.success || result.exitCode === 0) {
      return {
        success: true,
        output: `Codex CLI executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`,
        agentResponse: result.output || 'No detailed response available',
        cliName: 'codex',
        changesDetected: !!hasChanges,
        error: undefined,
      }
    } else {
      return {
        success: false,
        error: `Codex CLI failed (exit code ${result.exitCode}): ${result.error || 'No error message'}`,
        agentResponse: result.output,
        cliName: 'codex',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Codex CLI in Docker'
    return {
      success: false,
      error: errorMessage,
      cliName: 'codex',
      changesDetected: false,
    }
  }
}
