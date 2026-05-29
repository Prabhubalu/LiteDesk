const QUOTE_SECTION_TYPES = ['standard', 'optional', 'future'];

const QUOTE_SECTION_TYPE_DEFAULT = 'standard';

const DEFAULT_SECTION_TITLE = 'General';

function assertValidSectionType(type) {
  const t = String(type || '').trim();
  if (!t) return QUOTE_SECTION_TYPE_DEFAULT;
  if (!QUOTE_SECTION_TYPES.includes(t)) {
    const err = new Error(`Invalid section type: ${t}`);
    err.code = 'VALIDATION';
    throw err;
  }
  return t;
}

module.exports = {
  QUOTE_SECTION_TYPES,
  QUOTE_SECTION_TYPE_DEFAULT,
  DEFAULT_SECTION_TITLE,
  assertValidSectionType
};
