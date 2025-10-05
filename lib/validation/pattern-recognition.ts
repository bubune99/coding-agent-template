import { AttemptMetadata } from './retry-logic'

export interface ErrorPattern {
  type: 'stuck_in_loop' | 'no_progress' | 'timeout' | 'different_errors' | 'improving'
  confidence: number // 0-1
  description: string
  recommendation: string
}

export interface PatternAnalysisResult {
  patterns: ErrorPattern[]
  overallAssessment: 'continue' | 'rollback' | 'manual_intervention'
  reasoning: string
}

/**
 * Analyze error patterns across multiple attempts
 */
export function analyzeErrorPatterns(attempts: AttemptMetadata[]): PatternAnalysisResult {
  if (attempts.length === 0) {
    return {
      patterns: [],
      overallAssessment: 'continue',
      reasoning: 'No attempts yet',
    }
  }

  const patterns: ErrorPattern[] = []

  // Pattern 1: Stuck in loop (same errors repeating)
  const loopPattern = detectStuckInLoop(attempts)
  if (loopPattern) patterns.push(loopPattern)

  // Pattern 2: No progress (error count not decreasing)
  const progressPattern = detectProgress(attempts)
  if (progressPattern) patterns.push(progressPattern)

  // Pattern 3: Timeout pattern
  const timeoutPattern = detectTimeoutPattern(attempts)
  if (timeoutPattern) patterns.push(timeoutPattern)

  // Pattern 4: Improving errors (different errors each time)
  const improvementPattern = detectImprovement(attempts)
  if (improvementPattern) patterns.push(improvementPattern)

  // Determine overall assessment
  const assessment = determineOverallAssessment(patterns, attempts)

  return {
    patterns,
    ...assessment,
  }
}

/**
 * Detect if we're stuck in an error loop
 */
function detectStuckInLoop(attempts: AttemptMetadata[]): ErrorPattern | null {
  if (attempts.length < 2) return null

  const lastTwo = attempts.slice(-2)
  const [prev, current] = lastTwo

  if (!prev.testResults || !current.testResults) return null

  const prevErrors = prev.testResults.errors
  const currentErrors = current.testResults.errors

  // Calculate similarity
  const similarity = calculateErrorSimilarity(prevErrors, currentErrors)

  if (similarity > 0.85) {
    return {
      type: 'stuck_in_loop',
      confidence: similarity,
      description: 'Very similar errors appearing in consecutive attempts',
      recommendation: 'Try a completely different approach or rollback',
    }
  }

  return null
}

/**
 * Detect progress (or lack thereof)
 */
function detectProgress(attempts: AttemptMetadata[]): ErrorPattern | null {
  if (attempts.length < 2) return null

  const recentAttempts = attempts.slice(-3) // Last 3 attempts
  const errorCounts = recentAttempts.filter((a) => a.testResults).map((a) => a.testResults!.errors.length)

  if (errorCounts.length < 2) return null

  // Check if error count is decreasing
  const isDecreasing = errorCounts.every((count, i) => {
    if (i === 0) return true
    return count <= errorCounts[i - 1]
  })

  const isIncreasing = errorCounts.every((count, i) => {
    if (i === 0) return true
    return count >= errorCounts[i - 1]
  })

  if (isIncreasing && errorCounts[errorCounts.length - 1] > errorCounts[0]) {
    return {
      type: 'no_progress',
      confidence: 0.8,
      description: 'Error count is increasing with each attempt',
      recommendation: 'Current approach is making things worse. Rollback and try different strategy.',
    }
  }

  if (!isDecreasing && errorCounts.every((c) => c === errorCounts[0])) {
    return {
      type: 'no_progress',
      confidence: 0.7,
      description: 'Error count is not decreasing',
      recommendation: 'No progress detected. Consider alternative approach.',
    }
  }

  return null
}

/**
 * Detect timeout pattern
 */
function detectTimeoutPattern(attempts: AttemptMetadata[]): ErrorPattern | null {
  const timeoutCount = attempts.filter((a) => a.agentResult?.error?.toLowerCase().includes('timeout')).length

  if (timeoutCount >= 2) {
    return {
      type: 'timeout',
      confidence: 0.9,
      description: `Timeout errors occurred in ${timeoutCount} attempts`,
      recommendation: 'Task may be too complex or require more time. Consider breaking into smaller tasks.',
    }
  }

  return null
}

/**
 * Detect improvement pattern
 */
function detectImprovement(attempts: AttemptMetadata[]): ErrorPattern | null {
  if (attempts.length < 2) return null

  const recentAttempts = attempts.slice(-3)
  const errorCounts = recentAttempts.filter((a) => a.testResults).map((a) => a.testResults!.errors.length)

  if (errorCounts.length < 2) return null

  // Check if errors are decreasing
  const isImproving = errorCounts.every((count, i) => {
    if (i === 0) return true
    return count < errorCounts[i - 1]
  })

  if (isImproving) {
    const improvementRate = 1 - errorCounts[errorCounts.length - 1] / errorCounts[0]

    return {
      type: 'improving',
      confidence: Math.min(improvementRate + 0.3, 1),
      description: `Error count decreasing: ${errorCounts[0]} → ${errorCounts[errorCounts.length - 1]}`,
      recommendation: 'Progress detected. Continue with current approach.',
    }
  }

  // Check if errors are different (trying new things)
  if (attempts.length >= 2) {
    const lastTwo = attempts.slice(-2)
    const [prev, current] = lastTwo

    if (prev.testResults && current.testResults) {
      const similarity = calculateErrorSimilarity(prev.testResults.errors, current.testResults.errors)

      if (similarity < 0.5) {
        return {
          type: 'different_errors',
          confidence: 1 - similarity,
          description: 'Different errors in each attempt, indicating exploration of solutions',
          recommendation: 'Continue iterating, you are trying different approaches.',
        }
      }
    }
  }

  return null
}

/**
 * Calculate similarity between two error arrays
 */
function calculateErrorSimilarity(errors1: string[], errors2: string[]): number {
  if (errors1.length === 0 && errors2.length === 0) return 1
  if (errors1.length === 0 || errors2.length === 0) return 0

  // Simple word-based similarity
  const words1 = new Set(errors1.join(' ').toLowerCase().split(/\s+/))
  const words2 = new Set(errors2.join(' ').toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter((w) => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * Determine overall assessment based on patterns
 */
function determineOverallAssessment(
  patterns: ErrorPattern[],
  attempts: AttemptMetadata[],
): { overallAssessment: 'continue' | 'rollback' | 'manual_intervention'; reasoning: string } {
  // Check for critical patterns
  const hasStuckPattern = patterns.some((p) => p.type === 'stuck_in_loop' && p.confidence > 0.8)
  const hasNoProgress = patterns.some((p) => p.type === 'no_progress' && p.confidence > 0.7)
  const hasTimeout = patterns.some((p) => p.type === 'timeout')
  const hasImprovement = patterns.some((p) => p.type === 'improving' || p.type === 'different_errors')

  // Stuck in loop → rollback
  if (hasStuckPattern) {
    return {
      overallAssessment: 'rollback',
      reasoning: 'Detected repeating error pattern. Rollback and try alternative approach.',
    }
  }

  // No progress after multiple attempts → rollback
  if (hasNoProgress && attempts.length >= 3) {
    return {
      overallAssessment: 'rollback',
      reasoning: 'No progress after multiple attempts. Rollback to last stable version.',
    }
  }

  // Multiple timeouts → manual intervention
  if (hasTimeout) {
    return {
      overallAssessment: 'manual_intervention',
      reasoning: 'Repeated timeout errors. Task may need to be broken down or require manual review.',
    }
  }

  // Showing improvement → continue
  if (hasImprovement) {
    return {
      overallAssessment: 'continue',
      reasoning: 'Progress detected. Continue with current approach.',
    }
  }

  // Default: continue if under max attempts
  if (attempts.length < 3) {
    return {
      overallAssessment: 'continue',
      reasoning: 'Still within retry threshold. Continue attempting.',
    }
  }

  // Too many attempts without clear improvement
  return {
    overallAssessment: 'rollback',
    reasoning: 'Max attempts reached without clear improvement. Rollback recommended.',
  }
}

/**
 * Generate alternative approach suggestions based on error patterns
 */
export function generateAlternativeApproach(patterns: ErrorPattern[], attempts: AttemptMetadata[]): string {
  const suggestions: string[] = []

  // Add specific suggestions based on patterns
  patterns.forEach((pattern) => {
    if (pattern.type === 'stuck_in_loop') {
      suggestions.push('Try a fundamentally different implementation approach')
      suggestions.push('Consider using a different library or framework')
    }

    if (pattern.type === 'no_progress') {
      suggestions.push('Break the task into smaller, more manageable steps')
      suggestions.push('Review the initial requirements and simplify')
    }

    if (pattern.type === 'timeout') {
      suggestions.push('Optimize performance-critical code paths')
      suggestions.push('Add caching or memoization')
      suggestions.push('Consider asynchronous processing')
    }
  })

  // Add general suggestions
  if (suggestions.length === 0) {
    suggestions.push('Review error messages carefully and address root causes')
    suggestions.push('Consult documentation for best practices')
    suggestions.push('Simplify the implementation')
  }

  return suggestions.join('\n- ')
}
