import { type NextRequest, NextResponse } from "next/server"
import { deployV0CodeToDocker } from "@/lib/v0/docker-deploy"
import { TaskLogger } from "@/lib/utils/task-logger"
import { auth } from "@/app/(auth)/auth"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { code, taskId } = await request.json()

    if (!code || !taskId) {
      return NextResponse.json({ error: "Code and taskId are required" }, { status: 400 })
    }

    // Create a logger for this deployment
    const logger = new TaskLogger(taskId)

    // Deploy to Docker
    const result = await deployV0CodeToDocker(code, taskId, logger)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      previewUrl: result.previewUrl,
      containerId: result.containerId,
    })
  } catch (error) {
    console.error("Deploy error:", error)
    return NextResponse.json(
      {
        error: "Failed to deploy",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
