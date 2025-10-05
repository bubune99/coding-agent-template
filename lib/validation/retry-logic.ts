import { TaskLogger } from '../utils/task-logger'
import { UnifiedSandbox } from '../unified-sandbox'
import { AgentType } from '../sandbox/agents'

export interface AttemptMetadata {
  attemptNumber: number
  timestamp: Date
  commitHash?: string
  testResults?: {
    passed: boolean
    errors: string[]
  }
  agentResult?: {
    success: boolean
    error?: string
  }
}

export interface RetryConfig {
  maxAttempts: number
  rollbackThreshold: number // Number of failures before considering rollback
}

export interface RetryDecision {
  shouldRetry: boolean
  shouldRollback: boolean
  reason: string
  suggestedAction?: string
}

export class RetryManager {
  private attempts: AttemptMetadata[] = []
  private config: RetryConfig

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxAttempts: config?.maxAttempts || 3,
      rollbackThreshold: config?.rollbackThreshold || 2,
    }
  }

  /**
   * Record an attempt
   */
  recordAttempt(metadata: AttemptMetadata): void {
    this.attempts.push(metadata)
  }

  /**
   * Get all attempts
   */
  getAttempts(): AttemptMetadata[] {
    return [...this.attempts]
  }

  /**
   * Get current attempt number
   */
  getCurrentAttemptNumber(): number {
    return this.attempts.length
  }

  /**
   * Get last successful attempt (if any)
   */
  getLastSuccessfulAttempt(): AttemptMetadata | null {
    for (let i = this.attempts.length - 1; i >= 0; i--) {
      const attempt = this.attempts[i]
      if (attempt.testResults?.passed && attempt.agentResult?.success) {
        return attempt
      }
    }
    return null
  }

  /**
   * Analyze attempts and decide whether to retry or rollback
   */
  analyzeAndDecide(): RetryDecision {
    const attemptCount = this.attempts.length

    // Haven't tried yet
    if (attemptCount === 0) {
      return {
        shouldRetry: true,
        shouldRollback: false,
        reason: 'First attempt',
      }
    }

    // Max attempts reached
    if (attemptCount >= this.config.maxAttempts) {
      return {
        shouldRetry: false,
        shouldRollback: true,
        reason: `Maximum attempts (${this.config.maxAttempts}) reached`,
        suggestedAction: 'Rollback to last working version or flag for manual intervention',
      }
    }

    // Check if we're making progress
    const lastAttempt = this.attempts[this.attempts.length - 1]
    const isStuckInLoop = this.detectErrorLoop()

    if (isStuckInLoop) {
      return {
        shouldRetry: false,
        shouldRollback: true,
        reason: 'Stuck in error loop (same errors repeating)',
        suggestedAction: 'Try alternative approach or rollback',
      }
    }

    // Check if last attempt had different errors (progress)
    const isProgressing = this.detectProgress()

    if (!isProgressing && attemptCount >= this.config.rollbackThreshold) {
      return {
        shouldRetry: false,
        shouldRollback: true,
        reason: 'No progress detected after multiple attempts',
        suggestedAction: 'Consider different implementation strategy',
      }
    }

    // Continue retrying
    return {
      shouldRetry: true,
      shouldRollback: false,
      reason: `Retry attempt ${attemptCount + 1}/${this.config.maxAttempts}`,
      suggestedAction: 'Refine approach based on previous errors',
    }
  }

  /**
   * Detect if we're stuck in an error loop (same errors repeating)
   */
  private detectErrorLoop(): boolean {
    if (this.attempts.length < 2) {
      return false
    }

    const lastAttempt = this.attempts[this.attempts.length - 1]
    const previousAttempt = this.attempts[this.attempts.length - 2]

    if (!lastAttempt.testResults || !previousAttempt.testResults) {
      return false
    }

    // Compare error messages
    const lastErrors = lastAttempt.testResults.errors.join('|')
    const prevErrors = previousAttempt.testResults.errors.join('|')

    // If errors are very similar (>80% overlap), we're likely in a loop
    const similarity = this.calculateStringSimilarity(lastErrors, prevErrors)

    return similarity > 0.8
  }

  /**
   * Detect if we're making progress (different/fewer errors)
   */
  private detectProgress(): boolean {
    if (this.attempts.length < 2) {
      return true // First attempt is always "progress"
    }

    const lastAttempt = this.attempts[this.attempts.length - 1]
    const previousAttempt = this.attempts[this.attempts.length - 2]

    if (!lastAttempt.testResults || !previousAttempt.testResults) {
      return false
    }

    // Fewer errors = progress
    if (lastAttempt.testResults.errors.length < previousAttempt.testResults.errors.length) {
      return true
    }

    // Different errors = progress
    const lastErrors = lastAttempt.testResults.errors.join('|')
    const prevErrors = previousAttempt.testResults.errors.join('|')
    const similarity = this.calculateStringSimilarity(lastErrors, prevErrors)

    return similarity < 0.7 // Different errors indicate trying new things
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1
    if (str1.length === 0 || str2.length === 0) return 0

    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Generate feedback for next retry attempt
   */
  generateRetryFeedback(): string {
    const lastAttempt = this.attempts[this.attempts.length - 1]

    if (!lastAttempt || !lastAttempt.testResults) {
      return 'Previous attempt failed. Please try a different approach.'
    }

    const errors = lastAttempt.testResults.errors
    const attemptNumber = this.attempts.length

    let feedback = `Attempt ${attemptNumber} failed with the following issues:\n\n`

    errors.forEach((error, i) => {
      feedback += `${i + 1}. ${error}\n`
    })

    feedback += `\nPlease fix these specific issues. `

    if (attemptNumber >= 2) {
      feedback += `This is attempt ${attemptNumber}/${this.config.maxAttempts}. `
      feedback += `Focus on addressing the root cause, not just symptoms. `
    }

    if (this.detectErrorLoop()) {
      feedback += `\nWARNING: Similar errors detected in previous attempts. Consider a completely different approach.`
    }

    return feedback
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalAttempts: number
    successfulAttempts: number
    failedAttempts: number
    lastAttemptPassed: boolean
  } {
    const successful = this.attempts.filter((a) => a.testResults?.passed && a.agentResult?.success).length
    const lastAttempt = this.attempts[this.attempts.length - 1]

    return {
      totalAttempts: this.attempts.length,
      successfulAttempts: successful,
      failedAttempts: this.attempts.length - successful,
      lastAttemptPassed: lastAttempt?.testResults?.passed || false,
    }
  }
}

/**
 * Execute retry loop with validation
 */
export async function executeWithRetry(
  sandbox: UnifiedSandbox,
  taskDescription: string,
  agentType: AgentType,
  logger: TaskLogger,
  executeAttempt: (
    attemptNumber: number,
    feedback?: string,
  ) => Promise<{
    success: boolean
    testResults?: { passed: boolean; errors: string[] }
    error?: string
  }>,
  config?: Partial<RetryConfig>,
): Promise<{ success: boolean; attempts: AttemptMetadata[]; finalError?: string }> {
  const retryManager = new RetryManager(config)

  while (true) {
    const decision = retryManager.analyzeAndDecide()

    if (!decision.shouldRetry) {
      await logger.error(`Stopping retries: ${decision.reason}`)
      if (decision.suggestedAction) {
        await logger.info(`Suggestion: ${decision.suggestedAction}`)
      }

      return {
        success: false,
        attempts: retryManager.getAttempts(),
        finalError: decision.reason,
      }
    }

    const attemptNumber = retryManager.getCurrentAttemptNumber() + 1
    const feedback = attemptNumber > 1 ? retryManager.generateRetryFeedback() : undefined

    await logger.info(`Starting attempt ${attemptNumber}/${config?.maxAttempts || 3}...`)

    if (feedback) {
      await logger.info(`Feedback from previous attempt: ${feedback}`)
    }

    try {
      const result = await executeAttempt(attemptNumber, feedback)

      // Record attempt
      retryManager.recordAttempt({
        attemptNumber,
        timestamp: new Date(),
        testResults: result.testResults,
        agentResult: {
          success: result.success,
          error: result.error,
        },
      })

      // Check if successful
      if (result.success && result.testResults?.passed) {
        await logger.success(`Attempt ${attemptNumber} succeeded!`)
        return {
          success: true,
          attempts: retryManager.getAttempts(),
        }
      }

      // Failed, continue to next iteration
      await logger.error(`Attempt ${attemptNumber} failed`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await logger.error(`Attempt ${attemptNumber} threw error: ${message}`)

      retryManager.recordAttempt({
        attemptNumber,
        timestamp: new Date(),
        agentResult: {
          success: false,
          error: message,
        },
      })
    }
  }
}
