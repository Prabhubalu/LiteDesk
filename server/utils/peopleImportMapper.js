const People = require('../models/People');
const {
  setSalesParticipationIn,
  extractSalesFromUpdate,
  extractHelpdeskRoleFromUpdate,
  mergeHelpdeskRoleIntoParticipations,
} = require('./syncSalesParticipation');
const { extractCustomFields, buildUpdateWithCustomFields } = require('./customFieldsExtractor');
const { stripClientSource } = require('../services/sourceResolver');

/**
 * Map a CSV row to a flat People payload using the user's field mapping.
 */
function mapRowToPeopleImportPayload(row, fieldMapping) {
  const raw = {};

  Object.keys(fieldMapping).forEach((csvField) => {
    let contactField = fieldMapping[csvField];
    if (!contactField || !row[csvField]) return;

    // Legacy API alias
    if (contactField === 'type') contactField = 'sales_type';

    if (contactField.includes('.')) {
      const [parent, child] = contactField.split('.');
      if (!raw[parent]) raw[parent] = {};
      raw[parent][child] = row[csvField];
      return;
    }

    raw[contactField] = row[csvField];
  });

  return raw;
}

/**
 * Apply SALES / HELPDESK participations and custom-field routing to an import payload.
 */
function processPeopleImportPayload(rawPayload, existingParticipations = null) {
  stripClientSource(rawPayload);

  const { helpdeskRole, cleaned: afterHelpdesk, touched: helpdeskTouched } =
    extractHelpdeskRoleFromUpdate(rawPayload);
  const { sales, cleaned: updateDataWithoutSales } = extractSalesFromUpdate(afterHelpdesk);
  const hasSalesWrite =
    sales != null &&
    (sales.role != null || sales.lead_status != null || sales.contact_status != null);

  const { standardPayload, customFieldsSet } = extractCustomFields(updateDataWithoutSales, People);
  const doc = { ...standardPayload };

  if (Object.keys(customFieldsSet).length > 0) {
    doc.customFields = customFieldsSet;
  }

  if (hasSalesWrite || helpdeskTouched) {
    let participations = { ...(existingParticipations || {}) };

    if (hasSalesWrite) {
      if (existingParticipations) {
        const prevSales = existingParticipations.SALES || {};
        participations = setSalesParticipationIn(participations, {
          role: sales.role ?? prevSales.role ?? null,
          lead_status: sales.lead_status ?? prevSales.lead_status ?? null,
          contact_status: sales.contact_status ?? prevSales.contact_status ?? null,
        });
      } else {
        participations = setSalesParticipationIn(participations, sales);
      }
    }

    if (helpdeskTouched) {
      participations = mergeHelpdeskRoleIntoParticipations(participations, helpdeskRole);
    }

    doc.participations = participations;
  }

  return doc;
}

function buildPeopleCreatePayload(rawPayload, { organizationId, userId }) {
  const doc = processPeopleImportPayload(rawPayload);
  doc.organizationId = organizationId;
  if (userId) doc.createdBy = userId;
  return doc;
}

function buildPeopleUpdateSet(rawPayload, existingPerson) {
  const doc = processPeopleImportPayload(rawPayload, existingPerson?.participations || null);
  delete doc.organizationId;
  delete doc.createdBy;
  return buildUpdateWithCustomFields(doc, People);
}

module.exports = {
  mapRowToPeopleImportPayload,
  processPeopleImportPayload,
  buildPeopleCreatePayload,
  buildPeopleUpdateSet,
};
