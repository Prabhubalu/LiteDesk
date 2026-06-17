'use strict';

function defaultMultiStepConfig() {
  return {
    enabled: false,
    showProgress: true
  };
}

function defaultWebformStep(index = 0) {
  const order = Number(index) || 0;
  return {
    stepId: `step_${order + 1}`,
    title: `Step ${order + 1}`,
    description: '',
    order
  };
}

function sanitizeMultiStepConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: source.enabled === true,
    showProgress: source.showProgress !== false
  };
}

function sanitizeWebformSteps(rawSteps, multiStepEnabled) {
  if (!multiStepEnabled) return [];

  const rows = Array.isArray(rawSteps) ? rawSteps : [];
  const sanitized = rows
    .map((step, index) => ({
      stepId: String(step?.stepId || `step_${index + 1}`).trim(),
      title: String(step?.title || `Step ${index + 1}`).trim(),
      description: String(step?.description || '').trim(),
      order: Number.isFinite(Number(step?.order)) ? Number(step.order) : index
    }))
    .filter((step) => step.stepId);

  if (!sanitized.length) {
    return [defaultWebformStep(0), defaultWebformStep(1)];
  }

  return sanitized.sort((a, b) => a.order - b.order);
}

function orderedWebformSteps(webform) {
  const multiStep = sanitizeMultiStepConfig(webform?.multiStep);
  return sanitizeWebformSteps(webform?.steps, multiStep.enabled);
}

function isMultiStepEnabled(webform) {
  const multiStep = sanitizeMultiStepConfig(webform?.multiStep);
  return multiStep.enabled && orderedWebformSteps(webform).length > 0;
}

function resolveDefaultStepId(webform) {
  const steps = orderedWebformSteps(webform);
  return steps[0]?.stepId || '';
}

function sanitizeFieldStepId(stepId, webform) {
  if (!isMultiStepEnabled(webform)) return '';
  const id = String(stepId || '').trim();
  const validIds = new Set(orderedWebformSteps(webform).map((step) => step.stepId));
  if (id && validIds.has(id)) return id;
  return resolveDefaultStepId(webform);
}

module.exports = {
  defaultMultiStepConfig,
  defaultWebformStep,
  sanitizeMultiStepConfig,
  sanitizeWebformSteps,
  orderedWebformSteps,
  isMultiStepEnabled,
  resolveDefaultStepId,
  sanitizeFieldStepId
};
