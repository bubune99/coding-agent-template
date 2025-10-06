import { type NextRequest, NextResponse } from "next/server"
import { previewManager } from "@/lib/v0/preview-manager"
import { TaskLogger } from "@/lib/utils/task-logger"

export async function POST(request: NextRequest) {
  try {
    const { chatId, code } = await request.json()

    if (!chatId || !code) {
      return NextResponse.json({ error: "chatId and code are required" }, { status: 400 })
    }

    const logger = new TaskLogger()
    const result = await previewManager.triggerDockerPreview(chatId, code, logger)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
