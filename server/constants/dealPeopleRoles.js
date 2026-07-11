/**
 * Deal ↔ People relationship roles (server).
 * Role belongs to the deal relationship; isPrimary is independent of role.
 */

const DEAL_PEOPLE_ROLES = Object.freeze([
  'decision_maker',
  'champion',
  'influencer',
  'technical_contact',
  'partner_contact',
  'procurement',
  'legal',
  'other',
]);

const DEAL_PERSON_ROLE_DECISION_MAKER = 'decision_maker';

const LEGACY_ROLE_MAP = Object.freeze({
  primary_contact: 'decision_maker',
  decision_maker: 'decision_maker',
  champion: 'champion',
  influencer: 'influencer',
  technical_contact: 'technical_contact',
  partner_contact: 'partner_contact',
  procurement: 'procurement',
  legal: 'legal',
  other: 'other',
});

function isDealPersonRole(value) {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return DEAL_PEOPLE_ROLES.includes(v);
}

function normalizeDealPersonRole(value, fallback = 'other') {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!v) return fallback;
  if (LEGACY_ROLE_MAP[v]) return LEGACY_ROLE_MAP[v];
  return isDealPersonRole(v) ? v : fallback;
}

function defaultDealPersonRole(hasPrimaryPerson) {
  return hasPrimaryPerson ? 'influencer' : DEAL_PERSON_ROLE_DECISION_MAKER;
}

module.exports = {
  DEAL_PEOPLE_ROLES,
  DEAL_PERSON_ROLE_DECISION_MAKER,
  isDealPersonRole,
  normalizeDealPersonRole,
  defaultDealPersonRole,
};
