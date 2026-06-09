/**
 * Eligibility rules for adding picklist options inline from create/edit forms.
 * Persisting options requires settings.edit (customizeFields) on the API route.
 */

const TENANT_PICKLIST_OPTION_SOURCE_FIELDS = {
    tasks: new Set(['status', 'priority']),
    organizations: new Set([
        'types',
        'industry',
        'customerStatus',
        'customerTier',
        'partnerStatus',
        'partnerTier',
        'partnerType',
        'vendorStatus',
        'dealerLevel',
    ]),
};

const BLOCKED_INLINE_PICKLIST_KEYS = {
    deals: new Set(['stage', 'pipeline']),
    people: new Set(['salestype', 'sales_type', 'helpdeskrole', 'helpdesk_role']),
    events: new Set(['status', 'eventtype']),
};

const {
    PLATFORM_DEFAULT_PICKLIST_COLOR,
    resolveNewPicklistOptionColor,
} = require('./picklistColorPalette');

const DEFAULT_OPTION_COLOR = PLATFORM_DEFAULT_PICKLIST_COLOR;

function normalizeFieldKeyForMatch(key) {
    return String(key || '').trim().toLowerCase().replace(/[-_]/g, '');
}

function isTenantManagedPicklist(moduleKey, fieldKey) {
    const mod = String(moduleKey || '').toLowerCase();
    const fields = TENANT_PICKLIST_OPTION_SOURCE_FIELDS[mod];
    if (!fields) return false;
    const normalized = normalizeFieldKeyForMatch(fieldKey);
    for (const candidate of fields) {
        if (normalizeFieldKeyForMatch(candidate) === normalized) return true;
    }
    return false;
}

function isBlockedInlinePicklist(moduleKey, fieldKey) {
    const mod = String(moduleKey || '').toLowerCase();
    const blocked = BLOCKED_INLINE_PICKLIST_KEYS[mod];
    if (!blocked) return false;
    const normalized = normalizeFieldKeyForMatch(fieldKey);
    for (const candidate of blocked) {
        if (normalizeFieldKeyForMatch(candidate) === normalized) return true;
    }
    return false;
}

function canAddPicklistOptionInline(moduleKey, field) {
    if (!field || typeof field !== 'object') return false;
    const dataType = String(field.dataType || '');
    if (dataType !== 'Picklist' && dataType !== 'Multi-Picklist') return false;
    if (isBlockedInlinePicklist(moduleKey, field.key)) return false;
    if (String(field.owner || '').toLowerCase() === 'org') return true;
    return isTenantManagedPicklist(moduleKey, field.key);
}

function normalizeNewPicklistOptionValue(rawValue, fieldKey, moduleKey) {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed) return null;

    const mod = String(moduleKey || '').toLowerCase();
    const keyNorm = normalizeFieldKeyForMatch(fieldKey);
    const isTaskLifecycle = mod === 'tasks' && (keyNorm === 'status' || keyNorm === 'priority');

    if (isTaskLifecycle) {
        const slug = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        return slug || null;
    }

    return trimmed;
}

function getPicklistOptionValue(option) {
    if (option == null) return '';
    if (typeof option === 'string') return option.trim();
    if (typeof option === 'object') return String(option.value ?? option.key ?? '').trim();
    return String(option).trim();
}

function optionExists(options, value) {
    const target = String(value || '').trim().toLowerCase();
    if (!target) return false;
    return (Array.isArray(options) ? options : []).some((opt) => {
        const existing = getPicklistOptionValue(opt).toLowerCase();
        return existing === target;
    });
}

const IMPORT_ELIGIBLE_PEOPLE_PICKLIST_KEYS = new Set(['leadstatus', 'contactstatus']);

function getPicklistOptionLabel(option) {
    if (option == null) return '';
    if (typeof option === 'string') return option.trim();
    if (typeof option === 'object') return String(option.label ?? option.value ?? option.key ?? '').trim();
    return String(option).trim();
}

function findPicklistOptionByImportValue(options, rawValue, fieldKey, moduleKey) {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed) return null;
    const target = trimmed.toLowerCase();
    const slugCandidate = normalizeNewPicklistOptionValue(trimmed, fieldKey, moduleKey);
    const slugTarget = slugCandidate ? slugCandidate.toLowerCase() : null;

    for (const opt of (Array.isArray(options) ? options : [])) {
        const value = getPicklistOptionValue(opt).toLowerCase();
        const label = getPicklistOptionLabel(opt).toLowerCase();
        if (value === target || (slugTarget && value === slugTarget) || label === target) {
            return getPicklistOptionValue(opt) || slugCandidate || trimmed;
        }
    }
    return null;
}

function canEnsurePicklistOptionOnImport(moduleKey, field) {
    if (!field || typeof field !== 'object') return false;
    const dataType = String(field.dataType || '');
    if (dataType !== 'Picklist' && dataType !== 'Multi-Picklist') return false;
    if (isBlockedInlinePicklist(moduleKey, field.key)) return false;
    if (canAddPicklistOptionInline(moduleKey, field)) return true;
    const mod = String(moduleKey || '').toLowerCase();
    if (mod === 'people') {
        const keyNorm = normalizeFieldKeyForMatch(field.key);
        if (IMPORT_ELIGIBLE_PEOPLE_PICKLIST_KEYS.has(keyNorm)) return true;
    }
    return false;
}

function buildPicklistOptionEntry(rawValue, fieldKey, moduleKey, overrides = {}) {
    const value = normalizeNewPicklistOptionValue(rawValue, fieldKey, moduleKey);
    if (!value) return null;
    const mod = String(moduleKey || '').toLowerCase();
    const keyNorm = normalizeFieldKeyForMatch(fieldKey);
    const isTaskLifecycle = mod === 'tasks' && (keyNorm === 'status' || keyNorm === 'priority');
    const label = String(overrides.label || rawValue || value).trim() || value;
    const existingOptions = Array.isArray(overrides.existingOptions) ? overrides.existingOptions : [];
    const color = overrides.color || resolveNewPicklistOptionColor({
        fieldKey,
        moduleKey: mod,
        optionValue: value,
        existingOptions,
    });
    return {
        value,
        label,
        color,
        ...(isTaskLifecycle ? { enabled: true } : {}),
    };
}

module.exports = {
    TENANT_PICKLIST_OPTION_SOURCE_FIELDS,
    DEFAULT_OPTION_COLOR,
    canAddPicklistOptionInline,
    canEnsurePicklistOptionOnImport,
    normalizeNewPicklistOptionValue,
    getPicklistOptionValue,
    getPicklistOptionLabel,
    findPicklistOptionByImportValue,
    optionExists,
    buildPicklistOptionEntry,
};
