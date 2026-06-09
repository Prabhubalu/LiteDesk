/**
 * Default colors for People SALES participation status picklists.
 * Used by module field defaults, migration scripts, and option normalization.
 */

const {
    LEAD_STATUS_OPTION_COLORS,
    CONTACT_STATUS_OPTION_COLORS,
    normalizePicklistColorKey,
    getSemanticPicklistColor,
    backfillPicklistOptionColors,
} = require('./picklistColorPalette');

function getDefaultParticipationPicklistColor(fieldKey, value) {
    const semantic = getSemanticPicklistColor(fieldKey, value, 'people');
    if (semantic) return semantic;
    const field = String(fieldKey || '').toLowerCase();
    if (field === 'contact_status') return CONTACT_STATUS_OPTION_COLORS.inactive;
    return LEAD_STATUS_OPTION_COLORS.new;
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
    return backfillPicklistOptionColors(options, fieldKey, 'people');
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
