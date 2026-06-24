import { i18n } from '@/i18n';
import { isEngagementFormType } from '@/utils/engagementFormDisplay';

/**
 * Form Edit Permissions Utility
 *
 * Enforces edit permissions based on form status and type:
 * - Draft: full editing (all types)
 * - Ready: full editing (audits only)
 * - Active / live engagement: cosmetic changes only
 * - Archived: read-only
 */

function isLiveEngagementForm(status, formType) {
  return isEngagementFormType(formType) && (status === 'Active' || status === 'Ready');
}

/**
 * @param {string} status
 * @param {string} [formType]
 */
export const canEditForm = (status, formType) => {
  if (isEngagementFormType(formType)) {
    return status === 'Draft';
  }
  return ['Draft', 'Ready'].includes(status);
};

/**
 * @param {string} status
 * @param {string} [formType]
 */
export const isFormReadOnly = (status) => {
  return status === 'Archived';
};

/**
 * @param {string} status
 * @param {string} [formType]
 */
export const isFormLocked = (status, formType) => {
  if (isLiveEngagementForm(status, formType)) {
    return true;
  }
  return status === 'Active';
};

/**
 * @param {string} status
 * @param {string} [formType]
 */
export const canModifyStructure = (status, formType) => {
  if (isEngagementFormType(formType)) {
    return status === 'Draft';
  }
  return ['Draft', 'Ready'].includes(status);
};

export const canModifyQuestions = (status, formType) => canModifyStructure(status, formType);
export const canChangeQuestionType = (status, formType) => canModifyStructure(status, formType);
export const canModifyScoring = (status, formType) => canModifyStructure(status, formType);
export const canModifyEvidenceRules = (status, formType) => canModifyStructure(status, formType);
export const canModifyOutcomeRules = (status, formType) => canModifyStructure(status, formType);
export const canEditResponseTemplate = (status, formType) => canModifyStructure(status, formType);

/**
 * @param {string} status
 * @param {string} [formType]
 */
export const canMakeCosmeticChanges = (status, formType) => {
  if (status === 'Archived') {
    return false;
  }
  if (isLiveEngagementForm(status, formType) || status === 'Active') {
    return true;
  }
  return ['Draft', 'Ready'].includes(status);
};

/**
 * @param {string} status
 * @param {string} [formType]
 */
export const getBlockingMessage = (status, formType) => {
  if (isLiveEngagementForm(status, formType) || status === 'Active') {
    return i18n.global.t('forms.permBlockingActive');
  }
  if (status === 'Archived') {
    return i18n.global.t('forms.permBlockingArchived');
  }
  return null;
};

/**
 * @param {string} status
 * @param {string} action
 * @param {string} [formType]
 */
export const isEditAllowed = (status, action, formType) => {
  if (status === 'Archived') {
    return false;
  }

  if (isLiveEngagementForm(status, formType) || status === 'Active') {
    return action === 'cosmetic';
  }

  return ['Draft', 'Ready'].includes(status);
};

const STATUS_LABEL_KEYS = {
  Draft: 'forms.statusDraft',
  Ready: 'forms.statusReady',
  Active: 'forms.statusActive',
  Archived: 'forms.statusArchived',
};

function resolveSubmittedResponseCount(form, responseSummary) {
  if (!form) return 0;
  if (typeof form.submittedResponseCount === 'number') {
    return form.submittedResponseCount;
  }
  const summaryTotal = typeof responseSummary === 'object' && responseSummary
    ? (responseSummary.overview?.totalResponses ?? responseSummary.totalResponses)
    : undefined;
  if (typeof summaryTotal === 'number') {
    return summaryTotal;
  }
  return form.lastSubmission ? 1 : 0;
}

export function hasSubmittedFormResponses(form, responseSummary) {
  return resolveSubmittedResponseCount(form, responseSummary) > 0;
}

export function canHardDeleteForm(form, responseSummary) {
  if (!form) return false;
  return !hasSubmittedFormResponses(form, responseSummary);
}

export const getStatusInfo = (status, formType) => {
  const statusMap = {
    Draft: {
      color: 'gray',
      icon: 'document-text',
    },
    Ready: {
      color: 'blue',
      icon: 'check-circle',
    },
    Active: {
      color: 'green',
      icon: 'play-circle',
      locked: true,
    },
    Archived: {
      color: 'gray',
      icon: 'archive',
      locked: true,
    },
  };

  const resolved = statusMap[status] || statusMap.Draft;
  const labelKey = STATUS_LABEL_KEYS[status] || STATUS_LABEL_KEYS.Draft;
  const label = isLiveEngagementForm(status, formType)
    ? i18n.global.t('forms.statusLive')
    : i18n.global.t(labelKey);

  return {
    ...resolved,
    label,
  };
};
