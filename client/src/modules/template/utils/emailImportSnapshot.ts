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
