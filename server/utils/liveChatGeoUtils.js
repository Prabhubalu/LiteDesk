'use strict';

const { normalizeCountry, normalizeLanguage } = require('../constants/liveChatVisitorContext');

const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-country-code',
  'cloudfront-viewer-country',
];

function resolveCountryFromRequest(req) {
  for (const header of COUNTRY_HEADERS) {
    const value = normalizeCountry(req?.headers?.[header]);
    if (value) return value;
  }
  return '';
}

function resolveLanguageFromRequest(req, bodyLanguage = '') {
  const explicit = normalizeLanguage(bodyLanguage);
  if (explicit) return explicit;

  const accept = String(req?.headers?.['accept-language'] || '').trim();
  if (!accept) return '';

  const primary = accept.split(',')[0] || '';
  return normalizeLanguage(primary.split(';')[0]);
}

module.exports = {
  resolveCountryFromRequest,
  resolveLanguageFromRequest,
};
