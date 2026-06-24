'use strict';

function isEngagementFormType(formType) {
    const normalized = String(formType || '').toLowerCase();
    return normalized === 'survey' || normalized === 'feedback';
}

/** Surveys/feedback publish as Active (webform parity), not Ready. */
function normalizeEngagementPublishStatus(status, formType) {
    if (!isEngagementFormType(formType)) {
        return status;
    }
    if (String(status || '') === 'Ready') {
        return 'Active';
    }
    return status;
}

/** Legacy Ready engagement forms or Active — structurally locked. */
function isLiveEngagementForm(formType, status) {
    if (!isEngagementFormType(formType)) {
        return false;
    }
    const normalized = String(status || '');
    return normalized === 'Active' || normalized === 'Ready';
}

function isFormStructurallyLocked(formType, status) {
    const normalized = String(status || '');
    if (normalized === 'Archived') {
        return true;
    }
    if (normalized === 'Active') {
        return true;
    }
    return isLiveEngagementForm(formType, normalized);
}

const FORM_HAS_SUBMITTED_RESPONSES = 'FORM_HAS_SUBMITTED_RESPONSES';

async function countSubmittedFormResponses(FormResponse, formId, organizationId) {
    return FormResponse.countDocuments({
        formId,
        organizationId,
        executionStatus: 'Submitted'
    });
}

/** Legacy date-only values were stored at UTC midnight and expire after that calendar day. */
function isLegacyEngagementDateOnlyExpiry(expiryDate) {
    const d = new Date(expiryDate);
    if (Number.isNaN(d.getTime())) return false;
    return (
        d.getUTCHours() === 0
        && d.getUTCMinutes() === 0
        && d.getUTCSeconds() === 0
        && d.getUTCMilliseconds() === 0
    );
}

/** Expiry instant. Legacy date-only values remain valid through end of that UTC day. */
function getEngagementFormExpiryInstant(expiryDate) {
    if (!expiryDate) return null;
    const d = new Date(expiryDate);
    if (Number.isNaN(d.getTime())) return null;
    if (isLegacyEngagementDateOnlyExpiry(expiryDate)) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
    }
    return d;
}

function isEngagementFormExpired(expiryDate, now = new Date()) {
    const expiryAt = getEngagementFormExpiryInstant(expiryDate);
    if (!expiryAt) return false;
    return now.getTime() >= expiryAt.getTime();
}

/**
 * Normalize expiry input. Date-only values keep legacy UTC-midnight storage;
 * datetime values (ISO or datetime-local from client) preserve the instant.
 */
function normalizeEngagementExpiryDate(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const raw = String(value).trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [year, month, day] = raw.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

module.exports = {
    isEngagementFormType,
    normalizeEngagementPublishStatus,
    isLiveEngagementForm,
    isFormStructurallyLocked,
    FORM_HAS_SUBMITTED_RESPONSES,
    countSubmittedFormResponses,
    isLegacyEngagementDateOnlyExpiry,
    getEngagementFormExpiryInstant,
    isEngagementFormExpired,
    normalizeEngagementExpiryDate
};
