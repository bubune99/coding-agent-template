/**
 * NextAuth configuration stub
 * This is a placeholder for v0's auth system
 */

import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'

const config: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: async ({ auth }) => {
      // Allow all requests for now (authentication disabled)
      return true
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
export const { GET, POST } = handlers
