'use strict';

const People = require('../../models/People');
const Case = require('../../models/Case');

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  const onlyDigits = digits.replace(/\D/g, '');
  return onlyDigits.length >= 7 ? onlyDigits : '';
}

function phoneMatchVariants(normalized) {
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (normalized.length > 10) {
    variants.add(normalized.slice(-10));
  }
  if (normalized.length === 10) {
    variants.add(`91${normalized}`);
    variants.add(`1${normalized}`);
  }
  return Array.from(variants);
}

/**
 * Identify CRM records for a calling party phone number.
 * @returns {Promise<{linkedPersonId, linkedLeadId, linkedOrganizationId, linkedDealId, linkedCaseId, display}>}
 */
async function identifyCaller(organizationId, phoneNumber) {
  const empty = {
    linkedPersonId: null,
    linkedLeadId: null,
    linkedOrganizationId: null,
    linkedDealId: null,
    linkedCaseId: null,
    display: null,
  };

  const normalized = normalizePhone(phoneNumber);
  if (!organizationId || !normalized) return empty;

  const variants = phoneMatchVariants(normalized);
  const phoneOr = [];
  for (const v of variants) {
    phoneOr.push({ phone: new RegExp(`${v}$`) });
    phoneOr.push({ mobile: new RegExp(`${v}$`) });
  }

  let person = null;
  try {
    person = await People.findOne({
      organizationId,
      deletedAt: null,
      $or: phoneOr,
    })
      .select('_id firstName lastName name email phone mobile organizationId type leadStatus')
      .lean();
  } catch (err) {
    console.warn('[callerIdentificationService] people lookup failed', err.message);
  }

  if (!person) {
    return { ...empty, display: { phone: phoneNumber || normalized } };
  }

  const linkedPersonId = person._id;
  const linkedOrganizationId = person.organizationId || null;
  const isLead =
    String(person.type || '').toLowerCase() === 'lead' ||
    Boolean(person.leadStatus);

  let linkedCaseId = null;
  try {
    const openCase = await Case.findOne({
      organizationId,
      deletedAt: null,
      contactId: linkedPersonId,
      status: { $nin: ['closed', 'resolved', 'cancelled'] },
    })
      .sort({ updatedAt: -1 })
      .select('_id subject status')
      .lean();
    if (openCase) linkedCaseId = openCase._id;
  } catch {
    /* Case schema field names may vary — best effort */
  }

  let linkedDealId = null;
  try {
    const Deal = require('../../models/Deal');
    const recentDeal = await Deal.findOne({
      organizationId,
      deletedAt: null,
      $or: [{ contactId: linkedPersonId }, { personId: linkedPersonId }],
    })
      .sort({ updatedAt: -1 })
      .select('_id name title')
      .lean();
    if (recentDeal) linkedDealId = recentDeal._id;
  } catch {
    /* optional */
  }

  const displayName =
    [person.firstName, person.lastName].filter(Boolean).join(' ') ||
    person.name ||
    person.email ||
    phoneNumber;

  return {
    linkedPersonId,
    linkedLeadId: isLead ? linkedPersonId : null,
    linkedOrganizationId,
    linkedDealId,
    linkedCaseId,
    display: {
      phone: phoneNumber || normalized,
      name: displayName,
      email: person.email || null,
      personId: String(linkedPersonId),
    },
  };
}

module.exports = {
  normalizePhone,
  identifyCaller,
};
