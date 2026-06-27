'use strict';

/**
 * External User / Portal Framework feature flag.
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md
 */

function envFlag(name) {
  const v = process.env[name];
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

/**
 * @param {object|null|undefined} organization
 */
function isPortalFrameworkV1Enabled(organization) {
  const env = envFlag('PORTAL_FRAMEWORK_V1');
  if (env !== null) return env;
  return organization?.settings?.portalFrameworkV1Enabled === true;
}

module.exports = {
  isPortalFrameworkV1Enabled
};
