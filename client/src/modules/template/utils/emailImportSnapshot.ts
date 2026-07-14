import type { GrapesTemplateDefinition } from '../editor/storage';

export type EmailImportSnapshotReason = 'html-edit' | 'html-replace';

export interface EmailImportSnapshot {
  html: string;
  css: string;
  capturedAt: string;
  reason: EmailImportSnapshotReason;
}

export type GrapesTemplateDefinitionWithSnapshot = GrapesTemplateDefinition & {
  importSnapshot?: EmailImportSnapshot | null;
};

export function readImportSnapshot(
  definition: GrapesTemplateDefinition | null | undefined
): EmailImportSnapshot | null {
  if (!definition || typeof definition !== 'object') return null;
  const snapshot = (definition as GrapesTemplateDefinitionWithSnapshot).importSnapshot;
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (!String(snapshot.html || '').trim()) return null;
  return snapshot;
}

export function buildSnapshotFromParts(
  html: string,
  css: string,
  reason: EmailImportSnapshotReason
): EmailImportSnapshot {
  return {
    html: String(html || ''),
    css: String(css || ''),
    capturedAt: new Date().toISOString(),
    reason
  };
}

export function attachImportSnapshot(
  definition: GrapesTemplateDefinition,
  snapshot: EmailImportSnapshot | null | undefined
): GrapesTemplateDefinitionWithSnapshot {
  const { importSnapshot: _existing, ...base } = definition as GrapesTemplateDefinitionWithSnapshot;
  if (!snapshot) {
    return base;
  }
  return {
    ...base,
    importSnapshot: snapshot
  };
}

/** True when HTML still has email layout structure (not a flattened text blob). */
export function emailHtmlLooksStructured(html: string): boolean {
  const source = String(html || '');
  if (/<table\b/i.test(source)) return true;
  if (/<(td|th|tr)\b/i.test(source)) return true;
  const blocks = source.match(/<(div|section|article|header|footer|p|h[1-6]|ul|ol)\b/gi);
  return Boolean(blocks && blocks.length >= 2);
}

function emailHtmlWeight(html: string): number {
  const source = String(html || '');
  const tables = (source.match(/<table\b/gi) || []).length;
  return source.trim().length + tables * 500;
}

/**
 * True when `next` would discard a richer email definition (empty, flat, or severe shrink).
 */
export function isEmailDefinitionDegraded(
  next: GrapesTemplateDefinition | null | undefined,
  previous: GrapesTemplateDefinition | null | undefined
): boolean {
  if (!previous) return false;
  const prevHtml = String(
    previous.html || readImportSnapshot(previous)?.html || ''
  ).trim();
  if (!prevHtml) return false;

  const nextHtml = String(next?.html || readImportSnapshot(next)?.html || '').trim();
  if (!nextHtml) return true;

  if (emailHtmlLooksStructured(prevHtml) && !emailHtmlLooksStructured(nextHtml)) {
    return true;
  }

  const prevWeight = emailHtmlWeight(prevHtml);
  const nextWeight = emailHtmlWeight(nextHtml);
  if (prevWeight > 800 && nextWeight < prevWeight * 0.4) {
    return true;
  }
  return false;
}

export function preserveEmailCss(nextCss: string, previousCss: string): string {
  const next = String(nextCss || '').trim();
  if (next) return next;
  return String(previousCss || '').trim();
}

/**
 * Keep previous HTML when the next serialize is empty, flattened, or a severe shrink.
 * Live structured canvas content still wins when it is not a major regression.
 */
export function preserveEmailHtml(nextHtml: string, previousHtml: string): string {
  const next = String(nextHtml || '').trim();
  const previous = String(previousHtml || '').trim();
  if (!previous) return next;
  if (!next) return previous;
  if (emailHtmlLooksStructured(previous) && !emailHtmlLooksStructured(next)) {
    return previous;
  }
  if (emailHtmlLooksStructured(next)) {
    const prevWeight = emailHtmlWeight(previous);
    const nextWeight = emailHtmlWeight(next);
    if (prevWeight > 800 && nextWeight < prevWeight * 0.4) {
      return previous;
    }
    return next;
  }
  return previous;
}

/** Merge canvas serialize with last-known-good email html/css/snapshot. */
export function protectEmailDefinitionRoundTrip(
  next: GrapesTemplateDefinition,
  previous: GrapesTemplateDefinition | null | undefined
): GrapesTemplateDefinition {
  if (!previous) return next;
  if (isEmailDefinitionDegraded(next, previous)) {
    const prevSnapshot = readImportSnapshot(previous);
    return attachImportSnapshot(
      {
        ...previous,
        html: String(previous.html || prevSnapshot?.html || ''),
        css: String(previous.css || prevSnapshot?.css || ''),
        project: null
      },
      prevSnapshot || buildSnapshotFromParts(
        String(previous.html || ''),
        String(previous.css || ''),
        'html-edit'
      )
    );
  }

  const prevSnapshot = readImportSnapshot(previous);
  const nextSnapshot = readImportSnapshot(next);

  const html = preserveEmailHtml(next.html, previous.html || prevSnapshot?.html || '');
  const css = preserveEmailCss(
    next.css,
    previous.css || prevSnapshot?.css || nextSnapshot?.css || ''
  );

  const snapshotHtml = preserveEmailHtml(
    nextSnapshot?.html || html,
    prevSnapshot?.html || previous.html || ''
  );
  const snapshotCss = preserveEmailCss(
    nextSnapshot?.css || css,
    prevSnapshot?.css || previous.css || ''
  );

  const protectedDef: GrapesTemplateDefinition = {
    ...next,
    html,
    css,
    project: null
  };

  if (!snapshotHtml.trim()) {
    return protectedDef;
  }

  return attachImportSnapshot(
    protectedDef,
    buildSnapshotFromParts(
      snapshotHtml,
      snapshotCss,
      nextSnapshot?.reason || prevSnapshot?.reason || 'html-edit'
    )
  );
}

