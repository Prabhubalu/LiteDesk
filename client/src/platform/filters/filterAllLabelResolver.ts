type FilterAllLabelSource = {
  key: string;
  label?: string;
};

type TranslateFn = (key: string, params?: Record<string, string>) => string;

function normalizeKey(key: string): string {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const CANONICAL_FILTER_ALL_I18N_KEYS: Record<string, string> = {
  status: 'common.filterAllStatuses',
  executionstatus: 'common.filterAllStatuses',
  reviewstatus: 'common.filterAllStatuses',
  fulfillmentstatus: 'common.filterAllStatuses',
  assignedto: 'common.filterAllAssignees',
  ownerid: 'common.filterAllAssignees',
  eventownerid: 'common.filterAllAssignees',
  caseownerid: 'common.filterAllAssignees',
  priority: 'common.filterAllPriorities',
  category: 'common.filterAllCategories',
};

export function getCanonicalFilterAllI18nKey(fieldKey: string): string | null {
  return CANONICAL_FILTER_ALL_I18N_KEYS[normalizeKey(fieldKey)] ?? null;
}

export function resolveFilterAllLabel(
  filter: FilterAllLabelSource,
  t: TranslateFn,
  fallbackKey: 'common.listFilterAll' | 'common.filterAllNamed' = 'common.listFilterAll'
): string {
  const canonicalKey = getCanonicalFilterAllI18nKey(filter.key);
  if (canonicalKey) {
    return t(canonicalKey);
  }

  const label = filter.label || filter.key;
  if (fallbackKey === 'common.filterAllNamed') {
    return t(fallbackKey, { label });
  }
  return t(fallbackKey, { filter: label });
}
