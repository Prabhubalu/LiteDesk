/**
 * Human-readable sentences for process flow nodes (operations-first copy).
 */

const OPERATOR_PHRASES = {
  equals: 'is',
  '===': 'is',
  not_equals: 'is not',
  '!==': 'is not',
  greater_than: 'is greater than',
  less_than: 'is less than',
  contains: 'contains',
  exists: 'exists'
};

function fieldLabel(field) {
  if (!field) return 'field';
  const key = String(field).replace(/^(event\.|dataBag\.|event\.currentState\.)/, '');
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

export function buildNodeSentence(node, process) {
  if (!node) return '';

  const { type, config = {} } = node;

  switch (type) {
    case 'trigger': {
      const t = process?.trigger;
      if (t?.type === 'manual') return 'When triggered manually';
      if (t?.type === 'webhook') return 'When a webhook request is received';
      if (t?.type === 'schedule') {
        const preset = t.schedule?.preset || 'daily';
        if (preset === 'hourly') return 'On schedule (every hour)';
        if (preset === 'weekly') return 'On schedule (weekly)';
        return 'On schedule (daily)';
      }
      if (t?.type === 'domain_event') {
        const mod = process?.entityType || 'record';
        if (t.eventType?.endsWith('.created')) return `When a ${mod} is created`;
        if (t.eventType?.endsWith('.updated')) return `When a ${mod} is updated`;
      }
      return 'When this process starts';
    }
    case 'condition': {
      const c = config.condition || config;
      if (c?.field && c?.operator) {
        return `When ${fieldLabel(c.field)} ${OPERATOR_PHRASES[c.operator] || c.operator} ${formatValue(c.value)}`;
      }
      return 'When a condition is met';
    }
    case 'field_rule': {
      const key = fieldLabel(config.fieldKey);
      if (config.rule === 'mandatory') return `Make "${key}" mandatory`;
      if (config.rule === 'default') return `Set "${key}" default to ${formatValue(config.value)}`;
      if (config.rule === 'visibility') return config.value ? `Show field "${key}"` : `Hide field "${key}"`;
      return `Control field "${key}"`;
    }
    case 'ownership_rule':
      return `Assign ownership to ${config.target || '—'} (${config.assignment || 'owner'})`;
    case 'status_guard': {
      const t = config.allowedTransitions?.[0] || '';
      return t ? `Control transition: ${t}` : 'Control status or stage transitions';
    }
    case 'approval_gate':
      return `Require approval from ${config.approvers?.role || config.approvers?.user || 'approver'} before continuing`;
    case 'wait': {
      const n = Number(config.duration) || 1;
      const u = config.unit || 'hours';
      const unitWord = u === 'minutes' ? 'minute' : u === 'hours' ? 'hour' : 'day';
      const plural = n === 1 ? unitWord : `${unitWord}s`;
      return `Wait ${n} ${plural} before continuing`;
    }
    case 'action': {
      const labels = {
        create_task: 'Create task',
        notify_user: 'Send notification',
        start_process: 'Start another process'
      };
      const base = labels[config.actionType] || config.actionType || 'Run an action';
      if (config.actionType === 'create_task' && config.params?.title) {
        return `${base}: "${config.params.title}"`;
      }
      if (config.actionType === 'notify_user' && config.params?.message) {
        const msg = String(config.params.message).slice(0, 40);
        return `${base}: ${msg}${config.params.message.length > 40 ? '…' : ''}`;
      }
      return base;
    }
    case 'data_mapping':
      return 'Map data between steps';
    case 'end':
      return 'End process';
    default:
      return type || 'Step';
  }
}

export function getNodeTypeLabel(type) {
  const labels = {
    trigger: 'Trigger',
    condition: 'IF',
    field_rule: 'Field rule',
    ownership_rule: 'Ownership',
    status_guard: 'Status guard',
    approval_gate: 'Approval',
    wait: 'Wait',
    action: 'Action',
    data_mapping: 'Map data',
    end: 'End'
  };
  return labels[type] || type;
}
