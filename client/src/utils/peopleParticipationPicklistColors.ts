/**
 * Default colors for People SALES participation status picklists.
 * Keep in sync with server/utils/peopleParticipationPicklistColors.js
 */

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

export function getDefaultParticipationPicklistColor(fieldKey: string, value: unknown): string {
  const normalizedValue = normalizePicklistColorKey(value);
  const field = String(fieldKey || '').toLowerCase();
  if (field === 'lead_status') {
    return LEAD_STATUS_OPTION_COLORS[normalizedValue] || '#3B82F6';
  }
  if (field === 'contact_status') {
    return CONTACT_STATUS_OPTION_COLORS[normalizedValue] || '#6B7280';
  }
  return '#3B82F6';
}

export function buildColoredPicklistOption(fieldKey: string, value: string) {
  const label = String(value);
  return {
    value: label,
    label,
    enabled: true,
    color: getDefaultParticipationPicklistColor(fieldKey, label),
  };
}

export function buildDefaultColoredPicklistOptions(fieldKey: string, values: readonly string[]) {
  return values.map((value) => buildColoredPicklistOption(fieldKey, value));
}

export function applyDefaultColorsToPicklistOptions(fieldKey: string, options: unknown[]) {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => {
    if (typeof opt === 'string') {
      return buildColoredPicklistOption(fieldKey, opt);
    }
    if (opt != null && typeof opt === 'object') {
      const row = opt as { value?: unknown; label?: unknown; enabled?: boolean; color?: string };
      const value = String(row.value ?? row.label ?? '');
      return {
        ...row,
        value,
        label: row.label ?? value,
        enabled: row.enabled !== false,
        color: row.color || getDefaultParticipationPicklistColor(fieldKey, value),
      };
    }
    return opt;
  });
}

export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#1f2937';
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? '#1f2937' : '#ffffff';
}

export function picklistBadgeStyle(hexColor: string | null | undefined): Record<string, string> {
  if (!hexColor) return {};
  return {
    backgroundColor: hexColor,
    color: getContrastColor(hexColor),
  };
}
