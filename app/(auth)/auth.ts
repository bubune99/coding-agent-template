/**
 * Auth stub - authentication disabled
 * This is a placeholder for future auth implementation
 */

"use server"

export type UserType = "guest" | "regular"

// Stub auth function that returns null (no session)
export async function auth() {
  return null
}

// Stub signIn function
export async function signIn() {
  return null
}

// Stub signOut function
export async function signOut() {
  return null
}

// Stub handlers for API routes
export const handlers = {
  GET: async () => new Response("Auth not configured", { status: 501 }),
  POST: async () => new Response("Auth not configured", { status: 501 }),
}

export const { GET, POST } = handlers
