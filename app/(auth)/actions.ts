/**
 * Auth actions stub
 */

'use server'

type ActionState = {
  type: 'error' | 'success'
  message: string
} | undefined

export async function signInAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Stub implementation - authentication is disabled
  return { type: 'error', message: 'Authentication not configured' }
}

export async function signUpAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Stub implementation - authentication is disabled
  return { type: 'error', message: 'Authentication not configured' }
}
