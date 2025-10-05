/**
 * Playwright Adapter for Vercel Sandbox
 *
 * Uses lightweight @sparticuz/chromium for headless testing in serverless environments
 * This is necessary because Vercel Sandbox doesn't support X11/GUI applications
 */

import { Sandbox } from '@vercel/sandbox'
import { TaskLogger } from '../utils/task-logger'
import { TestExecutionResult } from './test-executor'

/**
 * Install Playwright with serverless-optimized Chromium for Vercel Sandbox
 */
export async function installPlaywrightVercel(sandbox: Sandbox, logger: TaskLogger): Promise<{ success: boolean; error?: string }> {
  try {
    await logger.info('Installing Playwright for Vercel Sandbox (serverless mode)...')

    // Install playwright-core (lighter than full playwright)
    const installPlaywright = await sandbox.runCommand('npm', ['install', '-D', 'playwright-core'])
    if (installPlaywright.exitCode !== 0) {
      const stderr = await installPlaywright.stderr()
      return { success: false, error: `Failed to install playwright-core: ${stderr}` }
    }

    // Install @sparticuz/chromium (serverless-optimized chromium)
    await logger.info('Installing serverless Chromium...')
    const installChromium = await sandbox.runCommand('npm', ['install', '-D', '@sparticuz/chromium'])
    if (installChromium.exitCode !== 0) {
      const stderr = await installChromium.stderr()
      return { success: false, error: `Failed to install @sparticuz/chromium: ${stderr}` }
    }

    await logger.success('Playwright (serverless mode) installed successfully')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Generate Playwright test configured for serverless Chromium
 */
export function generateServerlessPlaywrightTest(componentName: string, testCode: string): string {
  return `
import { test, expect } from '@playwright/test'
import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'

// Configure for serverless environment
test.use({
  // Use headless mode (required for Vercel Sandbox)
  headless: true,
  // Disable GPU acceleration
  launchOptions: {
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  },
})

${testCode}
`
}

/**
 * Execute Playwright tests in Vercel Sandbox using serverless Chromium
 */
export async function executePlaywrightTestsVercel(
  sandbox: Sandbox,
  testFilePath: string,
  logger: TaskLogger,
): Promise<TestExecutionResult> {
  const startTime = Date.now()

  try {
    await logger.info('Running Playwright tests (serverless mode)...')

    // Run tests with headless chromium
    const testCmd = await sandbox.runCommand('npx', [
      'playwright',
      'test',
      testFilePath,
      '--reporter=json',
      '--timeout=30000',
      '--headed=false', // Force headless
    ])

    const stdout = await testCmd.stdout()
    const stderr = await testCmd.stderr()
    const output = stdout + '\n' + stderr
    const exitCode = testCmd.exitCode

    const duration = Date.now() - startTime

    // Parse results
    const result = parsePlaywrightOutput(output, exitCode, duration)

    if (result.passed) {
      await logger.success(`All tests passed! (${result.testsPassed}/${result.testsTotal})`)
    } else {
      await logger.error(`Tests failed: ${result.testsFailed}/${result.testsTotal} failed`)
    }

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await logger.error(`Test execution failed: ${message}`)

    return {
      success: false,
      passed: false,
      testsPassed: 0,
      testsFailed: 0,
      testsTotal: 0,
      errors: [message],
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Parse Playwright JSON output
 */
function parsePlaywrightOutput(output: string, exitCode: number, duration: number): TestExecutionResult {
  try {
    const jsonMatch = output.match(/\{[\s\S]*"suites"[\s\S]*\}/)

    if (jsonMatch) {
      const jsonOutput = JSON.parse(jsonMatch[0])

      let testsPassed = 0
      let testsFailed = 0
      const errors: string[] = []

      function processTests(tests: any[]) {
        tests.forEach((test: any) => {
          if (test.status === 'passed' || test.status === 'expected') {
            testsPassed++
          } else {
            testsFailed++
            if (test.errors && test.errors.length > 0) {
              errors.push(...test.errors.map((e: any) => e.message || e.toString()))
            }
          }
        })
      }

      function processSuites(suites: any[]) {
        suites.forEach((suite: any) => {
          if (suite.specs) {
            processTests(suite.specs)
          }
          if (suite.suites) {
            processSuites(suite.suites)
          }
        })
      }

      if (jsonOutput.suites) {
        processSuites(jsonOutput.suites)
      }

      const testsTotal = testsPassed + testsFailed

      return {
        success: true,
        passed: testsFailed === 0 && testsTotal > 0,
        testsPassed,
        testsFailed,
        testsTotal,
        errors,
        output,
        duration,
      }
    }
  } catch (parseError) {
    // JSON parsing failed
  }

  // Fallback
  const passed = exitCode === 0
  const errorLines = output
    .split('\n')
    .filter((line) => line.includes('Error:') || line.includes('FAIL'))
    .slice(0, 5)

  return {
    success: true,
    passed,
    testsPassed: passed ? 1 : 0,
    testsFailed: passed ? 0 : 1,
    testsTotal: 1,
    errors: errorLines.length > 0 ? errorLines : passed ? [] : ['Tests failed'],
    output,
    duration,
  }
}

/**
 * Check if Vercel Sandbox can support Playwright
 */
export async function checkPlaywrightSupport(sandbox: Sandbox, logger: TaskLogger): Promise<boolean> {
  try {
    // Check if we can run headless chromium
    const checkCmd = await sandbox.runCommand('which', ['chromium'])
    const hasChromium = checkCmd.exitCode === 0

    if (!hasChromium) {
      await logger.info('Chromium not found, will install @sparticuz/chromium')
    }

    return true // We can always use @sparticuz/chromium
  } catch {
    return true
  }
}
