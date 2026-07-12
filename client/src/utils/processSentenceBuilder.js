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
      // Prefer engine trigger.type; fall back to node config.triggerKind
      const kind = t?.type || config.triggerKind || null;
      if (kind === 'manual') return 'When triggered manually';
      if (kind === 'webhook') return 'When a webhook request is received';
      if (kind === 'schedule') {
        const schedule = t?.schedule || {};
        const preset = schedule.preset || 'daily';
        const hour = Number(schedule.hour ?? 9);
        const minute = Number(schedule.minute ?? 0);
        const period = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 === 0 ? 12 : hour % 12;
        const time =
          minute === 0 ? `${h12} ${period}` : `${h12}:${String(minute).padStart(2, '0')} ${period}`;
        if (preset === 'hourly') return 'On schedule (every hour)';
        if (preset === 'weekly') return `On schedule (weekly at ${time})`;
        if (preset === 'monthly') {
          const day = schedule.dayOfMonth ?? 1;
          return `On schedule (monthly on day ${day} at ${time})`;
        }
        return `On schedule (daily at ${time})`;
      }
      if (kind === 'domain_event') {
        const mod = process?.entityType || 'record';
        const eventType = t?.eventType || config.eventType || '';
        if (eventType.endsWith('.created')) return `When a ${mod} is created`;
        if (eventType.endsWith('.updated')) return `When a ${mod} is updated`;
      }
      return 'When this process starts';
    }
    case 'condition': {
      const group = config.conditionGroup;
      if (group && (group.andBlock || group.orBlock)) {
        const fmt = (c) =>
          `${fieldLabel(c.field)} ${OPERATOR_PHRASES[c.operator] || c.operator} ${formatValue(c.value)}`;
        const andParts = (group.andBlock?.conditions || []).filter((c) => c?.field).map(fmt);
        const orParts = (group.orBlock?.conditions || []).filter((c) => c?.field).map(fmt);
        const andText = andParts.length ? `(${andParts.join(' AND ')})` : null;
        const orText = orParts.length ? `(${orParts.join(' OR ')})` : null;
        const parts = [andText, orText].filter(Boolean);
        if (parts.length === 1) return `When ${parts[0]}`;
        if (parts.length === 2) {
          return `When ${parts[0]} ${group.blockCombinator || 'AND'} ${parts[1]}`;
        }
      }
      if (group && Array.isArray(group.conditions) && group.conditions.length) {
        const parts = group.conditions.map((item) => {
          if (item && Array.isArray(item.conditions) && item.combinator) {
            const nested = item.conditions
              .filter((c) => c?.field)
              .map(
                (c) =>
                  `${fieldLabel(c.field)} ${OPERATOR_PHRASES[c.operator] || c.operator} ${formatValue(c.value)}`
              );
            if (!nested.length) return null;
            return `(${nested.join(` ${item.combinator} `)})`;
          }
          if (item?.field && item?.operator) {
            return `${fieldLabel(item.field)} ${OPERATOR_PHRASES[item.operator] || item.operator} ${formatValue(item.value)}`;
          }
          return null;
        }).filter(Boolean);
        if (parts.length) {
          return `When ${parts.join(` ${group.combinator || 'AND'} `)}`;
        }
      }
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
    case 'for_each':
      return `For each item in ${config.variableName || 'records'}`;
    case 'for_each_end':
      return 'End for each loop';
    case 'action': {
      const labels = {
        create_record: 'Create record',
        update_record: 'Update record',
        delete_record: 'Delete record',
        create_task: 'Create task',
        notify_user: 'Record alert',
        start_process: 'Trigger another process',
        send_email: 'Send email',
        send_sms: 'Send SMS',
        send_whatsapp: 'Send WhatsApp',
        mobile_push: 'Mobile push',
        slack_notification: 'Slack notification',
        webhook: 'Webhook',
        rest_api: 'REST API',
        custom_function: 'Custom function',
        fetch_records: 'Fetch records',
        fetch_related_records: 'Fetch related records',
        set_variable: 'Set variable',
        create_audit_entry: 'Create audit entry',
        run_analytics_report: 'Run analytics report'
      };
      const base = labels[config.actionType] || config.actionType || 'Run an action';
      if (config.actionType === 'create_record' && config.params?.moduleKey) {
        return `${base} in ${config.params.moduleKey}`;
      }
      if (config.actionType === 'update_record') {
        const mod = config.params?.moduleKey || 'record';
        return `${base} (${config.params?.target || 'current'} ${mod})`;
      }
      if (config.actionType === 'delete_record') {
        return `${base} (${config.params?.target || 'current'})`;
      }
      if (config.actionType === 'create_task' && config.params?.title) {
        return `${base}: "${config.params.title}"`;
      }
      if (config.actionType === 'notify_user' && config.params?.message) {
        const msg = String(config.params.message).slice(0, 40);
        return `${base}: ${msg}${config.params.message.length > 40 ? '…' : ''}`;
      }
      if (config.actionType === 'send_email' && config.params?.bodyMode === 'template') {
        return `${base}: template`;
      }
      if (config.actionType === 'send_email' && config.params?.subject) {
        return `${base}: "${config.params.subject}"`;
      }
      if (config.actionType === 'send_sms' || config.actionType === 'send_whatsapp') {
        return `${base} to ${config.params?.to || 'owner'}`;
      }
      if (config.actionType === 'mobile_push' && config.params?.title) {
        return `${base}: "${config.params.title}"`;
      }
      if (config.actionType === 'slack_notification') {
        return base;
      }
      if (config.actionType === 'webhook' && config.params?.url) {
        return `${base}: ${config.params.url}`;
      }
      if (config.actionType === 'rest_api' && config.params?.url) {
        return `${base}: ${config.params.method || 'GET'} ${config.params.url}`;
      }
      if (config.actionType === 'fetch_records' && config.params?.moduleKey) {
        return `${base} from ${config.params.moduleKey} → ${config.params.variableName || 'records'}`;
      }
      if (config.actionType === 'fetch_related_records') {
        return `${base} → ${config.params?.variableName || 'related'}`;
      }
      if (config.actionType === 'set_variable' && config.params?.name) {
        return `${base}: ${config.params.name}`;
      }
      if (config.actionType === 'create_audit_entry' && config.params?.message) {
        const msg = String(config.params.message).slice(0, 40);
        return `${base}: ${msg}${config.params.message.length > 40 ? '…' : ''}`;
      }
      if (config.actionType === 'custom_function' && config.params?.functionKey) {
        return `${base}: ${config.params.functionKey}`;
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
    for_each: 'For each',
    for_each_end: 'End for each',
    end: 'End'
  };
  return labels[type] || type;
}
