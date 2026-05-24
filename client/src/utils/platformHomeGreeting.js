/**
 * Platform home greeting copy from API payload or local fallback.
 */

export function getLocalTimeOfDay(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const TIME_KEY_BY_PART = {
  morning: { withName: 'platform.platformHomeGreetingMorningWithName', withoutName: 'platform.platformHomeGreetingMorning' },
  afternoon: { withName: 'platform.platformHomeGreetingAfternoonWithName', withoutName: 'platform.platformHomeGreetingAfternoon' },
  evening: { withName: 'platform.platformHomeGreetingEveningWithName', withoutName: 'platform.platformHomeGreetingEvening' },
};

/**
 * @param {{ firstName?: string, timeOfDay?: string } | null} greeting
 * @param {(key: string, params?: Record<string, any>) => string} t
 * @param {string} [fallbackFirstName]
 * @param {'morning'|'afternoon'|'evening'} [fallbackTimeOfDay]
 */
export function formatPlatformGreeting(greeting, t, fallbackFirstName = '', fallbackTimeOfDay = getLocalTimeOfDay()) {
  const firstName = (greeting?.firstName || fallbackFirstName || '').trim();
  const timeOfDay = greeting?.timeOfDay || fallbackTimeOfDay;
  const keys = TIME_KEY_BY_PART[timeOfDay] || TIME_KEY_BY_PART.morning;
  if (firstName) return t(keys.withName, { name: firstName });
  return t(keys.withoutName);
}
