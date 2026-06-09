'use strict';

/**
 * Maps organization vertical (industry) to onboarding emphasis and sample data templates.
 */
const VERTICAL_TEMPLATES = Object.freeze({
  default: {
    key: 'sales_default',
    primaryModules: ['people', 'deals'],
    primaryAppKey: 'SALES'
  },
  'Retail (Fashion, Electronics, Footwear, etc.)': {
    key: 'retail',
    primaryModules: ['people', 'deals', 'items'],
    primaryAppKey: 'SALES'
  },
  'Real Estate': {
    key: 'real_estate',
    primaryModules: ['people', 'deals', 'organizations'],
    primaryAppKey: 'SALES'
  },
  'Service-Based (Gyms, Salons)': {
    key: 'services',
    primaryModules: ['people', 'tasks'],
    primaryAppKey: 'SALES'
  },
  'Education Institutes': {
    key: 'education',
    primaryModules: ['people', 'tasks', 'events'],
    primaryAppKey: 'SALES'
  },
  'Healthcare Clinics': {
    key: 'healthcare',
    primaryModules: ['people', 'tasks'],
    primaryAppKey: 'SALES'
  },
  'IT & SaaS Agencies': {
    key: 'saas',
    primaryModules: ['people', 'deals', 'tasks'],
    primaryAppKey: 'SALES'
  },
  'Auditing Firms / Inspection Services': {
    key: 'audit',
    primaryModules: ['assignments'],
    primaryAppKey: 'AUDIT'
  },
  'Automotive Dealers': {
    key: 'automotive',
    primaryModules: ['people', 'deals', 'organizations'],
    primaryAppKey: 'SALES'
  },
  'Event Management Firms': {
    key: 'events',
    primaryModules: ['people', 'events', 'tasks'],
    primaryAppKey: 'SALES'
  },
  'Pest Control / Facility Maintenance': {
    key: 'field_service',
    primaryModules: ['people', 'tasks'],
    primaryAppKey: 'SALES'
  }
});

const SAMPLE_DATA_SETS = Object.freeze({
  sales_default: [
    { first_name: 'Alex', last_name: 'Rivera', email: 'alex.rivera@example.com', source: 'Sample' },
    { first_name: 'Jordan', last_name: 'Lee', email: 'jordan.lee@example.com', source: 'Sample' },
    { first_name: 'Sam', last_name: 'Patel', email: 'sam.patel@example.com', source: 'Sample' }
  ],
  retail: [
    { first_name: 'Morgan', last_name: 'Chen', email: 'morgan.chen@example.com', source: 'Sample' },
    { first_name: 'Taylor', last_name: 'Brooks', email: 'taylor.brooks@example.com', source: 'Sample' },
    { first_name: 'Casey', last_name: 'Wright', email: 'casey.wright@example.com', source: 'Sample' }
  ],
  real_estate: [
    { first_name: 'Dana', last_name: 'Morales', email: 'dana.morales@example.com', source: 'Sample' },
    { first_name: 'Riley', last_name: 'Nguyen', email: 'riley.nguyen@example.com', source: 'Sample' },
    { first_name: 'Quinn', last_name: 'Foster', email: 'quinn.foster@example.com', source: 'Sample' }
  ],
  saas: [
    { first_name: 'Avery', last_name: 'Kim', email: 'avery.kim@example.com', source: 'Sample' },
    { first_name: 'Blake', last_name: 'Singh', email: 'blake.singh@example.com', source: 'Sample' },
    { first_name: 'Cameron', last_name: 'Okafor', email: 'cameron.okafor@example.com', source: 'Sample' }
  ]
});

function resolveVerticalTemplate(organization) {
  const industry = String(organization?.industry || '').trim();
  return VERTICAL_TEMPLATES[industry] || VERTICAL_TEMPLATES.default;
}

function getSampleContactsForTemplate(templateKey) {
  return SAMPLE_DATA_SETS[templateKey] || SAMPLE_DATA_SETS.sales_default;
}

module.exports = {
  VERTICAL_TEMPLATES,
  SAMPLE_DATA_SETS,
  resolveVerticalTemplate,
  getSampleContactsForTemplate
};
