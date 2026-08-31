export type MobileModuleCategory = 'platform' | 'crm' | 'support' | 'operations' | 'audit'

export type MobileModuleDef = {
  key: string
  label: string
  permission: string
  apiPath: string
  detailApiPath?: string
  appKey?: string
  category: MobileModuleCategory
  featured?: boolean
  accentColor?: string
  titleKeys: string[]
  subtitleKeys: string[]
  detailFields: Array<{ label: string; keys: string[] }>
}

export const MOBILE_MODULE_CATEGORIES: Record<
  MobileModuleCategory,
  { label: string; order: number }
> = {
  platform: { label: 'Platform', order: 0 },
  crm: { label: 'CRM', order: 1 },
  support: { label: 'Support', order: 2 },
  operations: { label: 'Operations', order: 3 },
  audit: { label: 'Audit', order: 4 }
}

/** Mobile-supported modules — mirrors web sidebar entities, mobile-optimized lists. */
export const MOBILE_MODULES: MobileModuleDef[] = [
  {
    key: 'people',
    label: 'People',
    permission: 'people.view',
    apiPath: '/people',
    category: 'platform',
    featured: true,
    accentColor: '#6049E7',
    titleKeys: ['name', 'full_name', 'first_name', 'email'],
    subtitleKeys: ['email', 'phone', 'mobile', 'job_title'],
    detailFields: [
      { label: 'Email', keys: ['email'] },
      { label: 'Phone', keys: ['phone', 'mobile'] },
      { label: 'Title', keys: ['job_title', 'title'] }
    ]
  },
  {
    key: 'organizations',
    label: 'Organizations',
    permission: 'organizations.view',
    apiPath: '/organizations',
    category: 'platform',
    featured: true,
    accentColor: '#0891b2',
    titleKeys: ['name', 'organization_name'],
    subtitleKeys: ['website', 'industry', 'type'],
    detailFields: [
      { label: 'Website', keys: ['website'] },
      { label: 'Industry', keys: ['industry'] },
      { label: 'Type', keys: ['type'] }
    ]
  },
  {
    key: 'deals',
    label: 'Deals',
    permission: 'deals.view',
    apiPath: '/deals',
    appKey: 'SALES',
    category: 'crm',
    featured: true,
    accentColor: '#10b981',
    titleKeys: ['name', 'title', 'deal_name'],
    subtitleKeys: ['stage', 'status', 'amount'],
    detailFields: [
      { label: 'Stage', keys: ['stage', 'pipeline_stage'] },
      { label: 'Status', keys: ['status'] },
      { label: 'Amount', keys: ['amount', 'value'] }
    ]
  },
  {
    key: 'events',
    label: 'Events',
    permission: 'events.view',
    apiPath: '/events',
    appKey: 'SALES',
    category: 'crm',
    accentColor: '#f59e0b',
    titleKeys: ['eventName', 'name', 'title', 'subject'],
    subtitleKeys: ['status', 'startDate', 'start_date'],
    detailFields: [
      { label: 'Status', keys: ['status'] },
      { label: 'Start', keys: ['startDate', 'start_date'] },
      { label: 'Location', keys: ['location', 'venue'] }
    ]
  },
  {
    key: 'cases',
    label: 'Cases',
    permission: 'cases.view',
    apiPath: '/helpdesk/cases',
    appKey: 'HELPDESK',
    category: 'support',
    featured: true,
    accentColor: '#ef4444',
    titleKeys: ['subject', 'title', 'case_number'],
    subtitleKeys: ['status', 'priority', 'case_number'],
    detailFields: [
      { label: 'Status', keys: ['status'] },
      { label: 'Priority', keys: ['priority'] },
      { label: 'Number', keys: ['case_number', 'caseNumber'] }
    ]
  },
  {
    key: 'forms',
    label: 'Forms',
    permission: 'forms.view',
    apiPath: '/forms',
    category: 'operations',
    accentColor: '#8b5cf6',
    titleKeys: ['name', 'title'],
    subtitleKeys: ['status', 'type'],
    detailFields: [
      { label: 'Status', keys: ['status'] },
      { label: 'Type', keys: ['type', 'form_type'] }
    ]
  },
  {
    key: 'items',
    label: 'Items',
    permission: 'items.view',
    apiPath: '/items',
    appKey: 'SALES',
    category: 'operations',
    accentColor: '#3b82f6',
    titleKeys: ['name', 'item_name', 'sku'],
    subtitleKeys: ['sku', 'type', 'status'],
    detailFields: [
      { label: 'SKU', keys: ['sku'] },
      { label: 'Type', keys: ['type', 'item_type'] },
      { label: 'Status', keys: ['status'] }
    ]
  },
  {
    key: 'responses',
    label: 'Responses',
    permission: 'responses.view',
    apiPath: '/responses',
    category: 'audit',
    accentColor: '#ec4899',
    titleKeys: ['name', 'title', 'form_name'],
    subtitleKeys: ['status', 'submitted_at', 'updatedAt'],
    detailFields: [
      { label: 'Status', keys: ['status'] },
      { label: 'Submitted', keys: ['submitted_at', 'createdAt'] }
    ]
  }
]

export type MobileCreateAction = { moduleKey: string; label: string; permission: string }

/** Create menu parity with web Platform Home (PlatformHomeIntentBar createActions). */
export const MOBILE_CREATE_ACTIONS: MobileCreateAction[] = [
  { moduleKey: 'people', label: 'New person', permission: 'people.create' },
  { moduleKey: 'organizations', label: 'New organization', permission: 'organizations.create' },
  { moduleKey: 'deals', label: 'New deal', permission: 'deals.create' },
  { moduleKey: 'tasks', label: 'New task', permission: 'tasks.create' },
  { moduleKey: 'cases', label: 'New case', permission: 'cases.create' }
]

export function getMobileCreateAction(moduleKey: string): MobileCreateAction | undefined {
  return MOBILE_CREATE_ACTIONS.find((action) => action.moduleKey === moduleKey)
}

export function getMobileModule(key: string): MobileModuleDef | undefined {
  return MOBILE_MODULES.find((m) => m.key === key)
}

export function getModuleAccent(moduleKey: string): string {
  if (moduleKey === 'inbox') return '#6049E7'
  if (moduleKey === 'tasks') return '#10b981'
  return getMobileModule(moduleKey)?.accentColor || '#6049E7'
}

export function pickRecordField(
  record: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      if (key === 'first_name' && record.last_name) {
        return `${value} ${record.last_name}`.trim()
      }
      return String(value)
    }
  }
  return ''
}

export function recordTitle(record: Record<string, unknown>, mod: MobileModuleDef): string {
  const title = pickRecordField(record, mod.titleKeys)
  return title || mod.label
}

export function recordSubtitle(record: Record<string, unknown>, mod: MobileModuleDef): string {
  return pickRecordField(record, mod.subtitleKeys)
}
