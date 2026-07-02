'use strict';

const { detectMergeTags, applyMergeTagMappings } = require('./mergeTagDetector');
const { sanitizeEmailHtml, extractDocumentTitle } = require('./htmlSanitizerService');
const { htmlToGrapesDefinition } = require('./htmlToGrapesDefinition');
const { extractEmailBodyHtml } = require('./emailHtmlPrepareService');
const { processHubspotConditionals } = require('./hubspotConditionalService');
const { inlineAllowlistedStylesheets } = require('./emailExternalCssService');

const UNSUPPORTED_CSS_PATTERNS = [
  { property: 'position:fixed', regex: /position\s*:\s*fixed/i },
  { property: 'position:sticky', regex: /position\s*:\s*sticky/i },
  { property: 'flex-gap', regex: /gap\s*:\s*[^;]+/i },
  { property: 'grid', regex: /display\s*:\s*grid/i }
];

/**
 * @param {string} html
 * @returns {boolean}
 */
function isLikelyValidHtml(html) {
  const source = String(html || '').trim();
  if (!source) return false;
  const hasTag = /<\/?[a-z][\s\S]*>/i.test(source);
  const hasBody = /<body[\s>]/i.test(source) || /<table[\s>]/i.test(source) || /<div[\s>]/i.test(source);
  return hasTag && hasBody;
}

/**
 * @param {string} html
 * @param {string} css
 * @returns {Array<{ property: string, detail: string }>}
 */
function detectUnsupportedCss(html, css) {
  const combined = `${html}\n${css}`;
  const issues = [];
  for (const rule of UNSUPPORTED_CSS_PATTERNS) {
    if (rule.regex.test(combined)) {
      issues.push({
        property: rule.property,
        detail: `Found ${rule.property} — may render inconsistently in Outlook`
      });
    }
  }
  return issues;
}

/**
 * @param {string} html
 * @returns {{ images: number, tables: number, links: number, inlineStyles: boolean }}
 */
function countHtmlFeatures(html) {
  const source = String(html || '');
  return {
    images: (source.match(/<img\b/gi) || []).length,
    tables: (source.match(/<table\b/gi) || []).length,
    links: (source.match(/<a\b/gi) || []).length,
    inlineStyles: /style\s*=\s*["'][^"']+["']/i.test(source)
  };
}

/**
 * @param {object} params
 * @param {string} params.html
 * @param {Record<string, { path?: string, skip?: boolean }>} [params.mergeMappings]
 * @param {'keep'|'strip'} [params.hubspotConditionalMode]
 * @param {string[]} [params.externalCssAllowlist]
 * @param {boolean} [params.fetchExternalCss]
 * @returns {Promise<object>}
 */
async function analyzeEmailHtml(params) {
  const rawHtml = String(params?.html || '');
  if (!rawHtml.trim()) {
    const error = new Error('HTML content is required');
    error.code = 'HTML_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const hubspotResult = processHubspotConditionals({
    html: rawHtml,
    mode: params?.hubspotConditionalMode === 'strip' ? 'strip' : 'keep'
  });

  let workingHtml = hubspotResult.html;
  let prefetchedCss = '';
  let externalCssWarnings = [];

  const shouldFetchCss = params?.fetchExternalCss !== false;
  const allowlist = Array.isArray(params?.externalCssAllowlist)
    ? params.externalCssAllowlist
    : [];

  if (shouldFetchCss && allowlist.length) {
    const cssResult = await inlineAllowlistedStylesheets(workingHtml, allowlist);
    workingHtml = cssResult.html;
    prefetchedCss = cssResult.css;
    externalCssWarnings = cssResult.warnings;
  }

  const { html: sanitizedHtml, css, removals, warnings } = sanitizeEmailHtml(workingHtml);
  const combinedCss = [prefetchedCss, css].filter(Boolean).join('\n\n');
  const mergeTags = detectMergeTags(sanitizedHtml);
  const mappedHtml = applyMergeTagMappings(sanitizedHtml, params?.mergeMappings || {});
  const bodyHtml = extractEmailBodyHtml(mappedHtml);
  const features = countHtmlFeatures(bodyHtml);
  const unsupportedCss = detectUnsupportedCss(bodyHtml, combinedCss);
  const valid = isLikelyValidHtml(bodyHtml || mappedHtml);

  const checks = {
    htmlValid: valid,
    inlineCssFound: features.inlineStyles || Boolean(combinedCss.trim()),
    imagesDetected: features.images > 0,
    tablesDetected: features.tables > 0,
    linksFound: features.links > 0,
    mergeTagsFound: mergeTags.length > 0,
    hubspotConditionalsFound: hubspotResult.conditionals.length > 0
  };

  const issueWarnings = [
    ...hubspotResult.warnings.map((item) => ({
      type: item.type,
      detail: item.detail
    })),
    ...externalCssWarnings.map((item) => ({
      type: item.type,
      detail: item.detail
    })),
    ...warnings.map((item) => ({
      type: item.type,
      detail: item.detail,
      line: item.line
    })),
    ...unsupportedCss.map((item) => ({
      type: 'unsupported-css',
      detail: item.detail,
      property: item.property
    })),
    ...removals
      .filter((item) => item.type === 'javascript')
      .map((item) => ({
        type: 'javascript-removed',
        detail: item.detail,
        line: item.line
      })),
    ...removals
      .filter((item) => item.type === 'external-css')
      .map((item) => ({
        type: 'external-css-ignored',
        detail: item.detail,
        line: item.line
      }))
  ];

  const jsonDefinition = htmlToGrapesDefinition({ html: bodyHtml, css: combinedCss });
  const suggestedName = extractDocumentTitle(rawHtml);

  return {
    checks,
    counts: {
      images: features.images,
      tables: features.tables,
      links: features.links,
      mergeTags: mergeTags.length,
      hubspotConditionals: hubspotResult.conditionals.length
    },
    mergeTags,
    hubspotConditionals: hubspotResult.conditionals,
    warnings: issueWarnings,
    removals,
    sanitizedHtml: bodyHtml,
    css: combinedCss,
    suggestedName,
    jsonDefinition
  };
}

module.exports = {
  analyzeEmailHtml,
  isLikelyValidHtml,
  countHtmlFeatures,
  detectUnsupportedCss
};
