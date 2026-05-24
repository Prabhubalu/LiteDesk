/**
 * Translation catalog normalization for vue-i18n and TMS export (Crowdin / Lokalise / Phrase).
 */

export type CatalogEntry =
  | string
  | {
      message: string;
      description?: string;
      deprecated?: boolean;
      deprecatedBy?: string;
      context?: string;
    };

export type CatalogFile = Record<string, CatalogEntry>;

export type FlatMessages = Record<string, string>;

export type CatalogMetadata = Record<
  string,
  { description?: string; deprecated?: boolean; deprecatedBy?: string; context?: string }
>;

/**
 * Flatten a namespace catalog into vue-i18n message keys.
 * @param entries - Keys relative to namespace (e.g. "save" in actions.json)
 * @param namespace - Prefix without trailing dot (e.g. "actions")
 */
export function flattenCatalog(entries: CatalogFile, namespace: string): {
  messages: FlatMessages;
  metadata: CatalogMetadata;
} {
  const messages: FlatMessages = {};
  const metadata: CatalogMetadata = {};

  for (const [key, value] of Object.entries(entries)) {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    assertKeyDepth(fullKey);

    if (typeof value === 'string') {
      messages[fullKey] = value;
      continue;
    }

    if (value && typeof value === 'object' && 'message' in value) {
      messages[fullKey] = value.message;
      metadata[fullKey] = {
        description: value.description,
        deprecated: value.deprecated,
        deprecatedBy: value.deprecatedBy,
        context: value.context,
      };
    }
  }

  return { messages, metadata };
}

export function assertKeyDepth(fullKey: string): void {
  const depth = fullKey.split('.').length;
  if (depth > 3) {
    throw new Error(
      `i18n key "${fullKey}" exceeds max nesting depth of 3. Use a flatter key or a new namespace segment.`
    );
  }
}

/** Reject generic leaf segment names per governance rules. */
const FORBIDDEN_LEAF_SEGMENTS = new Set([
  'title',
  'label',
  'message',
  'text',
  'name',
  'description',
  'error',
  'hint',
  'placeholder',
]);

export function validateKeyNaming(fullKey: string): string[] {
  const issues: string[] = [];
  const segments = fullKey.split('.');
  const leaf = segments[segments.length - 1];

  if (FORBIDDEN_LEAF_SEGMENTS.has(leaf)) {
    issues.push(`Key "${fullKey}" uses forbidden generic leaf segment "${leaf}".`);
  }

  if (segments.length > 3) {
    issues.push(`Key "${fullKey}" exceeds max depth of 3.`);
  }

  const segment = '[a-z][a-zA-Z0-9]*';
  const snakeLeaf = '[a-z][a-z0-9]*(?:_[a-z0-9]+)*';
  let pattern;
  if (fullKey.startsWith('errors.')) {
    pattern = new RegExp(`^errors(\\.${snakeLeaf}){1,2}$`);
  } else if (fullKey.startsWith('validation.')) {
    pattern = new RegExp(`^validation(\\.${segment}){1,2}$`);
  } else {
    pattern = new RegExp(`^${segment}(\\.${segment}){0,2}$`);
  }

  if (!pattern.test(fullKey)) {
    issues.push(`Key "${fullKey}" must follow namespace naming rules (see I18N_GUIDELINES.md).`);
  }

  return issues;
}

/**
 * Export TMS-friendly catalog with deterministic key ordering.
 */
export function toTranslationPlatformExport(
  messages: FlatMessages,
  metadata: CatalogMetadata
): Record<string, CatalogEntry> {
  const out: Record<string, CatalogEntry> = {};
  for (const key of Object.keys(messages).sort()) {
    const meta = metadata[key];
    if (meta?.description || meta?.deprecated) {
      out[key] = {
        message: messages[key],
        description: meta.description,
        deprecated: meta.deprecated,
        deprecatedBy: meta.deprecatedBy,
        context: meta.context,
      };
    } else {
      out[key] = messages[key];
    }
  }
  return out;
}
