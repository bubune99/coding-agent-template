/**
 * Auth stub - authentication disabled
 * This is a placeholder for future auth implementation
 */

"use server"

export type UserType = "guest" | "regular"

export interface Session {
  user: {
    id: string
    email?: string
    name?: string
    type: UserType
  }
}

export async function auth(): Promise<Session | null> {
  return null
}

export async function signIn(provider?: string, options?: { redirect?: boolean; redirectTo?: string }) {
  return null
}

export async function signOut(options?: { redirect?: boolean; redirectTo?: string }) {
  return null
}

// Stub handlers for API routes
export const handlers = {
  GET: async () => new Response("Auth not configured", { status: 501 }),
  POST: async () => new Response("Auth not configured", { status: 501 }),
}

export const { GET, POST } = handlers
