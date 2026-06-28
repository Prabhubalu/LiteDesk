'use strict';

const People = require('../models/People');
const Deal = require('../models/Deal');
const {
  resolveVerticalTemplate,
  getSampleContactsForTemplate
} = require('./onboardingVerticalTemplates');

async function seedSampleDataForOrganization(organization, user) {
  if (!organization?._id || !user?._id) {
    const err = new Error('Organization and user required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (organization.onboarding?.sampleDataAccepted) {
    return { skipped: true, reason: 'already_accepted' };
  }

  const existing = await People.countDocuments({
    organizationId: organization._id,
    deletedAt: null
  });
  if (existing > 0) {
    return { skipped: true, reason: 'has_data' };
  }

  const template = resolveVerticalTemplate(organization);
  const contacts = getSampleContactsForTemplate(template.key);
  const createdPeople = [];

  for (const row of contacts) {
    const person = await People.create({
      organizationId: organization._id,
      createdBy: user._id,
      assignedTo: user._id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      source: row.source || 'Sample'
    });
    createdPeople.push(person);
  }

  let deal = null;
  if (template.primaryAppKey === 'SALES' && createdPeople[0]) {
    try {
      const closeDate = new Date();
      closeDate.setDate(closeDate.getDate() + 30);
      deal = await Deal.create({
        organizationId: organization._id,
        name: 'Sample opportunity',
        assignedTo: user._id,
        contactId: createdPeople[0]._id,
        stage: 'Prospecting',
        amount: 5000,
        currency: organization.settings?.currency || 'USD',
        expectedCloseDate: closeDate
      });
    } catch (dealErr) {
      console.warn('[onboardingSampleData] Deal seed skipped:', dealErr.message);
    }
  }

  if (!organization.onboarding) {
    organization.onboarding = { steps: [] };
  }
  organization.onboarding.sampleDataAccepted = true;
  await organization.save();

  return {
    skipped: false,
    peopleCreated: createdPeople.length,
    dealCreated: Boolean(deal)
  };
}

module.exports = {
  seedSampleDataForOrganization
};
