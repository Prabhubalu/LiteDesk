import DomPurifyLib from 'dompurify';

type SanitizeFn = (dirty: string, cfg?: object) => string;

function resolveSanitize(): SanitizeFn {
  const lib = DomPurifyLib as unknown as {
    sanitize?: SanitizeFn;
    default?: { sanitize?: SanitizeFn };
  };
  const fn = lib?.sanitize || lib?.default?.sanitize;
  if (typeof fn === 'function') return fn.bind(lib.default || lib);
  // Vitest/node: no DOM — escape-only passthrough (already escaped upstream).
  return (dirty: string) => String(dirty || '');
}

const sanitizeHtml = resolveSanitize();

export type AstraAnswerSection =
  | { type: 'prose'; html: string }
  | { type: 'steps'; items: string[] }
  | { type: 'inventory'; items: string[] }
  | { type: 'draft'; title: string; body: string };

const NUMBERED = /^\s*(\d+)[.)]\s+(.+)$/;
const BULLET = /^\s*[-*•]\s+(.+)$/;
const FENCE_OPEN = /^```[\w-]*\s*$/;
const FENCE_CLOSE = /^```\s*$/;
/** Headings that duplicate the steps card label — drop from prose. */
const STEPS_HEADING_ONLY = /^(#{1,3}\s*|\*\*)?(concrete\s+)?next\s+steps\b[\s*:]*(\*\*)?$/i;
/** Draft section titles (with optional markdown / parenthetical). */
const DRAFT_HEADING = /^(#{1,3}\s*|\*\*)?(short\s+)?((follow-?up|email)\s+)?draft(\s+follow-?up)?\b/i;
const EMAIL_START = /^(subject\s*:|hi\s+[\[\w]|dear\s+|hello\s+[\[\w])/i;

function stripInlineMd(text: string): string {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, '$1$2')
    .replace(/^#+\s*/, '')
    .trim();
}

function isDraftHeading(line: string): boolean {
  const t = stripInlineMd(line.trim());
  if (!t) return false;
  return DRAFT_HEADING.test(t);
}

function isStepsHeadingOnly(line: string): boolean {
  return STEPS_HEADING_ONLY.test(stripInlineMd(line.trim()));
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Light markdown: **bold**, *italic*, line breaks → sanitized HTML. */
export function proseToSafeHtml(text: string): string {
  const escaped = escapeHtml(text.trim());
  if (!escaped) return '';
  const withInline = escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  const paragraphs = withInline
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, '<br />').trim())
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join('');
  return sanitizeHtml(paragraphs, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
    ALLOWED_ATTR: [],
  });
}

/** Drop trailing “Next steps” / “Concrete next steps” lines before a steps card. */
function scrubStepsHeadingFromProse(buf: string[]) {
  while (buf.length) {
    const last = buf[buf.length - 1];
    if (!String(last || '').trim()) {
      buf.pop();
      continue;
    }
    if (isStepsHeadingOnly(String(last || ''))) {
      buf.pop();
      continue;
    }
    break;
  }
}

function flushProse(buf: string[], out: AstraAnswerSection[]) {
  scrubStepsHeadingFromProse(buf);
  const text = buf.join('\n').trim();
  buf.length = 0;
  if (!text) return;
  // Drop standalone steps headings that became their own paragraph block
  const lines = text.split('\n').filter((l) => !isStepsHeadingOnly(l));
  const cleaned = lines.join('\n').trim();
  if (!cleaned) return;
  const html = proseToSafeHtml(cleaned);
  if (html) out.push({ type: 'prose', html });
}

function flushSteps(items: string[], out: AstraAnswerSection[]) {
  if (!items.length) return;
  const inventoryHits = items.filter(looksLikeInventoryItem).length;
  const asInventory = inventoryHits >= 3
    || (items.length >= 2 && inventoryHits >= Math.ceil(items.length * 0.5));
  if (asInventory) {
    out.push({ type: 'inventory', items: items.slice() });
  } else {
    out.push({ type: 'steps', items: items.slice() });
  }
  items.length = 0;
}

/** Merge adjacent steps cards so “Next steps” only appears once. */
function coalesceStepsSections(sections: AstraAnswerSection[]): AstraAnswerSection[] {
  const out: AstraAnswerSection[] = [];
  for (const section of sections) {
    const prev = out[out.length - 1];
    if (section.type === 'steps' && prev?.type === 'steps') {
      prev.items.push(...section.items);
      continue;
    }
    // Drop empty prose between two steps blocks, then merge.
    if (
      section.type === 'steps'
      && prev?.type === 'prose'
      && out.length >= 2
      && out[out.length - 2]?.type === 'steps'
    ) {
      const proseText = String(prev.html || '').replace(/<[^>]+>/g, '').trim();
      if (!proseText || /^(concrete\s+)?next\s+steps\b/i.test(proseText)) {
        out.pop();
        const stepsPrev = out[out.length - 1];
        if (stepsPrev?.type === 'steps') {
          stepsPrev.items.push(...section.items);
          continue;
        }
      }
    }
    out.push(section);
  }
  return out;
}

/** CRM inventory rows (deal lists) — not actionable “next steps”. */
function looksLikeInventoryItem(text: string): boolean {
  const t = String(text || '');
  if (/\$\s?[\d,]+/.test(t)) return true;
  if (/\bMR[A-Z0-9-]+\b/i.test(t)) return true;
  if (/\b(deal|proposal|negotiation|qualification|contract\s+sent)\b/i.test(t) && /—|-/.test(t)) {
    return true;
  }
  return false;
}

function draftTitleFrom(line: string): string {
  const t = stripInlineMd(line).replace(/:$/, '').trim();
  // Drop parenthetical instructions from the card title
  return t.replace(/\s*\([^)]*\)\s*$/, '').trim() || 'draft';
}

/**
 * Parse free-form Astra answer text into structured UI sections.
 */
export function parseAstraAnswer(raw: string): AstraAnswerSection[] {
  const source = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!source) return [];

  const lines = source.split('\n');
  const sections: AstraAnswerSection[] = [];
  const proseBuf: string[] = [];
  const stepItems: string[] = [];
  let i = 0;
  let pendingDraftTitle = '';

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Fenced code → draft
    if (FENCE_OPEN.test(trimmed)) {
      flushSteps(stepItems, sections);
      flushProse(proseBuf, sections);
      i += 1;
      const bodyLines: string[] = [];
      while (i < lines.length && !FENCE_CLOSE.test((lines[i] ?? '').trim())) {
        bodyLines.push(lines[i] ?? '');
        i += 1;
      }
      if (i < lines.length) i += 1;
      const body = bodyLines.join('\n').trim();
      if (body) {
        sections.push({
          type: 'draft',
          title: pendingDraftTitle || 'draft',
          body,
        });
      }
      pendingDraftTitle = '';
      continue;
    }

    // Draft heading → remainder (or until next major section)
    if (isDraftHeading(trimmed)) {
      flushSteps(stepItems, sections);
      flushProse(proseBuf, sections);
      pendingDraftTitle = draftTitleFrom(trimmed);
      i += 1;
      if (i < lines.length && FENCE_OPEN.test((lines[i] ?? '').trim())) continue;

      const bodyLines: string[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? '';
        const t = current.trim();
        if (FENCE_OPEN.test(t)) break;
        if (isDraftHeading(t) && bodyLines.some((b) => b.trim())) break;
        if (NUMBERED.test(current) && bodyLines.some((b) => EMAIL_START.test(b.trim()) || b.trim().length > 40)) {
          break;
        }
        bodyLines.push(current);
        i += 1;
      }
      const body = bodyLines.join('\n').trim();
      if (body) {
        sections.push({ type: 'draft', title: pendingDraftTitle, body });
        pendingDraftTitle = '';
      }
      continue;
    }

    const numbered = NUMBERED.exec(line);
    const bullet = BULLET.exec(line);
    if (numbered || bullet) {
      scrubStepsHeadingFromProse(proseBuf);
      flushProse(proseBuf, sections);
      const itemText = numbered?.[2] ?? bullet?.[1] ?? '';
      stepItems.push(itemText.trim());
      i += 1;
      continue;
    }

    // Keep one steps list across blank lines / repeated “Next steps” headings.
    if (stepItems.length && (!trimmed || isStepsHeadingOnly(trimmed))) {
      i += 1;
      continue;
    }

    if (stepItems.length) {
      flushSteps(stepItems, sections);
    }

    if (!trimmed) {
      proseBuf.push('');
    } else {
      proseBuf.push(line);
    }
    i += 1;
  }

  flushSteps(stepItems, sections);
  flushProse(proseBuf, sections);

  if (!sections.length) {
    const html = proseToSafeHtml(source);
    return html ? [{ type: 'prose', html }] : [];
  }
  return coalesceStepsSections(sections);
}
