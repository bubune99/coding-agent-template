/**
 * v0 UI Component Generator
 *
 * Integrates v0 Platform API to generate UI components
 */

import { createClient } from 'v0-sdk'
import { TaskLogger } from '../utils/task-logger'

export interface V0GenerationRequest {
  prompt: string
  framework?: 'react' | 'nextjs' | 'vue' | 'svelte'
  styling?: 'tailwind' | 'css' | 'styled-components'
}

export interface V0GenerationResult {
  success: boolean
  code?: string
  componentName?: string
  filePath?: string
  error?: string
}

/**
 * Generate UI component using v0
 */
export async function generateV0Component(
  request: V0GenerationRequest,
  logger: TaskLogger,
): Promise<V0GenerationResult> {
  try {
    // Check if v0 API key is available
    if (!process.env.V0_API_KEY) {
      return {
        success: false,
        error: 'V0_API_KEY not configured. Cannot generate UI components.',
      }
    }

    await logger.info('🎨 Generating UI component with v0...')

    // Configure v0 client
    const client = createClient({
      apiKey: process.env.V0_API_KEY,
    })

    // Generate component
    const result = await client.generate({
      prompt: request.prompt,
      framework: request.framework || 'react',
      styling: request.styling || 'tailwind',
    })

    if (!result || !result.code) {
      return {
        success: false,
        error: 'v0 returned no code',
      }
    }

    await logger.success('✅ v0 component generated successfully')

    // Extract component name from code or prompt
    const componentName = extractComponentName(result.code, request.prompt)
    const filePath = determineFilePath(componentName, request.framework || 'react')

    return {
      success: true,
      code: result.code,
      componentName,
      filePath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await logger.error(`v0 generation failed: ${message}`)

    return {
      success: false,
      error: `Failed to generate with v0: ${message}`,
    }
  }
}

/**
 * Extract component name from generated code
 */
function extractComponentName(code: string, prompt: string): string {
  // Try to extract from function/const declaration
  const functionMatch = code.match(/(?:export\s+(?:default\s+)?function|const)\s+([A-Z][a-zA-Z0-9]*)/)
  if (functionMatch) {
    return functionMatch[1]
  }

  // Fallback: Generate from prompt
  const words = prompt.split(' ').filter((w) => w.length > 3)
  if (words.length > 0) {
    return words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase() + 'Component'
  }

  return 'GeneratedComponent'
}

/**
 * Determine file path based on component name and framework
 */
function determineFilePath(componentName: string, framework: string): string {
  const extension = framework === 'vue' ? '.vue' : framework === 'svelte' ? '.svelte' : '.tsx'

  // Use components directory for React/Next.js
  if (framework === 'react' || framework === 'nextjs') {
    return `components/${componentName}${extension}`
  }

  // Use src/components for Vue/Svelte
  return `src/components/${componentName}${extension}`
}

/**
 * Detect if prompt is UI-focused
 */
export function isUIPrompt(prompt: string): boolean {
  const uiKeywords = [
    'component',
    'button',
    'form',
    'modal',
    'card',
    'navbar',
    'header',
    'footer',
    'sidebar',
    'menu',
    'dropdown',
    'table',
    'list',
    'grid',
    'layout',
    'page',
    'dashboard',
    'ui',
    'interface',
    'design',
  ]

  const lowerPrompt = prompt.toLowerCase()
  return uiKeywords.some((keyword) => lowerPrompt.includes(keyword))
}
