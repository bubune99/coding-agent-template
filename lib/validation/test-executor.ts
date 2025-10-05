import { DockerContainer } from '../docker/container'
import { Sandbox } from '@vercel/sandbox'
import { TaskLogger } from '../utils/task-logger'
import { UnifiedSandbox } from '../unified-sandbox'
import { getExecutionMode } from '../execution-mode'

export interface TestExecutionResult {
  success: boolean
  passed: boolean
  testsPassed: number
  testsFailed: number
  testsTotal: number
  errors: string[]
  output?: string
  duration?: number
}

/**
 * Install Playwright in the sandbox/container
 */
export async function installPlaywright(
  sandbox: UnifiedSandbox,
  logger: TaskLogger,
): Promise<{ success: boolean; error?: string }> {
  const mode = getExecutionMode()

  try {
    await logger.info('Installing Playwright...')

    if (mode === 'docker') {
      const container = sandbox as DockerContainer

      // Install Playwright
      const installResult = await container.runCommand('npm', ['install', '-D', '@playwright/test'])
      if (!installResult.success) {
        return { success: false, error: 'Failed to install Playwright' }
      }

      // Install Playwright browsers
      await logger.info('Installing Playwright browsers (this may take a minute)...')
      const browsersResult = await container.runCommand('npx', ['playwright', 'install', 'chromium', '--with-deps'])

      if (!browsersResult.success) {
        await logger.info('Failed to install browsers with deps, trying without deps...')
        const fallbackResult = await container.runCommand('npx', ['playwright', 'install', 'chromium'])
        if (!fallbackResult.success) {
          return { success: false, error: 'Failed to install Playwright browsers' }
        }
      }
    } else {
      const vercelSandbox = sandbox as Sandbox

      // Install Playwright
      const installCmd = await vercelSandbox.runCommand('npm', ['install', '-D', '@playwright/test'])
      const installStdout = await installCmd.stdout()
      const installStderr = await installCmd.stderr()

      if (installCmd.exitCode !== 0) {
        return { success: false, error: `Failed to install Playwright: ${installStderr}` }
      }

      // Install browsers
      await logger.info('Installing Playwright browsers...')
      const browsersCmd = await vercelSandbox.runCommand('npx', ['playwright', 'install', 'chromium', '--with-deps'])
      const browsersStderr = await browsersCmd.stderr()

      if (browsersCmd.exitCode !== 0) {
        await logger.info('Failed with deps, trying without...')
        const fallbackCmd = await vercelSandbox.runCommand('npx', ['playwright', 'install', 'chromium'])
        if (fallbackCmd.exitCode !== 0) {
          return { success: false, error: 'Failed to install Playwright browsers' }
        }
      }
    }

    await logger.success('Playwright installed successfully')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Write test file to sandbox/container
 */
export async function writeTestFile(
  sandbox: UnifiedSandbox,
  testCode: string,
  testFilePath: string,
  logger: TaskLogger,
): Promise<{ success: boolean; error?: string }> {
  const mode = getExecutionMode()

  try {
    await logger.info(`Writing test file to ${testFilePath}...`)

    // Create directory structure
    const dir = testFilePath.split('/').slice(0, -1).join('/')

    if (mode === 'docker') {
      const container = sandbox as DockerContainer

      // Create directory
      if (dir) {
        await container.runCommand('mkdir', ['-p', dir])
      }

      // Write file (escape special characters in test code)
      const escapedCode = testCode.replace(/'/g, "'\\''")
      const writeResult = await container.runCommand('sh', ['-c', `cat > '${testFilePath}' << 'EOF'\n${testCode}\nEOF`])

      if (!writeResult.success) {
        return { success: false, error: `Failed to write test file: ${writeResult.error}` }
      }
    } else {
      const vercelSandbox = sandbox as Sandbox

      // Create directory
      if (dir) {
        await vercelSandbox.runCommand('mkdir', ['-p', dir])
      }

      // Write file
      const writeCmd = await vercelSandbox.runCommand('sh', [
        '-c',
        `cat > '${testFilePath}' << 'EOF'\n${testCode}\nEOF`,
      ])

      if (writeCmd.exitCode !== 0) {
        const stderr = await writeCmd.stderr()
        return { success: false, error: `Failed to write test file: ${stderr}` }
      }
    }

    await logger.success('Test file written successfully')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Execute Playwright tests in the sandbox/container
 */
export async function executePlaywrightTests(
  sandbox: UnifiedSandbox,
  testFilePath: string,
  logger: TaskLogger,
): Promise<TestExecutionResult> {
  const mode = getExecutionMode()
  const startTime = Date.now()

  try {
    await logger.info('Running Playwright tests...')

    let output = ''
    let exitCode = 0

    if (mode === 'docker') {
      const container = sandbox as DockerContainer

      // Run tests with JSON reporter
      const testResult = await container.runCommand('npx', [
        'playwright',
        'test',
        testFilePath,
        '--reporter=json',
        '--timeout=30000',
      ])

      output = testResult.output || ''
      exitCode = testResult.exitCode || 0

      if (testResult.error) {
        output += '\n' + testResult.error
      }
    } else {
      const vercelSandbox = sandbox as Sandbox

      const testCmd = await vercelSandbox.runCommand('npx', [
        'playwright',
        'test',
        testFilePath,
        '--reporter=json',
        '--timeout=30000',
      ])

      const stdout = await testCmd.stdout()
      const stderr = await testCmd.stderr()
      output = stdout + '\n' + stderr
      exitCode = testCmd.exitCode
    }

    const duration = Date.now() - startTime

    // Parse test results
    const result = parsePlaywrightOutput(output, exitCode, duration)

    if (result.passed) {
      await logger.success(`All tests passed! (${result.testsPassed}/${result.testsTotal})`)
    } else {
      await logger.error(`Tests failed: ${result.testsFailed}/${result.testsTotal} failed`)
      result.errors.forEach((error, i) => {
        logger.error(`Error ${i + 1}: ${error}`)
      })
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
 * Parse Playwright JSON output to extract test results
 */
function parsePlaywrightOutput(output: string, exitCode: number, duration: number): TestExecutionResult {
  try {
    // Try to parse JSON reporter output
    const jsonMatch = output.match(/\{[\s\S]*"suites"[\s\S]*\}/)

    if (jsonMatch) {
      const jsonOutput = JSON.parse(jsonMatch[0])

      let testsPassed = 0
      let testsFailed = 0
      const errors: string[] = []

      // Count tests and collect errors
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

      // Recursively process all test suites
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
    // JSON parsing failed, fall back to exit code
  }

  // Fallback: use exit code
  const passed = exitCode === 0

  // Try to extract errors from output
  const errorLines = output
    .split('\n')
    .filter((line) => line.includes('Error:') || line.includes('FAIL') || line.includes('✘'))
    .slice(0, 5) // Limit to first 5 errors

  return {
    success: true,
    passed,
    testsPassed: passed ? 1 : 0,
    testsFailed: passed ? 0 : 1,
    testsTotal: 1,
    errors: errorLines.length > 0 ? errorLines : passed ? [] : ['Tests failed (no detailed error available)'],
    output,
    duration,
  }
}
