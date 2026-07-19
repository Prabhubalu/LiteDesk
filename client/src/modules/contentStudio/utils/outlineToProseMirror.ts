import type { ProseMirrorJson } from '../types/contentStudio';

type PmNode = NonNullable<ProseMirrorJson['content']>[number];

function textNode(text: string): { type: 'text'; text: string } {
  return { type: 'text', text };
}

function paragraph(text: string): PmNode {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return { type: 'paragraph', content: [] };
  }
  return { type: 'paragraph', content: [textNode(trimmed)] };
}

function heading(level: 1 | 2 | 3, text: string): PmNode {
  return {
    type: 'heading',
    attrs: { level },
    content: [textNode(String(text || '').trim() || 'Untitled')],
  };
}

function bulletList(items: string[]): PmNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)],
    })),
  };
}

/**
 * Convert Astra outline markdown-ish text into a Content Studio ProseMirror doc.
 */
export function outlineTextToProseMirrorDoc(outline: string, title?: string): ProseMirrorJson {
  const content: PmNode[] = [];
  const titleText = String(title || '').trim();
  if (titleText) {
    content.push(heading(1, titleText));
  }

  const lines = String(outline || '')
    .split(/\n/)
    .map((line) => line.replace(/\s+$/g, ''))
    .filter((line, idx, arr) => line.trim() || (idx > 0 && arr[idx - 1]?.trim()));

  let pendingBullets: string[] = [];

  const flushBullets = () => {
    if (!pendingBullets.length) return;
    content.push(bulletList(pendingBullets));
    pendingBullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      continue;
    }

    const mdHeading = line.match(/^(#{1,3})\s+(.+)$/);
    if (mdHeading) {
      flushBullets();
      const level = Math.min(3, mdHeading[1].length) as 1 | 2 | 3;
      content.push(heading(level, mdHeading[2]));
      continue;
    }

    const numbered = line.match(/^\d+[\).]\s+(.+)$/);
    if (numbered) {
      flushBullets();
      content.push(heading(2, numbered[1]));
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      pendingBullets.push(bullet[1]);
      continue;
    }

    flushBullets();
    content.push(paragraph(line));
  }

  flushBullets();

  if (!content.length) {
    content.push(paragraph(''));
  }

  return { type: 'doc', content };
}

export const ASTRA_CONTENT_DRAFT_STORAGE_KEY = 'arivu:astra-content-draft';

export interface AstraContentDraftPayload {
  title: string;
  outline: string;
  mode: 'blog' | 'articles';
  summary?: string;
  eventId?: string;
  eventName?: string;
  createdAt: number;
}

export function stashAstraContentDraft(payload: Omit<AstraContentDraftPayload, 'createdAt'>): string {
  const id = `astra-draft-${Date.now().toString(36)}`;
  const full: AstraContentDraftPayload = {
    ...payload,
    createdAt: Date.now(),
  };
  try {
    sessionStorage.setItem(`${ASTRA_CONTENT_DRAFT_STORAGE_KEY}:${id}`, JSON.stringify(full));
    sessionStorage.setItem(ASTRA_CONTENT_DRAFT_STORAGE_KEY, JSON.stringify({ id, ...full }));
  } catch {
    // ignore quota / private mode
  }
  return id;
}

export function consumeAstraContentDraft(draftId?: string | null): AstraContentDraftPayload | null {
  try {
    const key = draftId
      ? `${ASTRA_CONTENT_DRAFT_STORAGE_KEY}:${draftId}`
      : ASTRA_CONTENT_DRAFT_STORAGE_KEY;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    if (!draftId) sessionStorage.removeItem(ASTRA_CONTENT_DRAFT_STORAGE_KEY);
    const parsed = JSON.parse(raw) as AstraContentDraftPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
