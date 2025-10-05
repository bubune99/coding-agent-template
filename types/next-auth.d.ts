import type { UserType } from '@/app/(auth)/auth'

declare module 'next-auth' {
  interface User {
    type: UserType
  }

  interface Session {
    user: User & {
      id: string
    }
  }
}
