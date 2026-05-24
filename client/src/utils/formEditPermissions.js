import { i18n } from '@/i18n';

/**
 * Form Edit Permissions Utility
 *
 * Enforces edit permissions based on form status:
 * - Draft & Ready: Full editing allowed
 * - Active: Only cosmetic changes (titles, labels, help text)
 * - Archived: Read-only
 */

/**
 * Check if a form can be edited
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canEditForm = (status) => {
  return ['Draft', 'Ready'].includes(status);
};

/**
 * Check if a form is read-only
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const isFormReadOnly = (status) => {
  return status === 'Archived';
};

/**
 * Check if a form is locked (Active status - limited edits)
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const isFormLocked = (status) => {
  return status === 'Active';
};

/**
 * Check if structural changes are allowed
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canModifyStructure = (status) => {
  return ['Draft', 'Ready'].includes(status);
};

/**
 * Check if questions can be added/removed
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canModifyQuestions = (status) => {
  return ['Draft', 'Ready'].includes(status);
};

/**
 * Check if question type can be changed
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canChangeQuestionType = (status) => {
  return ['Draft', 'Ready'].includes(status);
};

/**
 * Check if scoring logic can be modified
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canModifyScoring = (status) => {
  return ['Draft', 'Ready'].includes(status);
};

/**
 * Check if evidence rules can be modified
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canModifyEvidenceRules = (status) => {
  return ['Draft', 'Ready'].includes(status);
};

/**
 * Check if outcome rules can be modified
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canModifyOutcomeRules = (status) => {
  return ['Draft', 'Ready'].includes(status);
};

/**
 * Check if response template can be edited
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canEditResponseTemplate = (status) => {
  return ['Draft', 'Ready'].includes(status);
};

/**
 * Check if cosmetic changes are allowed (titles, labels, help text)
 * @param {string} status - Form status
 * @returns {boolean}
 */
export const canMakeCosmeticChanges = (status) => {
  return ['Draft', 'Ready', 'Active'].includes(status);
};

/**
 * Get the blocking message for a form status
 * @param {string} status - Form status
 * @returns {string|null}
 */
export const getBlockingMessage = (status) => {
  if (status === 'Active') {
    return i18n.global.t('forms.permBlockingActive');
  }
  if (status === 'Archived') {
    return i18n.global.t('forms.permBlockingArchived');
  }
  return null;
};

/**
 * Check if a specific edit action is allowed
 * @param {string} status - Form status
 * @param {string} action - Action type: 'addSection', 'removeSection', 'addQuestion', 'removeQuestion', 'changeQuestionType', 'modifyScoring', 'modifyEvidence', 'modifyOutcomes', 'editTemplate', 'cosmetic'
 * @returns {boolean}
 */
export const isEditAllowed = (status, action) => {
  if (status === 'Archived') {
    return false;
  }
  
  if (status === 'Active') {
    // Only cosmetic changes allowed
    return action === 'cosmetic';
  }
  
  // Draft and Ready: all edits allowed
  return true;
};

/**
 * Get status display information
 * @param {string} status - Form status
 * @returns {{label: string, color: string, icon: string}}
 */
const STATUS_LABEL_KEYS = {
  Draft: 'forms.statusDraft',
  Ready: 'forms.statusReady',
  Active: 'forms.statusActive',
  Archived: 'forms.statusArchived',
};

export const getStatusInfo = (status) => {
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

  return {
    ...resolved,
    label: i18n.global.t(labelKey),
  };
};

