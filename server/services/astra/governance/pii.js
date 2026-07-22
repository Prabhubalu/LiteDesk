'use strict';

/**
 * PII governance — reuse the existing redaction engine. Defense-in-depth before
 * any prompt leaves the platform. Field-level ACL + tenant isolation still apply.
 */

const {
  redactText,
  redactMessages,
  redactOptionsFromAiSettings,
} = require('../../ai/piiRedaction');

/**
 * Redact an array of chat messages before sending to a provider.
 * @param {Array<{role?: string, content?: string}>} messages
 * @param {{ piiCustomRules?: object[], preserveEmails?: boolean }} [aiSettings]
 */
function scrubMessages(messages, aiSettings = {}) {
  const options = redactOptionsFromAiSettings(aiSettings, {
    preserveEmails: Boolean(aiSettings.preserveEmails),
  });
  return redactMessages(messages, options);
}

module.exports = {
  redactText,
  scrubMessages,
};
