/**
 * Translate tenant-configured labels (API field labels, pipeline/stage names, picklist values).
 * Falls back to the configured string when no catalog entry exists.
 */

import { getModuleLabelKey } from '@/utils/navigationLabels';

/** @type {Record<string, string>} normalized stage name → deals.* key */
const STAGE_LABEL_KEYS = {
  new: 'deals.stageNew',
  qualified: 'deals.stageQualified',
  qualification: 'deals.stageQualified',
  proposal: 'deals.stageProposal',
  negotiation: 'deals.stageNegotiation',
  'closed won': 'deals.stageClosedWon',
  'closed lost': 'deals.stageClosedLost',
  won: 'deals.stageWon',
  lost: 'deals.stageLost',
  'new business': 'deals.picklistNewBusiness',
  discovery: 'deals.stageDiscovery',
  'needs analysis': 'deals.stageNeedsAnalysis',
  'value proposition': 'deals.stageValueProposition',
  'id decision makers': 'deals.stageIdDecisionMakers',
  'perception analysis': 'deals.stagePerceptionAnalysis',
  'proposal price quote': 'deals.stageProposalPriceQuote',
  'negotiation review': 'deals.stageNegotiationReview',
};

/** @type {Record<string, string>} normalized pipeline key → deals.* key */
const PIPELINE_LABEL_KEYS = {
  'sales-pipeline': 'deals.pipelineSales',
  sales: 'deals.pipelineSales',
  default: 'deals.pipelineDefault',
  marketing: 'deals.pipelineMarketing',
  partner: 'deals.pipelinePartner',
};

/** @type {Record<string, string>} normalized picklist value → {namespace}.{key} */
const PICKLIST_VALUE_KEYS = {
  new: 'deals.picklistNew',
  'new business': 'deals.picklistNewBusiness',
  upsell: 'deals.picklistUpsell',
  crosssell: 'deals.picklistCrossSell',
  'cross sell': 'deals.picklistCrossSell',
  renewal: 'deals.picklistRenewal',
  'existing customer': 'deals.picklistExistingCustomer',
  'general task': 'tasks.picklistGeneralTask',
  'follow-up': 'tasks.picklistFollowUp',
  'follow up': 'tasks.picklistFollowUp',
  call: 'tasks.picklistCall',
  email: 'tasks.picklistEmail',
  meeting: 'tasks.picklistMeeting',
  support: 'tasks.picklistSupport',
  research: 'tasks.picklistResearch',
  documentation: 'tasks.picklistDocumentation',
  internal: 'tasks.picklistInternal',
  bug: 'tasks.picklistBug',
  enhancement: 'tasks.picklistEnhancement',
  'feature request': 'tasks.picklistFeatureRequest',
  'usability issue': 'tasks.picklistUsabilityIssue',
  general_task: 'tasks.picklistGeneralTask',
  follow_up: 'tasks.picklistFollowUp',
  feature_request: 'tasks.picklistFeatureRequest',
  usability: 'tasks.picklistUsabilityIssue',
};

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function slugifyLabelPhrase(text) {
  return normalizeToken(text).replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 80);
}

/** phrase_annual_revenue → phraseAnnualRevenue */
export function phraseCatalogKey(slug) {
  if (!slug) return '';
  const parts = slug.split('_').filter(Boolean);
  return `phrase${parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')}`;
}

/**
 * @param {string} i18nKey dotted key e.g. deals.stageNew
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
function translateKey(i18nKey, t, te) {
  if (i18nKey && te(i18nKey)) return t(i18nKey);
  return null;
}

/**
 * @param {string} value stage or picklist display value
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveStageOrPicklistLabel(value, t, te) {
  const norm = normalizeToken(value);
  if (!norm) return null;

  const pickKey = PICKLIST_VALUE_KEYS[norm];
  const fromPick = translateKey(pickKey, t, te);
  if (fromPick) return fromPick;

  const stageKey = STAGE_LABEL_KEYS[norm];
  const fromStage = translateKey(stageKey, t, te);
  if (fromStage) return fromStage;

  const slugKey = `deals.stageValue_${slugifyLabelPhrase(norm)}`;
  return translateKey(slugKey, t, te);
}

/**
 * @param {string} pipelineKey internal pipeline key from tenant config
 * @param {string} [configuredLabel] optional display label from API
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolvePipelineLabel(pipelineKey, configuredLabel, t, te) {
  const keyNorm = normalizeToken(pipelineKey).replace(/\s/g, '-');
  const fromKey = translateKey(PIPELINE_LABEL_KEYS[keyNorm], t, te);
  if (fromKey) return fromKey;

  if (configuredLabel) {
    const fromLabel = resolveStageOrPicklistLabel(configuredLabel, t, te);
    if (fromLabel) return fromLabel;
    const slugKey = `deals.pipeline_${slugifyLabelPhrase(configuredLabel)}`;
    const fromSlug = translateKey(slugKey, t, te);
    if (fromSlug) return fromSlug;
  }

  return configuredLabel || pipelineKey || '';
}

/**
 * Tenant/API field label: phrase catalog in {module}.phrase_{slug} or common.phrase_{slug}.
 * @param {string} moduleKey
 * @param {string} fieldKey
 * @param {string} apiLabel
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function resolveTenantFieldLabel(moduleKey, fieldKey, apiLabel, t, te) {
  const mod = String(moduleKey || '').toLowerCase();
  const slug = slugifyLabelPhrase(apiLabel);
  if (slug) {
    const phraseLeaf = phraseCatalogKey(slug);
    const modPhrase = `${mod}.${phraseLeaf}`;
    const commonPhrase = `common.${phraseLeaf}`;
    const hit = translateKey(modPhrase, t, te) || translateKey(commonPhrase, t, te);
    if (hit) return hit;
  }

  const fk = String(fieldKey || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (fk) {
    const fieldParts = fk.split('_').filter(Boolean);
    const fieldLeaf = `fieldPhrase${fieldParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')}`;
    const hit = translateKey(`${mod}.${fieldLeaf}`, t, te);
    if (hit) return hit;
  }

  return null;
}

/**
 * Localized module name for tabs (deals → Geschäfte).
 * @param {string} moduleKey route segment e.g. deals
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} [te]
 */
export function resolveModuleDisplayName(moduleKey, t, te = () => false) {
  const key = getModuleLabelKey(moduleKey);
  if (key && te(key)) return t(key);
  const mod = String(moduleKey || '').trim();
  if (!mod) return '';
  return mod.charAt(0).toUpperCase() + mod.slice(1);
}

/**
 * Tab title params with localized module label for ICU templates.
 * @param {string} moduleKey
 * @param {string} [recordName]
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function buildRecordTabTitleParams(moduleKey, recordName, t, te) {
  return {
    module: resolveModuleDisplayName(moduleKey, t, te),
    name: recordName || '',
  };
}

/**
 * Localize picklist/select option labels from tenant config.
 * @param {Array<unknown>} options
 * @param {(key: string) => string} t
 * @param {(key: string) => boolean} te
 */
export function localizeSelectOptions(options, t, te) {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => {
    if (opt && typeof opt === 'object') {
      const raw = String(opt.label ?? opt.value ?? '').trim();
      const localized =
        resolveStageOrPicklistLabel(raw, t, te) ||
        resolveTenantFieldLabel('', '', raw, t, te) ||
        raw;
      return { ...opt, label: localized };
    }
    const raw = String(opt).trim();
    const localized =
      resolveStageOrPicklistLabel(raw, t, te) ||
      resolveTenantFieldLabel('', '', raw, t, te) ||
      raw;
    return { value: opt, label: localized };
  });
}
