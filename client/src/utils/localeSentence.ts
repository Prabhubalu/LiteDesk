/**
 * Locale-aware sentence generators for workflows, automation, and activity copy.
 * Never concatenate translated fragments — always use ICU templates + parameters.
 */

import type { Composer } from 'vue-i18n';

export type SentenceTemplateParams = Record<string, string | number | boolean | Date | null | undefined>;

/**
 * Build a localized sentence from an ICU template key.
 * @example buildSentence(t, 'process.trigger.onCreate', { module: 'Deal' })
 */
export function buildSentence(
  t: Composer['t'],
  templateKey: string,
  params: SentenceTemplateParams = {}
): string {
  const normalized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (value instanceof Date) {
      normalized[key] = value.toISOString();
    } else {
      normalized[key] = value as string | number;
    }
  }
  return t(templateKey, normalized);
}

/**
 * Register workflow template keys under a dedicated namespace prefix.
 * Keys must exist in locale catalogs before use.
 */
export const WORKFLOW_TEMPLATE_PREFIX = 'workflow';

export function workflowTemplateKey(segment: string): string {
  const parts = segment.split('.');
  if (parts.length > 2) {
    throw new Error(`Workflow template key "${segment}" exceeds depth budget (workflow.*.*).`);
  }
  return `${WORKFLOW_TEMPLATE_PREFIX}.${segment}`;
}
