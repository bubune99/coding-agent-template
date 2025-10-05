/**
 * Determines the execution mode: Docker (local) or Vercel Sandbox (cloud)
 */

export type ExecutionMode = 'docker' | 'vercel'

export function getExecutionMode(): ExecutionMode {
  // Check environment variable
  const mode = process.env.EXECUTION_MODE?.toLowerCase()

  if (mode === 'docker') {
    return 'docker'
  }

  if (mode === 'vercel') {
    return 'vercel'
  }

  // Default: Use Docker if running locally (NODE_ENV !== 'production')
  // Or if Vercel tokens are not configured
  const hasVercelTokens = process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID && process.env.VERCEL_TOKEN

  if (!hasVercelTokens) {
    return 'docker'
  }

  // In production with Vercel tokens, use Vercel Sandbox
  if (process.env.NODE_ENV === 'production') {
    return 'vercel'
  }

  // Default to Docker for local development
  return 'docker'
}

export function isDockerMode(): boolean {
  return getExecutionMode() === 'docker'
}

export function isVercelMode(): boolean {
  return getExecutionMode() === 'vercel'
}
