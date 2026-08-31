type ModulePermissions = Record<string, boolean | undefined>

export type UserPermissionEnvelope = Record<string, ModulePermissions | boolean | undefined>

function normalizeModuleKey(moduleKey: string): string {
  if (moduleKey === 'people') return 'contacts'
  if (moduleKey === 'settings-users') return 'users'
  return moduleKey
}

function moduleAllows(
  perms: UserPermissionEnvelope | undefined,
  moduleKey: string,
  action: string
): boolean {
  if (!perms) return false
  const normalized = normalizeModuleKey(moduleKey)
  const modulePerms = perms[normalized]
  if (!modulePerms || typeof modulePerms !== 'object') return false
  if (modulePerms[action] === true) return true
  if (action === 'read' && modulePerms.view === true) return true
  if (action === 'view' && modulePerms.read === true) return true
  return false
}

export function hasPermission(
  user: Record<string, unknown> | null | undefined,
  permission: string | undefined
): boolean {
  if (!permission) return true
  if (!user) return false

  const role = String(user.role || '').toLowerCase()
  if (user.isOwner === true || role === 'admin' || role === 'owner') return true

  const [moduleKey, action] = permission.split('.')
  if (!moduleKey || !action) return false

  const perms = user.permissions as UserPermissionEnvelope | undefined

  if (moduleAllows(perms, moduleKey, action)) return true
  if (moduleKey === 'people' && moduleAllows(perms, 'people', action)) return true
  if (moduleKey === 'contacts' && moduleAllows(perms, 'people', action)) return true
  if (moduleKey === 'responses' && moduleAllows(perms, 'forms', action)) return true

  return false
}
