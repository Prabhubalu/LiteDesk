import { BUILDER_CANVAS_EDITED_BINDING_KEYS } from '@/constants/builderInlineEdit';

export interface BuilderBindingField {
  key: string;
  labelKey: string;
  input: 'text' | 'textarea' | 'number' | 'checkbox';
  rows?: number;
}

const F = (
  key: string,
  labelKey: string,
  input: BuilderBindingField['input'] = 'text',
  rows?: number
): BuilderBindingField => ({ key, labelKey, input, rows });

export const BUILDER_BINDING_FIELDS_BY_TYPE: Record<string, BuilderBindingField[]> = {
  RichText: [F('html', 'templates.builderFieldHtml', 'textarea', 6)],
  Html: [F('html', 'templates.builderFieldHtml', 'textarea', 6)],
  Link: [
    F('text', 'templates.builderFieldText'),
    F('href', 'templates.builderFieldHref')
  ],
  Button: [
    F('text', 'templates.builderFieldText'),
    F('href', 'templates.builderFieldHref')
  ],
  List: [
    F('items', 'templates.builderFieldListItems', 'textarea', 4),
    F('ordered', 'templates.builderFieldListOrdered', 'checkbox')
  ],
  Variable: [
    F('name', 'templates.builderFieldVariableName'),
    F('defaultValue', 'templates.builderFieldDefaultValue')
  ],
  Formula: [F('expression', 'templates.builderFieldExpression', 'textarea', 3)],
  QrCode: [F('value', 'templates.builderFieldValue')],
  Barcode: [
    F('value', 'templates.builderFieldValue'),
    F('format', 'templates.builderFieldBarcodeFormat')
  ],
  Icon: [
    F('name', 'templates.builderFieldIconName'),
    F('size', 'templates.builderFieldIconSize', 'number')
  ],
  Signature: [
    F('label', 'templates.builderFieldLabel'),
    F('signerName', 'templates.builderFieldSignerName')
  ],
  Repeater: [
    F('collection', 'templates.builderFieldCollection'),
    F('itemAlias', 'templates.builderFieldItemAlias')
  ],
  Loop: [
    F('collection', 'templates.builderFieldCollection'),
    F('itemAlias', 'templates.builderFieldItemAlias')
  ],
  ConditionalBlock: [F('condition', 'templates.builderFieldCondition', 'textarea', 2)],
  Row: [F('gap', 'templates.builderFieldRowGap', 'number')],
  Column: [F('span', 'templates.builderFieldColumnSpan', 'number')],
  RelatedRecords: [
    F('relation', 'templates.builderFieldRelation'),
    F('moduleScope', 'templates.builderFieldModuleScope')
  ],
  AddressBlock: [F('path', 'templates.builderFieldRecordPath')],
  ContactCard: [F('path', 'templates.builderFieldRecordPath')],
  OrganizationBlock: [F('path', 'templates.builderFieldRecordPath')],
  Totals: [
    F('showSubtotal', 'templates.builderFieldShowSubtotal', 'checkbox'),
    F('showTax', 'templates.builderFieldShowTax', 'checkbox'),
    F('showGrandTotal', 'templates.builderFieldShowGrandTotal', 'checkbox')
  ],
  TaxSummary: [F('showTaxBreakdown', 'templates.builderFieldShowTaxBreakdown', 'checkbox')]
};

export function getBuilderBindingFields(type: string): BuilderBindingField[] {
  const normalized = String(type || '').trim();
  const fields = BUILDER_BINDING_FIELDS_BY_TYPE[normalized] || [];
  const skip = new Set(BUILDER_CANVAS_EDITED_BINDING_KEYS[normalized] || []);
  return fields.filter((field) => !skip.has(field.key));
}

export function formatBindingFieldValue(field: BuilderBindingField, value: unknown): unknown {
  if (field.input === 'checkbox') return Boolean(value);
  if (field.input === 'number') return Number(value) || 0;
  if (field.key === 'items') {
    if (Array.isArray(value)) return value.join('\n');
    return String(value ?? '');
  }
  return String(value ?? '');
}

export function parseBindingFieldInput(field: BuilderBindingField, raw: unknown): unknown {
  if (field.input === 'checkbox') return Boolean(raw);
  if (field.input === 'number') return Number(raw) || 0;
  if (field.key === 'items') {
    return String(raw ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return String(raw ?? '');
}
