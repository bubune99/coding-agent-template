/**
 * v0 Integration into Validation Workflow
 *
 * Combines v0 UI generation with agent execution and validation
 */

import { UnifiedSandbox } from '../unified-sandbox'
import { TaskLogger } from '../utils/task-logger'
import { generateV0Component, isUIPrompt, V0GenerationRequest } from './generator'
import { getExecutionMode } from '../execution-mode'
import { DockerContainer } from '../docker/container'
import { Sandbox } from '@vercel/sandbox'

export interface V0IntegrationConfig {
  enableV0: boolean
  framework?: 'react' | 'nextjs' | 'vue' | 'svelte'
  styling?: 'tailwind' | 'css' | 'styled-components'
}

export const DEFAULT_V0_CONFIG: V0IntegrationConfig = {
  enableV0: true,
  framework: 'react',
  styling: 'tailwind',
}

/**
 * Execute v0 generation if prompt is UI-focused
 */
export async function executeV0IfNeeded(
  sandbox: UnifiedSandbox,
  prompt: string,
  logger: TaskLogger,
  config: V0IntegrationConfig = DEFAULT_V0_CONFIG,
): Promise<{ v0Used: boolean; success: boolean; error?: string }> {
  // Check if v0 should be used
  if (!config.enableV0) {
    return { v0Used: false, success: true }
  }

  if (!isUIPrompt(prompt)) {
    await logger.info('Prompt is not UI-focused, skipping v0 generation')
    return { v0Used: false, success: true }
  }

  await logger.info('🎨 UI-focused prompt detected, using v0 for generation...')

  // Generate with v0
  const v0Request: V0GenerationRequest = {
    prompt,
    framework: config.framework,
    styling: config.styling,
  }

  const v0Result = await generateV0Component(v0Request, logger)

  if (!v0Result.success) {
    await logger.error(`v0 generation failed: ${v0Result.error}`)
    return { v0Used: true, success: false, error: v0Result.error }
  }

  // Write generated component to sandbox
  const writeSuccess = await writeV0ComponentToSandbox(sandbox, v0Result.code!, v0Result.filePath!, logger)

  if (!writeSuccess) {
    return { v0Used: true, success: false, error: 'Failed to write v0 component to sandbox' }
  }

  await logger.success(`✅ v0 component written to ${v0Result.filePath}`)

  return { v0Used: true, success: true }
}

/**
 * Write v0-generated component to sandbox filesystem
 */
async function writeV0ComponentToSandbox(
  sandbox: UnifiedSandbox,
  code: string,
  filePath: string,
  logger: TaskLogger,
): Promise<boolean> {
  const mode = await getExecutionMode()

  try {
    // Create directory
    const dir = filePath.split('/').slice(0, -1).join('/')

    if (mode === 'docker') {
      const container = sandbox as DockerContainer

      if (dir) {
        await container.runCommand('mkdir', ['-p', dir])
      }

      // Write file
      const escapedCode = code.replace(/'/g, "'\\''")
      const writeResult = await container.runCommand('sh', ['-c', `cat > '${filePath}' << 'EOF'\n${code}\nEOF`])

      return writeResult.success
    } else {
      const vercelSandbox = sandbox as Sandbox

      if (dir) {
        await vercelSandbox.runCommand('mkdir', ['-p', dir])
      }

      const writeCmd = await vercelSandbox.runCommand('sh', ['-c', `cat > '${filePath}' << 'EOF'\n${code}\nEOF`])

      return writeCmd.exitCode === 0
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await logger.error(`Failed to write v0 component: ${message}`)
    return false
  }
}

/**
 * Generate Playwright tests specifically for v0 components
 */
export function generateV0ValidationTests(componentName: string, filePath: string): string {
  return `
import { test, expect } from '@playwright/test'

test.describe('${componentName}', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page that renders the component
    await page.goto('http://localhost:3000')
  })

  test('should render without crashing', async ({ page }) => {
    // Wait for component to be visible
    await page.waitForSelector('[data-testid="${componentName.toLowerCase()}"]', { timeout: 5000 })

    // Take screenshot for visual verification
    await page.screenshot({ path: 'screenshots/${componentName}.png' })
  })

  test('should be interactive', async ({ page }) => {
    // Test basic interactivity (clicks, hovers, etc.)
    const component = page.locator('[data-testid="${componentName.toLowerCase()}"]')
    await expect(component).toBeVisible()

    // Check accessibility
    await expect(component).toHaveAccessibleName()
  })

  test('should match design specs', async ({ page }) => {
    // Visual regression testing
    await expect(page).toHaveScreenshot('${componentName}-baseline.png')
  })
})
`
}
