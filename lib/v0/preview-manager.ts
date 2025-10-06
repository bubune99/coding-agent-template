import { DockerContainer } from "@/lib/docker/container"
import type { TaskLogger } from "@/lib/utils/task-logger"
import { executePlaywrightTestsVercel } from "@/lib/validation/playwright-vercel-adapter"

export type PreviewMode = "iframe" | "docker"
export type ValidationStatus = "pending" | "running" | "passed" | "failed" | "error"

export interface PreviewResult {
  mode: PreviewMode
  url: string
  dockerUrl?: string
  validationStatus: ValidationStatus
  validationResults?: any
  error?: string
}

export interface ValidationResult {
  status: ValidationStatus
  passed: number
  failed: number
  total: number
  screenshots?: string[]
  errors?: string[]
  duration?: number
}

export class PreviewManager {
  private containers: Map<string, DockerContainer> = new Map()
  private validationQueue: Map<string, Promise<ValidationResult>> = new Map()

  /**
   * Create a preview with automatic fallback
   * - Tries iframe first (instant)
   * - Falls back to Docker if iframe fails
   * - Starts background validation regardless
   */
  async createPreview(chatId: string, code: string, iframeUrl: string, logger: TaskLogger): Promise<PreviewResult> {
    const result: PreviewResult = {
      mode: "iframe",
      url: iframeUrl,
      validationStatus: "pending",
    }

    // Try iframe preview first
    try {
      const iframeHealthy = await this.checkIframeHealth(iframeUrl)
      if (iframeHealthy) {
        await logger.info("Using iframe preview (fast mode)")
        // Start background validation
        this.startBackgroundValidation(chatId, code, logger)
        return result
      }
    } catch (error) {
      await logger.info("Iframe preview failed, falling back to Docker")
    }

    // Fallback to Docker preview
    try {
      const dockerResult = await this.createDockerPreview(chatId, code, logger)
      result.mode = "docker"
      result.url = dockerResult.url
      result.dockerUrl = dockerResult.url
      result.validationStatus = "running"

      // Validation already running in Docker mode
      this.validationQueue.set(chatId, dockerResult.validation)

      return result
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error"
      result.validationStatus = "error"
      return result
    }
  }

  /**
   * Create Docker preview with dev server
   */
  private async createDockerPreview(
    chatId: string,
    code: string,
    logger: TaskLogger,
  ): Promise<{ url: string; validation: Promise<ValidationResult> }> {
    await logger.info("Creating Docker container for preview...")

    const container = new DockerContainer(
      {
        taskId: `v0-preview-${chatId}`,
        repoUrl: "", // Not cloning a repo for v0 previews
        workDir: "/workspace",
        timeout: 10 * 60 * 1000, // 10 minutes
      },
      logger,
    )

    await container.create()
    this.containers.set(chatId, container)

    // Write generated code
    await logger.info("Writing generated code to container...")
    await this.writeCodeToContainer(container, code)

    await logger.info("Starting Next.js dev server...")
    const { url } = await container.startDevServer()

    // Start validation in background
    const validation = this.runPlaywrightValidation(container, url, logger)

    // Cleanup after 30 minutes
    setTimeout(() => this.cleanup(chatId), 30 * 60 * 1000)

    return { url, validation }
  }

  /**
   * Start background validation without blocking
   */
  private startBackgroundValidation(chatId: string, code: string, logger: TaskLogger): void {
    const validation = (async () => {
      try {
        await logger.info("Starting background validation...")
        const dockerResult = await this.createDockerPreview(chatId, code, logger)
        return await dockerResult.validation
      } catch (error) {
        await logger.error(`Background validation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
        return {
          status: "error" as ValidationStatus,
          passed: 0,
          failed: 0,
          total: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
        }
      }
    })()

    this.validationQueue.set(chatId, validation)
  }

  /**
   * Get validation results (non-blocking)
   */
  async getValidationResults(chatId: string): Promise<ValidationResult | null> {
    const validation = this.validationQueue.get(chatId)
    if (!validation) return null

    try {
      return await validation
    } catch (error) {
      return {
        status: "error",
        passed: 0,
        failed: 0,
        total: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }
    }
  }

  /**
   * Manually trigger Docker preview
   */
  async triggerDockerPreview(chatId: string, code: string, logger: TaskLogger): Promise<PreviewResult> {
    const dockerResult = await this.createDockerPreview(chatId, code, logger)

    return {
      mode: "docker",
      url: dockerResult.url,
      dockerUrl: dockerResult.url,
      validationStatus: "running",
    }
  }

  /**
   * Check if iframe preview is healthy
   */
  private async checkIframeHealth(url: string): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        signal: controller.signal,
        method: "HEAD",
      })

      clearTimeout(timeout)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Write code to Docker container
   */
  private async writeCodeToContainer(container: DockerContainer, code: string): Promise<void> {
    await container.runCommand("sh", ["-c", "npm init -y"])
    await container.runCommand("sh", [
      "-c",
      "npm install next@latest react@latest react-dom@latest typescript @types/react @types/node",
    ])

    // Create app directory
    await container.runCommand("mkdir", ["-p", "app"])

    await container.writeFile("app/page.tsx", code)

    // Create minimal next.config.js
    const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig`
    await container.writeFile("next.config.js", nextConfig)

    // Create minimal tsconfig.json
    const tsConfig = `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`
    await container.writeFile("tsconfig.json", tsConfig)

    // Add dev script to package.json
    await container.runCommand("sh", ["-c", 'npm pkg set scripts.dev="next dev"'])
  }

  /**
   * Run Playwright validation
   */
  private async runPlaywrightValidation(
    container: DockerContainer,
    url: string,
    logger: TaskLogger,
  ): Promise<ValidationResult> {
    try {
      await logger.info("Running Playwright validation...")

      // Generate basic test spec
      const testSpec = this.generateTestSpec(url)
      await container.runCommand("sh", ["-c", `echo '${testSpec}' > tests/generated.spec.ts`])

      // Run Playwright tests
      const results = await executePlaywrightTestsVercel(container, "tests/generated.spec.ts", logger)

      return {
        status: results.success ? "passed" : "failed",
        passed: results.passed || 0,
        failed: results.failed || 0,
        total: (results.passed || 0) + (results.failed || 0),
        errors: results.errors,
        duration: results.duration,
      }
    } catch (error) {
      await logger.error(`Playwright validation error: ${error instanceof Error ? error.message : "Unknown error"}`)
      return {
        status: "error",
        passed: 0,
        failed: 0,
        total: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }
    }
  }

  /**
   * Generate basic Playwright test spec
   */
  private generateTestSpec(url: string): string {
    return `
import { test, expect } from '@playwright/test';

test('page loads successfully', async ({ page }) => {
  await page.goto('${url}');
  await expect(page).toHaveTitle(/.+/);
});

test('no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.goto('${url}');
  await page.waitForLoadState('networkidle');
  
  expect(errors).toHaveLength(0);
});

test('page is interactive', async ({ page }) => {
  await page.goto('${url}');
  await page.waitForLoadState('domcontentloaded');
  
  const buttons = await page.locator('button').count();
  const links = await page.locator('a').count();
  
  expect(buttons + links).toBeGreaterThan(0);
});
    `.trim()
  }

  /**
   * Allocate unique port for container
   */
  private allocatePort(): number {
    return 3000 + Math.floor(Math.random() * 10000)
  }

  /**
   * Cleanup container and resources
   */
  async cleanup(chatId: string): Promise<void> {
    const container = this.containers.get(chatId)
    if (container) {
      await container.destroy()
      this.containers.delete(chatId)
    }
    this.validationQueue.delete(chatId)
  }

  /**
   * Cleanup all containers
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.containers.keys()).map((chatId) => this.cleanup(chatId))
    await Promise.all(cleanupPromises)
  }
}

// Singleton instance
export const previewManager = new PreviewManager()
