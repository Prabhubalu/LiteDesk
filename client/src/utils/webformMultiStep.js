import { filterVisibleWebformFields } from '@/utils/webformConditionalLogic';

export function defaultMultiStepConfig() {
  return {
    enabled: false,
    showProgress: true
  };
}

export function defaultWebformStep(index = 0) {
  const order = Number(index) || 0;
  return {
    stepId: `step_${order + 1}`,
    title: `Step ${order + 1}`,
    description: '',
    order
  };
}

export function sanitizeMultiStepConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: source.enabled === true,
    showProgress: source.showProgress !== false
  };
}

export function sanitizeWebformSteps(rawSteps, multiStepEnabled) {
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

export function orderedWebformSteps(webform) {
  const multiStep = sanitizeMultiStepConfig(webform?.multiStep);
  return sanitizeWebformSteps(webform?.steps, multiStep.enabled);
}

export function isMultiStepEnabled(webform) {
  const multiStep = sanitizeMultiStepConfig(webform?.multiStep);
  return multiStep.enabled && orderedWebformSteps(webform).length > 0;
}

export function isMultiStepFormActive(webform) {
  return isMultiStepEnabled(webform) && orderedWebformSteps(webform).length > 1;
}

export function resolveDefaultStepId(webform) {
  const steps = orderedWebformSteps(webform);
  return steps[0]?.stepId || '';
}

export function sanitizeFieldStepId(stepId, webform) {
  if (!isMultiStepEnabled(webform)) return '';
  const id = String(stepId || '').trim();
  const validIds = new Set(orderedWebformSteps(webform).map((step) => step.stepId));
  if (id && validIds.has(id)) return id;
  return resolveDefaultStepId(webform);
}

export function fieldsOnStep(fields, webform, stepId) {
  const targetStepId = String(stepId || '').trim();
  if (!targetStepId) return [];
  return fields.filter((field) => sanitizeFieldStepId(field.stepId, webform) === targetStepId);
}

export function filterVisibleFieldsForStep(fields, webform, stepId, values) {
  return filterVisibleWebformFields(fieldsOnStep(fields, webform, stepId), values, fields);
}

export function nextWebformStepId(steps) {
  let max = 0;
  for (const step of steps) {
    const match = /^step_(\d+)$/.exec(String(step?.stepId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `step_${max + 1}`;
}

export function ensureDefaultSteps() {
  return [defaultWebformStep(0), defaultWebformStep(1)];
}
