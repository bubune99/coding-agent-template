/**
 * Validation Orchestrator - Main entry point for validation system
 *
 * Coordinates:
 * - Test generation
 * - Test execution
 * - Retry logic
 * - Version control
 * - Rollback decisions
 */

import { UnifiedSandbox, executeAgentInUnifiedSandbox } from '../unified-sandbox'
import { AgentType } from '../sandbox/agents'
import { TaskLogger } from '../utils/task-logger'
import { generatePlaywrightTests, detectProjectInfo } from './test-generator'
import { installPlaywright, writeTestFile, executePlaywrightTests, TestExecutionResult } from './test-executor'
import { RetryManager, AttemptMetadata } from './retry-logic'
import { VersionController } from './version-control'
import { RollbackEngine, DEFAULT_ROLLBACK_STRATEGY, RollbackStrategy } from './rollback-engine'
import { executeV0IfNeeded, V0IntegrationConfig, DEFAULT_V0_CONFIG } from '../v0/integration'

export interface ValidationConfig {
  enableValidation: boolean
  generateTests: boolean
  maxAttempts: number
  rollbackStrategy?: RollbackStrategy
  v0Config?: V0IntegrationConfig
}

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  enableValidation: true,
  generateTests: true,
  maxAttempts: 3,
  rollbackStrategy: DEFAULT_ROLLBACK_STRATEGY,
  v0Config: DEFAULT_V0_CONFIG,
}

export interface ValidationResult {
  success: boolean
  attempts: number
  finalTestResults?: TestExecutionResult
  rolledBack: boolean
  error?: string
}

/**
 * Execute agent with validation and auto-retry
 */
export async function executeAgentWithValidation(
  sandbox: UnifiedSandbox,
  taskDescription: string,
  agentType: AgentType,
  logger: TaskLogger,
  selectedModel?: string,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
  onCancellationCheck?: () => Promise<boolean>,
): Promise<ValidationResult> {
  // If validation is disabled, just execute agent once
  if (!config.enableValidation) {
    await logger.info('Validation disabled, executing agent without tests...')

    const result = await executeAgentInUnifiedSandbox(
      sandbox,
      taskDescription,
      agentType,
      logger,
      selectedModel,
      onCancellationCheck,
    )

    return {
      success: result.success,
      attempts: 1,
      rolledBack: false,
      error: result.error,
    }
  }

  await logger.info('🔍 Validation enabled - executing with auto-retry and rollback...')

  // Initialize managers
  const retryManager = new RetryManager({
    maxAttempts: config.maxAttempts,
    rollbackThreshold: config.rollbackStrategy?.rollbackThreshold || 2,
  })

  const versionController = new VersionController(sandbox, logger)
  const rollbackEngine = new RollbackEngine(versionController, logger, [])

  let testCode: string | undefined
  let testFilePath: string | undefined
  let playwrightInstalled = false

  // Main retry loop
  while (true) {
    const decision = retryManager.analyzeAndDecide()

    // Check if we should stop
    if (!decision.shouldRetry) {
      await logger.error(`Stopping execution: ${decision.reason}`)

      // Decide if rollback is needed
      const rollbackDecision = await rollbackEngine.analyzeAndDecide()

      if (rollbackDecision.shouldRollback) {
        await rollbackEngine.executeRollback(rollbackDecision)

        return {
          success: false,
          attempts: retryManager.getCurrentAttemptNumber(),
          rolledBack: true,
          error: decision.reason,
        }
      }

      return {
        success: false,
        attempts: retryManager.getCurrentAttemptNumber(),
        rolledBack: false,
        error: decision.reason,
      }
    }

    const attemptNumber = retryManager.getCurrentAttemptNumber() + 1
    const feedback = attemptNumber > 1 ? retryManager.generateRetryFeedback() : undefined

    await logger.info(`\n========== Attempt ${attemptNumber}/${config.maxAttempts} ==========`)

    // Check for cancellation
    if (onCancellationCheck && (await onCancellationCheck())) {
      await logger.info('Task cancelled by user')
      return {
        success: false,
        attempts: attemptNumber,
        rolledBack: false,
        error: 'Cancelled by user',
      }
    }

    // Step 0.5: Try v0 generation if UI-focused (first attempt only)
    if (attemptNumber === 1 && config.v0Config?.enableV0) {
      const v0Result = await executeV0IfNeeded(sandbox, taskDescription, logger, config.v0Config)

      if (v0Result.v0Used && v0Result.success) {
        await logger.success('v0 component generated, proceeding to validation...')
      } else if (v0Result.v0Used && !v0Result.success) {
        await logger.info('v0 generation failed, falling back to agent execution')
      }
    }

    // Step 1: Execute agent
    let enhancedPrompt = taskDescription
    if (feedback) {
      enhancedPrompt += `\n\n## Feedback from Previous Attempt:\n${feedback}`
    }

    await logger.info(`📝 Executing ${agentType} agent...`)
    const agentResult = await executeAgentInUnifiedSandbox(
      sandbox,
      enhancedPrompt,
      agentType,
      logger,
      selectedModel,
      onCancellationCheck,
    )

    if (!agentResult.success) {
      await logger.error(`Agent execution failed: ${agentResult.error}`)

      // Record failed attempt
      const attemptMetadata: AttemptMetadata = {
        attemptNumber,
        timestamp: new Date(),
        agentResult: {
          success: false,
          error: agentResult.error,
        },
      }

      retryManager.recordAttempt(attemptMetadata)
      rollbackEngine.addAttempt(attemptMetadata)

      continue // Retry
    }

    await logger.success('Agent execution completed')

    // Step 2: Get changed files for test generation
    const changedFiles = await versionController.getChangedFiles()

    if (changedFiles.length === 0) {
      await logger.info('No files changed, skipping validation')

      return {
        success: true,
        attempts: attemptNumber,
        rolledBack: false,
      }
    }

    await logger.info(`Files changed: ${changedFiles.join(', ')}`)

    // Step 3: Generate tests (first attempt only, or if previous tests failed)
    if (config.generateTests && (!testCode || attemptNumber > 1)) {
      await logger.info('🧪 Generating Playwright tests...')

      const projectInfo = await detectProjectInfo(changedFiles)
      await logger.info(`Detected project type: ${projectInfo.projectType}`)

      if (projectInfo.projectType !== 'web') {
        await logger.info('Skipping test generation for non-web project')

        // Create version without tests
        await versionController.createVersion(attemptNumber, taskDescription, true)

        return {
          success: true,
          attempts: attemptNumber,
          rolledBack: false,
        }
      }

      const testGenResult = await generatePlaywrightTests({
        taskDescription,
        projectType: projectInfo.projectType,
        frameworkDetected: projectInfo.frameworkDetected,
        filesChanged: changedFiles,
      })

      if (!testGenResult.success) {
        await logger.error(`Failed to generate tests: ${testGenResult.error}`)
        // Continue without tests
        await versionController.createVersion(attemptNumber, taskDescription, true)

        return {
          success: true,
          attempts: attemptNumber,
          rolledBack: false,
        }
      }

      testCode = testGenResult.testCode!
      testFilePath = testGenResult.testFilePath!

      await logger.success(`Tests generated: ${testFilePath}`)
    }

    // Step 4: Install Playwright (once)
    if (testCode && !playwrightInstalled) {
      await logger.info('📦 Installing Playwright...')

      const installResult = await installPlaywright(sandbox, logger)

      if (!installResult.success) {
        await logger.error(`Failed to install Playwright: ${installResult.error}`)
        // Continue without tests
        await versionController.createVersion(attemptNumber, taskDescription, true)

        return {
          success: true,
          attempts: attemptNumber,
          rolledBack: false,
        }
      }

      playwrightInstalled = true
    }

    // Step 5: Write test file
    if (testCode && testFilePath) {
      const writeResult = await writeTestFile(sandbox, testCode, testFilePath, logger)

      if (!writeResult.success) {
        await logger.error(`Failed to write test file: ${writeResult.error}`)
        // Continue without tests
        await versionController.createVersion(attemptNumber, taskDescription, true)

        return {
          success: true,
          attempts: attemptNumber,
          rolledBack: false,
        }
      }
    }

    // Step 6: Execute tests
    let testResults: TestExecutionResult | undefined

    if (testCode && testFilePath && playwrightInstalled) {
      await logger.info('🧪 Running Playwright tests...')

      testResults = await executePlaywrightTests(sandbox, testFilePath, logger)

      if (!testResults.success) {
        await logger.error('Test execution failed')
      }

      if (testResults.passed) {
        await logger.success('✅ All tests passed!')

        // Create stable version
        await versionController.createVersion(
          attemptNumber,
          taskDescription,
          true, // Stable
          {
            passed: true,
            testsPassed: testResults.testsPassed,
            testsFailed: testResults.testsFailed,
          },
        )

        return {
          success: true,
          attempts: attemptNumber,
          finalTestResults: testResults,
          rolledBack: false,
        }
      } else {
        await logger.error(`❌ Tests failed: ${testResults.testsFailed}/${testResults.testsTotal}`)

        // Create unstable version
        await versionController.createVersion(
          attemptNumber,
          taskDescription,
          false, // Not stable
          {
            passed: false,
            testsPassed: testResults.testsPassed,
            testsFailed: testResults.testsFailed,
          },
        )

        // Record attempt
        const attemptMetadata: AttemptMetadata = {
          attemptNumber,
          timestamp: new Date(),
          testResults: {
            passed: false,
            errors: testResults.errors,
          },
          agentResult: {
            success: true,
          },
        }

        retryManager.recordAttempt(attemptMetadata)
        rollbackEngine.addAttempt(attemptMetadata)

        // Continue to next iteration (will retry)
        continue
      }
    } else {
      // No tests available, mark as success
      await logger.info('No tests to run, marking as success')

      await versionController.createVersion(attemptNumber, taskDescription, true)

      return {
        success: true,
        attempts: attemptNumber,
        rolledBack: false,
      }
    }
  }
}
