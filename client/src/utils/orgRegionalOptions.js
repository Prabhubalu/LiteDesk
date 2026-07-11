/** IANA timezone groups for org regional settings (display offsets are static labels). */
export const TIMEZONE_GROUPS = [
  {
    region: 'Popular',
    items: [
      { value: 'UTC', text: 'UTC — Coordinated Universal Time', sublabel: 'UTC', offset: 'UTC+00:00' },
      { value: 'Asia/Kolkata', text: 'India Standard Time', sublabel: 'Kolkata, Mumbai, New Delhi, Chennai', offset: 'UTC+05:30' },
      { value: 'America/New_York', text: 'Eastern Time', sublabel: 'New York, Toronto', offset: 'UTC−05:00' },
      { value: 'America/Los_Angeles', text: 'Pacific Time', sublabel: 'Los Angeles, San Francisco', offset: 'UTC−08:00' },
      { value: 'Europe/London', text: 'British Time', sublabel: 'London, Edinburgh', offset: 'UTC+00:00' },
      { value: 'Asia/Singapore', text: 'Singapore Time', sublabel: 'Singapore', offset: 'UTC+08:00' }
    ]
  },
  {
    region: 'Americas',
    items: [
      { value: 'America/New_York', text: 'America/New_York', sublabel: 'Eastern Time', offset: 'UTC−05:00' },
      { value: 'America/Chicago', text: 'America/Chicago', sublabel: 'Central Time', offset: 'UTC−06:00' },
      { value: 'America/Denver', text: 'America/Denver', sublabel: 'Mountain Time', offset: 'UTC−07:00' },
      { value: 'America/Phoenix', text: 'America/Phoenix', sublabel: 'Arizona (no DST)', offset: 'UTC−07:00' },
      { value: 'America/Los_Angeles', text: 'America/Los_Angeles', sublabel: 'Pacific Time', offset: 'UTC−08:00' },
      { value: 'America/Anchorage', text: 'America/Anchorage', sublabel: 'Alaska Time', offset: 'UTC−09:00' },
      { value: 'Pacific/Honolulu', text: 'Pacific/Honolulu', sublabel: 'Hawaii Time', offset: 'UTC−10:00' },
      { value: 'America/Toronto', text: 'America/Toronto', sublabel: 'Eastern Time (Canada)', offset: 'UTC−05:00' },
      { value: 'America/Vancouver', text: 'America/Vancouver', sublabel: 'Pacific Time (Canada)', offset: 'UTC−08:00' },
      { value: 'America/Mexico_City', text: 'America/Mexico_City', sublabel: 'Mexico City', offset: 'UTC−06:00' },
      { value: 'America/Bogota', text: 'America/Bogota', sublabel: 'Colombia', offset: 'UTC−05:00' },
      { value: 'America/Sao_Paulo', text: 'America/Sao_Paulo', sublabel: 'Brazil (São Paulo)', offset: 'UTC−03:00' },
      { value: 'America/Buenos_Aires', text: 'America/Argentina/Buenos_Aires', sublabel: 'Argentina', offset: 'UTC−03:00' },
      { value: 'America/Santiago', text: 'America/Santiago', sublabel: 'Chile', offset: 'UTC−04:00' }
    ]
  },
  {
    region: 'Europe',
    items: [
      { value: 'Europe/London', text: 'Europe/London', sublabel: 'GMT / BST', offset: 'UTC+00:00' },
      { value: 'Europe/Dublin', text: 'Europe/Dublin', sublabel: 'Ireland', offset: 'UTC+00:00' },
      { value: 'Europe/Lisbon', text: 'Europe/Lisbon', sublabel: 'Portugal', offset: 'UTC+00:00' },
      { value: 'Europe/Paris', text: 'Europe/Paris', sublabel: 'Central European Time', offset: 'UTC+01:00' },
      { value: 'Europe/Berlin', text: 'Europe/Berlin', sublabel: 'Germany', offset: 'UTC+01:00' },
      { value: 'Europe/Madrid', text: 'Europe/Madrid', sublabel: 'Spain', offset: 'UTC+01:00' },
      { value: 'Europe/Rome', text: 'Europe/Rome', sublabel: 'Italy', offset: 'UTC+01:00' },
      { value: 'Europe/Amsterdam', text: 'Europe/Amsterdam', sublabel: 'Netherlands', offset: 'UTC+01:00' },
      { value: 'Europe/Stockholm', text: 'Europe/Stockholm', sublabel: 'Sweden', offset: 'UTC+01:00' },
      { value: 'Europe/Zurich', text: 'Europe/Zurich', sublabel: 'Switzerland', offset: 'UTC+01:00' },
      { value: 'Europe/Warsaw', text: 'Europe/Warsaw', sublabel: 'Poland', offset: 'UTC+01:00' },
      { value: 'Europe/Athens', text: 'Europe/Athens', sublabel: 'Greece', offset: 'UTC+02:00' },
      { value: 'Europe/Helsinki', text: 'Europe/Helsinki', sublabel: 'Finland', offset: 'UTC+02:00' },
      { value: 'Europe/Istanbul', text: 'Europe/Istanbul', sublabel: 'Turkey', offset: 'UTC+03:00' },
      { value: 'Europe/Moscow', text: 'Europe/Moscow', sublabel: 'Russia (Moscow)', offset: 'UTC+03:00' }
    ]
  },
  {
    region: 'Asia',
    items: [
      { value: 'Asia/Jerusalem', text: 'Asia/Jerusalem', sublabel: 'Israel', offset: 'UTC+02:00' },
      { value: 'Asia/Dubai', text: 'Asia/Dubai', sublabel: 'UAE', offset: 'UTC+04:00' },
      { value: 'Asia/Riyadh', text: 'Asia/Riyadh', sublabel: 'Saudi Arabia', offset: 'UTC+03:00' },
      { value: 'Asia/Tehran', text: 'Asia/Tehran', sublabel: 'Iran', offset: 'UTC+03:30' },
      { value: 'Asia/Karachi', text: 'Asia/Karachi', sublabel: 'Pakistan', offset: 'UTC+05:00' },
      { value: 'Asia/Kolkata', text: 'Asia/Kolkata', sublabel: 'India Standard Time (IST)', offset: 'UTC+05:30' },
      { value: 'Asia/Colombo', text: 'Asia/Colombo', sublabel: 'Sri Lanka', offset: 'UTC+05:30' },
      { value: 'Asia/Kathmandu', text: 'Asia/Kathmandu', sublabel: 'Nepal', offset: 'UTC+05:45' },
      { value: 'Asia/Dhaka', text: 'Asia/Dhaka', sublabel: 'Bangladesh', offset: 'UTC+06:00' },
      { value: 'Asia/Bangkok', text: 'Asia/Bangkok', sublabel: 'Thailand, Vietnam', offset: 'UTC+07:00' },
      { value: 'Asia/Jakarta', text: 'Asia/Jakarta', sublabel: 'Indonesia (Western)', offset: 'UTC+07:00' },
      { value: 'Asia/Singapore', text: 'Asia/Singapore', sublabel: 'Singapore', offset: 'UTC+08:00' },
      { value: 'Asia/Kuala_Lumpur', text: 'Asia/Kuala_Lumpur', sublabel: 'Malaysia', offset: 'UTC+08:00' },
      { value: 'Asia/Hong_Kong', text: 'Asia/Hong_Kong', sublabel: 'Hong Kong', offset: 'UTC+08:00' },
      { value: 'Asia/Shanghai', text: 'Asia/Shanghai', sublabel: 'China', offset: 'UTC+08:00' },
      { value: 'Asia/Taipei', text: 'Asia/Taipei', sublabel: 'Taiwan', offset: 'UTC+08:00' },
      { value: 'Asia/Manila', text: 'Asia/Manila', sublabel: 'Philippines', offset: 'UTC+08:00' },
      { value: 'Asia/Seoul', text: 'Asia/Seoul', sublabel: 'South Korea', offset: 'UTC+09:00' },
      { value: 'Asia/Tokyo', text: 'Asia/Tokyo', sublabel: 'Japan', offset: 'UTC+09:00' }
    ]
  },
  {
    region: 'Africa',
    items: [
      { value: 'Africa/Casablanca', text: 'Africa/Casablanca', sublabel: 'Morocco', offset: 'UTC+01:00' },
      { value: 'Africa/Lagos', text: 'Africa/Lagos', sublabel: 'Nigeria', offset: 'UTC+01:00' },
      { value: 'Africa/Johannesburg', text: 'Africa/Johannesburg', sublabel: 'South Africa', offset: 'UTC+02:00' },
      { value: 'Africa/Cairo', text: 'Africa/Cairo', sublabel: 'Egypt', offset: 'UTC+02:00' },
      { value: 'Africa/Nairobi', text: 'Africa/Nairobi', sublabel: 'Kenya', offset: 'UTC+03:00' }
    ]
  },
  {
    region: 'Oceania',
    items: [
      { value: 'Australia/Perth', text: 'Australia/Perth', sublabel: 'Western Australia', offset: 'UTC+08:00' },
      { value: 'Australia/Adelaide', text: 'Australia/Adelaide', sublabel: 'Central Australia', offset: 'UTC+09:30' },
      { value: 'Australia/Sydney', text: 'Australia/Sydney', sublabel: 'New South Wales', offset: 'UTC+10:00' },
      { value: 'Australia/Melbourne', text: 'Australia/Melbourne', sublabel: 'Victoria', offset: 'UTC+10:00' },
      { value: 'Australia/Brisbane', text: 'Australia/Brisbane', sublabel: 'Queensland', offset: 'UTC+10:00' },
      { value: 'Pacific/Auckland', text: 'Pacific/Auckland', sublabel: 'New Zealand', offset: 'UTC+12:00' },
      { value: 'Pacific/Fiji', text: 'Pacific/Fiji', sublabel: 'Fiji', offset: 'UTC+12:00' }
    ]
  }
];

export const ORG_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' }
];

/** Legacy alias used by some browsers; normalize to canonical IANA id. */
export function normalizeIanaTimezone(timeZone) {
  const tz = String(timeZone || '').trim();
  if (tz === 'Asia/Calcutta') return 'Asia/Kolkata';
  return tz;
}

export function getAllTimezones() {
  const seen = new Set();
  const list = [];
  for (const group of TIMEZONE_GROUPS) {
    for (const tz of group.items) {
      if (seen.has(tz.value)) continue;
      seen.add(tz.value);
      list.push(tz);
    }
  }
  return list;
}

export function filterTimezoneGroups(searchQuery) {
  const q = String(searchQuery || '').trim().toLowerCase();
  if (!q) return TIMEZONE_GROUPS;
  return TIMEZONE_GROUPS
    .map((group) => ({
      region: group.region,
      items: group.items.filter((tz) => {
        const haystack = `${tz.value} ${tz.text} ${tz.sublabel || ''} ${tz.offset}`.toLowerCase();
        return haystack.includes(q);
      })
    }))
    .filter((group) => group.items.length > 0);
}

export function buildCurrencyOptions(currencies = ORG_CURRENCIES) {
  return currencies.map((currency) => ({
    value: currency.code,
    label: `${currency.symbol}  ${currency.code} — ${currency.name}`
  }));
}
