'use strict';

const mongoose = require('mongoose');
const People = require('../../models/People');
const Organization = require('../../models/Organization');
const { extractMergeExpressions } = require('./marketingCampaignContentValidationService');
const {
  ORGANIZATION_MERGE_SELECT,
  resolveCrmOrganizationRef
} = require('../contentPlatform/engines/dataProviderEngine');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');

const DEFAULT_PEOPLE_SELECT = new Set([
  '_id',
  'first_name',
  'last_name',
  'email',
  'phone',
  'mobile',
  'title',
  'organization'
]);

const CAMEL_ALIASES = {
  first_name: 'firstName',
  last_name: 'lastName'
};

/**
 * @param {string} subject
 * @param {string} html
 * @param {string} [text]
 */
function extractCampaignMergeExpressions(subject, html, text = '') {
  const combined = [subject, html, text].filter(Boolean).join('\n');
  return [...new Set(extractMergeExpressions(combined))];
}

/**
 * @param {string[]} expressions
 * @returns {Set<string>}
 */
function buildPeopleSelectFields(expressions) {
  const fields = new Set(DEFAULT_PEOPLE_SELECT);

  for (const expression of expressions) {
    const normalized = String(expression || '').trim();
    if (!normalized.toLowerCase().startsWith('people.')) continue;
    const leaf = normalized.split('.').slice(1).join('.');
    if (!leaf) continue;
    const schemaKey = leaf.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    fields.add(schemaKey);
    if (CAMEL_ALIASES[schemaKey]) {
      fields.add(CAMEL_ALIASES[schemaKey]);
    }
  }

  return fields;
}

/**
 * @param {object|null|undefined} person
 * @param {object|null|undefined} tenantOrganization
 * @param {object|null|undefined} crmOrganization
 */
function mapPersonToMergeScope(person, tenantOrganization, crmOrganization) {
  const firstName = String(person?.first_name || person?.firstName || '').trim();
  const lastName = String(person?.last_name || person?.lastName || '').trim();
  const email = String(person?.email || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  const peopleScope = {
    ...(person || {}),
    first_name: firstName,
    last_name: lastName,
    firstName,
    lastName,
    fullName,
    email
  };

  const orgScope = crmOrganization && typeof crmOrganization === 'object'
    ? crmOrganization
    : { name: tenantOrganization?.name || '' };

  return {
    People: peopleScope,
    Organization: orgScope,
    CurrentOrganization: tenantOrganization || {},
    personId: person?._id ? String(person._id) : undefined
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} personId
 * @param {Set<string>} [selectFields]
 */
async function loadPersonMergeContext(organizationId, personId, selectFields = DEFAULT_PEOPLE_SELECT) {
  if (!mongoose.Types.ObjectId.isValid(String(personId))) {
    return { person: null, tenantOrganization: null, crmOrganization: null };
  }

  return runWithOrganizationTenantContext(organizationId, async () => {
    const [person, tenantOrganization] = await Promise.all([
      People.findOne({
        _id: personId,
        organizationId,
        deletedAt: null
      })
        .populate({ path: 'organization', select: ORGANIZATION_MERGE_SELECT })
        .select([...selectFields].join(' '))
        .lean(),
      Organization.findById(organizationId).select('name settings.branding').lean()
    ]);

    const crmOrganization = person
      ? await resolveCrmOrganizationRef(person.organization, organizationId)
      : null;

    return { person, tenantOrganization, crmOrganization };
  });
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {{ email: string, name?: string, recipientId: string, mergeData?: object, personId?: string }[]} params.recipients
 * @param {string} [params.subject]
 * @param {string} [params.html]
 * @param {string} [params.text]
 */
async function hydrateRecipientMergeScopes(params) {
  const organizationId = params.organizationId;
  const recipients = Array.isArray(params.recipients) ? params.recipients : [];
  if (recipients.length === 0) return recipients;

  const expressions = extractCampaignMergeExpressions(
    params.subject || '',
    params.html || '',
    params.text || ''
  );
  const selectFields = buildPeopleSelectFields(expressions);

  const personIds = [
    ...new Set(
      recipients
        .map((recipient) => recipient.mergeData?.personId || recipient.personId || recipient.recipientId)
        .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
        .map(String)
    )
  ];

  /** @type {Map<string, object>} */
  const scopeByPersonId = new Map();
  if (personIds.length > 0) {
    const rows = await runWithOrganizationTenantContext(organizationId, async () =>
      People.find({
        organizationId,
        deletedAt: null,
        _id: { $in: personIds.map((id) => new mongoose.Types.ObjectId(String(id))) }
      })
        .populate({ path: 'organization', select: ORGANIZATION_MERGE_SELECT })
        .select([...selectFields].join(' '))
        .lean()
    );

    const tenantOrganization = await runWithOrganizationTenantContext(organizationId, async () =>
      Organization.findById(organizationId).select('name settings.branding').lean()
    );

    for (const person of rows) {
      const crmOrganization = await resolveCrmOrganizationRef(person.organization, organizationId);
      scopeByPersonId.set(
        String(person._id),
        mapPersonToMergeScope(person, tenantOrganization, crmOrganization)
      );
    }
  }

  return recipients.map((recipient) => {
    const personKey = String(
      recipient.mergeData?.personId || recipient.personId || recipient.recipientId || ''
    );
    const hydratedScope = scopeByPersonId.get(personKey);
    if (!hydratedScope) {
      return recipient;
    }

    return {
      ...recipient,
      mergeData: {
        ...(recipient.mergeData || {}),
        ...hydratedScope
      }
    };
  });
}

module.exports = {
  extractCampaignMergeExpressions,
  buildPeopleSelectFields,
  mapPersonToMergeScope,
  loadPersonMergeContext,
  hydrateRecipientMergeScopes
};
