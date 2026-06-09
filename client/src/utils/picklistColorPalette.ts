/**
 * Curated Tailwind 500 palette for picklist option badges.
 * Keep in sync with server/utils/picklistColorPalette.js
 */

export const PLATFORM_DEFAULT_PICKLIST_COLOR = '#3B82F6'; // blue-500

export const PICKLIST_COLOR_PALETTE: readonly string[] = Object.freeze([
  '#3B82F6', // blue-500
  '#6366F1', // indigo-500
  '#8B5CF6', // violet-500
  '#A855F7', // purple-500
  '#D946EF', // fuchsia-500
  '#EC4899', // pink-500
  '#F43F5E', // rose-500
  '#EF4444', // red-500
  '#F97316', // orange-500
  '#F59E0B', // amber-500
  '#EAB308', // yellow-500
  '#84CC16', // lime-500
  '#22C55E', // green-500
  '#10B981', // emerald-500
  '#14B8A6', // teal-500
  '#06B6D4', // cyan-500
  '#0EA5E9', // sky-500
  '#6B7280', // gray-500
]);

export const TASK_STATUS_OPTION_COLORS: Readonly<Record<string, string>> = Object.freeze({
  todo: '#6B7280',
  in_progress: '#2563EB',
  waiting: '#D97706',
  completed: '#16A34A',
  cancelled: '#DC2626',
});

export const TASK_PRIORITY_OPTION_COLORS: Readonly<Record<string, string>> = Object.freeze({
  low: '#6B7280',
  medium: '#2563EB',
  high: '#D97706',
  urgent: '#DC2626',
});

export const LEAD_STATUS_OPTION_COLORS: Readonly<Record<string, string>> = Object.freeze({
  new: '#2563EB',
  contacted: '#6366F1',
  qualified: '#16A34A',
  disqualified: '#DC2626',
  nurturing: '#D97706',
  're-engage': '#9333EA',
  re_engage: '#9333EA',
});

export const CONTACT_STATUS_OPTION_COLORS: Readonly<Record<string, string>> = Object.freeze({
  active: '#16A34A',
  inactive: '#6B7280',
  donotcontact: '#DC2626',
});

export function normalizePicklistColorKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeFieldKey(fieldKey: string | null | undefined): string {
  return String(fieldKey || '').trim().toLowerCase();
}

export function normalizePicklistColorHex(color: unknown): string | null {
  const s = String(color ?? '').trim();
  const m = s.match(/^#?([0-9A-Fa-f]{6})$/);
  const hex = m?.[1];
  return hex ? `#${hex.toUpperCase()}` : null;
}

type PicklistOptionLike = string | { value?: unknown; label?: unknown; color?: unknown; enabled?: boolean };

export function getPicklistOptionValue(option: unknown): string {
  if (option == null) return '';
  if (typeof option === 'string') return option.trim();
  if (typeof option === 'object') {
    const row = option as { value?: unknown; label?: unknown };
    return String(row.value ?? row.label ?? '').trim();
  }
  return String(option).trim();
}

export function getUsedPicklistColors(options: unknown[] | null | undefined): Set<string> {
  const used = new Set<string>();
  for (const opt of Array.isArray(options) ? options : []) {
    const hex =
      typeof opt === 'object' && opt != null
        ? normalizePicklistColorHex((opt as { color?: unknown }).color)
        : null;
    if (hex) used.add(hex);
  }
  return used;
}

export function nextPicklistOptionColor(
  existingOptions: unknown[] | null | undefined = [],
  options: { skipPlatformDefault?: boolean } = {}
): string {
  const used = getUsedPicklistColors(existingOptions);
  const skipPlatformDefault = options.skipPlatformDefault === true;
  for (const color of PICKLIST_COLOR_PALETTE) {
    const hex = normalizePicklistColorHex(color);
    if (!hex) continue;
    if (skipPlatformDefault && hex === PLATFORM_DEFAULT_PICKLIST_COLOR) continue;
    if (!used.has(hex)) return hex;
  }
  const len = PICKLIST_COLOR_PALETTE.length;
  const count = Array.isArray(existingOptions) ? existingOptions.length : 0;
  for (let offset = 0; offset < len; offset += 1) {
    const hex = normalizePicklistColorHex(PICKLIST_COLOR_PALETTE[(count + offset) % len]);
    if (!hex) continue;
    if (skipPlatformDefault && hex === PLATFORM_DEFAULT_PICKLIST_COLOR) continue;
    if (!used.has(hex)) return hex;
  }
  return PLATFORM_DEFAULT_PICKLIST_COLOR;
}

export function isPlatformDefaultPicklistColor(color: unknown): boolean {
  const hex = normalizePicklistColorHex(color);
  if (!hex) return true;
  return hex === PLATFORM_DEFAULT_PICKLIST_COLOR;
}

export function getSemanticPicklistColor(
  fieldKey: string | null | undefined,
  optionValue: unknown,
  moduleKey = ''
): string | null {
  const key = normalizeFieldKey(fieldKey);
  const mod = String(moduleKey || '').toLowerCase();
  const val = normalizePicklistColorKey(optionValue);

  if (mod === 'tasks' || mod === '') {
    if (key === 'status') return TASK_STATUS_OPTION_COLORS[val] || null;
    if (key === 'priority') return TASK_PRIORITY_OPTION_COLORS[val] || null;
  }
  if (key === 'lead_status') return LEAD_STATUS_OPTION_COLORS[val] || null;
  if (key === 'contact_status') return CONTACT_STATUS_OPTION_COLORS[val] || null;
  return null;
}

export function resolveNewPicklistOptionColor({
  fieldKey,
  moduleKey = '',
  optionValue,
  existingOptions = [],
}: {
  fieldKey: string | null | undefined;
  moduleKey?: string;
  optionValue: unknown;
  existingOptions?: unknown[] | null;
}): string {
  const semantic = getSemanticPicklistColor(fieldKey, optionValue, moduleKey);
  if (semantic) return semantic;
  return nextPicklistOptionColor(existingOptions);
}

export function backfillPicklistOptionColors(
  options: unknown[] | null | undefined,
  fieldKey: string | null | undefined,
  moduleKey = ''
): PicklistOptionLike[] {
  if (!Array.isArray(options) || options.length === 0) return [];
  const result: PicklistOptionLike[] = [];
  for (const opt of options) {
    if (typeof opt === 'string') {
      const value = opt.trim();
      if (!value) continue;
      const semantic = getSemanticPicklistColor(fieldKey, value, moduleKey);
      result.push({
        value,
        label: value,
        enabled: true,
        color: semantic || nextPicklistOptionColor(result, { skipPlatformDefault: true }),
      });
      continue;
    }
    if (opt != null && typeof opt === 'object') {
      const row = opt as { value?: unknown; label?: unknown; color?: unknown; enabled?: boolean };
      const value = getPicklistOptionValue(opt);
      if (!value) {
        result.push(opt);
        continue;
      }
      const stored = normalizePicklistColorHex(row.color);
      let color: string;
      if (stored && !isPlatformDefaultPicklistColor(stored)) {
        color = stored;
      } else {
        const semantic = getSemanticPicklistColor(fieldKey, value, moduleKey);
        color = semantic || nextPicklistOptionColor(result, { skipPlatformDefault: true });
      }
      result.push({
        ...row,
        value,
        label: row.label ?? value,
        enabled: row.enabled !== false,
        color,
      });
      continue;
    }
    continue;
  }
  return result;
}
