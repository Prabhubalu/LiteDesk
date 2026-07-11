const test = require('node:test');
const assert = require('node:assert/strict');
const { getBaseFieldsForKey } = require('../../controllers/moduleController');
const {
  isTenantPlatformOrganizationFieldPath,
} = require('../organizationTenantPlatformFields');

test('isTenantPlatformOrganizationFieldPath matches tenant infrastructure roots and nested paths', () => {
  assert.equal(isTenantPlatformOrganizationFieldPath('onboarding'), true);
  assert.equal(isTenantPlatformOrganizationFieldPath('onboarding.setupCompletedAt'), true);
  assert.equal(isTenantPlatformOrganizationFieldPath('embed.chat.enabled'), true);
  assert.equal(isTenantPlatformOrganizationFieldPath('usage.externalUsers.active'), true);
  assert.equal(isTenantPlatformOrganizationFieldPath('emailMergeTagMappings'), true);
  assert.equal(isTenantPlatformOrganizationFieldPath('emailExternalCssAllowlist'), true);
  assert.equal(isTenantPlatformOrganizationFieldPath('settings.timeZone'), true);
  assert.equal(isTenantPlatformOrganizationFieldPath('name'), false);
  assert.equal(isTenantPlatformOrganizationFieldPath('customerStatus'), false);
});

test('getBaseFieldsForKey(organizations) excludes tenant platform infrastructure paths', () => {
  const keys = getBaseFieldsForKey('organizations').map((field) => field.key);

  assert.ok(keys.includes('name'));
  assert.ok(keys.includes('customerStatus'));
  assert.equal(keys.some((key) => String(key).startsWith('onboarding.')), false);
  assert.equal(keys.some((key) => String(key).startsWith('embed.')), false);
  assert.equal(keys.some((key) => String(key).startsWith('usage.')), false);
  assert.equal(keys.some((key) => String(key).startsWith('settings.')), false);
  assert.equal(keys.includes('emailMergeTagMappings'), false);
  assert.equal(keys.includes('emailExternalCssAllowlist'), false);
  assert.equal(keys.includes('partnerOnboardingSteps'), false);
});
