/**
 * Platform-wide record `source` picklist — identical across all modules.
 * Single source of truth for enum validation and resolver output.
 */
const RECORD_SOURCE_VALUES = Object.freeze([
  'Direct',
  'Web Form',
  'Import',
  'API',
  'Automation',
  'AI',
  'Email',
  'Phone',
  'Chat',
  'WhatsApp',
  'Facebook',
  'LinkedIn',
  'Referral',
  'Campaign',
  'Integration',
  'Tally',
]);

const DEFAULT_RECORD_SOURCE = 'Direct';

const RECORD_SOURCE_SET = new Set(RECORD_SOURCE_VALUES);

module.exports = {
  RECORD_SOURCE_VALUES,
  DEFAULT_RECORD_SOURCE,
  RECORD_SOURCE_SET
};
