import { Suspense } from 'react'
import { ChatsClient } from '@/components/v0/chats/chats-client'

export default function ChatsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatsClient />
    </Suspense>
  )
}
