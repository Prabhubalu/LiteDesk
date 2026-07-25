'use strict';

/**
 * Studio hydrate helper — web competitor research for competitor-matrix panels.
 *
 * Subject = the tenant organization (what this CRM customer sells), not the
 * platform vendor. Customer/account on the canvas is fit context only.
 */

const { researchCompetitors, isWebResearchEnabled } = require('../astra/tools/webResearch');

function normalizeModule(mk = '') {
  const k = String(mk || '').toLowerCase();
  if (k === 'organization' || k === 'org' || k === 'account') return 'organizations';
  if (k === 'deal') return 'deals';
  if (k === 'person' || k === 'contact') return 'people';
  return k;
}

/** Normalize a tenant / product display name. */
function normalizeBrandName(raw = '') {
  const name = String(raw || '').trim();
  if (!name || name.length < 2) return '';
  return name.slice(0, 80);
}

/**
 * Tenant product brand — who this org competes as.
 * Always Organization.name for the signed-in tenant (Arivu for you, XYZ for others).
 */
async function resolveTenantProductBrand(organizationId) {
  if (!organizationId) return '';
  try {
    const Organization = require('../../models/Organization');
    const org = await Organization.findById(organizationId).select('name').lean();
    return normalizeBrandName(org?.name || '');
  } catch (err) {
    console.warn('[competitorWebResearch] tenant brand lookup failed:', err?.message || err);
    return '';
  }
}

/** @deprecated sync helper — prefer resolveTenantProductBrand(organizationId) */
function productBrand(explicitName = '') {
  return normalizeBrandName(explicitName);
}

function customerContext(focus = [], situation = null) {
  const rows = Array.isArray(focus) ? focus : [];
  const org = rows.find((f) => normalizeModule(f.moduleKey) === 'organizations');
  const person = rows.find((f) => normalizeModule(f.moduleKey) === 'people');
  const deal = rows.find((f) => normalizeModule(f.moduleKey) === 'deals');
  const fromFocus = String(
    org?.recordName
    || person?.recordName
    || situation?.focus?.title
    || situation?.focus?.name
    || '',
  ).trim();
  // Prefer account/person over deal title ("Sample Deal" is not a competitor subject)
  if (fromFocus && !/^sample\s+deal$/i.test(fromFocus)) return fromFocus;
  if (deal?.recordName && !/^sample\s+deal$/i.test(String(deal.recordName))) {
    return String(deal.recordName).trim();
  }
  return fromFocus || '';
}

/** @deprecated use resolveTenantProductBrand + customerContext */
async function subjectFromFocus(focus = [], prompt = '', organizationId = '') {
  const brand = await resolveTenantProductBrand(organizationId);
  const customer = customerContext(focus);
  if (brand && customer) return `${brand} for ${customer}`;
  return brand || String(prompt || '').trim().slice(0, 80);
}

function knownFromSituation(situation) {
  const blob = String(situation?.llmText || '');
  const names = [];
  const re = /(?:competitor|competing\s+with|vs\.?|versus)\s*[:\-]?\s*([A-Z][A-Za-z0-9 .&-]{1,40})/gi;
  let m;
  while ((m = re.exec(blob)) && names.length < 4) {
    const name = String(m[1] || '').trim().replace(/[.,;:]+$/, '');
    if (!name) continue;
    if (/^(alternatives?|competitors?|top|best)\b/i.test(name)) continue;
    if (names.includes(name)) continue;
    names.push(name);
  }
  return names;
}

/**
 * @returns {Promise<{ body: string, competitors: string[], sources: Array, provider?: string }>}
 */
async function researchCompetitorsForCanvas({
  organizationId = '',
  focus = [],
  prompt = '',
  situation = null,
  industry = '',
} = {}) {
  if (!isWebResearchEnabled()) {
    return { body: '', competitors: [], sources: [] };
  }
  const brand = await resolveTenantProductBrand(organizationId);
  const customer = customerContext(focus, situation);
  if (!brand || brand.length < 2) {
    return { body: '', competitors: [], sources: [] };
  }
  try {
    const result = await researchCompetitors({
      subject: brand,
      customer,
      industry: industry || 'CRM',
      productHints: ['CRM', 'customer platform', 'sales CRM'],
      knownCompetitors: knownFromSituation(situation),
      limit: 5,
    });
    if (!result.ok) {
      return { body: '', competitors: [], sources: [], provider: result.provider };
    }
    return {
      body: result.body || '',
      competitors: result.competitors || [],
      sources: result.sources || [],
      provider: result.provider,
    };
  } catch (err) {
    console.warn('[competitorWebResearch] failed:', err?.message || err);
    return { body: '', competitors: [], sources: [] };
  }
}

module.exports = {
  researchCompetitorsForCanvas,
  subjectFromFocus,
  knownFromSituation,
  productBrand,
  resolveTenantProductBrand,
  customerContext,
};
