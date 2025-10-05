import { DockerContainer } from '../container'
import { AgentExecutionResult } from '@/lib/sandbox/types'
import { executeClaudeInDocker } from './claude'
import { executeCodexInDocker } from './codex'
import { executeCursorInDocker } from './cursor'
import { executeGeminiInDocker } from './gemini'
import { executeOpenCodeInDocker } from './opencode'
import { TaskLogger } from '@/lib/utils/task-logger'
import { AgentType } from '@/lib/sandbox/agents'

/**
 * Execute an agent in a Docker container
 */
export async function executeAgentInDocker(
  container: DockerContainer,
  instruction: string,
  agentType: AgentType,
  logger: TaskLogger,
  selectedModel?: string,
  onCancellationCheck?: () => Promise<boolean>,
): Promise<AgentExecutionResult> {
  // Check for cancellation before starting
  if (onCancellationCheck && (await onCancellationCheck())) {
    await logger.info('Task was cancelled before agent execution')
    return {
      success: false,
      error: 'Task was cancelled',
      cliName: agentType,
      changesDetected: false,
    }
  }

  switch (agentType) {
    case 'claude':
      return executeClaudeInDocker(container, instruction, logger, selectedModel)

    case 'codex':
      return executeCodexInDocker(container, instruction, logger, selectedModel)

    case 'cursor':
      return executeCursorInDocker(container, instruction, logger, selectedModel)

    case 'gemini':
      return executeGeminiInDocker(container, instruction, logger, selectedModel)

    case 'opencode':
      return executeOpenCodeInDocker(container, instruction, logger, selectedModel)

    default:
      return {
        success: false,
        error: `Unknown agent type: ${agentType}`,
        cliName: agentType,
        changesDetected: false,
      }
  }
}
