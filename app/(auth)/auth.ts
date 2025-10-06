"use server"

import { stackServerApp } from "@/stack/server"

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
  const user = await stackServerApp.getUser()

  if (!user) {
    return null
  }

  return {
    user: {
      id: user.id,
      email: user.primaryEmail ?? undefined,
      name: user.displayName ?? undefined,
      type: "regular" as UserType,
    },
  }
}

export async function signIn() {
  // Stack Auth handles sign in through the /handler/signin page
  return { url: "/handler/signin" }
}

export async function signOut() {
  // Stack Auth handles sign out through the /handler/signout page
  return { url: "/handler/signout" }
}
