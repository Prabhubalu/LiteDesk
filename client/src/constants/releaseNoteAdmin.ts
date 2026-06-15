export const RELEASE_NOTE_TARGET_APPS = [
  'SALES',
  'HELPDESK',
  'PROJECTS',
  'PORTAL',
  'AUDIT',
  'LMS',
  'INVENTORY'
];

export const RELEASE_NOTE_TARGET_PLANS = ['trial', 'paid'];

export const RELEASE_NOTE_IMPORTANCE_OPTIONS = ['major', 'minor', 'patch'];

export const RELEASE_NOTE_ITEM_TYPES = ['feature', 'improvement', 'bugfix'];

export const RELEASE_NOTE_STATUS_OPTIONS = ['draft', 'scheduled', 'published', 'archived'];

export function emptyReleaseItem(sortOrder = 0) {
  return {
    type: 'feature',
    title: '',
    description: '',
    imageUrl: null,
    ctaLabel: null,
    ctaUrl: null,
    sortOrder
  };
}

export function emptyReleaseForm() {
  return {
    version: '',
    slug: '',
    title: '',
    summary: '',
    importance: 'minor',
    targetApps: [],
    targetPlans: [],
    badgeExpiresAt: null,
    items: [emptyReleaseItem(0)]
  };
}
