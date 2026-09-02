'use strict';

/**
 * Canonical vertical labels — must match keys in onboardingVerticalTemplates.js
 * and client/src/constants/verticalOptions.js.
 */
const VERTICAL_CATALOG = Object.freeze([
  { label: 'Retail (Fashion, Electronics, Footwear, etc.)', templateKey: 'retail' },
  { label: 'Real Estate', templateKey: 'real_estate' },
  { label: 'Service-Based (Gyms, Salons)', templateKey: 'services' },
  { label: 'Education Institutes', templateKey: 'education' },
  { label: 'Healthcare Clinics', templateKey: 'healthcare' },
  { label: 'IT & SaaS Agencies', templateKey: 'saas' },
  { label: 'Auditing Firms / Inspection Services', templateKey: 'audit' },
  { label: 'Automotive Dealers', templateKey: 'automotive' },
  { label: 'Event Management Firms', templateKey: 'events' },
  { label: 'Pest Control / Facility Maintenance', templateKey: 'field_service' },
]);

const VERTICAL_LABELS = Object.freeze(VERTICAL_CATALOG.map((entry) => entry.label));

const TEMPLATE_KEY_BY_LABEL = Object.freeze(
  VERTICAL_CATALOG.reduce((acc, entry) => {
    acc[entry.label] = entry.templateKey;
    return acc;
  }, {})
);

module.exports = {
  VERTICAL_CATALOG,
  VERTICAL_LABELS,
  TEMPLATE_KEY_BY_LABEL,
};
