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

async function installClaudeCLI(
  container: DockerContainer,
  logger: TaskLogger,
  selectedModel?: string,
): Promise<{ success: boolean }> {
  await logger.info('Installing Claude CLI...')
  const claudeInstall = await container.runCommand('npm', ['install', '-g', '@anthropic-ai/claude-code'])

  if (claudeInstall.success) {
    await logger.info('Claude CLI installed successfully')

    // Authenticate Claude CLI with API key
    if (process.env.ANTHROPIC_API_KEY) {
      await logger.info('Authenticating Claude CLI...')

      const modelToUse = selectedModel || 'claude-sonnet-4-5-20250929'
      const configFileCmd = `mkdir -p $HOME/.config/claude && cat > $HOME/.config/claude/config.json << 'EOF'
{
  "api_key": "${process.env.ANTHROPIC_API_KEY}",
  "default_model": "${modelToUse}"
}
EOF`
      const configFileResult = await container.runCommand('sh', ['-c', configFileCmd])

      if (configFileResult.success) {
        await logger.info('Claude CLI config file created successfully')
      } else {
        await logger.info('Warning: Failed to create Claude CLI config file')
      }

      // Verify authentication
      const verifyAuth = await container.runCommand('sh', [
        '-c',
        `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY} claude --version`,
      ])
      if (verifyAuth.success) {
        await logger.info('Claude CLI authentication verified')
      } else {
        await logger.info('Warning: Claude CLI authentication could not be verified')
      }
    } else {
      await logger.info('Warning: ANTHROPIC_API_KEY not found, Claude CLI may not work')
    }

    return { success: true }
  } else {
    await logger.info('Failed to install Claude CLI')
    return { success: false }
  }
}

export async function executeClaudeInDocker(
  container: DockerContainer,
  instruction: string,
  logger: TaskLogger,
  selectedModel?: string,
): Promise<AgentExecutionResult> {
  try {
    // Check if Claude CLI is available
    const cliCheck = await runAndLogCommand(container, 'which', ['claude'], logger)

    if (!cliCheck.success) {
      // Install Claude CLI
      const installResult = await installClaudeCLI(container, logger, selectedModel)

      if (!installResult.success) {
        return {
          success: false,
          error: 'Failed to install Claude CLI',
          cliName: 'claude',
          changesDetected: false,
        }
      }

      // Verify installation
      const verifyCheck = await runAndLogCommand(container, 'which', ['claude'], logger)
      if (!verifyCheck.success) {
        return {
          success: false,
          error: 'Claude CLI installation completed but CLI still not found',
          cliName: 'claude',
          changesDetected: false,
        }
      }
    }

    // Check if ANTHROPIC_API_KEY is available
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        success: false,
        error: 'ANTHROPIC_API_KEY environment variable is required but not found',
        cliName: 'claude',
        changesDetected: false,
      }
    }

    // Execute Claude CLI
    const modelToUse = selectedModel || 'claude-sonnet-4-5-20250929'
    await logger.info(`Executing Claude CLI with model ${modelToUse}...`)

    const envPrefix = `ANTHROPIC_API_KEY="${process.env.ANTHROPIC_API_KEY}"`
    const fullCommand = `${envPrefix} claude --model "${modelToUse}" --dangerously-skip-permissions --verbose "${instruction}"`

    const redactedCommand = fullCommand.replace(process.env.ANTHROPIC_API_KEY!, '[REDACTED]')
    await logger.command(redactedCommand)

    const result = await container.runCommand('sh', ['-c', fullCommand])

    if (!result) {
      const errorMsg = 'Claude CLI execution failed - no result returned'
      await logger.error(errorMsg)
      return {
        success: false,
        error: errorMsg,
        cliName: 'claude',
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
        output: `Claude CLI executed successfully${hasChanges ? ' (Changes detected)' : ' (No changes made)'}`,
        agentResponse: result.output || 'No detailed response available',
        cliName: 'claude',
        changesDetected: !!hasChanges,
        error: undefined,
      }
    } else {
      return {
        success: false,
        error: `Claude CLI failed (exit code ${result.exitCode}): ${result.error || 'No error message'}`,
        agentResponse: result.output,
        cliName: 'claude',
        changesDetected: !!hasChanges,
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute Claude CLI in Docker'
    return {
      success: false,
      error: errorMessage,
      cliName: 'claude',
      changesDetected: false,
    }
  }
}
