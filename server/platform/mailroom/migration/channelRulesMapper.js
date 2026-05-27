'use strict';

const { MAILROOM_DEDUP_BEHAVIORS } = require('../../../constants/mailroomPolicies');
const { getTemplate } = require('../policies/templates/defaultTemplates');

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Map legacy helpdesk channelRules duplicate mode → Mailroom dedup.onDuplicate.
 */
function mapChannelDuplicateHandling(rule = {}) {
  const raw = String(rule.duplicateHandling || rule.onDuplicate || '').trim().toLowerCase();
  if (raw === 'create_child_case' || raw === 'create_child') return 'create_child_case';
  if (raw === 'flag_for_review') return 'flag_for_review';
  if (raw === 'ignore') return 'ignore';
  if (raw === 'append_to_existing_open_case' || raw === 'append') return 'append_to_existing_open_case';
  if (MAILROOM_DEDUP_BEHAVIORS.includes(raw)) return raw;
  return 'append_to_existing_open_case';
}

/**
 * Build Mailroom policy fragments from a single channel rule (typically Email).
 */
function mapChannelRuleToMailroomPolicies(channelRule = {}) {
  const rule = isPlainObject(channelRule) ? channelRule : {};
  const onDuplicate = mapChannelDuplicateHandling(rule);

  const defaults = {};
  if (rule.defaultCaseType) defaults.caseType = rule.defaultCaseType;
  if (rule.defaultPriority) defaults.priority = rule.defaultPriority;
  if (rule.defaultChannel) defaults.channel = rule.defaultChannel;
  else if (rule.channel) defaults.channel = rule.channel;

  const caseLinkPatch = {};
  if (Object.keys(defaults).length > 0) {
    caseLinkPatch.defaults = defaults;
  }

  return {
    dedup: { onDuplicate },
    caseLink: caseLinkPatch,
    _source: {
      channelRuleKeys: Object.keys(rule),
      mappedDuplicate: onDuplicate
    }
  };
}

/**
 * Prefer Email channel rule; fall back to first configured channel.
 */
function pickPrimaryChannelRule(channelRules = {}) {
  if (!isPlainObject(channelRules)) return { channel: null, rule: {} };
  if (isPlainObject(channelRules.Email) && Object.keys(channelRules.Email).length > 0) {
    return { channel: 'Email', rule: channelRules.Email };
  }
  if (isPlainObject(channelRules.email) && Object.keys(channelRules.email).length > 0) {
    return { channel: 'email', rule: channelRules.email };
  }
  for (const [channel, rule] of Object.entries(channelRules)) {
    if (isPlainObject(rule) && Object.keys(rule).length > 0) {
      return { channel, rule };
    }
  }
  return { channel: null, rule: {} };
}

function hasMeaningfulChannelRule(rule) {
  if (!isPlainObject(rule)) return false;
  return Boolean(
    rule.defaultCaseType
    || rule.defaultPriority
    || rule.defaultOwnerId
    || rule.duplicateHandling
    || rule.onDuplicate
    || rule.defaultChannel
    || rule.channel
  );
}

function mergeMailroomPolicies(basePolicies, patch) {
  const base = isPlainObject(basePolicies) ? basePolicies : {};
  const merged = { ...base };

  if (patch.dedup) {
    merged.dedup = {
      ...(isPlainObject(base.dedup) ? base.dedup : {}),
      ...patch.dedup
    };
  }

  if (patch.caseLink) {
    const baseCaseLink = isPlainObject(base.caseLink) ? base.caseLink : {};
    merged.caseLink = {
      ...baseCaseLink,
      ...patch.caseLink,
      defaults: {
        ...(isPlainObject(baseCaseLink.defaults) ? baseCaseLink.defaults : {}),
        ...(isPlainObject(patch.caseLink.defaults) ? patch.caseLink.defaults : {})
      }
    };
  }

  return merged;
}

/**
 * Resolve base policies for migration (stored config or active template).
 */
function resolveBasePoliciesForMigration(mailroomRow) {
  const stored = mailroomRow?.policies;
  if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
    const hasContent = Boolean(stored.threading || stored.dedup || stored.caseLink);
    if (hasContent) return JSON.parse(JSON.stringify(stored));
  }
  const template = getTemplate(mailroomRow?.activeTemplateId || 'helpdesk_standard_email');
  return JSON.parse(JSON.stringify(template?.policies || getTemplate('helpdesk_standard_email').policies));
}

function buildMigrationPlan({ channelRules, mailroomRow }) {
  const { channel, rule } = pickPrimaryChannelRule(channelRules);
  if (!hasMeaningfulChannelRule(rule)) {
    return { skipped: true, reason: 'no_channel_rules', channel: null };
  }

  const patch = mapChannelRuleToMailroomPolicies(rule);
  const basePolicies = resolveBasePoliciesForMigration(mailroomRow);
  const policies = mergeMailroomPolicies(basePolicies, patch);

  return {
    skipped: false,
    channel,
    sourceRule: rule,
    patch,
    policies,
    mailroomEnabled: mailroomRow?.enabled === true,
    activeTemplateId: mailroomRow?.activeTemplateId || 'helpdesk_standard_email'
  };
}

module.exports = {
  mapChannelDuplicateHandling,
  mapChannelRuleToMailroomPolicies,
  pickPrimaryChannelRule,
  hasMeaningfulChannelRule,
  mergeMailroomPolicies,
  resolveBasePoliciesForMigration,
  buildMigrationPlan
};
