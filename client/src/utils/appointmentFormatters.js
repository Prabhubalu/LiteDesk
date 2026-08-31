import { formatDate, formatTime, formatUserDate } from '@/utils/localeFormat';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'demo', label: 'Demo', description: 'Product walkthrough' },
  { value: 'consultation', label: 'Consultation', description: 'Explore fit & needs' },
  { value: 'support', label: 'Support', description: 'Get help with an issue' },
  { value: 'other', label: 'Other', description: 'General meeting' }
];

export const SLOT_DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' }
];

export const BUFFER_OPTIONS = [
  { value: 0, label: 'No buffer' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' }
];

export const MEETING_TYPE_OPTIONS = [
  { value: 'offline', label: 'In person', icon: 'location' },
  { value: 'google_meet', label: 'Google Meet', icon: 'video' },
  { value: 'ms_teams', label: 'Microsoft Teams', icon: 'video' }
];

/** Guest fields always collected on the public booking form (not stored in customFields). */
export const DEFAULT_BOOKING_GUEST_FIELDS = [
  { key: 'firstName', labelKey: 'appointments.defaultFieldFirstName', type: 'text', required: true },
  { key: 'lastName', labelKey: 'appointments.defaultFieldLastName', type: 'text', required: false },
  { key: 'email', labelKey: 'appointments.defaultFieldEmail', type: 'email', required: true },
  { key: 'phone', labelKey: 'appointments.defaultFieldPhone', type: 'phone', required: false }
];

export function formatSlotTime(iso) {
  return formatTime(iso, { hour: 'numeric', minute: '2-digit' });
}

export function formatSlotDate(iso) {
  return formatDate(iso, { weekday: 'long', month: 'long', day: 'numeric' })
    || formatUserDate(iso);
}

export function slugifyClient(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export { DAY_LABELS };

export function appointmentSourceLabel(source) {
  const map = {
    public_page: 'Public page',
    manual: 'Manual',
    integration: 'Integration',
    campaign: 'Campaign'
  };
  return map[source] || source || '—';
}

export function appointmentTypeLabel(type) {
  const found = APPOINTMENT_TYPE_OPTIONS.find((o) => o.value === type);
  return found?.label || type || '—';
}

/** Public booking page URL (standalone or embed). */
export function buildBookingPageUrl(slug, { embed = false, origin } = {}) {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const path = embed ? `/book/${slug}/embed` : `/book/${slug}`;
  return `${base}${path}`;
}

export function buildBookingIframeSnippet(slug, { height = 720, origin } = {}) {
  const url = buildBookingPageUrl(slug, { embed: true, origin });
  return `<iframe src="${url}" title="Book an appointment" width="100%" height="${height}" frameborder="0" style="border:0;border-radius:12px;max-width:480px;" allow="clipboard-write"></iframe>`;
}

export function buildBookingScriptSnippet(slug, { height = 720, origin } = {}) {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `<div id="arivu-booking" data-slug="${slug}" data-height="${height}"></div>\n<script src="${base}/embed/booking.js" async></script>`;
}
