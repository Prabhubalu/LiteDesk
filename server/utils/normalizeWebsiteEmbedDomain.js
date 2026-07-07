'use strict';

const BLOCKED_HOSTS = new Set(['0.0.0.0']);

function invalidDomainError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_EMBED_WEBSITE_DOMAIN';
  return error;
}

function isLocalhostHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1';
}

function normalizeWebsiteEmbedDomain(raw, { allowLocalhost = false } = {}) {
  const input = String(raw || '').trim();
  if (!input) {
    return { domain: '', origins: [] };
  }

  let parsed;
  try {
    parsed = input.includes('://') ? new URL(input) : new URL(`https://${input}`);
  } catch (_error) {
    throw invalidDomainError('Enter a valid website domain, e.g. www.example.com');
  }

  if (parsed.username || parsed.password) {
    throw invalidDomainError('Enter only your website domain, not a login URL');
  }

  const pathname = String(parsed.pathname || '');
  if (pathname && pathname !== '/') {
    throw invalidDomainError('Enter only your website domain, not a page path');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) {
    throw invalidDomainError('Enter a valid website domain');
  }

  if (BLOCKED_HOSTS.has(hostname)) {
    throw invalidDomainError('Enter a valid public website domain');
  }

  if (isLocalhostHost(hostname)) {
    if (!allowLocalhost) {
      throw invalidDomainError('Use your public website domain, not localhost');
    }
    const protocol = input.includes('https://') ? 'https:' : 'http:';
    const origin = `${protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    return { domain: hostname, origins: [origin] };
  }

  if (!hostname.includes('.')) {
    throw invalidDomainError('Enter a valid website domain, e.g. www.example.com');
  }

  const protocol = parsed.protocol === 'http:' ? 'http:' : 'https:';
  const origins = new Set([`${protocol}//${hostname}`]);

  if (hostname.startsWith('www.')) {
    origins.add(`${protocol}//${hostname.slice(4)}`);
  } else {
    origins.add(`${protocol}//www.${hostname}`);
  }

  return {
    domain: hostname,
    origins: [...origins],
  };
}

module.exports = {
  normalizeWebsiteEmbedDomain,
  isLocalhostHost,
};
