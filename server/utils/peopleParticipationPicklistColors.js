/**
 * Default colors for People SALES participation status picklists.
 * Used by module field defaults, migration scripts, and option normalization.
 */

function normalizePicklistColorKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

const LEAD_STATUS_OPTION_COLORS = Object.freeze({
  new: '#2563EB',
  contacted: '#6366F1',
  qualified: '#16A34A',
  disqualified: '#DC2626',
  nurturing: '#D97706',
  're-engage': '#9333EA',
  re_engage: '#9333EA',
});

const CONTACT_STATUS_OPTION_COLORS = Object.freeze({
  active: '#16A34A',
  inactive: '#6B7280',
  donotcontact: '#DC2626',
});

function getDefaultParticipationPicklistColor(fieldKey, value) {
  const normalizedValue = normalizePicklistColorKey(value);
  const field = String(fieldKey || '').toLowerCase();
  if (field === 'lead_status') {
    return LEAD_STATUS_OPTION_COLORS[normalizedValue] || '#3B82F6';
  }
  if (field === 'contact_status') {
    return CONTACT_STATUS_OPTION_COLORS[normalizedValue] || '#6B7280';
  }
  return '#3B82F6';
}

function buildColoredPicklistOption(fieldKey, value) {
  const label = String(value);
  return {
    value: label,
    label,
    enabled: true,
    color: getDefaultParticipationPicklistColor(fieldKey, label),
  };
}

function buildDefaultColoredPicklistOptions(fieldKey, values) {
  return (Array.isArray(values) ? values : []).map((value) => buildColoredPicklistOption(fieldKey, value));
}

function applyDefaultColorsToPicklistOptions(fieldKey, options) {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => {
    if (typeof opt === 'string') {
      return buildColoredPicklistOption(fieldKey, opt);
    }
    if (opt && typeof opt === 'object') {
      const value = opt.value ?? opt.label ?? '';
      return {
        ...opt,
        value,
        label: opt.label ?? value,
        enabled: opt.enabled !== false,
        color: opt.color || getDefaultParticipationPicklistColor(fieldKey, value),
      };
    }
    return opt;
  });
}

module.exports = {
  LEAD_STATUS_OPTION_COLORS,
  CONTACT_STATUS_OPTION_COLORS,
  normalizePicklistColorKey,
  getDefaultParticipationPicklistColor,
  buildColoredPicklistOption,
  buildDefaultColoredPicklistOptions,
  applyDefaultColorsToPicklistOptions,
};
