import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/appStorage'

const STORAGE_NAME = 'footer-module'

export async function getFooterModuleKey(): Promise<string | null> {
  return readStoredValue(STORAGE_NAME)
}

export async function persistFooterModuleKey(moduleKey: string | null): Promise<void> {
  if (moduleKey) await writeStoredValue(STORAGE_NAME, moduleKey)
  else await removeStoredValue(STORAGE_NAME)
}
