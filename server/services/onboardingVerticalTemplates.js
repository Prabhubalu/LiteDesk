'use strict';

/**
 * Maps organization vertical (industry) to onboarding emphasis and sample data templates.
 */
const VERTICAL_TEMPLATES = Object.freeze({
  default: {
    key: 'sales_default',
    primaryModules: ['people', 'deals'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateSalesDefault'
  },
  'Retail (Fashion, Electronics, Footwear, etc.)': {
    key: 'retail',
    primaryModules: ['people', 'deals', 'items'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateRetail'
  },
  'Real Estate': {
    key: 'real_estate',
    primaryModules: ['people', 'deals', 'organizations'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateRealEstate'
  },
  'Service-Based (Gyms, Salons)': {
    key: 'services',
    primaryModules: ['people', 'tasks'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateServices'
  },
  'Education Institutes': {
    key: 'education',
    primaryModules: ['people', 'tasks', 'events'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateEducation'
  },
  'Healthcare Clinics': {
    key: 'healthcare',
    primaryModules: ['people', 'tasks'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateHealthcare'
  },
  'IT & SaaS Agencies': {
    key: 'saas',
    primaryModules: ['people', 'deals', 'tasks'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateSaas'
  },
  'Auditing Firms / Inspection Services': {
    key: 'audit',
    primaryModules: ['assignments'],
    primaryAppKey: 'AUDIT',
    emptyStateCopyKey: 'onboarding.emptyStateAudit'
  },
  'Automotive Dealers': {
    key: 'automotive',
    primaryModules: ['people', 'deals', 'organizations'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateAutomotive'
  },
  'Event Management Firms': {
    key: 'events',
    primaryModules: ['people', 'events', 'tasks'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateEvents'
  },
  'Pest Control / Facility Maintenance': {
    key: 'field_service',
    primaryModules: ['people', 'tasks'],
    primaryAppKey: 'SALES',
    emptyStateCopyKey: 'onboarding.emptyStateFieldService'
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
  services: [
    { first_name: 'Jamie', last_name: 'Walsh', email: 'jamie.walsh@example.com', source: 'Sample' },
    { first_name: 'Robin', last_name: 'Hayes', email: 'robin.hayes@example.com', source: 'Sample' },
    { first_name: 'Skylar', last_name: 'Reed', email: 'skylar.reed@example.com', source: 'Sample' }
  ],
  education: [
    { first_name: 'Priya', last_name: 'Sharma', email: 'priya.sharma@example.com', source: 'Sample' },
    { first_name: 'Ethan', last_name: 'Cole', email: 'ethan.cole@example.com', source: 'Sample' },
    { first_name: 'Mia', last_name: 'Torres', email: 'mia.torres@example.com', source: 'Sample' }
  ],
  healthcare: [
    { first_name: 'Noah', last_name: 'Bennett', email: 'noah.bennett@example.com', source: 'Sample' },
    { first_name: 'Emma', last_name: 'Liu', email: 'emma.liu@example.com', source: 'Sample' },
    { first_name: 'Omar', last_name: 'Hassan', email: 'omar.hassan@example.com', source: 'Sample' }
  ],
  saas: [
    { first_name: 'Avery', last_name: 'Kim', email: 'avery.kim@example.com', source: 'Sample' },
    { first_name: 'Blake', last_name: 'Singh', email: 'blake.singh@example.com', source: 'Sample' },
    { first_name: 'Cameron', last_name: 'Okafor', email: 'cameron.okafor@example.com', source: 'Sample' }
  ],
  audit: [
    { first_name: 'Leslie', last_name: 'Grant', email: 'leslie.grant@example.com', source: 'Sample' },
    { first_name: 'Marcus', last_name: 'Bell', email: 'marcus.bell@example.com', source: 'Sample' },
    { first_name: 'Helen', last_name: 'Price', email: 'helen.price@example.com', source: 'Sample' }
  ],
  automotive: [
    { first_name: 'Carlos', last_name: 'Mendez', email: 'carlos.mendez@example.com', source: 'Sample' },
    { first_name: 'Hannah', last_name: 'Stein', email: 'hannah.stein@example.com', source: 'Sample' },
    { first_name: 'Raj', last_name: 'Malhotra', email: 'raj.malhotra@example.com', source: 'Sample' }
  ],
  events: [
    { first_name: 'Sophie', last_name: 'Laurent', email: 'sophie.laurent@example.com', source: 'Sample' },
    { first_name: 'Daniel', last_name: 'Okonkwo', email: 'daniel.okonkwo@example.com', source: 'Sample' },
    { first_name: 'Isabella', last_name: 'Romero', email: 'isabella.romero@example.com', source: 'Sample' }
  ],
  field_service: [
    { first_name: 'Mike', last_name: 'Sullivan', email: 'mike.sullivan@example.com', source: 'Sample' },
    { first_name: 'Nina', last_name: 'Patel', email: 'nina.patel@example.com', source: 'Sample' },
    { first_name: 'Greg', last_name: 'Turner', email: 'greg.turner@example.com', source: 'Sample' }
  ]
});

const SAMPLE_DEAL_NAMES = Object.freeze({
  sales_default: 'Sample opportunity',
  retail: 'Sample retail sale',
  real_estate: 'Sample property deal',
  services: 'Sample membership',
  education: 'Sample admission application',
  healthcare: 'Sample treatment plan',
  saas: 'Sample SaaS opportunity',
  audit: 'Sample inspection contract',
  automotive: 'Sample vehicle sale',
  events: 'Sample event contract',
  field_service: 'Sample service contract',
});

function resolveVerticalTemplate(organization) {
  const industry = String(organization?.industry || '').trim();
  return VERTICAL_TEMPLATES[industry] || VERTICAL_TEMPLATES.default;
}

function resolveTemplateByKey(templateKey) {
  const key = String(templateKey || 'sales_default').trim();
  if (key === 'sales_default') {
    return { ...VERTICAL_TEMPLATES.default };
  }
  for (const template of Object.values(VERTICAL_TEMPLATES)) {
    if (template.key === key) {
      return { ...template };
    }
  }
  return { ...VERTICAL_TEMPLATES.default };
}

function getSampleContactsForTemplate(templateKey) {
  return SAMPLE_DATA_SETS[templateKey] || SAMPLE_DATA_SETS.sales_default;
}

function getSampleDealNameForTemplate(templateKey) {
  return SAMPLE_DEAL_NAMES[templateKey] || SAMPLE_DEAL_NAMES.sales_default;
}

module.exports = {
  VERTICAL_TEMPLATES,
  SAMPLE_DATA_SETS,
  SAMPLE_DEAL_NAMES,
  resolveVerticalTemplate,
  resolveTemplateByKey,
  getSampleContactsForTemplate,
  getSampleDealNameForTemplate,
};
