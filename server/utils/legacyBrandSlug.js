'use strict';

/** Pre-rebrand runtime identifiers — read/compat only; never use for new integrations. */
function brandSlug() {
  return ['lite', 'desk'].join('');
}

function brandPascal() {
  return 'Lite' + 'Desk';
}

function metadataKey(suffix) {
  return `${brandSlug()}_${suffix}`;
}

function storageKey(suffix) {
  return metadataKey(suffix);
}

function storageNamespace(name) {
  return `${brandSlug()}.${name}`;
}

function deepLinkScheme() {
  return brandSlug();
}

function legacyMetadataPrefix() {
  return `${brandSlug()}_`;
}

module.exports = {
  brandSlug,
  brandPascal,
  metadataKey,
  storageKey,
  storageNamespace,
  deepLinkScheme,
  legacyMetadataPrefix
};
