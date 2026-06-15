/**
 * Curated Tailwind 500 palette for picklist option badges.
 * Assign colors at write time; users can override in field settings.
 */

const PLATFORM_DEFAULT_PICKLIST_COLOR = '#3B82F6'; // blue-500

/** Tailwind CSS default palette — 500 shades for badge contrast */
const PICKLIST_COLOR_PALETTE = Object.freeze([
    '#3B82F6', // blue-500
    '#6366F1', // indigo-500
    '#8B5CF6', // violet-500
    '#A855F7', // purple-500
    '#D946EF', // fuchsia-500
    '#EC4899', // pink-500
    '#F43F5E', // rose-500
    '#EF4444', // red-500
    '#F97316', // orange-500
    '#F59E0B', // amber-500
    '#EAB308', // yellow-500
    '#84CC16', // lime-500
    '#22C55E', // green-500
    '#10B981', // emerald-500
    '#14B8A6', // teal-500
    '#06B6D4', // cyan-500
    '#0EA5E9', // sky-500
    '#6B7280', // gray-500
]);

const TASK_STATUS_OPTION_COLORS = Object.freeze({
    todo: '#6B7280', // gray-500
    in_progress: '#2563EB', // blue-600
    waiting: '#D97706', // amber-600
    completed: '#16A34A', // green-600
    cancelled: '#DC2626', // red-600
});

const TASK_PRIORITY_OPTION_COLORS = Object.freeze({
    low: '#6B7280',
    medium: '#2563EB',
    high: '#D97706',
    urgent: '#DC2626',
});

const TASK_TYPE_OPTION_COLORS = Object.freeze({
    general_task: '#6B7280',
    follow_up: '#F59E0B',
    call: '#2563EB',
    email: '#6366F1',
    meeting: '#8B5CF6',
    support: '#0EA5E9',
    research: '#06B6D4',
    documentation: '#14B8A6',
    internal: '#64748B',
    bug: '#DC2626',
    enhancement: '#22C55E',
    feature_request: '#A855F7',
    usability: '#EC4899',
});

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

function normalizePicklistColorKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function normalizeFieldKey(fieldKey) {
    return String(fieldKey || '').trim().toLowerCase();
}

function normalizePicklistColorHex(color) {
    const s = String(color || '').trim();
    const m = s.match(/^#?([0-9A-Fa-f]{6})$/);
    return m ? `#${m[1].toUpperCase()}` : null;
}

function getPicklistOptionValue(option) {
    if (option == null) return '';
    if (typeof option === 'string') return option.trim();
    if (typeof option === 'object') return String(option.value ?? option.label ?? '').trim();
    return String(option).trim();
}

function getUsedPicklistColors(options) {
    const used = new Set();
    for (const opt of Array.isArray(options) ? options : []) {
        const hex = normalizePicklistColorHex(typeof opt === 'object' ? opt.color : null);
        if (hex) used.add(hex);
    }
    return used;
}

function nextPicklistOptionColor(existingOptions = [], options = {}) {
    const used = getUsedPicklistColors(existingOptions);
    const skipPlatformDefault = options.skipPlatformDefault === true;
    for (const color of PICKLIST_COLOR_PALETTE) {
        const hex = normalizePicklistColorHex(color);
        if (!hex) continue;
        if (skipPlatformDefault && hex === PLATFORM_DEFAULT_PICKLIST_COLOR) continue;
        if (!used.has(hex)) return hex;
    }
    const len = PICKLIST_COLOR_PALETTE.length;
    const count = Array.isArray(existingOptions) ? existingOptions.length : 0;
    for (let offset = 0; offset < len; offset += 1) {
        const hex = normalizePicklistColorHex(PICKLIST_COLOR_PALETTE[(count + offset) % len]);
        if (!hex) continue;
        if (skipPlatformDefault && hex === PLATFORM_DEFAULT_PICKLIST_COLOR) continue;
        if (!used.has(hex)) return hex;
    }
    return PLATFORM_DEFAULT_PICKLIST_COLOR;
}

function isPlatformDefaultPicklistColor(color) {
    const hex = normalizePicklistColorHex(color);
    if (!hex) return true;
    return hex === PLATFORM_DEFAULT_PICKLIST_COLOR;
}

function getSemanticPicklistColor(fieldKey, optionValue, moduleKey = '') {
    const key = normalizeFieldKey(fieldKey);
    const mod = String(moduleKey || '').toLowerCase();
    const val = normalizePicklistColorKey(optionValue);

    if (mod === 'tasks' || mod === '') {
        if (key === 'status') return TASK_STATUS_OPTION_COLORS[val] || null;
        if (key === 'priority') return TASK_PRIORITY_OPTION_COLORS[val] || null;
        if (key === 'tasktype') return TASK_TYPE_OPTION_COLORS[val] || null;
    }
    if (key === 'lead_status') return LEAD_STATUS_OPTION_COLORS[val] || null;
    if (key === 'contact_status') return CONTACT_STATUS_OPTION_COLORS[val] || null;
    return null;
}

function resolveNewPicklistOptionColor({ fieldKey, moduleKey, optionValue, existingOptions = [] }) {
    const semantic = getSemanticPicklistColor(fieldKey, optionValue, moduleKey);
    if (semantic) return semantic;
    return nextPicklistOptionColor(existingOptions);
}

function backfillPicklistOptionColors(options, fieldKey, moduleKey = '') {
    if (!Array.isArray(options) || options.length === 0) return [];
    const result = [];
    for (const opt of options) {
        if (typeof opt === 'string') {
            const value = opt.trim();
            if (!value) continue;
            const semantic = getSemanticPicklistColor(fieldKey, value, moduleKey);
            result.push({
                value,
                label: value,
                enabled: true,
                color: semantic || nextPicklistOptionColor(result, { skipPlatformDefault: true }),
            });
            continue;
        }
        if (opt && typeof opt === 'object') {
            const value = getPicklistOptionValue(opt);
            if (!value) {
                result.push(opt);
                continue;
            }
            const stored = normalizePicklistColorHex(opt.color);
            let color;
            if (stored && !isPlatformDefaultPicklistColor(stored)) {
                color = stored;
            } else {
                const semantic = getSemanticPicklistColor(fieldKey, value, moduleKey);
                color = semantic || nextPicklistOptionColor(result, { skipPlatformDefault: true });
            }
            result.push({
                ...opt,
                value,
                label: opt.label ?? value,
                enabled: opt.enabled !== false,
                color,
            });
            continue;
        }
        result.push(opt);
    }
    return result;
}

module.exports = {
    PLATFORM_DEFAULT_PICKLIST_COLOR,
    PICKLIST_COLOR_PALETTE,
    TASK_STATUS_OPTION_COLORS,
    TASK_PRIORITY_OPTION_COLORS,
    TASK_TYPE_OPTION_COLORS,
    LEAD_STATUS_OPTION_COLORS,
    CONTACT_STATUS_OPTION_COLORS,
    normalizePicklistColorKey,
    normalizePicklistColorHex,
    getPicklistOptionValue,
    getUsedPicklistColors,
    nextPicklistOptionColor,
    isPlatformDefaultPicklistColor,
    getSemanticPicklistColor,
    resolveNewPicklistOptionColor,
    backfillPicklistOptionColors,
};
