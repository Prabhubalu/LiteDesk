export type BuilderEnterBehavior = 'continue' | 'linebreak';

export interface BuilderInlineEditConfig {
  bindingField: string;
  enterBehavior: BuilderEnterBehavior;
  multiline?: boolean;
  plainText?: boolean;
  textClass?: string;
  placeholderKey?: string;
}

export const BUILDER_INLINE_EDIT_CONFIG: Record<string, BuilderInlineEditConfig> = {
  Heading: {
    bindingField: 'text',
    enterBehavior: 'continue',
    placeholderKey: 'templates.builderHeadingPlaceholder'
  },
  Paragraph: {
    bindingField: 'text',
    enterBehavior: 'linebreak',
    multiline: true,
    placeholderKey: 'templates.builderParagraphPlaceholder'
  },
  RichText: {
    bindingField: 'html',
    enterBehavior: 'linebreak',
    multiline: true,
    placeholderKey: 'templates.builderRichTextPlaceholder'
  },
  Html: {
    bindingField: 'html',
    enterBehavior: 'linebreak',
    multiline: true,
    placeholderKey: 'templates.builderHtmlPlaceholder'
  },
  Link: {
    bindingField: 'text',
    enterBehavior: 'continue',
    textClass: 'text-sm text-primary-600 underline',
    placeholderKey: 'templates.builderLinkPlaceholder'
  },
  Button: {
    bindingField: 'text',
    enterBehavior: 'continue',
    textClass: 'text-xs font-medium text-white',
    placeholderKey: 'templates.builderButtonPlaceholder'
  },
  List: {
    bindingField: 'items',
    enterBehavior: 'linebreak',
    multiline: true,
    plainText: true,
    textClass: 'text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap',
    placeholderKey: 'templates.builderListPlaceholder'
  },
  Variable: {
    bindingField: 'name',
    enterBehavior: 'continue',
    plainText: true,
    textClass: 'font-mono text-xs',
    placeholderKey: 'templates.builderVariablePlaceholder'
  },
  Formula: {
    bindingField: 'expression',
    enterBehavior: 'linebreak',
    multiline: true,
    plainText: true,
    textClass: 'font-mono text-xs whitespace-pre-wrap',
    placeholderKey: 'templates.builderFormulaPlaceholder'
  },
  PageNumber: {
    bindingField: 'format',
    enterBehavior: 'continue',
    plainText: true,
    textClass: 'text-xs text-neutral-600',
    placeholderKey: 'templates.builderPageNumberPlaceholder'
  },
  Watermark: {
    bindingField: 'text',
    enterBehavior: 'linebreak',
    plainText: true,
    textClass: 'text-3xl font-bold uppercase tracking-widest text-neutral-300/80 text-center',
    placeholderKey: 'templates.builderWatermarkPlaceholder'
  },
  QrCode: {
    bindingField: 'value',
    enterBehavior: 'continue',
    plainText: true,
    textClass: 'font-mono text-xs',
    placeholderKey: 'templates.builderValuePlaceholder'
  },
  Barcode: {
    bindingField: 'value',
    enterBehavior: 'continue',
    plainText: true,
    textClass: 'font-mono text-xs',
    placeholderKey: 'templates.builderValuePlaceholder'
  },
  Signature: {
    bindingField: 'label',
    enterBehavior: 'continue',
    plainText: true,
    textClass: 'text-sm text-neutral-700',
    placeholderKey: 'templates.builderSignaturePlaceholder'
  }
};

/** Binding keys edited on canvas — hide from properties panel. */
export const BUILDER_CANVAS_EDITED_BINDING_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(BUILDER_INLINE_EDIT_CONFIG).map(([type, config]) => [type, [config.bindingField]])
);

export function getBuilderInlineEditConfig(type: string): BuilderInlineEditConfig | null {
  return BUILDER_INLINE_EDIT_CONFIG[String(type || '').trim()] || null;
}

export function hasCanvasInlineEdit(type: string): boolean {
  return Boolean(getBuilderInlineEditConfig(type));
}

export function resolveCanvasInlineText(node: { bindings?: Record<string, unknown> } | null | undefined, config: BuilderInlineEditConfig): string {
  const bindings = node?.bindings || {};
  const value = bindings[config.bindingField];
  if (config.bindingField === 'items') {
    if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
    return String(value ?? '');
  }
  return String(value ?? '');
}
