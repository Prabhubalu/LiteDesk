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
  const group = config.conditionGroup;
  if (group && (group.andBlock || group.orBlock)) {
    const fmt = (item) => {
      const fieldName = String(item.field).replace(/^(event\.|dataBag\.)/, '');
      const op = item.operator;
      const operatorLabel =
        typeof OPERATOR_SYMBOLS[op] === 'function' ? OPERATOR_SYMBOLS[op]() : OPERATOR_SYMBOLS[op] || op;
      return `${fieldName} ${operatorLabel} ${item.value}`;
    };
    const andParts = (group.andBlock?.conditions || []).filter((c) => c?.field).map(fmt);
    const orParts = (group.orBlock?.conditions || []).filter((c) => c?.field).map(fmt);
    const chunks = [];
    if (andParts.length) chunks.push(`(${andParts.join(' AND ')})`);
    if (orParts.length) chunks.push(`(${orParts.join(' OR ')})`);
    if (chunks.length) return chunks.join(` ${group.blockCombinator || 'AND'} `);
  }
  if (group && Array.isArray(group.conditions) && group.conditions.length) {
    const parts = group.conditions.map((item) => {
      if (item?.conditions && item.combinator) {
        return `(${item.combinator}: ${item.conditions.length})`;
      }
      if (item?.field && item?.operator) {
        const fieldName = String(item.field).replace(/^(event\.|dataBag\.)/, '');
        const op = item.operator;
        const operatorLabel =
          typeof OPERATOR_SYMBOLS[op] === 'function' ? OPERATOR_SYMBOLS[op]() : OPERATOR_SYMBOLS[op] || op;
        return `${fieldName} ${operatorLabel} ${item.value}`;
      }
      return null;
    }).filter(Boolean);
    if (parts.length) return parts.join(` ${group.combinator || 'AND'} `);
  }
  if (config.field && config.operator) {
    const fieldName = config.field.replace(/^(event\.|dataBag\.)/, '');
    const op = config.operator;
    const operatorLabel =
      typeof OPERATOR_SYMBOLS[op] === 'function' ? OPERATOR_SYMBOLS[op]() : OPERATOR_SYMBOLS[op] || op;
    return `${fieldName} ${operatorLabel} ${config.value}`;
  }
  const legacy = config.condition;
  if (legacy?.field && legacy?.operator) {
    const fieldName = String(legacy.field).replace(/^(event\.|dataBag\.)/, '');
    const op = legacy.operator;
    const operatorLabel =
      typeof OPERATOR_SYMBOLS[op] === 'function' ? OPERATOR_SYMBOLS[op]() : OPERATOR_SYMBOLS[op] || op;
    return `${fieldName} ${operatorLabel} ${legacy.value}`;
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
    create_record: t('actionCreateRecord'),
    update_record: t('actionUpdateRecord'),
    delete_record: t('actionDeleteRecord'),
    create_task: t('actionCreateTask'),
    notify_user: t('actionNotifyUser'),
    start_process: t('actionStartProcess')
  };
  return labels[config.actionType] || t('actionGeneric');
}

export function getActionSummary(node) {
  const config = node.config || {};
  if (config.actionType === 'create_record') {
    return t('summaryCreateRecord', {
      module: config.params?.moduleKey || t('summaryModuleUnknown')
    });
  }
  if (config.actionType === 'update_record') {
    return t('summaryUpdateRecord', {
      target: config.params?.target || 'current'
    });
  }
  if (config.actionType === 'delete_record') {
    return t('summaryDeleteRecord', {
      target: config.params?.target || 'current'
    });
  }
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
