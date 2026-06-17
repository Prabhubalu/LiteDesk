import { getPicklistOptionValue } from '@/utils/picklistColorPalette';

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
