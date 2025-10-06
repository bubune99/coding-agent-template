import { eq } from "drizzle-orm"

import { users, chat_ownerships, anonymous_chat_logs, type User } from "./schema"
import { nanoid } from "nanoid"
import { generateHashedPassword } from "./utils"
import db from "./connection"

export async function syncStackUser(stackUserId: string, email: string): Promise<User> {
  try {
    // Check if user already exists
    const existingUsers = await db.select().from(users).where(eq(users.id, stackUserId))

    if (existingUsers.length > 0) {
      return existingUsers[0]
    }

    // Create new user with Stack Auth ID
    const newUsers = await db
      .insert(users)
      .values({
        id: stackUserId,
        email,
        password: null, // Stack Auth handles passwords
        type: "regular",
      })
      .returning()

    return newUsers[0]
  } catch (error) {
    console.error("Failed to sync Stack user to database:", error)
    throw error
  }
}

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(users).where(eq(users.email, email))
  } catch (error) {
    console.error("Failed to get user from database")
    throw error
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const result = await db.select().from(users).where(eq(users.id, id))
    return result[0] || null
  } catch (error) {
    console.error("Failed to get user by ID from database")
    throw error
  }
}

export async function createUser(email: string, password: string): Promise<User[]> {
  try {
    const hashedPassword = generateHashedPassword(password)
    return await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
      })
      .returning()
  } catch (error) {
    console.error("Failed to create user in database")
    throw error
  }
}

export async function createGuestUser(): Promise<User[]> {
  try {
    const guestId = nanoid()
    const guestEmail = `guest-${guestId}@example.com`

    return await db
      .insert(users)
      .values({
        email: guestEmail,
        password: null,
      })
      .returning()
  } catch (error) {
    console.error("Failed to create guest user in database")
    throw error
  }
}

export async function createChatOwnership(v0ChatId: string, userId: string) {
  try {
    return await db
      .insert(chat_ownerships)
      .values({
        v0_chat_id: v0ChatId,
        user_id: userId,
      })
      .returning()
  } catch (error) {
    console.error("Failed to create chat ownership:", error)
    throw error
  }
}

export async function getChatOwnership(v0ChatId: string) {
  try {
    const result = await db.select().from(chat_ownerships).where(eq(chat_ownerships.v0_chat_id, v0ChatId))
    return result[0] || null
  } catch (error) {
    console.error("Failed to get chat ownership:", error)
    throw error
  }
}

export async function getChatIdsByUserId(userId: string): Promise<string[]> {
  try {
    const ownerships = await db.select().from(chat_ownerships).where(eq(chat_ownerships.user_id, userId))
    return ownerships.map((o) => o.v0_chat_id)
  } catch (error) {
    console.error("Failed to get chat IDs by user ID:", error)
    throw error
  }
}

export async function deleteChatOwnership(v0ChatId: string) {
  try {
    return await db.delete(chat_ownerships).where(eq(chat_ownerships.v0_chat_id, v0ChatId)).returning()
  } catch (error) {
    console.error("Failed to delete chat ownership:", error)
    throw error
  }
}

export async function createAnonymousChatLog(ipAddress: string, v0ChatId: string) {
  try {
    return await db
      .insert(anonymous_chat_logs)
      .values({
        ip_address: ipAddress,
        v0_chat_id: v0ChatId,
      })
      .returning()
  } catch (error) {
    console.error("Failed to create anonymous chat log:", error)
    throw error
  }
}

export async function getChatCountByUserId(userId: string): Promise<number> {
  try {
    const ownerships = await db.select().from(chat_ownerships).where(eq(chat_ownerships.user_id, userId))
    return ownerships.length
  } catch (error) {
    console.error("Failed to get chat count by user ID:", error)
    throw error
  }
}

export async function getChatCountByIP(ipAddress: string, hoursAgo = 24): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    const logs = await db.select().from(anonymous_chat_logs).where(eq(anonymous_chat_logs.ip_address, ipAddress))

    // Filter by time in memory since we don't have a complex where clause
    const recentLogs = logs.filter((log) => log.created_at >= cutoffTime)
    return recentLogs.length
  } catch (error) {
    console.error("Failed to get chat count by IP:", error)
    throw error
  }
}
