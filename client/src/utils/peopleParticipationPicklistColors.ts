/**
 * Default colors for People SALES participation status picklists.
 * Keep in sync with server/utils/peopleParticipationPicklistColors.js
 */

import {
  LEAD_STATUS_OPTION_COLORS,
  CONTACT_STATUS_OPTION_COLORS,
  PLATFORM_DEFAULT_PICKLIST_COLOR,
  normalizePicklistColorKey,
  getSemanticPicklistColor,
  backfillPicklistOptionColors,
} from '@/utils/picklistColorPalette';

export { LEAD_STATUS_OPTION_COLORS, CONTACT_STATUS_OPTION_COLORS, normalizePicklistColorKey };

export function getDefaultParticipationPicklistColor(fieldKey: string, value: unknown): string {
  const semantic = getSemanticPicklistColor(fieldKey, value, 'people');
  if (semantic) return semantic;
  const field = String(fieldKey || '').toLowerCase();
  if (field === 'contact_status') return CONTACT_STATUS_OPTION_COLORS.inactive ?? PLATFORM_DEFAULT_PICKLIST_COLOR;
  return LEAD_STATUS_OPTION_COLORS.new ?? PLATFORM_DEFAULT_PICKLIST_COLOR;
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
  return backfillPicklistOptionColors(options, fieldKey, 'people');
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
