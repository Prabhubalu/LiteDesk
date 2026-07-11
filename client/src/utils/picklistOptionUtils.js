import { getPicklistOptionValue, picklistChipStyle } from '@/utils/picklistColorPalette';

export function picklistOptionLabel(option) {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    return option.label || option.value || String(option);
  }
  return String(option ?? '');
}

export function picklistOptionColor(option) {
  if (typeof option === 'object' && option !== null && option.color) {
    return option.color;
  }
  return null;
}

export function picklistOptionChipStyle(option) {
  return picklistChipStyle(picklistOptionColor(option));
}

export function picklistOptionKey(option) {
  return getPicklistOptionValue(option) || picklistOptionLabel(option);
}

export function filterPicklistOptions(options, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return options;
  return options.filter((option) => picklistOptionLabel(option).toLowerCase().includes(normalizedQuery));
}

export function findPicklistOptionByValue(options, value) {
  const target = String(value ?? '');
  return options.find((option) => {
    const optionValue = getPicklistOptionValue(option);
    return optionValue === target || String(optionValue) === target;
  });
}

/** Normalize module picklist options to `{ value, label }` for list/segment filters. */
export function normalizeFilterSelectOptions(rawOptions = []) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((opt) => {
      if (typeof opt === 'string') {
        const value = opt.trim();
        return value ? { value, label: value } : null;
      }
      if (typeof opt === 'object' && opt !== null && opt.enabled === false) return null;
      const value = String(opt?.value ?? opt?.label ?? '').trim();
      if (!value) return null;
      const label = String(opt?.label ?? opt?.value ?? value).trim() || value;
      return { value, label };
    })
    .filter(Boolean);
}
