/**
 * Playwright Adapter for Docker Containers
 *
 * Executes Playwright tests in Docker containers with full browser support
 */

import type { DockerContainer } from "@/lib/docker/container"
import type { TaskLogger } from "../utils/task-logger"
import type { TestExecutionResult } from "./test-executor"

/**
 * Install Playwright in Docker container
 */
export async function installPlaywrightDocker(
  container: DockerContainer,
  logger: TaskLogger,
): Promise<{ success: boolean; error?: string }> {
  try {
    await logger.info("Installing Playwright in Docker container...")

    // Install Playwright
    const installResult = await container.runCommand("npm", ["install", "-D", "@playwright/test"])
    if (!installResult.success) {
      return { success: false, error: `Failed to install Playwright: ${installResult.error}` }
    }

    // Install browsers
    await logger.info("Installing Playwright browsers...")
    const browsersResult = await container.runCommand("npx", ["playwright", "install", "--with-deps", "chromium"])
    if (!browsersResult.success) {
      return { success: false, error: `Failed to install browsers: ${browsersResult.error}` }
    }

    await logger.success("Playwright installed successfully")
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: message }
  }
}

/**
 * Execute Playwright tests in Docker container
 */
export async function executePlaywrightTestsDocker(
  container: DockerContainer,
  testFilePath: string,
  logger: TaskLogger,
): Promise<TestExecutionResult> {
  const startTime = Date.now()

  try {
    await logger.info("Running Playwright tests in Docker...")

    // Run tests with JSON reporter
    const testResult = await container.runCommand("npx", [
      "playwright",
      "test",
      testFilePath,
      "--reporter=json",
      "--timeout=30000",
    ])

    const output = (testResult.output || "") + "\n" + (testResult.error || "")
    const exitCode = testResult.exitCode || 0
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
    const message = error instanceof Error ? error.message : "Unknown error"
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonOutput = JSON.parse(jsonMatch[0])

      let testsPassed = 0
      let testsFailed = 0
      const errors: string[] = []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function processTests(tests: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tests.forEach((test: any) => {
          if (test.status === "passed" || test.status === "expected") {
            testsPassed++
          } else {
            testsFailed++
            if (test.errors && test.errors.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              errors.push(...test.errors.map((e: any) => e.message || e.toString()))
            }
          }
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function processSuites(suites: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  } catch {
    // JSON parsing failed, use fallback
  }

  // Fallback parsing
  const passed = exitCode === 0
  const errorLines = output
    .split("\n")
    .filter((line) => line.includes("Error:") || line.includes("FAIL"))
    .slice(0, 5)

  return {
    success: true,
    passed,
    testsPassed: passed ? 1 : 0,
    testsFailed: passed ? 0 : 1,
    testsTotal: 1,
    errors: errorLines.length > 0 ? errorLines : passed ? [] : ["Tests failed"],
    output,
    duration,
  }
}
