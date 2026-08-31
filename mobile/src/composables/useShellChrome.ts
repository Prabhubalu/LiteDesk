import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import { getFooterModuleKey, persistFooterModuleKey } from '@/services/footerModule'

export type AstraOpenOptions = {
  prompt?: string
  autoAsk?: boolean
  moduleKey?: string
  recordId?: string
  recordName?: string
}

export type ShellChrome = {
  launcherOpen: Ref<boolean>
  quickCreateOpen: Ref<boolean>
  profileMenuOpen: Ref<boolean>
  searchOpen: Ref<boolean>
  astraOpen: Ref<boolean>
  astraOptions: Ref<AstraOpenOptions | null>
  /** Record title from the active detail view for contextual Astra. */
  astraRecordName: Ref<string | null>
  setAstraRecordName: (name: string | null) => void
  /** Module key whose create form sheet is open, null when closed. */
  createModuleKey: Ref<string | null>
  /** When set (e.g. on Inbox), FAB opens this instead of Quick Create. */
  primaryAction: Ref<(() => void) | null>
  primaryActionLabel: Ref<string>
  /** Module pinned to the footer app picker after selection. */
  footerModuleKey: Ref<string | null>
  setFooterModuleKey: (moduleKey: string | null) => void
  openLauncher: () => void
  closeLauncher: () => void
  toggleLauncher: () => void
  openQuickCreate: () => void
  closeQuickCreate: () => void
  openProfileMenu: () => void
  closeProfileMenu: () => void
  openSearch: () => void
  closeSearch: () => void
  openAstra: (options?: AstraOpenOptions) => void
  closeAstra: () => void
  toggleAstra: (options?: AstraOpenOptions) => void
  openCreateForm: (moduleKey: string) => void
  closeCreateForm: () => void
  closeAllSheets: () => void
  setPrimaryAction: (handler: (() => void) | null, label?: string) => void
  runPrimaryAction: () => void
}

const shellChromeKey: InjectionKey<ShellChrome> = Symbol('shellChrome')

export function provideShellChrome(): ShellChrome {
  const launcherOpen = ref(false)
  const quickCreateOpen = ref(false)
  const profileMenuOpen = ref(false)
  const searchOpen = ref(false)
  const astraOpen = ref(false)
  const astraOptions = ref<AstraOpenOptions | null>(null)
  const astraRecordName = ref<string | null>(null)
  const createModuleKey = ref<string | null>(null)
  const primaryAction = ref<(() => void) | null>(null)
  const primaryActionLabel = ref('Quick create')
  const footerModuleKey = ref<string | null>(null)

  void getFooterModuleKey().then((key) => {
    footerModuleKey.value = key
  })

  function closeAllSheets() {
    launcherOpen.value = false
    quickCreateOpen.value = false
    profileMenuOpen.value = false
    searchOpen.value = false
    astraOpen.value = false
    astraOptions.value = null
    createModuleKey.value = null
  }

  const chrome: ShellChrome = {
    launcherOpen,
    quickCreateOpen,
    profileMenuOpen,
    searchOpen,
    astraOpen,
    astraOptions,
    astraRecordName,
    setAstraRecordName: (name: string | null) => {
      astraRecordName.value = name
    },
    createModuleKey,
    primaryAction,
    primaryActionLabel,
    footerModuleKey,
    setFooterModuleKey: (moduleKey: string | null) => {
      footerModuleKey.value = moduleKey
      void persistFooterModuleKey(moduleKey)
    },
    openLauncher: () => {
      quickCreateOpen.value = false
      profileMenuOpen.value = false
      searchOpen.value = false
      astraOpen.value = false
      launcherOpen.value = true
    },
    closeLauncher: () => {
      launcherOpen.value = false
    },
    toggleLauncher: () => {
      if (launcherOpen.value) {
        launcherOpen.value = false
        return
      }
      chrome.openLauncher()
    },
    openQuickCreate: () => {
      launcherOpen.value = false
      profileMenuOpen.value = false
      searchOpen.value = false
      astraOpen.value = false
      quickCreateOpen.value = true
    },
    closeQuickCreate: () => {
      quickCreateOpen.value = false
    },
    openProfileMenu: () => {
      launcherOpen.value = false
      quickCreateOpen.value = false
      searchOpen.value = false
      astraOpen.value = false
      profileMenuOpen.value = true
    },
    closeProfileMenu: () => {
      profileMenuOpen.value = false
    },
    openSearch: () => {
      launcherOpen.value = false
      quickCreateOpen.value = false
      profileMenuOpen.value = false
      astraOpen.value = false
      createModuleKey.value = null
      searchOpen.value = true
    },
    closeSearch: () => {
      searchOpen.value = false
    },
    openAstra: (options?: AstraOpenOptions) => {
      launcherOpen.value = false
      quickCreateOpen.value = false
      profileMenuOpen.value = false
      searchOpen.value = false
      createModuleKey.value = null
      astraOptions.value = options || null
      astraOpen.value = true
    },
    closeAstra: () => {
      astraOpen.value = false
      astraOptions.value = null
    },
    toggleAstra: (options?: AstraOpenOptions) => {
      if (astraOpen.value) {
        astraOpen.value = false
        astraOptions.value = null
        return
      }
      chrome.openAstra(options)
    },
    openCreateForm: (moduleKey: string) => {
      launcherOpen.value = false
      profileMenuOpen.value = false
      quickCreateOpen.value = false
      searchOpen.value = false
      astraOpen.value = false
      createModuleKey.value = moduleKey
    },
    closeCreateForm: () => {
      createModuleKey.value = null
    },
    closeAllSheets,
    setPrimaryAction: (handler, label = 'Quick create') => {
      primaryAction.value = handler
      primaryActionLabel.value = label
    },
    runPrimaryAction: () => {
      if (primaryAction.value) {
        primaryAction.value()
        return
      }
      chrome.openQuickCreate()
    }
  }

  provide(shellChromeKey, chrome)
  return chrome
}

export function useShellChrome(): ShellChrome {
  const chrome = inject(shellChromeKey)
  if (!chrome) {
    throw new Error('useShellChrome must be used within ShellView')
  }
  return chrome
}
