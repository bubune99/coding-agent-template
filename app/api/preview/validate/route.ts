import { type NextRequest, NextResponse } from "next/server"
import { previewManager } from "@/lib/v0/preview-manager"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chatId = searchParams.get("chatId")

  if (!chatId) {
    return NextResponse.json({ error: "chatId is required" }, { status: 400 })
  }

  const results = await previewManager.getValidationResults(chatId)

  if (!results) {
    return NextResponse.json({ status: "pending", message: "Validation not started" }, { status: 200 })
  }

  return NextResponse.json(results)
}
