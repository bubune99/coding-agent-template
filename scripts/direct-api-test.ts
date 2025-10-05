#!/usr/bin/env tsx
/**
 * Direct API test - creates task via HTTP API
 *
 * Usage:
 *   pnpm tsx scripts/direct-api-test.ts
 */

async function createTaskViaAPI() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

  const taskRequest = {
    prompt: 'Add a simple README.md file with project description',
    repoUrl: 'https://github.com/your-username/test-repo.git', // CHANGE THIS
    selectedAgent: 'claude',
    selectedModel: 'claude-sonnet-4-5-20250929',
    installDependencies: false,
    maxDuration: 5,
  }

  console.log('🚀 Creating task via API...\n')
  console.log('Config:', JSON.stringify(taskRequest, null, 2))
  console.log('\n─'.repeat(50))

  try {
    const response = await fetch(`${apiUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskRequest),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    console.log('\n✅ Task created successfully!')
    console.log('Task ID:', result.task.id)
    console.log('Status:', result.task.status)
    console.log('\n📊 Monitor at: http://localhost:3000')
    console.log(`📝 Or check logs: http://localhost:3000/tasks/${result.task.id}`)

    return result.task
  } catch (error) {
    console.error('\n❌ Failed to create task:', error)
    throw error
  }
}

createTaskViaAPI().catch(console.error)
