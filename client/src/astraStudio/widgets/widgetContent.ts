import type { CanvasWidget } from '@/astraStudio/types';

/** Salesforce-style: only surface panels that have a real payload. */
export function widgetHasRenderableContent(widget: CanvasWidget): boolean {
  const type = String(widget.type || '');
  const cfg = widget.config || {};
  const body = cfg.body || cfg.summary || widget.ai?.text;
  const recordId =
    widget.bindings?.recordId
    || (Array.isArray(widget.bindings?.recordIds) ? widget.bindings.recordIds[0] : undefined);

  if (type.startsWith('ai.')) return Boolean(body && String(body).trim());

  if (type.startsWith('crm.')) return Boolean(recordId);

  if (type === 'content.checklist') {
    return Array.isArray(cfg.items) && cfg.items.length > 0;
  }

  if (type === 'viz.timeline') {
    return Array.isArray(cfg.items) && cfg.items.length > 0;
  }

  if (type.startsWith('analytics.') || type.includes('chart') || type.includes('kpi')) {
    const metrics = cfg.metrics;
    if (!Array.isArray(metrics) || !metrics.length) return false;
    return metrics.some((row) => {
      if (!row || typeof row !== 'object') return false;
      const value = (row as { value?: unknown }).value;
      return value != null && String(value).trim() !== '' && String(value) !== '—';
    });
  }

  if (type.startsWith('comms.')) {
    if (body && String(body).trim()) return true;
    if (Array.isArray(cfg.messages) && cfg.messages.length) return true;
    if (Array.isArray(cfg.items) && cfg.items.length) return true;
    return false;
  }

  if (
    type.startsWith('viz.')
    || type === 'content.table'
    || type.includes('whiteboard')
    || type.includes('kanban')
  ) {
    if (body && String(body).trim()) return true;
    if (Array.isArray(cfg.nodes) && cfg.nodes.length > 0) return true;
    if (Array.isArray(cfg.rows) && cfg.rows.length > 0) return true;
    if (Array.isArray(cfg.columns) && cfg.columns.length > 0) return true;
    return false;
  }

  if (type.startsWith('content.')) {
    return Boolean(body && String(body).trim());
  }

  return Boolean(body && String(body).trim());
}

/** Reading order for packed Generative Canvas grid. */
export function sortWidgetsForFlow(widgets: CanvasWidget[]): CanvasWidget[] {
  return [...widgets].sort((a, b) => {
    const ay = a.frame?.y ?? 0;
    const by = b.frame?.y ?? 0;
    if (ay !== by) return ay - by;
    return (a.frame?.x ?? 0) - (b.frame?.x ?? 0);
  });
}

/**
 * Masonry tile class — CSS columns pack vertically so short cards
 * fill under neighbors instead of waiting on the tallest row peer.
 */
export function bentoTileClass(widget: CanvasWidget, _index = 0): string {
  const type = String(widget.type || '');
  const compact =
    type.startsWith('crm.')
    || type.startsWith('analytics.')
    || type.includes('kpi');
  return compact ? 'living-bento-tile--compact' : '';
}

/** @deprecated alias — masonry uses bentoTileClass */
export function bentoCellClass(widget: CanvasWidget, index = 0): string {
  return bentoTileClass(widget, index);
}

/** @deprecated use bentoTileClass */
export function flowColSpan(widget: CanvasWidget, index = 0): string {
  return bentoTileClass(widget, index);
}

export type ContentTone = 'neutral' | 'danger' | 'warning' | 'info' | 'success';

export type ContentRowKind = 'heading' | 'item' | 'paragraph';

export type ParsedContentRow = {
  kind: ContentRowKind;
  primary: string;
  secondary?: string;
  badge?: string;
  tone: ContentTone;
  initials?: string;
  href?: string;
};

const SECTION_HEADING_RE =
  /^(current\s+situation|key\s+risks?|risks?(?:\s*&\s*objections?)?|win\s+strategy|next\s+steps?|action\s+items?|talking\s+points?|buying\s+signals?|competitors?(?:\s+matrix)?|overview|summary|background|context|stakeholders?|decision\s+makers?|objections?|opportunities?|strengths?|weaknesses?|threats?|recommendations?|agenda|focus|notes?|open\s+questions?|blockers?)$/i;

/** Strip list markers / markdown heading prefixes; keep semantic text. */
function cleanLineText(line: string): string {
  return String(line || '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*\*(.+?)\*\*\s*$/, '$1')
    .replace(/^__ (.+?) __\s*$/, '$1')
    .replace(/^[\s•●◦▪\-–—*]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    // Never show Mongo ids / module:id plumbing in panel UI
    .replace(
      /\b(?:people|organizations?|orgs?|deals?|quotes?|cases?|tasks?|events?|items?|contacts?|accounts?):[a-f0-9]{24}\b/gi,
      '',
    )
    .replace(/\bid\s*[=:]\s*[a-f0-9]{24}\b/gi, '')
    .replace(/\b[a-f0-9]{24}\b/gi, '')
    .replace(/\[\s*(items?|quotes?|deals?|people|tasks?|events?|cases?)\s*\]/gi, '')
    .replace(/^[\s·•\-–—|:]+/, '')
    .replace(/[\s·•\-–—|:]+$/g, '')
    .replace(/\s*[·•\-–—|:]\s*(?=\s*[·•\-–—|:])/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

/** Split AI body into clean lines (bullets / numbered / plain). */
export function splitContentLines(raw: string): string[] {
  return String(raw || '')
    .split(/\n+/)
    .map((line) => cleanLineText(line))
    .filter(Boolean);
}

function splitLabel(line: string): { primary: string; secondary?: string } {
  // Avoid splitting prose / emails on the first colon
  if (line.length > 96) return { primary: line };
  const m = line.match(/^(.{1,48}?)(?:\s*[:：]\s+|\s+[—–]\s+)(.+)$/);
  if (m) {
    const label = (m[1] ?? '').trim();
    const rest = (m[2] ?? '').trim();
    // Label must look like a field name, not a sentence fragment
    if (
      label.length <= 40
      && !/[.!?]$/.test(label)
      && !/@/.test(label)
      && rest.length > 0
    ) {
      return { primary: label, secondary: rest };
    }
  }
  return { primary: line };
}

/** Pull a trailing http(s) URL into href; keep human label as text. */
function extractHref(text: string): { text: string; href?: string } {
  const raw = String(text || '').trim();
  if (!raw) return { text: '' };
  const m = raw.match(/(https?:\/\/[^\s<>"']+)/i);
  if (!m?.[1]) return { text: raw };
  const href = m[1].replace(/[),.;]+$/g, '');
  const label = raw
    .replace(m[1], '')
    .replace(/\s*[—–\-|:]\s*$/g, '')
    .replace(/^[—–\-|:]\s*/, '')
    .trim();
  return { text: label || href, href };
}

function looksLikeHeading(rawLine: string, cleaned: string, hadBullet: boolean): boolean {
  const trimmed = String(rawLine || '').trim();
  if (!cleaned || cleaned.length > 72) return false;
  if (/^#{1,6}\s+\S/.test(trimmed)) return true;
  if (/^\*\*[^*].+[^*]\*\*$/.test(trimmed)) return true;
  if (SECTION_HEADING_RE.test(cleaned)) return true;
  // Trailing colon section labels: "Key Risks:"
  if (/[:：]\s*$/.test(cleaned) && cleaned.length <= 56 && !/@/.test(cleaned)) {
    return true;
  }
  // Title-case labels only when not already a list item (bullets stay as items)
  if (hadBullet) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (
    words.length >= 1
    && words.length <= 5
    && cleaned.length <= 48
    && !/[.!?]$/.test(cleaned)
    && !/@/.test(cleaned)
    && !/\d{2,}/.test(cleaned)
    && words.every((w) => /^[A-Z0-9(&/)]/.test(w) || /^(and|or|of|the|a|an|to|&)$/i.test(w))
  ) {
    return true;
  }
  return false;
}

function looksLikeParagraph(cleaned: string, hadBullet: boolean): boolean {
  if (hadBullet) return false;
  if (cleaned.length >= 160) return true;
  if (cleaned.length >= 100 && /[.!?]\s/.test(cleaned)) return true;
  return false;
}

function stripTrailingColon(text: string): string {
  return text.replace(/[:：]\s*$/, '').trim();
}

function initialsFrom(label: string): string {
  const parts = label.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1] ?? '';
  return `${first[0] || ''}${second[0] || ''}`.toUpperCase();
}

function riskTone(text: string): { tone: ContentTone; badge: 'high' | 'med' | 'low' | 'risk' } {
  const lower = text.toLowerCase();
  if (/\b(critical|blocker|severe|urgent|high)\b/.test(lower)) {
    return { tone: 'danger', badge: 'high' };
  }
  if (/\b(medium|moderate|delay|constraint|concern)\b/.test(lower)) {
    return { tone: 'warning', badge: 'med' };
  }
  if (/\b(low|minor|watch)\b/.test(lower)) {
    return { tone: 'info', badge: 'low' };
  }
  return { tone: 'warning', badge: 'risk' };
}

/** Parse widget body into structured rows for premium in-card rendering. */
export function parseWidgetContentRows(widget: CanvasWidget, raw: string): ParsedContentRow[] {
  const layout = contentLayoutForWidget(widget);
  const isRisk = layout === 'risk';
  const isStakeholder = layout === 'stakeholder';
  const isTalking = layout === 'talking';

  const rawLines = String(raw || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const out: ParsedContentRow[] = [];

  for (const rawLine of rawLines) {
    const hadBullet = /^[\s•●◦▪\-–—*]+/.test(rawLine) || /^\d+[.)]\s+/.test(rawLine);
    const cleaned = cleanLineText(rawLine);
    if (!cleaned) continue;
    // Drop template placeholders like [Items] / [quotes]
    if (/^\[[^\]]+\]$/.test(cleaned)) continue;

    if (looksLikeHeading(rawLine, cleaned, hadBullet)) {
      out.push({
        kind: 'heading',
        primary: stripTrailingColon(cleaned),
        tone: 'neutral',
      });
      continue;
    }

    if (looksLikeParagraph(cleaned, hadBullet)) {
      out.push({
        kind: 'paragraph',
        primary: cleaned,
        tone: 'neutral',
      });
      continue;
    }

    const { primary, secondary } = splitLabel(cleaned);
    const fromSecondary = secondary ? extractHref(secondary) : null;
    const fromPrimary = !fromSecondary?.href ? extractHref(primary) : null;
    const href = fromSecondary?.href || fromPrimary?.href;
    const nextPrimary = fromPrimary && !secondary ? fromPrimary.text : primary;
    const nextSecondary = fromSecondary
      ? fromSecondary.text
      : secondary;

    if (isRisk) {
      const { tone, badge } = riskTone(cleaned);
      out.push({ kind: 'item', primary: nextPrimary, secondary: nextSecondary, tone, badge, href });
      continue;
    }
    if (isStakeholder) {
      const roleLike =
        /\b(buyer|champion|legal|technical|influencer|blocker|sponsor|coach|decision|contact|economic)\b/i.test(
          nextPrimary,
        )
        && nextPrimary.length <= 40;
      out.push({
        kind: 'item',
        primary: nextPrimary,
        secondary: nextSecondary,
        tone: 'info',
        initials: initialsFrom(nextSecondary || nextPrimary),
        badge: roleLike && !nextSecondary ? 'role' : undefined,
        href,
      });
      continue;
    }
    if (isTalking) {
      out.push({ kind: 'item', primary: nextPrimary, secondary: nextSecondary, tone: 'info', href });
      continue;
    }
    out.push({ kind: 'item', primary: nextPrimary, secondary: nextSecondary, tone: 'neutral', href });
  }

  return out;
}

export function contentLayoutForWidget(widget: CanvasWidget): 'agenda' | 'stakeholder' | 'risk' | 'talking' | 'list' {
  const type = String(widget.type || '');
  const title = String(widget.config?.title || '').toLowerCase();
  if (type.includes('risk') || type.includes('objection') || title.includes('risk')) return 'risk';
  if (/buying\s*signal|signal/i.test(title)) return 'talking';
  if (
    title.includes('stakeholder')
    || title.includes('decision maker')
    || type === 'viz.relationship_graph'
  ) {
    return 'stakeholder';
  }
  if (type.includes('recommend') || title.includes('talking') || title.includes('win')) return 'talking';
  if (type.includes('summary') || title.includes('agenda')) return 'agenda';
  // Generic insights / health → clean list (not ROLE avatars)
  if (type.includes('insight')) return 'list';
  return 'list';
}
