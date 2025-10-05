import { VersionController, VersionMetadata } from './version-control'
import { analyzeErrorPatterns, generateAlternativeApproach, PatternAnalysisResult } from './pattern-recognition'
import { AttemptMetadata } from './retry-logic'
import { TaskLogger } from '../utils/task-logger'
import { UnifiedSandbox } from '../unified-sandbox'

export interface RollbackDecision {
  shouldRollback: boolean
  rollbackTarget?: string // commit hash
  reason: string
  confidence: number
  alternativeApproach?: string
}

export class RollbackEngine {
  private versionController: VersionController
  private logger: TaskLogger
  private attempts: AttemptMetadata[]

  constructor(versionController: VersionController, logger: TaskLogger, attempts: AttemptMetadata[] = []) {
    this.versionController = versionController
    this.logger = logger
    this.attempts = attempts
  }

  /**
   * Analyze current state and decide if rollback is needed
   */
  async analyzeAndDecide(): Promise<RollbackDecision> {
    await this.logger.info('Analyzing error patterns and version history...')

    // Get pattern analysis
    const patternAnalysis = analyzeErrorPatterns(this.attempts)

    await this.logger.info(`Pattern analysis: ${patternAnalysis.overallAssessment}`)
    await this.logger.info(`Reasoning: ${patternAnalysis.reasoning}`)

    // Log detected patterns
    if (patternAnalysis.patterns.length > 0) {
      await this.logger.info('Detected patterns:')
      patternAnalysis.patterns.forEach((pattern) => {
        this.logger.info(
          `- ${pattern.type}: ${pattern.description} (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`,
        )
      })
    }

    // Determine rollback decision
    const decision = this.makeRollbackDecision(patternAnalysis)

    if (decision.shouldRollback) {
      await this.logger.error(`Rollback recommended: ${decision.reason}`)
      if (decision.alternativeApproach) {
        await this.logger.info(`Alternative approach suggested:\n${decision.alternativeApproach}`)
      }
    } else {
      await this.logger.info('No rollback needed. Continue with current approach.')
    }

    return decision
  }

  /**
   * Execute rollback if needed
   */
  async executeRollback(decision: RollbackDecision): Promise<{ success: boolean; error?: string }> {
    if (!decision.shouldRollback) {
      return { success: true }
    }

    if (!decision.rollbackTarget) {
      return { success: false, error: 'No rollback target specified' }
    }

    await this.logger.info(`Executing rollback to ${decision.rollbackTarget.substring(0, 8)}...`)

    const result = await this.versionController.rollbackToVersion(decision.rollbackTarget)

    if (result.success) {
      await this.logger.success('Rollback completed successfully')
    } else {
      await this.logger.error(`Rollback failed: ${result.error}`)
    }

    return result
  }

  /**
   * Make rollback decision based on pattern analysis
   */
  private makeRollbackDecision(patternAnalysis: PatternAnalysisResult): RollbackDecision {
    const { overallAssessment, patterns, reasoning } = patternAnalysis

    // Get last stable version
    const lastStable = this.versionController.getLastStableVersion()

    // Case 1: Manual intervention needed
    if (overallAssessment === 'manual_intervention') {
      return {
        shouldRollback: true,
        rollbackTarget: lastStable?.commitHash,
        reason: 'Manual intervention required. ' + reasoning,
        confidence: 0.9,
        alternativeApproach: 'Task complexity requires human review and breakdown into smaller steps.',
      }
    }

    // Case 2: Rollback recommended
    if (overallAssessment === 'rollback') {
      const alternatives = generateAlternativeApproach(patterns, this.attempts)

      return {
        shouldRollback: true,
        rollbackTarget: lastStable?.commitHash,
        reason: reasoning,
        confidence: 0.85,
        alternativeApproach: alternatives,
      }
    }

    // Case 3: Continue (no rollback)
    return {
      shouldRollback: false,
      reason: reasoning,
      confidence: 0.7,
    }
  }

  /**
   * Add attempt to history
   */
  addAttempt(attempt: AttemptMetadata): void {
    this.attempts.push(attempt)
  }

  /**
   * Get summary of rollback engine state
   */
  getSummary(): {
    totalAttempts: number
    stableVersions: number
    lastStableAttempt?: number
    patterns: string[]
  } {
    const patternAnalysis = analyzeErrorPatterns(this.attempts)
    const lastStable = this.versionController.getLastStableVersion()
    const stableVersions = this.versionController.getVersionHistory().filter((v) => v.isStable).length

    return {
      totalAttempts: this.attempts.length,
      stableVersions,
      lastStableAttempt: lastStable?.attemptNumber,
      patterns: patternAnalysis.patterns.map((p) => `${p.type} (${(p.confidence * 100).toFixed(0)}%)`),
    }
  }
}

/**
 * Create a rollback strategy based on configuration
 */
export interface RollbackStrategy {
  maxAttempts: number
  rollbackThreshold: number
  autoRollback: boolean // If true, automatically rollback without confirmation
}

export const DEFAULT_ROLLBACK_STRATEGY: RollbackStrategy = {
  maxAttempts: 3,
  rollbackThreshold: 2,
  autoRollback: true,
}
