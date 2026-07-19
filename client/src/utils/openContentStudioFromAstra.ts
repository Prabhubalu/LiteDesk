import type { Router } from 'vue-router';
import { createContentDocument } from '@/modules/contentStudio/services/contentStudioApi';
import {
  outlineTextToProseMirrorDoc,
  stashAstraContentDraft,
  type AstraContentDraftPayload,
} from '@/modules/contentStudio/utils/outlineToProseMirror';
import type { ContentStudioMode } from '@/modules/contentStudio/types/contentStudio';

export interface AstraOpenContentStudioAction {
  kind?: string;
  label?: string;
  fields?: Record<string, unknown>;
  moduleKey?: string;
}

function resolveMode(fields: Record<string, unknown> = {}): ContentStudioMode {
  const raw = String(fields.mode || fields.contentMode || '').toLowerCase();
  if (raw === 'articles' || raw === 'helpdesk' || raw === 'help') return 'articles';
  return 'blog';
}

function resolveTitle(fields: Record<string, unknown> = {}, label = ''): string {
  const fromFields = String(fields.title || fields.name || '').trim();
  if (fromFields) return fromFields.slice(0, 160);
  const fromLabel = String(label || '').replace(/^open\s+content\s+studio\b[:\s-]*/i, '').trim();
  return (fromLabel || 'Meeting deck').slice(0, 160);
}

function resolveOutline(fields: Record<string, unknown> = {}, fallbackDetail = ''): string {
  const outline = String(fields.outline || fields.body || fields.content || fallbackDetail || '').trim();
  return outline.slice(0, 12000);
}

function editorRouteForMode(mode: ContentStudioMode, documentId?: string) {
  if (mode === 'articles') {
    if (documentId) {
      return { name: 'helpdesk-article-edit', params: { id: documentId } };
    }
    return { name: 'helpdesk-article-new', query: {} as Record<string, string> };
  }
  if (documentId) {
    return { name: 'marketing-blog-edit', params: { id: documentId } };
  }
  return { name: 'marketing-blog-new', query: {} as Record<string, string> };
}

/**
 * Create a Content Studio draft from an Astra open_content_studio action and navigate to the editor.
 */
export async function openContentStudioFromAstraAction(
  router: Router,
  action: AstraOpenContentStudioAction,
  options: { fallbackDetail?: string } = {},
): Promise<{ ok: boolean; documentId?: string; error?: string }> {
  const fields = action.fields && typeof action.fields === 'object' ? action.fields : {};
  const mode = resolveMode(fields);
  const title = resolveTitle(fields, action.label);
  const outline = resolveOutline(fields, options.fallbackDetail);
  const summary = String(fields.summary || '').trim().slice(0, 400);
  const blocks = outlineTextToProseMirrorDoc(outline, title);

  const draftMeta: Omit<AstraContentDraftPayload, 'createdAt'> = {
    title,
    outline,
    mode,
    summary: summary || undefined,
    eventId: fields.eventId ? String(fields.eventId) : undefined,
    eventName: fields.eventName ? String(fields.eventName) : undefined,
  };

  try {
    const record = await createContentDocument(mode, {
      title,
      summary: summary || undefined,
      visibility: mode === 'articles' ? 'portal' : 'public',
      tags: ['astra', 'meeting-deck'],
      blocks,
    });
    const documentId = String(record?._id || '');
    if (!documentId) {
      throw new Error('Content Studio create returned no id');
    }
    const dest = editorRouteForMode(mode, documentId);
    await router.push(dest);
    return { ok: true, documentId };
  } catch (err) {
    const draftId = stashAstraContentDraft(draftMeta);
    const dest = editorRouteForMode(mode);
    dest.query = { astraDraft: draftId };
    try {
      await router.push(dest);
      return {
        ok: true,
        error: err instanceof Error ? err.message : String(err || 'create_failed'),
      };
    } catch (navErr) {
      return {
        ok: false,
        error: navErr instanceof Error ? navErr.message : String(navErr || err || 'navigate_failed'),
      };
    }
  }
}
