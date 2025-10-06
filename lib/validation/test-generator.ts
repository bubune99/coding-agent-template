import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

export interface TestGenerationRequest {
  taskDescription: string
  generatedCode?: string
  projectType: "web" | "api" | "library" | "unknown"
  frameworkDetected?: string
  filesChanged: string[]
}

export interface TestGenerationResult {
  success: boolean
  testCode?: string
  testFilePath?: string
  error?: string
}

/**
 * Generate Playwright tests using AI based on task description and generated code
 */
export async function generatePlaywrightTests(request: TestGenerationRequest): Promise<TestGenerationResult> {
  try {
    // Check if AI Gateway API key is available
    if (!process.env.AI_GATEWAY_API_KEY) {
      return {
        success: false,
        error: "AI_GATEWAY_API_KEY not configured. Cannot generate tests.",
      }
    }

    // Only generate tests for web projects
    if (request.projectType !== "web") {
      return {
        success: false,
        error: `Test generation not supported for project type: ${request.projectType}`,
      }
    }

    const openai = createOpenAI({
      apiKey: process.env.AI_GATEWAY_API_KEY,
      baseURL: "https://gateway.ai.cloudflare.com/v1/d78eb673161e96c57c5ee8e0cb5d1ba5/ai-gateway/openai",
    })

    const systemPrompt = `You are an expert at writing Playwright end-to-end tests.

Your task is to generate a complete Playwright test file that validates the changes described by the user.

Requirements:
1. Write TypeScript Playwright tests
2. Use Playwright's best practices (page objects, proper waits, accessibility)
3. Test the SPECIFIC features mentioned in the task description
4. Include both positive and negative test cases
5. Use proper assertions with meaningful error messages
6. Handle async operations correctly
7. Keep tests focused and maintainable

Output ONLY the complete test file code. No explanations, just code.`

    const userPrompt = `Task Description: ${request.taskDescription}

Project Type: ${request.projectType}
${request.frameworkDetected ? `Framework: ${request.frameworkDetected}` : ""}
Files Changed: ${request.filesChanged.join(", ")}

Generate a Playwright test file that validates these changes work correctly.`

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.3, // Lower temperature for more consistent code generation
    })

    // Extract code from response (remove markdown code blocks if present)
    let testCode = text.trim()

    // Remove markdown code fences
    if (testCode.startsWith("```")) {
      testCode = testCode.replace(/^```(?:typescript|ts|javascript|js)?\n/, "")
      testCode = testCode.replace(/```$/, "")
      testCode = testCode.trim()
    }

    // Determine test file path based on project structure
    const testFilePath = determineTestFilePath(request.filesChanged)

    return {
      success: true,
      testCode,
      testFilePath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      success: false,
      error: `Failed to generate tests: ${message}`,
    }
  }
}

/**
 * Detect project type based on files changed and repository structure
 */
export async function detectProjectInfo(filesChanged: string[]): Promise<{
  projectType: "web" | "api" | "library" | "unknown"
  frameworkDetected?: string
}> {
  // Check for web frameworks
  const hasNextJS = filesChanged.some((f) => f.includes("app/") || f.includes("pages/"))
  const hasReact = filesChanged.some((f) => f.endsWith(".tsx") || f.endsWith(".jsx"))
  const hasVue = filesChanged.some((f) => f.endsWith(".vue"))
  const hasSvelte = filesChanged.some((f) => f.endsWith(".svelte"))

  // Check for API files
  const hasAPI = filesChanged.some((f) => f.includes("api/") || f.includes("routes/") || f.includes("controllers/"))

  // Determine project type
  if (hasNextJS) {
    return { projectType: "web", frameworkDetected: "Next.js" }
  } else if (hasReact) {
    return { projectType: "web", frameworkDetected: "React" }
  } else if (hasVue) {
    return { projectType: "web", frameworkDetected: "Vue" }
  } else if (hasSvelte) {
    return { projectType: "web", frameworkDetected: "Svelte" }
  } else if (hasAPI) {
    return { projectType: "api", frameworkDetected: undefined }
  } else if (filesChanged.some((f) => f.endsWith(".ts") || f.endsWith(".js"))) {
    return { projectType: "library", frameworkDetected: undefined }
  }

  return { projectType: "unknown", frameworkDetected: undefined }
}

/**
 * Determine where to place the test file
 */
function determineTestFilePath(filesChanged: string[]): string {
  // If there's a tests/ or __tests__/ directory in changed files, use it
  const testDir = filesChanged.find((f) => f.includes("tests/") || f.includes("__tests__/"))

  if (testDir) {
    const dir = testDir.split("/").slice(0, -1).join("/")
    return `${dir}/generated-validation.spec.ts`
  }

  // Default to e2e/tests/ directory
  return "e2e/tests/generated-validation.spec.ts"
}

/**
 * Generate test improvement prompt based on test failures
 */
export async function generateTestImprovementPrompt(
  originalTaskDescription: string,
  testCode: string,
  testErrors: string[],
): Promise<string> {
  const prompt = `The following Playwright tests failed:

Original Task: ${originalTaskDescription}

Test Code:
\`\`\`typescript
${testCode}
\`\`\`

Errors:
${testErrors.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Please fix the test code to handle these failures. Consider:
1. Are the selectors correct?
2. Are there timing issues (need better waits)?
3. Are the assertions accurate?
4. Does the test match the actual implementation?

Provide ONLY the updated test code, no explanations.`

  return prompt
}
