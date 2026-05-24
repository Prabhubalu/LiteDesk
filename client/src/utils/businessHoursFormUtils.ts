import type { WeekDay } from '@/composables/useBusinessHours';

export function normalizeTimeHHMM(value: string | null | undefined): string {
  if (!value) return '';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match?.[1] || match[2] === undefined) return raw;
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function normalizeWeekForSave(week: WeekDay[]): WeekDay[] {
  return week.map((day) => ({
    ...day,
    windows: (day.windows || []).map((w) => ({
      start: normalizeTimeHHMM(w.start),
      end: normalizeTimeHHMM(w.end)
    })),
    breaks: (day.breaks || []).map((b) => ({
      start: normalizeTimeHHMM(b.start),
      end: normalizeTimeHHMM(b.end)
    }))
  }));
}

export function buildDefaultWeekLocal() {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    enabled: day >= 1 && day <= 5,
    windows: [{ start: '09:00', end: '18:00' }],
    breaks: [] as { start: string; end: string }[]
  }));
}

export function validateScheduleForm(form: {
  name?: string;
  linkedTo?: { type?: string; id?: string | null };
  isDefault?: boolean;
}): string | null {
  if (!form.name?.trim()) return 'settingsBhValidateNameRequired';
  const type = form.linkedTo?.type || 'company';
  if (type === 'group' && !form.linkedTo?.id) return 'settingsBhValidateTeamRequired';
  if (type === 'user' && !form.linkedTo?.id) return 'settingsBhValidateUserRequired';
  if (form.isDefault && type !== 'company') {
    return 'settingsBhValidateDefaultCompanyOnly';
  }
  return null;
}

export function buildSchedulePayload(form: {
  name: string;
  timezone: string;
  week: WeekDay[];
  holidayCalendarId: string | null;
  overtimeAllowed: boolean;
  linkedTo: { type: string; id?: string | null };
  isDefault: boolean;
  status: string;
}) {
  const linkedType = form.linkedTo?.type || 'company';
  return {
    name: form.name.trim(),
    timezone: form.timezone,
    week: normalizeWeekForSave(form.week),
    holidayCalendarId: form.holidayCalendarId || null,
    overtimeAllowed: Boolean(form.overtimeAllowed),
    linkedTo: {
      type: linkedType,
      id: linkedType === 'company' ? null : form.linkedTo?.id || null
    },
    isDefault: Boolean(form.isDefault),
    status: form.status
  };
}
