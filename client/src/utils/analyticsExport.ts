import type { AnalyticsExecuteResult } from '@/types/analytics.types';

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function analyticsResultToCsv(result: AnalyticsExecuteResult | null | undefined): string {
  const columns = result?.columns || [];
  const rows = result?.rows || [];
  const headers = columns.map((col) => col.label || col.key);
  const keys = columns.map((col) => col.key);
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(keys.map((key) => escapeCsvCell(row[key])).join(','));
  }
  return lines.join('\n');
}

export function downloadAnalyticsCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const ANALYTICS_SCHEDULE_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;
