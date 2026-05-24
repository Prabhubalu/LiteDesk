import { i18n } from '@/i18n';

const t = (key, params) => i18n.global.t(`process.${key}`, params);

const OPERATOR_SYMBOLS = {
  equals: '=',
  not_equals: '≠',
  greater_than: '>',
  less_than: '<',
  contains: () => t('opSymbolContains')
};

export function getConditionSummary(node) {
  const config = node.config || {};
  if (config.field && config.operator) {
    const fieldName = config.field.replace(/^(event\.|dataBag\.)/, '');
    const op = config.operator;
    const operatorLabel =
      typeof OPERATOR_SYMBOLS[op] === 'function' ? OPERATOR_SYMBOLS[op]() : OPERATOR_SYMBOLS[op] || op;
    return `${fieldName} ${operatorLabel} ${config.value}`;
  }
  return t('summaryConditionCheck');
}

export function getFieldRuleSummary(node) {
  const config = node.config || {};
  if (config.rule === 'mandatory') {
    return t('summaryFieldMandatory', { field: config.fieldKey });
  }
  if (config.rule === 'default') {
    return t('summaryFieldDefault', { field: config.fieldKey, value: config.value });
  }
  if (config.rule === 'visibility') {
    return config.value
      ? t('summaryFieldShow', { field: config.fieldKey })
      : t('summaryFieldHide', { field: config.fieldKey });
  }
  return t('summaryFieldRuleApplied');
}

export function getOwnershipRuleSummary(node) {
  const config = node.config || {};
  return t('summaryOwnership', { target: config.target, assignment: config.assignment });
}

export function getStatusGuardSummary(node) {
  const config = node.config || {};
  const transition = config.allowedTransitions?.[0] || '';
  return t('summaryStatusGuard', { field: config.field, transition });
}

export function getActionTypeLabel(node) {
  const config = node.config || {};
  const labels = {
    create_task: t('actionCreateTask'),
    notify_user: t('actionNotifyUser'),
    start_process: t('actionStartProcess')
  };
  return labels[config.actionType] || t('actionGeneric');
}

export function getActionSummary(node) {
  const config = node.config || {};
  if (config.actionType === 'create_task') {
    return `"${config.params?.title || t('summaryActionUntitled')}"`;
  }
  if (config.actionType === 'notify_user') {
    return t('summaryNotifyTo', {
      recipient: config.params?.recipient || t('summaryNotifyUserFallback')
    });
  }
  if (config.actionType === 'start_process') {
    return t('summaryStartProcess', {
      processId: config.params?.processId || t('summaryProcessUnknown')
    });
  }
  return t('summaryActionExecuted');
}
