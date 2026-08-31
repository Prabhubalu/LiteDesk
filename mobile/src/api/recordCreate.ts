import { apiClient } from '@/api/client'
import { inferLookupTarget } from '@/api/lookupOptions'

export type MobileCreateFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'radio'
  | 'multi-select'
  | 'checkbox'
  | 'lookup'
  | 'related-to'
  | 'tags'

export type MobileCreateField = {
  key: string
  label: string
  type: MobileCreateFieldType
  dataType: string
  required: boolean
  placeholder: string
  options: Array<{ value: string; label: string }>
  lookupTarget?: string
}

type ModuleFieldDef = {
  key?: string
  label?: string
  dataType?: string
  required?: boolean
  placeholder?: string
  options?: Array<string | { value?: string; label?: string }>
  lookupSettings?: { targetModule?: string; displayField?: string }
  dependencies?: unknown[]
}

type ModuleDef = {
  key?: string
  fields?: ModuleFieldDef[]
  quickCreate?: string[]
}

const DATA_TYPE_MAP: Record<string, MobileCreateFieldType> = {
  text: 'text',
  'single line': 'text',
  'text-area': 'textarea',
  'rich text': 'textarea',
  richtext: 'textarea',
  email: 'email',
  phone: 'phone',
  url: 'url',
  integer: 'number',
  decimal: 'number',
  currency: 'number',
  date: 'date',
  'date-time': 'datetime',
  picklist: 'select',
  'radio button': 'radio',
  'multi-picklist': 'multi-select',
  checkbox: 'checkbox',
  user: 'lookup'
}

const LONG_TEXT_FIELD_KEYS = new Set([
  'description',
  'notes',
  'note',
  'comments',
  'comment',
  'body',
  'details'
])

const SKIP_DATA_TYPES = new Set([
  'auto-number',
  'formula',
  'rollup summary',
  'file upload',
  'image',
  'signature'
])

const SYSTEM_FIELD_KEYS = new Set([
  'createdby',
  'createdat',
  'updatedby',
  'updatedat',
  'modifiedtime',
  'createdtime',
  'organizationid',
  '_id',
  '__v',
  'deletedby',
  'deletedat'
])

/** Create endpoints mirror CreateRecordDrawer moduleEndpointMap. */
const CREATE_ENDPOINTS: Record<string, string> = {
  people: '/people',
  organizations: '/organizations',
  deals: '/deals',
  tasks: '/tasks',
  events: '/events',
  cases: '/helpdesk/cases'
}

function parseModulesList(body: unknown): ModuleDef[] {
  if (Array.isArray(body)) return body as ModuleDef[]
  if (!body || typeof body !== 'object') return []
  const payload = body as Record<string, unknown>
  if (Array.isArray(payload.data)) return payload.data as ModuleDef[]
  if (payload.data && typeof payload.data === 'object') {
    const nested = payload.data as Record<string, unknown>
    if (Array.isArray(nested.modules)) return nested.modules as ModuleDef[]
  }
  if (Array.isArray(payload.modules)) return payload.modules as ModuleDef[]
  return []
}

function normalizeFieldKey(key: string): string {
  return String(key || '').toLowerCase().trim()
}

function resolveFieldByKey(fields: ModuleFieldDef[], key: string): ModuleFieldDef | undefined {
  const raw = String(key || '').trim()
  if (!raw) return undefined

  const fieldByKey = new Map<string, ModuleFieldDef>()
  fields.forEach((field) => {
    const fieldKey = normalizeFieldKey(field?.key || '')
    if (fieldKey) fieldByKey.set(fieldKey, field)
  })

  const direct = fieldByKey.get(normalizeFieldKey(raw))
  if (direct) return direct

  const camelCaseKey = raw.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
  const camelHit = fieldByKey.get(normalizeFieldKey(camelCaseKey))
  if (camelHit) return camelHit

  if (raw.includes('_')) {
    const camelFromSnake = raw.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    const snakeHit = fieldByKey.get(normalizeFieldKey(camelFromSnake))
    if (snakeHit) return snakeHit
  }

  if (/[A-Z]/.test(raw)) {
    const snakeFromCamel = raw.replace(/([A-Z])/g, '_$1').toLowerCase()
    const camelToSnakeHit = fieldByKey.get(normalizeFieldKey(snakeFromCamel))
    if (camelToSnakeHit) return camelToSnakeHit
  }

  return undefined
}

function normalizeOptions(options: ModuleFieldDef['options']): MobileCreateField['options'] {
  if (!Array.isArray(options)) return []
  return options
    .map((option) => {
      if (typeof option === 'string') return { value: option, label: option }
      const value = String(option?.value ?? option?.label ?? '')
      if (!value) return null
      return { value, label: String(option?.label ?? value) }
    })
    .filter((option): option is { value: string; label: string } => option !== null)
}

function isSystemField(field: ModuleFieldDef): boolean {
  const key = normalizeFieldKey(field?.key || '').replace(/[^a-z0-9]/g, '')
  return SYSTEM_FIELD_KEYS.has(key)
}

function resolveMobileFieldType(field: ModuleFieldDef): MobileCreateFieldType | null {
  const key = normalizeFieldKey(field?.key || '')
  const dataType = String(field?.dataType || '').toLowerCase().trim()

  if (key === 'relatedto' || key === 'related-to') return 'related-to'
  if (key === 'tags') return 'tags'

  if (SKIP_DATA_TYPES.has(dataType)) return null

  if (
    dataType.includes('lookup') ||
    dataType.includes('reference') ||
    field.lookupSettings?.targetModule ||
    inferLookupTarget(field.key || '', field.lookupSettings)
  ) {
    return 'lookup'
  }

  const mapped = DATA_TYPE_MAP[dataType] || null
  const normalizedKey = key.replace(/[^a-z0-9]/g, '')
  if (mapped === 'text' && LONG_TEXT_FIELD_KEYS.has(normalizedKey)) {
    return 'textarea'
  }

  return mapped
}

function toMobileField(field: ModuleFieldDef): MobileCreateField | null {
  const key = String(field?.key || '').trim()
  if (!key) return null

  const type = resolveMobileFieldType(field)
  if (!type) return null

  const dataType = String(field?.dataType || '').trim()
  const lookupTarget =
    type === 'lookup' ? inferLookupTarget(key, field.lookupSettings) : undefined

  return {
    key,
    label: String(field?.label || key),
    type,
    dataType,
    required: field?.required === true,
    placeholder: String(field?.placeholder || ''),
    options: normalizeOptions(field?.options),
    lookupTarget
  }
}

function fieldIsVisible(field: ModuleFieldDef, formValues: Record<string, unknown>): boolean {
  const deps = field.dependencies
  if (!Array.isArray(deps) || deps.length === 0) return true

  return deps.every((dep) => {
    if (!dep || typeof dep !== 'object') return true
    const rule = dep as Record<string, unknown>
    const fieldKey = String(rule.field || rule.fieldKey || '')
    const operator = String(rule.operator || 'equals').toLowerCase()
    const expected = rule.value
    const actual = formValues[fieldKey]

    if (operator === 'not_equals' || operator === 'not equals') {
      return String(actual ?? '') !== String(expected ?? '')
    }
    if (operator === 'is_empty' || operator === 'is empty') {
      return actual == null || String(actual).trim() === ''
    }
    if (operator === 'is_not_empty' || operator === 'is not empty') {
      return actual != null && String(actual).trim() !== ''
    }
    return String(actual ?? '') === String(expected ?? '')
  })
}

/**
 * Quick Create fields as configured in Settings (same source and ordering as web CreateRecordDrawer).
 * Includes required fields missing from quickCreate config.
 */
export async function fetchQuickCreateFields(
  moduleKey: string,
  appKey?: string
): Promise<MobileCreateField[]> {
  const key = moduleKey.toLowerCase().trim()
  const res = await apiClient.get<unknown>(
    `/modules?key=${encodeURIComponent(key)}&context=all`,
    { appKey }
  )
  const modules = parseModulesList(res)
  const mod =
    modules.find((entry) => String(entry?.key || '').toLowerCase().trim() === key) || modules[0]
  const fields = Array.isArray(mod?.fields) ? mod.fields : []
  if (!fields.length) return []

  const quickCreateKeys = Array.isArray(mod?.quickCreate) ? mod.quickCreate : []
  const ordered: MobileCreateField[] = []
  const seen = new Set<string>()

  for (const quickKey of quickCreateKeys) {
    const source = resolveFieldByKey(fields, String(quickKey))
    if (!source || isSystemField(source) || !fieldIsVisible(source, {})) continue
    const mobileField = toMobileField(source)
    if (!mobileField) continue
    const norm = normalizeFieldKey(mobileField.key)
    if (seen.has(norm)) continue
    ordered.push(mobileField)
    seen.add(norm)
  }

  for (const source of fields) {
    if (!source.required || isSystemField(source)) continue
    const mobileField = toMobileField(source)
    if (!mobileField) continue
    const norm = normalizeFieldKey(mobileField.key)
    if (seen.has(norm)) continue
    if (!fieldIsVisible(source, {})) continue
    ordered.push(mobileField)
    seen.add(norm)
  }

  return ordered
}

export function initialFieldValue(field: MobileCreateField): FormFieldValue {
  if (field.type === 'checkbox') return false
  if (field.type === 'multi-select' || field.type === 'tags') return []
  if (field.type === 'related-to') return { type: 'none', id: null }
  return ''
}

export type FormFieldValue =
  | string
  | boolean
  | string[]
  | { type: string; id: string | null }

export async function createModuleRecord(
  moduleKey: string,
  payload: Record<string, unknown>,
  appKey?: string
): Promise<{ success?: boolean; message?: string; data?: Record<string, unknown> }> {
  const key = moduleKey.toLowerCase().trim()
  const path = CREATE_ENDPOINTS[key] || `/${key}`
  const body = key === 'tasks' ? { status: 'todo', ...payload } : payload
  return apiClient.post<{ success?: boolean; message?: string; data?: Record<string, unknown> }>(
    path,
    body,
    { appKey }
  )
}
