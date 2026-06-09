'use strict';

function getValueByPath(source, path) {
  if (!path) return undefined;
  const parts = String(path).split('.');
  let current = source;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function normalizeDealRecord(deal) {
  if (!deal) return null;
  return deal.toObject ? deal.toObject() : deal;
}

function getDealFieldValue(dealRecord, field) {
  const path = String(field || '').trim();
  if (!path || !dealRecord) return undefined;

  const direct = getValueByPath(dealRecord, path);
  if (direct !== undefined) {
    return direct;
  }

  if (dealRecord.customFields && typeof dealRecord.customFields === 'object') {
    const customPath = path.startsWith('customFields.')
      ? path.slice('customFields.'.length)
      : path;
    return getValueByPath(dealRecord.customFields, customPath);
  }

  return undefined;
}

function evaluatePlaybookExitCondition(condition, deal) {
  const dealRecord = normalizeDealRecord(deal);
  const left = getDealFieldValue(dealRecord, condition?.field);
  const right = condition?.value;
  const operator = String(condition?.operator || 'equals').toLowerCase();

  switch (operator) {
    case 'equals':
    case '==':
    case '===':
      if (left === right) return true;
      if (typeof left === 'string' && typeof right === 'string') {
        return left.trim().toLowerCase() === right.trim().toLowerCase();
      }
      return String(left ?? '') === String(right ?? '');
    case 'not_equals':
    case '!=':
    case '!==':
      if (left === right) return false;
      if (typeof left === 'string' && typeof right === 'string') {
        return left.trim().toLowerCase() !== right.trim().toLowerCase();
      }
      return String(left ?? '') !== String(right ?? '');
    case 'contains':
      return String(left || '').toLowerCase().includes(String(right || '').toLowerCase());
    case 'in':
      return Array.isArray(right) && right.map(String).includes(String(left));
    case 'not_in':
      return Array.isArray(right) && !right.map(String).includes(String(left));
    case 'exists':
      return left !== undefined && left !== null && left !== '';
    case 'gt':
      return Number(left) > Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    default:
      return false;
  }
}

function evaluatePlaybookExitConditions(conditions, deal) {
  const validConditions = (Array.isArray(conditions) ? conditions : [])
    .filter((condition) => String(condition?.field || '').trim());
  if (!validConditions.length) {
    return false;
  }

  return validConditions.every((condition) => evaluatePlaybookExitCondition(condition, deal));
}

function allRequiredPlaybookActionsCompleted(actionStates) {
  const actions = Array.isArray(actionStates) ? actionStates : [];
  const requiredActions = actions.filter((action) => action.required !== false);
  const targetActions = requiredActions.length > 0 ? requiredActions : actions;
  if (!targetActions.length) {
    return true;
  }
  return targetActions.every((action) => action.status === 'completed');
}

function evaluateCustomPlaybookExitCriteria(actionStates, exitCriteria, deal) {
  const conditions = Array.isArray(exitCriteria?.conditions) ? exitCriteria.conditions : [];
  const hasConditions = conditions.some((condition) => String(condition?.field || '').trim());
  const actionsComplete = allRequiredPlaybookActionsCompleted(actionStates);

  if (!hasConditions) {
    return { met: false, type: 'custom' };
  }

  const conditionsMet = evaluatePlaybookExitConditions(conditions, deal);
  return {
    met: conditionsMet && actionsComplete,
    type: 'custom'
  };
}

module.exports = {
  getDealFieldValue,
  evaluatePlaybookExitCondition,
  evaluatePlaybookExitConditions,
  allRequiredPlaybookActionsCompleted,
  evaluateCustomPlaybookExitCriteria
};
