#!/usr/bin/env tsx
/**
 * Programmatic test script for validation flow
 *
 * Usage:
 *   pnpm tsx scripts/test-validation-flow.ts
 *
 * Or add to package.json:
 *   "test:validation": "tsx scripts/test-validation-flow.ts"
 */

import { db } from "../lib/db/client"
import { tasks } from "../lib/db/schema"
import { generateId } from "../lib/utils/id"
import { eq } from "drizzle-orm"

interface CreateTaskRequest {
  prompt: string
  repoUrl: string
  selectedAgent?: string
  selectedModel?: string
  installDependencies?: boolean
  maxDuration?: number
}

async function createTask(request: CreateTaskRequest) {
  const taskId = generateId(12)

  const taskData = {
    id: taskId,
    prompt: request.prompt,
    repoUrl: request.repoUrl,
    selectedAgent: request.selectedAgent || "claude",
    selectedModel: request.selectedModel,
    installDependencies: request.installDependencies ?? false,
    maxDuration: request.maxDuration || 5,
    status: "pending" as const,
    progress: 0,
    logs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const [newTask] = await db.insert(tasks).values(taskData).returning()

  console.log("✅ Task created:", {
    id: newTask.id,
    prompt: newTask.prompt,
    agent: newTask.selectedAgent,
  })

  // Trigger processing by making API call
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

  try {
    const response = await fetch(`${apiUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    const result = await response.json()

    console.log("📡 API response:", {
      status: response.status,
      taskId: result.task?.id,
    })

    return result.task
  } catch (error) {
    console.error("❌ API call failed:", error)
    return newTask
  }
}

async function monitorTask(taskId: string) {
  console.log(`\n👀 Monitoring task ${taskId}...`)
  console.log("Press Ctrl+C to stop monitoring\n")

  const checkInterval = setInterval(async () => {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId))

    if (!task) {
      console.log("❌ Task not found")
      clearInterval(checkInterval)
      return
    }

    const statusEmoji =
      {
        pending: "⏳",
        processing: "🔄",
        completed: "✅",
        error: "❌",
        stopped: "🛑",
      }[task.status] || "❓"

    console.log(`${statusEmoji} Status: ${task.status} | Progress: ${task.progress}%`)

    if (task.status === "completed") {
      console.log("\n🎉 Task completed successfully!")
      console.log("Branch:", task.branchName)
      console.log("Logs:", task.logs?.length, "entries")
      clearInterval(checkInterval)
      process.exit(0)
    }

    if (task.status === "error" || task.status === "stopped") {
      console.log(`\n💥 Task ${task.status}:`, task.error)
      console.log("Logs:", task.logs?.length, "entries")
      clearInterval(checkInterval)
      process.exit(1)
    }
  }, 2000) // Check every 2 seconds
}

// Test scenarios
const TEST_SCENARIOS = {
  simple: {
    prompt: "Add a README.md file with a hello world message",
    repoUrl: "https://github.com/your-username/test-repo.git", // CHANGE THIS
    selectedAgent: "claude",
    installDependencies: false,
  },
  nextjs: {
    prompt: "Add a contact form component with email validation to the home page",
    repoUrl: "https://github.com/your-username/nextjs-test.git", // CHANGE THIS
    selectedAgent: "claude",
    installDependencies: true,
  },
  withValidation: {
    prompt: "Create a simple counter button that increments on click",
    repoUrl: "https://github.com/your-username/react-test.git", // CHANGE THIS
    selectedAgent: "claude",
    installDependencies: true,
  },
}

async function main() {
  const args = process.argv.slice(2)
  const scenario = (args[0] as keyof typeof TEST_SCENARIOS) || "simple"

  console.log("🚀 Testing Validation Flow\n")
  console.log("Scenario:", scenario)
  console.log("─".repeat(50))

  if (!TEST_SCENARIOS[scenario]) {
    console.error("❌ Unknown scenario. Available:", Object.keys(TEST_SCENARIOS).join(", "))
    process.exit(1)
  }

  const config = TEST_SCENARIOS[scenario]

  console.log("\n📝 Task Config:")
  console.log(JSON.stringify(config, null, 2))
  console.log("\n─".repeat(50))

  const task = await createTask(config)

  if (task) {
    await monitorTask(task.id)
  }
}

main().catch(console.error)
