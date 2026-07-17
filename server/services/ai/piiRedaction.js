/**
 * Minimal PII / secret redaction before provider calls.
 * Defense-in-depth — not a substitute for field-level ACL.
 */

const PATTERNS = [
  { name: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[EMAIL]' },
  { name: 'creditCard', regex: /\b(?:\d[ -]*?){13,19}\b/g, replacement: '[CARD]' },
  { name: 'phone', regex: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g, replacement: '[PHONE]' },
  { name: 'bearerToken', regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, replacement: 'Bearer [REDACTED]' },
  { name: 'apiKey', regex: /\b(?:sk|pk|rk|api)[_-][A-Za-z0-9_]{16,}\b/gi, replacement: '[API_KEY]' },
  { name: 'jwt', regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: '[JWT]' },
];

/**
 * @param {string} input
 * @param {{ preserveEmails?: boolean }} [options]
 */
function redactText(input, options = {}) {
  let text = String(input || '');
  const preserveEmails = Boolean(options.preserveEmails);
  for (const pattern of PATTERNS) {
    if (preserveEmails && pattern.name === 'email') continue;
    text = text.replace(pattern.regex, pattern.replacement);
  }
  return text;
}

/**
 * @param {Array<{ role?: string, content?: string }>} messages
 * @param {{ preserveEmails?: boolean }} [options]
 */
function redactMessages(messages, options = {}) {
  return (messages || []).map((message) => ({
    ...message,
    content: redactText(message.content, options),
  }));
}

module.exports = {
  redactText,
  redactMessages,
};
