/**
 * Event status lifecycle (client)
 * Mirrors server/domain/events/eventStatus.js semantics.
 */

export type StatusCategory = 'OPEN' | 'DONE' | 'CANCELLED';

export interface EventStatusValue {
  key: string;
  label: string;
  category: StatusCategory;
  color?: string;
  order?: number;
  isDefault?: boolean;
  isSystem?: boolean;
  archived?: boolean;
}

export interface EventStatusTypeConfig {
  eventTypeKey: string;
  label: string;
  configurable: boolean;
  isAudit: boolean;
  categories: StatusCategory[];
  values: EventStatusValue[];
  activeValues: EventStatusValue[];
}

export const STATUS_CATEGORIES: StatusCategory[] = ['OPEN', 'DONE', 'CANCELLED'];

const LEGACY_CATEGORY: Record<string, StatusCategory> = {
  Planned: 'OPEN',
  Completed: 'DONE',
  Cancelled: 'CANCELLED',
};

export function resolveStatusCategory(
  statusLabel: string | null | undefined,
  values?: EventStatusValue[] | null
): StatusCategory {
  if (values?.length && statusLabel) {
    const match = values.find(
      (v) => v.label.toLowerCase() === String(statusLabel).toLowerCase()
    );
    if (match?.category) return match.category;
  }
  if (statusLabel && LEGACY_CATEGORY[statusLabel]) return LEGACY_CATEGORY[statusLabel];
  return 'OPEN';
}

export function isManualStatusEditable(eventTypeOrKey: string | null | undefined): boolean {
  if (!eventTypeOrKey) return false;
  const raw = String(eventTypeOrKey).trim().toUpperCase().replace(/\s+/g, '_');
  if (raw === 'MEETING' || raw === 'FIELD_SALES_BEAT') return true;
  const label = String(eventTypeOrKey).trim().toLowerCase();
  return label === 'meeting' || label === 'meeting / appointment' || label === 'field sales beat';
}

export function statusValuesToSelectOptions(values: EventStatusValue[] = []) {
  return values
    .filter((v) => !v.archived)
    .map((v) => ({
      value: v.label,
      label: v.label,
      color: v.color,
      category: v.category,
    }));
}
