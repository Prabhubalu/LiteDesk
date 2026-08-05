/**
 * Meeting calendar invite prompt helpers (create/edit save).
 */

function asId(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') {
    const o = raw as { _id?: unknown; id?: unknown; userId?: unknown; value?: unknown };
    return String(o._id ?? o.id ?? o.userId ?? o.value ?? '').trim();
  }
  return String(raw).trim();
}

function asIso(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const d = raw instanceof Date ? raw : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? String(raw) : d.toISOString();
}

export function isMeetingEventType(eventType: unknown): boolean {
  const t = String(eventType || '').trim();
  if (!t) return false;
  return t === 'Meeting' || t === 'MEETING' || t.toLowerCase() === 'meeting';
}

export function normalizeAttendeeIds(attendees: unknown): string[] {
  if (!Array.isArray(attendees)) {
    if (attendees == null || attendees === '') return [];
    const id = asId(attendees);
    return id ? [id] : [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of attendees) {
    const id = asId(a);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.sort();
}

export function participantCount(attendees: unknown): number {
  return normalizeAttendeeIds(attendees).length;
}

const GUEST_RELEVANT_KEYS = [
  'eventName',
  'startDateTime',
  'endDateTime',
  'meetingMode',
  'meetingLink',
  'conferenceProvider',
  'location',
  'assignedTo',
  'attendees',
] as const;

/**
 * True when update can affect guests' calendar invites (not agenda/status-only).
 */
export function isGuestRelevantMeetingChange(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined
): boolean {
  if (!previous || !next) return true;
  for (const key of GUEST_RELEVANT_KEYS) {
    if (key === 'attendees') {
      const a = normalizeAttendeeIds(previous.attendees).join(',');
      const b = normalizeAttendeeIds(next.attendees).join(',');
      if (a !== b) return true;
      continue;
    }
    if (key === 'startDateTime' || key === 'endDateTime') {
      if (asIso(previous[key]) !== asIso(next[key])) return true;
      continue;
    }
    if (key === 'assignedTo') {
      if (asId(previous.assignedTo) !== asId(next.assignedTo)) return true;
      continue;
    }
    if (String(previous[key] ?? '').trim() !== String(next[key] ?? '').trim()) {
      return true;
    }
  }
  return false;
}

export type MeetingInvitePromptDecision =
  | { prompt: false; sendInvites: boolean }
  | { prompt: true; participantCount: number };

/**
 * When to prompt and default sendInvites if no prompt.
 * - Create with participants → prompt
 * - Edit guest-relevant with prior/new participants → prompt
 * - Otherwise silent (no guest notify); calendar host sync may still run
 */
export function resolveMeetingInvitePrompt(args: {
  isEditing: boolean;
  eventType: unknown;
  form: Record<string, unknown> | null | undefined;
  record?: Record<string, unknown> | null;
}): MeetingInvitePromptDecision {
  if (!isMeetingEventType(args.eventType ?? args.form?.eventType)) {
    return { prompt: false, sendInvites: false };
  }
  const form = args.form || {};
  const formCount = participantCount(form.attendees);
  const recordCount = participantCount(args.record?.attendees);

  if (!args.isEditing) {
    if (formCount > 0) return { prompt: true, participantCount: formCount };
    return { prompt: false, sendInvites: true };
  }

  if (!isGuestRelevantMeetingChange(args.record || null, form)) {
    return { prompt: false, sendInvites: false };
  }
  if (formCount > 0 || recordCount > 0) {
    return { prompt: true, participantCount: Math.max(formCount, recordCount) };
  }
  return { prompt: false, sendInvites: false };
}
