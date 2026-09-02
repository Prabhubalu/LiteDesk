'use strict';

const People = require('../models/People');
const Deal = require('../models/Deal');
const Organization = require('../models/Organization');
const {
  resolveVerticalTemplate,
  getSampleContactsForTemplate,
  getSampleDealNameForTemplate,
} = require('./onboardingVerticalTemplates');

async function seedSampleDataForOrganization(organization, user, options = {}) {
  const { force = false } = options;

  if (!organization?._id || !user?._id) {
    const err = new Error('Organization and user required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const orgDoc = organization.save
    ? organization
    : await Organization.findById(organization._id);

  if (!orgDoc) {
    const err = new Error('Organization not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (!force && orgDoc.onboarding?.sampleDataAccepted) {
    return { skipped: true, reason: 'already_accepted' };
  }

  const existing = await People.countDocuments({
    organizationId: orgDoc._id,
    deletedAt: null,
  });
  if (!force && existing > 0) {
    return { skipped: true, reason: 'has_data' };
  }

  const template = resolveVerticalTemplate(orgDoc);
  const contacts = getSampleContactsForTemplate(template.key);
  const createdPeople = [];

  for (const row of contacts) {
    const person = await People.create({
      organizationId: orgDoc._id,
      createdBy: user._id,
      assignedTo: user._id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      source: row.source || 'Sample',
    });
    createdPeople.push(person);
  }

  let deal = null;
  if (template.primaryAppKey === 'SALES' && createdPeople[0]) {
    try {
      const closeDate = new Date();
      closeDate.setDate(closeDate.getDate() + 30);
      deal = await Deal.create({
        organizationId: orgDoc._id,
        name: getSampleDealNameForTemplate(template.key),
        assignedTo: user._id,
        contactId: createdPeople[0]._id,
        stage: 'Prospecting',
        amount: 5000,
        currency: orgDoc.settings?.currency || 'USD',
        expectedCloseDate: closeDate,
      });
    } catch (dealErr) {
      console.warn('[onboardingSampleData] Deal seed skipped:', dealErr.message);
    }
  }

  if (!orgDoc.onboarding) {
    orgDoc.onboarding = { steps: [] };
  }
  orgDoc.onboarding.sampleDataAccepted = true;
  await orgDoc.save();

  return {
    skipped: false,
    peopleCreated: createdPeople.length,
    dealCreated: Boolean(deal),
    templateKey: template.key,
  };
}

module.exports = {
  seedSampleDataForOrganization,
};
