'use strict';

/**
 * Organization (CRM party) ↔ Tally Ledger (party) field mapping.
 */

function resolveLedgerParent(org = {}) {
  const types = Array.isArray(org.types) ? org.types.map((t) => String(t).toLowerCase()) : [];
  if (types.some((t) => t.includes('vendor') || t.includes('supplier'))) {
    return 'Sundry Creditors';
  }
  return 'Sundry Debtors';
}

function addressFromOrg(org = {}) {
  const structured = org.billingAddressStructured || {};
  if (structured && (structured.line1 || structured.city || structured.state)) {
    return [structured.line1, structured.line2, structured.city, structured.state, structured.postalCode]
      .filter(Boolean)
      .join(', ');
  }
  return org.address || org.shippingAddress || null;
}

/**
 * @param {object} org - Arivu CRM Organization (isTenant: false)
 * @returns {object} Tally ledger party payload (agent → XML)
 */
function toTally(org = {}) {
  return {
    masterType: 'LEDGER',
    name: org.name || null,
    parent: resolveLedgerParent(org),
    gstin: org.gstin || null,
    gstRegistrationType: org.gstRegistrationType || null,
    stateCode: org.stateCode || null,
    address: addressFromOrg(org),
    phone: org.phone || null,
    website: org.website || null,
    taxId: org.taxId || null,
    arivuId: org._id ? String(org._id) : null,
    organizationNumber: org.organizationNumber || null,
    types: Array.isArray(org.types) ? org.types : [],
  };
}

/**
 * @param {object} ledger - Tally ledger / party fields
 * @returns {object} Arivu Organization patch
 */
function fromTally(ledger = {}) {
  const parent = String(ledger.parent || ledger.PARENT || '').toLowerCase();
  const types = [];
  if (parent.includes('creditor')) types.push('Vendor');
  else if (parent.includes('debtor')) types.push('Customer');

  return {
    name: ledger.name || ledger.NAME || null,
    gstin: ledger.gstin || ledger.GSTIN || ledger.PARTYGSTIN || null,
    gstRegistrationType: ledger.gstRegistrationType || ledger.GSTREGISTRATIONTYPE || null,
    stateCode: ledger.stateCode || ledger.STATECODE || null,
    address: ledger.address || ledger.ADDRESS || null,
    phone: ledger.phone || ledger.LEDGERPHONE || null,
    website: ledger.website || null,
    taxId: ledger.taxId || ledger.INCOMETAXNUMBER || null,
    types,
    externalReferenceId: ledger.masterId || ledger.MASTERID || ledger.guid || ledger.GUID || null,
  };
}

module.exports = {
  toTally,
  fromTally,
  resolveLedgerParent,
  addressFromOrg,
};
