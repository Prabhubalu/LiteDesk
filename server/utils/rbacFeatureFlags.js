/**
 * RBAC v2 + Sharing v1 feature flags.
 * Default: off — legacy behavior until org or env enables.
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
function isRbacV2Enabled(organization) {
  const env = envFlag('RBAC_V2');
  if (env !== null) return env;
  return organization?.settings?.rbacV2Enabled === true;
}

/**
 * @param {object|null|undefined} organization
 */
function isSharingV1Enabled(organization) {
  const env = envFlag('SHARING_V1');
  if (env !== null) return env;
  return organization?.settings?.sharingV1Enabled === true;
}

/** New org registration uses v2 seed when global env is on. */
function shouldSeedRbacV2ForNewOrganization() {
  return process.env.RBAC_V2 === 'true';
}

/** Org settings for new tenant signup — RBAC v2 + sharing enabled together. */
function getNewOrganizationRbacSettings() {
  const enabled = shouldSeedRbacV2ForNewOrganization();
  return {
    rbacV2Enabled: enabled,
    sharingV1Enabled: enabled
  };
}

const ZERO_LEGACY_ROLE_CAPABILITIES = Object.freeze({
  canViewAllData: false,
  canManageTeam: false,
  canExportData: false
});

/**
 * RBAC v2: legacy role capability booleans are not used — module matrix + sharing only.
 * @param {object|null|undefined} roleLean
 * @param {object|null|undefined} organization
 * @returns {object|null|undefined}
 */
function withoutLegacyCapabilitiesWhenRbacV2(roleLean, organization) {
  if (!roleLean || !isRbacV2Enabled(organization)) return roleLean;
  return {
    ...roleLean,
    ...ZERO_LEGACY_ROLE_CAPABILITIES
  };
}

/**
 * @param {object|null|undefined} organization
 */
function legacyRoleCapabilitiesForPersistence(organization) {
  if (isRbacV2Enabled(organization)) {
    return { ...ZERO_LEGACY_ROLE_CAPABILITIES };
  }
  return null;
}

module.exports = {
  isRbacV2Enabled,
  isSharingV1Enabled,
  shouldSeedRbacV2ForNewOrganization,
  getNewOrganizationRbacSettings,
  withoutLegacyCapabilitiesWhenRbacV2,
  legacyRoleCapabilitiesForPersistence,
  ZERO_LEGACY_ROLE_CAPABILITIES
};
