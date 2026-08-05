/**
 * Canonical conference providers for Meeting events (Virtual / Hybrid).
 * Keep values in sync with server/constants/meetingConferenceProviders.js
 */
export type MeetingConferenceProvider = 'google_meet' | 'ms_teams' | 'zoom';

export interface MeetingConferenceProviderDef {
  value: MeetingConferenceProvider;
  /** i18n key under events.* */
  labelKey: string;
  linkHosts: readonly string[];
}

export const MEETING_CONFERENCE_PROVIDERS: readonly MeetingConferenceProviderDef[] = [
  {
    value: 'google_meet',
    labelKey: 'events.conferenceProviderGoogleMeet',
    linkHosts: ['meet.google.com'],
  },
  {
    value: 'ms_teams',
    labelKey: 'events.conferenceProviderMsTeams',
    linkHosts: ['teams.microsoft.com', 'teams.live.com'],
  },
  {
    value: 'zoom',
    labelKey: 'events.conferenceProviderZoom',
    linkHosts: ['zoom.us', 'zoom.com'],
  },
] as const;

export const MEETING_CONFERENCE_PROVIDER_VALUES: readonly MeetingConferenceProvider[] =
  MEETING_CONFERENCE_PROVIDERS.map((p) => p.value);

export function isValidMeetingConferenceProvider(
  value: unknown
): value is MeetingConferenceProvider {
  if (value == null || value === '') return false;
  return (MEETING_CONFERENCE_PROVIDER_VALUES as readonly string[]).includes(String(value));
}
