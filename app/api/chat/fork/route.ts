import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "v0-sdk"
import { auth } from "@/app/(auth)/auth"

// Create v0 client with custom baseUrl if V0_API_URL is set
const v0 = createClient(process.env.V0_API_URL ? { baseUrl: process.env.V0_API_URL } : {})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { chatId } = await request.json()

    if (!chatId) {
      return NextResponse.json({ error: "Chat ID is required" }, { status: 400 })
    }

    // Fork the chat using v0 SDK
    const forkedChat = await v0.chats.fork({
      chatId,
      privacy: "private", // Default to private
    })

    console.log("Chat forked successfully:", forkedChat.id)

    return NextResponse.json(forkedChat)
  } catch (error) {
    console.error("Error forking chat:", error)
    return NextResponse.json({ error: "Failed to fork chat" }, { status: 500 })
  }
}
