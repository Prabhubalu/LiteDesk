/** Popular shortcuts shown at the top of the picker. */
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Cairo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'Australia/Sydney'
];

const REGION_ORDER = ['UTC', 'Popular', 'Africa', 'America', 'Asia', 'Europe', 'Pacific', 'Other'] as const;

export interface TimezonePickerOption {
  value: string;
  label: string;
  group: string;
}

function getAllIanaTimezones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('timeZone');
    if (supported?.length) return [...supported];
  } catch {
    /* ignore */
  }
  return [...COMMON_TIMEZONES];
}

function regionGroup(timezone: string): string {
  if (timezone === 'UTC') return 'UTC';
  if (timezone.startsWith('Africa/')) return 'Africa';
  if (timezone.startsWith('America/')) return 'America';
  if (timezone.startsWith('Asia/')) return 'Asia';
  if (timezone.startsWith('Europe/')) return 'Europe';
  if (timezone.startsWith('Australia/') || timezone.startsWith('Pacific/')) return 'Pacific';
  return 'Other';
}

/**
 * Full IANA timezone options for the business-hours picker:
 * Popular shortcuts first, then every supported zone grouped by region.
 */
export function buildTimezonePickerOptions(selectedTimezone?: string | null): TimezonePickerOption[] {
  const zoneSet = new Set<string>(getAllIanaTimezones());
  zoneSet.add('UTC');
  for (const tz of COMMON_TIMEZONES) {
    zoneSet.add(tz);
  }
  if (selectedTimezone?.trim()) {
    zoneSet.add(selectedTimezone.trim());
  }

  const popularSet = new Set(COMMON_TIMEZONES.filter((z) => zoneSet.has(z)));
  const byRegion = new Map<string, string[]>();

  for (const value of zoneSet) {
    if (popularSet.has(value) && value !== 'UTC') continue;
    const group = regionGroup(value);
    if (group === 'UTC' && popularSet.has('UTC')) continue;
    const list = byRegion.get(group) || [];
    list.push(value);
    byRegion.set(group, list);
  }

  for (const list of byRegion.values()) {
    list.sort();
  }

  const options: TimezonePickerOption[] = [];

  for (const value of COMMON_TIMEZONES) {
    if (!zoneSet.has(value)) continue;
    options.push({
      value,
      label: value,
      group: value === 'UTC' ? 'UTC' : 'Popular'
    });
  }

  for (const group of REGION_ORDER) {
    if (group === 'UTC' || group === 'Popular') continue;
    const list = byRegion.get(group);
    if (!list?.length) continue;
    for (const value of list) {
      if (popularSet.has(value)) continue;
      options.push({ value, label: value, group });
    }
  }

  return options;
}

/** @deprecated Use buildTimezonePickerOptions for UI. */
export function getTimezoneOptions(): string[] {
  return buildTimezonePickerOptions().map((o) => o.value);
}

export function formatTimeInZone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date());
  } catch {
    return '';
  }
}

export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
