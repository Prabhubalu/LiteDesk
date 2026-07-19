import type { Router } from 'vue-router';
import {
  parseCanvasFromActionFields,
  stashArivuCanvasDocument,
  type ArivuCanvasDocument,
} from '@/utils/arivuCanvasSession';

export interface AstraOpenCanvasAction {
  kind?: string;
  label?: string;
  fields?: Record<string, unknown>;
}

/**
 * Stash Arivu Canvas payload and navigate to the generative canvas page.
 */
export async function openArivuCanvasFromAstraAction(
  router: Router,
  action: AstraOpenCanvasAction,
  options: { fallbackDetail?: string; fallbackHeadline?: string } = {},
): Promise<{ ok: boolean; canvasId?: string; error?: string }> {
  let doc = parseCanvasFromActionFields(action.fields || {});

  // Reject meta-only / empty CRM docs so we never stash placeholders as "canvas".
  const hasCrmSurface = Boolean(
    (doc?.widgets || []).length
    || (doc?.cards || []).length
    || (doc?.kpis || []).length,
  );
  if (doc?.mode === 'crm' && !hasCrmSurface) {
    const summary = String(doc.heroSummary || doc.summary || '');
    if (/\b(launching|you'll see|canvas will load|full slide outline ready)\b/i.test(summary) || !summary) {
      doc = null;
    }
  }

  if (!doc) {
    const mode = String(action.fields?.mode || '').toLowerCase() === 'presentation'
      ? 'presentation'
      : 'crm';
    const title = String(action.fields?.title || options.fallbackHeadline || 'Arivu Canvas').slice(0, 160);
    const outline = String(action.fields?.outline || options.fallbackDetail || '').trim();
    if (!outline && mode === 'crm') {
      return { ok: false, error: 'Canvas payload missing live CRM cards. Ask Astra again to regenerate.' };
    }
    doc = {
      version: 2,
      mode,
      title,
      subtitle: mode === 'presentation' ? 'Presentation canvas' : 'CRM canvas',
      summary: outline.slice(0, 2000),
      heroSummary: outline.slice(0, 600),
      kpis: [],
      cards: [],
      blocks: [],
      slides: mode === 'presentation'
        ? outline.split(/\n/).filter(Boolean).slice(0, 12).map((line, idx) => ({
          id: `slide_${idx + 1}`,
          title: line.replace(/^\d+[\).]\s*/, '').replace(/^#+\s*/, '').slice(0, 120),
          bullets: [] as string[],
        }))
        : [],
      suggestedPrompts: [],
      conversationStarters: [],
      opportunities: [],
      actions: [],
      createdAt: new Date().toISOString(),
    } satisfies ArivuCanvasDocument;
  }

  try {
    const canvasId = stashArivuCanvasDocument(doc);
    await router.push({
      name: 'arivu-canvas',
      query: { id: canvasId },
    });
    return { ok: true, canvasId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err || 'navigate_failed'),
    };
  }
}
