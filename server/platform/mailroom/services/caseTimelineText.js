'use strict';

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function messageBodyText(msg) {
  const text = String(msg?.body || '').trim();
  if (text) return text;
  return stripHtml(msg?.htmlBody);
}

module.exports = {
  stripHtml,
  messageBodyText
};
