import { readStoredFlag, writeStoredFlag } from '@/utils/appStorage'

export async function hasSeenWelcome(): Promise<boolean> {
  return readStoredFlag('welcomeSeen')
}

export async function markWelcomeSeen(): Promise<void> {
  await writeStoredFlag('welcomeSeen', true)
}
