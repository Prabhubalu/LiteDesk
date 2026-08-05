/**
 * Canonical conference providers for Meeting events (Virtual / Hybrid).
 * Align values with AppointmentBookingConfig.meetingType where overlapping.
 * No "custom" / generic URL provider — paste join links under a named provider.
 */
const MEETING_CONFERENCE_PROVIDERS = Object.freeze([
  {
    value: 'google_meet',
    label: 'Google Meet',
    linkHosts: ['meet.google.com']
  },
  {
    value: 'ms_teams',
    label: 'Microsoft Teams',
    linkHosts: ['teams.microsoft.com', 'teams.live.com']
  },
  {
    value: 'zoom',
    label: 'Zoom',
    linkHosts: ['zoom.us', 'zoom.com']
  }
]);

const MEETING_CONFERENCE_PROVIDER_VALUES = MEETING_CONFERENCE_PROVIDERS.map((p) => p.value);

function isValidMeetingConferenceProvider(value) {
  if (value == null || value === '') return false;
  return MEETING_CONFERENCE_PROVIDER_VALUES.includes(String(value));
}

/**
 * Soft check: join URL host should match provider when both are set.
 * Returns true when either side is missing or URL is malformed free-text (allow save).
 */
function meetingLinkMatchesProvider(provider, link) {
  if (!isValidMeetingConferenceProvider(provider)) return true;
  const raw = typeof link === 'string' ? link.trim() : '';
  if (!raw) return true;
  let host = '';
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    host = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return true;
  }
  const def = MEETING_CONFERENCE_PROVIDERS.find((p) => p.value === provider);
  if (!def?.linkHosts?.length) return true;
  return def.linkHosts.some(
    (h) => host === h || host.endsWith(`.${h}`)
  );
}

module.exports = {
  MEETING_CONFERENCE_PROVIDERS,
  MEETING_CONFERENCE_PROVIDER_VALUES,
  isValidMeetingConferenceProvider,
  meetingLinkMatchesProvider
};
