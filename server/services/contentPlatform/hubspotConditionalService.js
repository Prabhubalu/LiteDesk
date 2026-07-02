'use strict';

/** @typedef {{ raw: string, kind: string, index: number }} HubspotConditionalBlock */

const HUBSPOT_LOGIC_TAG = /\{%[\s\S]*?%\}/g;

const IF_BLOCK_REGEX = /\{%\s*if\b[^%]*%\}((?:(?!\{%\s*if\b)[\s\S])*?)(?:\{%\s*else\b[^%]*%\}((?:(?!\{%\s*if\b)[\s\S])*?))?\{%\s*endif\s*%\}/gi;
const UNLESS_BLOCK_REGEX = /\{%\s*unless\b[^%]*%\}([\s\S]*?)\{%\s*endunless\s*%\}/gi;
const FOR_BLOCK_REGEX = /\{%\s*for\b[^%]*%\}([\s\S]*?)\{%\s*endfor\s*%\}/gi;

/**
 * @param {string} tag
 * @returns {string}
 */
function classifyHubspotTag(tag) {
  const source = String(tag || '').trim();
  if (/^\{%\s*if\b/i.test(source)) return 'if';
  if (/^\{%\s*unless\b/i.test(source)) return 'unless';
  if (/^\{%\s*for\b/i.test(source)) return 'for';
  if (/^\{%\s*else\b/i.test(source)) return 'else';
  if (/^\{%\s*elif\b/i.test(source)) return 'elif';
  if (/^\{%\s*endif\b/i.test(source)) return 'endif';
  if (/^\{%\s*endunless\b/i.test(source)) return 'endunless';
  if (/^\{%\s*endfor\b/i.test(source)) return 'endfor';
  return 'logic';
}

/**
 * @param {string} html
 * @returns {HubspotConditionalBlock[]}
 */
function detectHubspotConditionals(html) {
  const source = String(html || '');
  const blocks = [];
  const seen = new Set();
  let match = HUBSPOT_LOGIC_TAG.exec(source);

  while (match) {
    const raw = match[0];
    const kind = classifyHubspotTag(raw);
    if (kind === 'logic') {
      match = HUBSPOT_LOGIC_TAG.exec(source);
      continue;
    }
    if (!seen.has(raw)) {
      seen.add(raw);
      blocks.push({ raw, kind, index: match.index });
    }
    match = HUBSPOT_LOGIC_TAG.exec(source);
  }

  return blocks.sort((a, b) => a.index - b.index);
}

/**
 * Strip HubSpot conditional tags, keeping the primary branch content for if/else blocks.
 *
 * @param {string} html
 * @returns {string}
 */
function stripHubspotConditionals(html) {
  let output = String(html || '');
  let previous = '';

  while (output !== previous) {
    previous = output;
    output = output.replace(IF_BLOCK_REGEX, (_match, ifContent, _elseContent) => ifContent || '');
    output = output.replace(UNLESS_BLOCK_REGEX, (_match, inner) => inner || '');
    output = output.replace(FOR_BLOCK_REGEX, (_match, inner) => inner || '');
  }

  return output.replace(HUBSPOT_LOGIC_TAG, '');
}

/**
 * @param {object} params
 * @param {string} params.html
 * @param {'keep'|'strip'} [params.mode]
 * @returns {{ html: string, conditionals: HubspotConditionalBlock[], warnings: Array<{ type: string, detail: string }> }}
 */
function processHubspotConditionals(params) {
  const mode = params?.mode === 'strip' ? 'strip' : 'keep';
  const source = String(params?.html || '');
  const conditionals = detectHubspotConditionals(source);

  if (!conditionals.length) {
    return { html: source, conditionals, warnings: [] };
  }

  if (mode === 'keep') {
    return {
      html: source,
      conditionals,
      warnings: conditionals.map((block) => ({
        type: 'hubspot-conditional',
        detail: block.raw.length > 120 ? `${block.raw.slice(0, 117)}...` : block.raw
      }))
    };
  }

  return {
    html: stripHubspotConditionals(source),
    conditionals,
    warnings: [{
      type: 'hubspot-conditional-stripped',
      detail: `Removed ${conditionals.length} HubSpot logic block(s); kept primary branch content only`
    }]
  };
}

module.exports = {
  detectHubspotConditionals,
  stripHubspotConditionals,
  processHubspotConditionals
};
