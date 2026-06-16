export const SLA_RECIPIENT_LABEL_KEYS = {
  assigned_user: 'settings.slaAlertRecipientAssigned',
  manager: 'settings.slaAlertRecipientManager',
  assigned_group: 'settings.slaAlertRecipientGroup',
  record_owner: 'settings.slaAlertRecipientOwner'
};

export const SLA_CHANNEL_LABEL_KEYS = {
  inApp: 'settings.slaAlertChannelInApp',
  email: 'settings.slaAlertChannelEmail',
  push: 'settings.slaAlertChannelPush'
};

export const SLA_ESCALATION_ROLE_LABEL_KEYS = {
  assigned_user: 'settings.slaAlertRecipientAssigned',
  manager: 'settings.slaAlertRecipientManager',
  team_lead: 'settings.slaEscalationTeamLead',
  operations_head: 'settings.slaEscalationOpsHead'
};

export const SLA_TIMING_MODE_LABEL_KEYS = {
  before: 'settings.slaAlertTimingBefore',
  after: 'settings.slaAlertTimingAfter',
  immediately: 'settings.slaAlertTimingImmediately'
};

export const SLA_OVERRIDE_MODE_LABEL_KEYS = {
  default: 'settings.slaOverrideDefault',
  standard: 'settings.slaOverrideStandard',
  calendar24x7: 'settings.slaOverrideCalendar24x7'
};

export const SLA_ALERT_TYPE_LABEL_KEYS = {
  warning: 'settings.slaAlertWarning',
  breach: 'settings.slaAlertBreach'
};

export function buildRecipientOptions(recipientIds, t) {
  return (recipientIds || []).map((value) => ({
    value,
    label: SLA_RECIPIENT_LABEL_KEYS[value] ? t(SLA_RECIPIENT_LABEL_KEYS[value]) : value
  }));
}

export function buildChannelOptions(channelIds, t) {
  return (channelIds || []).map((value) => ({
    value,
    label: SLA_CHANNEL_LABEL_KEYS[value] ? t(SLA_CHANNEL_LABEL_KEYS[value]) : value
  }));
}

export function buildEscalationRoleOptions(roleIds, t) {
  return (roleIds || []).map((value) => ({
    value,
    label: SLA_ESCALATION_ROLE_LABEL_KEYS[value] ? t(SLA_ESCALATION_ROLE_LABEL_KEYS[value]) : value
  }));
}

export function buildTimingModeOptions(timingModes, t) {
  return (timingModes || []).map((value) => ({
    value,
    label: SLA_TIMING_MODE_LABEL_KEYS[value] ? t(SLA_TIMING_MODE_LABEL_KEYS[value]) : value
  }));
}

export function buildOverrideModeOptions(modes, t) {
  return (modes || []).map((value) => ({
    value,
    label: SLA_OVERRIDE_MODE_LABEL_KEYS[value] ? t(SLA_OVERRIDE_MODE_LABEL_KEYS[value]) : value
  }));
}

export function alertTypeLabel(type, t) {
  const key = SLA_ALERT_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
}
