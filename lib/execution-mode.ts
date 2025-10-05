/**
 * Determines the execution mode: Docker (local) or Vercel Sandbox (cloud)
 */

import { cookies } from 'next/headers'

export type ExecutionMode = 'docker' | 'vercel'

export async function getExecutionMode(): Promise<ExecutionMode> {
  // 1. Check user preference from cookies (highest priority)
  try {
    const cookieStore = await cookies()
    const userPreference = cookieStore.get('execution_mode')?.value as ExecutionMode | undefined

    if (userPreference === 'docker' || userPreference === 'vercel') {
      // Validate user preference against available resources
      if (userPreference === 'vercel') {
        const hasVercelTokens =
          process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID && process.env.VERCEL_TOKEN
        if (hasVercelTokens) {
          return 'vercel'
        }
        // Fall through to auto-detection if tokens not available
      } else {
        return 'docker'
      }
    }
  } catch {
    // cookies() not available in this context, continue with env-based detection
  }

  // 2. Check environment variable override
  const mode = process.env.EXECUTION_MODE?.toLowerCase()

  if (mode === 'docker') {
    return 'docker'
  }

  if (mode === 'vercel') {
    return 'vercel'
  }

  // 3. Auto-detect based on environment
  const hasVercelTokens = process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID && process.env.VERCEL_TOKEN

  if (!hasVercelTokens) {
    return 'docker'
  }

  // In production with Vercel tokens, use Vercel Sandbox
  if (process.env.NODE_ENV === 'production') {
    return 'vercel'
  }

  // Default to Vercel if tokens are available (allows cloud dev)
  return 'vercel'
}

export async function isDockerMode(): Promise<boolean> {
  return (await getExecutionMode()) === 'docker'
}

export async function isVercelMode(): Promise<boolean> {
  return (await getExecutionMode()) === 'vercel'
}
