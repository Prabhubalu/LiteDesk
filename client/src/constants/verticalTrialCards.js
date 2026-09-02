/**
 * Consumer-facing copy for trial industry cards — keyed by server templateKey.
 */
export const VERTICAL_TRIAL_CARDS_BY_TEMPLATE = Object.freeze({
  retail: {
    title: 'Retail',
    subtitle: 'Fashion, electronics, footwear & product-led stores',
    suite: 'Sales workspace',
  },
  real_estate: {
    title: 'Real Estate',
    subtitle: 'Brokers, developers & property managers',
    suite: 'Sales workspace',
  },
  services: {
    title: 'Service businesses',
    subtitle: 'Gyms, salons, studios & appointment-based teams',
    suite: 'Sales workspace',
  },
  education: {
    title: 'Education',
    subtitle: 'Schools, academies & training institutes',
    suite: 'Sales workspace',
  },
  healthcare: {
    title: 'Healthcare',
    subtitle: 'Clinics, practices & patient-focused care',
    suite: 'Sales workspace',
  },
  saas: {
    title: 'IT & SaaS',
    subtitle: 'Agencies, software vendors & B2B services',
    suite: 'Sales workspace',
  },
  audit: {
    title: 'Auditing & inspection',
    subtitle: 'Compliance audits, inspections & field assessments',
    suite: 'Audit workspace',
  },
  automotive: {
    title: 'Automotive',
    subtitle: 'Dealers, fleets & vehicle sales teams',
    suite: 'Sales workspace',
  },
  events: {
    title: 'Events',
    subtitle: 'Planners, venues & experience teams',
    suite: 'Sales workspace',
  },
  field_service: {
    title: 'Field service',
    subtitle: 'Pest control, maintenance & on-site operations',
    suite: 'Sales workspace',
  },
  sales_default: {
    title: 'General business',
    subtitle: 'CRM for contacts, deals & everyday sales',
    suite: 'Sales workspace',
  },
});

const APP_SUITE_LABELS = Object.freeze({
  SALES: 'Sales workspace',
  AUDIT: 'Audit workspace',
  HELPDESK: 'Helpdesk workspace',
  INVENTORY: 'Inventory workspace',
});

const MODULE_FALLBACK_LABELS = Object.freeze({
  people: 'Contacts',
  deals: 'Deals',
  organizations: 'Accounts',
  items: 'Products',
  tasks: 'Tasks',
  events: 'Events',
  assignments: 'Inspections',
});

export function formatAppSuiteLabel(appKey) {
  const key = String(appKey || '').trim().toUpperCase();
  return APP_SUITE_LABELS[key] || 'Workspace';
}

export function formatModuleLabel(moduleKey, moduleLabels = {}) {
  const raw = moduleLabels?.[moduleKey];
  if (raw && typeof raw === 'object') {
    return raw.plural || raw.singular || MODULE_FALLBACK_LABELS[moduleKey] || moduleKey;
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw;
  }
  return MODULE_FALLBACK_LABELS[moduleKey] || moduleKey;
}

export function getVerticalTrialCardDisplay(vertical) {
  const templateKey = vertical?.templateKey || vertical?.preview?.templateKey || 'sales_default';
  const meta = VERTICAL_TRIAL_CARDS_BY_TEMPLATE[templateKey] || VERTICAL_TRIAL_CARDS_BY_TEMPLATE.sales_default;
  const moduleLabels = vertical?.preview?.moduleLabels || {};
  const primaryModules = vertical?.preview?.primaryModules || [];
  const highlights = primaryModules
    .slice(0, 4)
    .map((moduleKey) => formatModuleLabel(moduleKey, moduleLabels));

  return {
    title: meta.title || vertical?.label || 'Industry',
    subtitle: meta.subtitle || vertical?.label || '',
    highlights,
    suite: meta.suite || formatAppSuiteLabel(vertical?.preview?.primaryAppKey),
  };
}
