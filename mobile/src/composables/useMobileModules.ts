import { computed } from 'vue'
import {
  MOBILE_MODULES,
  MOBILE_MODULE_CATEGORIES,
  type MobileModuleCategory,
  type MobileModuleDef
} from '@/config/mobileModules'
import { hasPermission } from '@/utils/permissions'
import { useAuthStore } from '@/stores/auth'

export function useMobileModules() {
  const auth = useAuthStore()

  const allowedModules = computed(() => {
    return MOBILE_MODULES.filter((mod) => hasPermission(auth.user, mod.permission))
  })

  const featuredModules = computed(() => {
    return allowedModules.value.filter((mod) => mod.featured)
  })

  const modulesByCategory = computed(() => {
    const grouped = new Map<MobileModuleCategory, MobileModuleDef[]>()
    for (const mod of allowedModules.value) {
      const list = grouped.get(mod.category) || []
      list.push(mod)
      grouped.set(mod.category, list)
    }
    return [...grouped.entries()]
      .sort(
        (a, b) =>
          MOBILE_MODULE_CATEGORIES[a[0]].order - MOBILE_MODULE_CATEGORIES[b[0]].order
      )
      .map(([category, modules]) => ({
        category,
        label: MOBILE_MODULE_CATEGORIES[category].label,
        modules
      }))
  })

  function canAccessModule(key: string): boolean {
    const mod = MOBILE_MODULES.find((m) => m.key === key)
    if (!mod) return false
    return hasPermission(auth.user, mod.permission)
  }

  return {
    allowedModules,
    featuredModules,
    modulesByCategory,
    canAccessModule
  }
}
