/** Calendar grid helpers for the custom DatePicker. */

export type CalendarDay = {
  date: Date;
  iso: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
};

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function buildCalendarGrid(
  viewYear: number,
  viewMonth: number,
  selectedIso?: string | null
): CalendarDay[] {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    date.setHours(0, 0, 0, 0);
    const iso = toIsoDate(date);
    days.push({
      date,
      iso,
      isCurrentMonth: date.getMonth() === viewMonth,
      isToday: isSameDay(date, today),
      isSelected: Boolean(selectedIso && iso === selectedIso),
    });
  }
  return days;
}

export function normalizeDateInput(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0] ?? '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value);
  }
  return '';
}

export function toDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseDateTimeLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const cleaned = value.replace(/\.\d{3}Z?$/, '').replace(/Z$/, '');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cleaned)) {
    const [datePart, timePart] = cleaned.split('T');
    if (!datePart || !timePart) return null;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    if (!year || !month || !day || hours === undefined || minutes === undefined) return null;
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return parseIsoDate(cleaned);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeDateTimeInput(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    if (value.includes('T')) {
      return value.replace(/\.\d{3}Z?$/, '').replace(/Z$/, '').slice(0, 16);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return toDateTimeLocal(parsed);
    return '';
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateTimeLocal(value);
  }
  return '';
}

export function splitDateTimeLocal(value: string | null | undefined): { date: string; hour: number; minute: number } {
  const normalized = normalizeDateTimeInput(value);
  if (!normalized) {
    const now = new Date();
    return { date: toIsoDate(now), hour: now.getHours(), minute: now.getMinutes() };
  }
  const [date = '', time = '00:00'] = normalized.split('T');
  const [hour, minute] = time.split(':').map(Number);
  return { date, hour: hour ?? 0, minute: minute ?? 0 };
}

export function isDateTimeLocalDisabled(
  value: string,
  min?: string | null,
  max?: string | null
): boolean {
  if (min && value < min) return true;
  if (max && value > max) return true;
  return false;
}
