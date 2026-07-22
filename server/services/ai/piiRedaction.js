/**
 * Minimal PII / secret redaction before provider calls.
 * Defense-in-depth — not a substitute for field-level ACL.
 */

const MAX_CUSTOM_RULES = 20;
const MAX_PATTERN_LEN = 200;
const MAX_LABEL_LEN = 80;
const MAX_REPLACEMENT_LEN = 40;

const PATTERNS = [
  {
    name: 'email',
    label: 'Email addresses',
    description: 'Addresses like name@company.com are replaced with [EMAIL] before the model sees the prompt.',
    example: 'ada@example.com → [EMAIL]',
    replacement: '[EMAIL]',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    alwaysRedacted: false,
    note: 'May be kept only when Astra is drafting or sending email (To / Subject / Body), so staff can complete outreach.',
  },
  {
    name: 'email',
    label: 'Email addresses',
    description: 'Addresses like name@company.com are replaced with [EMAIL] before the model sees the prompt.',
    example: 'ada@example.com → [EMAIL]',
    replacement: '[EMAIL]',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    alwaysRedacted: false,
    note: 'May be kept only when Astra is drafting or sending email (To / Subject / Body), so staff can complete outreach.',
  },
  {
    name: 'creditCard',
    label: 'Payment card numbers',
    description: 'Long digit sequences that look like card numbers are replaced with [CARD].',
    example: '4111 1111 1111 1111 → [CARD]',
    replacement: '[CARD]',
    // Prefer card-shaped groups; avoid swallowing intl phone prefixes like 0091…
    regexes: [
      /\b(?:\d{4}[ -]*){3}\d{1,4}\b/g,
      /\b\d{13,19}\b/g,
    ],
    alwaysRedacted: true,
  },
  {
    name: 'phone',
    label: 'Phone numbers',
    description: 'Phone and mobile-style numbers are replaced with [PHONE], including India (+91 / 10-digit mobiles) and common international formats.',
    example: '+91 98765 43210 → [PHONE]',
    replacement: '[PHONE]',
    // India regexes run first (before cards) via PHONE_INDIA_REGEXES in redactText.
    regexes: [
      // Generic intl / US-style
      /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g,
    ],
    alwaysRedacted: true,
  },
  {
    name: 'bearerToken',
    label: 'Bearer tokens',
    description: 'Authorization Bearer tokens are stripped before provider calls.',
    example: 'Bearer eyJ… → Bearer [REDACTED]',
    replacement: 'Bearer [REDACTED]',
    regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
    alwaysRedacted: true,
  },
  {
    name: 'apiKey',
    label: 'API keys',
    description: 'Provider-style secret keys (sk_, pk_, api_…) are replaced with [API_KEY].',
    example: 'sk_live_… → [API_KEY]',
    replacement: '[API_KEY]',
    regex: /\b(?:sk|pk|rk|api)[_-][A-Za-z0-9_]{16,}\b/gi,
    alwaysRedacted: true,
  },
  {
    name: 'jwt',
    label: 'JSON Web Tokens (JWT)',
    description: 'JWT-shaped strings are replaced with [JWT].',
    example: 'eyJhbGciOi… → [JWT]',
    replacement: '[JWT]',
    regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    alwaysRedacted: true,
  },
];

/** Applied before card redaction so India numbers are not mistaken for cards. */
const PHONE_INDIA_REGEXES = [
  // +91 with 10 digits or common groupings (5-5, 3-3-4, 4-6)
  /\+91[-.\s]?(?:\d{10}|\d{5}[-.\s]?\d{5}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{4}[-.\s]?\d{6})/g,
  // 0091 international prefix
  /\b0091[-.\s]?\d{10}\b/g,
  // India landline: 0 + STD (2–4 digits) + subscriber
  /\b0(?:\d{2}[-.\s]?\d{8}|\d{3}[-.\s]?\d{7}|\d{4}[-.\s]?\d{6})\b/g,
  // India mobile (10 digits, starts 6–9)
  /\b[6-9]\d{9}\b/g,
];

function escapeRegexLiteral(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSafeRegexSource(source = '') {
  const s = String(source || '');
  if (s.length > MAX_PATTERN_LEN) return false;
  // Basic ReDoS guard — nested quantifiers on groups
  if (/\([^)]*[+*][^)]*\)[+*]/.test(s)) return false;
  if (/\(\?[^)]*[+*]/.test(s)) return false;
  return true;
}

function compileCustomRegex(rule = {}) {
  const matchType = rule.matchType === 'literal' ? 'literal' : 'regex';
  const pattern = String(rule.pattern || '').trim();
  if (!pattern || !isSafeRegexSource(pattern)) {
    throw new Error('Invalid or unsafe pattern');
  }
  try {
    if (matchType === 'literal') {
      return new RegExp(escapeRegexLiteral(pattern), 'gi');
    }
    return new RegExp(pattern, 'gi');
  } catch {
    throw new Error('Invalid regular expression');
  }
}

/**
 * Validate one custom rule (throws AiConfigurationError-compatible errors via message).
 * @returns {object} normalized rule for storage
 */
function validateCustomPiiRule(rule = {}, index = 0) {
  const label = String(rule.label || '').trim();
  const pattern = String(rule.pattern || '').trim();
  let replacement = String(rule.replacement || '[CUSTOM]').trim() || '[CUSTOM]';
  const matchType = rule.matchType === 'literal' ? 'literal' : 'regex';

  if (!label || label.length > MAX_LABEL_LEN) {
    throw new Error(`Custom PII rule ${index + 1}: label is required (max ${MAX_LABEL_LEN} chars)`);
  }
  if (!pattern || pattern.length > MAX_PATTERN_LEN) {
    throw new Error(`Custom PII rule "${label}": pattern is required (max ${MAX_PATTERN_LEN} chars)`);
  }
  if (replacement.length > MAX_REPLACEMENT_LEN) {
    throw new Error(`Custom PII rule "${label}": replacement too long`);
  }
  if (!/^\[[A-Z0-9_]{1,30}\]$/.test(replacement)) {
    replacement = '[CUSTOM]';
  }

  compileCustomRegex({ pattern, matchType });

  const id = String(rule.id || `custom_${index + 1}`).trim().slice(0, 64)
    || `custom_${index + 1}`;

  return {
    id,
    label,
    pattern,
    replacement,
    matchType,
    enabled: rule.enabled !== false,
  };
}

/** Normalize custom rules for API responses (includes disabled). */
function normalizeCustomPiiRulesForDisplay(rules = []) {
  if (!Array.isArray(rules)) return [];
  return rules.slice(0, MAX_CUSTOM_RULES).map((row, index) => {
    try {
      return validateCustomPiiRule(row, index);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/** Enabled rules compiled for runtime redaction. */
function compileCustomPiiRules(rules = []) {
  return normalizeCustomPiiRulesForDisplay(rules)
    .filter((r) => r.enabled)
    .map((row) => ({
      ...row,
      regex: compileCustomRegex(row),
    }));
}

/**
 * Staff-facing catalog of what is scrubbed from AI prompts (no regex objects).
 * @param {object[]} customRules
 */
function getPiiRedactionCatalog(customRules = []) {
  const builtIn = PATTERNS.map((p) => ({
    id: p.name,
    label: p.label,
    description: p.description,
    example: p.example,
    placeholder: p.replacement,
    alwaysRedacted: Boolean(p.alwaysRedacted),
    note: p.note || null,
    custom: false,
    enabled: true,
    pattern: null,
    matchType: null,
  }));

  const custom = normalizeCustomPiiRulesForDisplay(customRules).map((r) => ({
    id: r.id,
    label: r.label,
    description: r.matchType === 'literal'
      ? `Text match: "${r.pattern}" is replaced before the model sees the prompt.`
      : `Pattern /${r.pattern}/ is replaced before the model sees the prompt.`,
    example: `${r.pattern} → ${r.replacement}`,
    placeholder: r.replacement,
    alwaysRedacted: true,
    note: null,
    custom: true,
    enabled: r.enabled,
    pattern: r.pattern,
    matchType: r.matchType,
  }));

  return {
    title: 'Data not sent to AI providers',
    summary:
      'Before Arivu calls an LLM provider, prompts are scanned and sensitive values below are replaced with placeholders. This is defense-in-depth — permissions and tenant isolation still apply.',
    items: [...builtIn, ...custom],
    customRules: custom,
    maxCustomRules: MAX_CUSTOM_RULES,
  };
}

function sanitizeCustomPiiRulesForStorage(rules = []) {
  if (!Array.isArray(rules)) {
    throw new Error('piiCustomRules must be an array');
  }
  if (rules.length > MAX_CUSTOM_RULES) {
    throw new Error(`Maximum ${MAX_CUSTOM_RULES} custom PII rules allowed`);
  }
  return rules.map((row, index) => validateCustomPiiRule(row, index));
}

/**
 * @param {string} input
 * @param {{ preserveEmails?: boolean, customRules?: object[] }} [options]
 */
function redactText(input, options = {}) {
  let text = String(input || '');
  const preserveEmails = Boolean(options.preserveEmails);
  const customCompiled = compileCustomPiiRules(options.customRules);

  // India phones before card patterns (0091… can look card-like).
  for (const re of PHONE_INDIA_REGEXES) {
    text = text.replace(re, '[PHONE]');
  }

  for (const pattern of PATTERNS) {
    if (preserveEmails && pattern.name === 'email') continue;
    const list = Array.isArray(pattern.regexes)
      ? pattern.regexes
      : (pattern.regex ? [pattern.regex] : []);
    for (const re of list) {
      text = text.replace(re, pattern.replacement);
    }
  }

  for (const rule of customCompiled) {
    text = text.replace(rule.regex, rule.replacement);
  }

  return text;
}

/**
 * @param {Array<{ role?: string, content?: string }>} messages
 * @param {{ preserveEmails?: boolean, customRules?: object[] }} [options]
 */
function redactMessages(messages, options = {}) {
  return (messages || []).map((message) => ({
    ...message,
    content: redactText(message.content, options),
  }));
}

/** Build redact options from org aiSettings slice. */
function redactOptionsFromAiSettings(aiSettings = {}, extra = {}) {
  return {
    ...extra,
    customRules: Array.isArray(aiSettings?.piiCustomRules)
      ? aiSettings.piiCustomRules
      : [],
  };
}

module.exports = {
  redactText,
  redactMessages,
  getPiiRedactionCatalog,
  normalizeCustomPiiRulesForDisplay,
  sanitizeCustomPiiRulesForStorage,
  compileCustomPiiRules,
  redactOptionsFromAiSettings,
  MAX_CUSTOM_RULES,
};
