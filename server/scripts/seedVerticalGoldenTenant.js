#!/usr/bin/env node
'use strict';

/**
 * Seed a golden reference tenant for a vertical (local dev / QA).
 *
 * Usage:
 *   node scripts/seedVerticalGoldenTenant.js retail
 *   node scripts/seedVerticalGoldenTenant.js "Healthcare Clinics"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Role = require('../models/Role');
const { VERTICAL_CATALOG, TEMPLATE_KEY_BY_LABEL } = require('../constants/verticalCatalog');
const { resolveTemplateByKey } = require('../services/onboardingVerticalTemplates');
const {
  buildEnabledAppsArray,
  resolveEnabledModulesFromTemplate,
  applyVerticalPresets,
} = require('../services/verticalPresetService');

function resolveIndustryInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (TEMPLATE_KEY_BY_LABEL[raw]) return raw;

  const byKey = VERTICAL_CATALOG.find((entry) => entry.templateKey === raw);
  if (byKey) return byKey.label;

  return null;
}

async function main() {
  const input = process.argv[2];
  const industry = resolveIndustryInput(input);
  if (!industry) {
    console.error('Usage: node scripts/seedVerticalGoldenTenant.js <vertical-label-or-template-key>');
    console.error('Examples: retail | "Healthcare Clinics" | real_estate');
    process.exit(1);
  }

  const template = resolveTemplateByKey(TEMPLATE_KEY_BY_LABEL[industry] || input);
  const slugBase = `golden-${template.key}`;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/arivu_master';
  await mongoose.connect(uri);
  console.log(`Connected: ${mongoose.connection.name}`);

  let org = await Organization.findOne({ slug: slugBase, isTenant: true });
  if (!org) {
    org = await Organization.create({
      name: `Golden ${template.key}`,
      slug: slugBase,
      industry,
      isTenant: true,
      isActive: true,
      subscription: {
        tier: 'trial',
        status: 'trial',
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
      enabledModules: resolveEnabledModulesFromTemplate(template.key),
      enabledApps: buildEnabledAppsArray(template.key, { includeOptional: true }),
    });
    console.log('Created org:', org._id.toString());
  } else {
    org.industry = industry;
    org.enabledModules = resolveEnabledModulesFromTemplate(template.key);
    org.enabledApps = buildEnabledAppsArray(template.key, { includeOptional: true });
    await org.save();
    console.log('Reusing org:', org._id.toString());
  }

  try {
    await Role.createDefaultRoles(org._id);
  } catch (roleErr) {
    console.warn('Role seed skipped:', roleErr.message);
  }

  const presetResult = await applyVerticalPresets(org._id, template.key, { force: true });
  console.log('Preset apply:', presetResult);

  const ownerEmail = `golden+${template.key}@arivu.local`;
  let owner = await User.findOne({ organizationId: org._id, email: ownerEmail });
  if (!owner) {
    const password = await bcrypt.hash('GoldenTenant123!', 10);
    owner = await User.create({
      organizationId: org._id,
      username: `golden_${template.key}`,
      email: ownerEmail,
      password,
      role: 'owner',
      isOwner: true,
      status: 'active',
      userType: 'INTERNAL',
      allowedApps: buildEnabledAppsArray(template.key, { includeOptional: true }).map((entry) => entry.appKey),
    });
    owner.setPermissionsByRole('owner');
    await owner.save();
  }

  console.log('\nGolden tenant ready');
  console.log('  Vertical:', industry);
  console.log('  Template:', template.key);
  console.log('  Org slug:', org.slug);
  console.log('  Login:', ownerEmail);
  console.log('  Password: GoldenTenant123!');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
