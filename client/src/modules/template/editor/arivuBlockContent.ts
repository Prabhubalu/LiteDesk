import { CONTENT_COMPONENT_TYPES as T } from '@/constants/contentComponentRegistry';
import type { BlockCatalogEntry, BlockCatalogFormat } from './blockCatalog';

const mergeChipStyle =
  'display:inline-block;padding:2px 6px;border-radius:4px;background:#eef2ff;color:#4338ca;font-family:monospace;font-size:13px;';

export function mergeToken(path: string): string {
  return `{{${path}}}`;
}

export function mergeField(path: string): string {
  return `<span data-merge-field="true" data-gjs-type="text" style="${mergeChipStyle}">${mergeToken(path)}</span>`;
}

export interface ArivuBlockDefinition {
  id: string;
  label: string;
  iconType: string;
  labelKey: string;
  groupKey: string;
  formats: BlockCatalogFormat[];
  content: string;
}

export const ARIVU_BLOCK_DEFINITIONS: ArivuBlockDefinition[] = [
  // Layout
  {
    id: 'section',
    label: 'Section',
    iconType: T.SECTION,
    labelKey: 'templates.builderComponentSection',
    groupKey: 'templates.builderGroupLayout',
    formats: ['all'],
    content:
      '<section data-section="true" style="padding:24px 0;"><div style="max-width:720px;margin:0 auto;">Section content</div></section>'
  },
  {
    id: 'container',
    label: 'Container',
    iconType: T.CONTAINER,
    labelKey: 'templates.builderComponentContainer',
    groupKey: 'templates.builderGroupLayout',
    formats: ['all'],
    content:
      '<div data-container="true" style="max-width:720px;margin:0 auto;padding:16px;">Container content</div>'
  },
  {
    id: 'row',
    label: 'Row',
    iconType: T.ROW,
    labelKey: 'templates.builderComponentRow',
    groupKey: 'templates.builderGroupLayout',
    formats: ['all'],
    content:
      '<div data-row="true" class="arivu-layout-row" style="display:flex;flex-wrap:wrap;gap:16px;width:100%;"><div data-column="true" class="arivu-layout-col" style="flex:1;min-width:120px;">Column</div><div data-column="true" class="arivu-layout-col" style="flex:1;min-width:120px;">Column</div></div>'
  },
  {
    id: 'column',
    label: 'Column',
    iconType: T.COLUMN,
    labelKey: 'templates.builderComponentColumn',
    groupKey: 'templates.builderGroupLayout',
    formats: ['all'],
    content:
      '<div data-column="true" class="arivu-layout-col" style="flex:1;min-width:120px;padding:8px;">Column content</div>'
  },
  {
    id: 'divider',
    label: 'Divider',
    iconType: T.DIVIDER,
    labelKey: 'templates.builderComponentDivider',
    groupKey: 'templates.builderGroupLayout',
    formats: ['print'],
    content: '<hr data-divider="true" style="border:0;border-top:1px solid #e5e7eb;margin:16px 0;" />'
  },
  {
    id: 'spacer',
    label: 'Spacer',
    iconType: T.SPACER,
    labelKey: 'templates.builderComponentSpacer',
    groupKey: 'templates.builderGroupLayout',
    formats: ['all'],
    content: '<div data-spacer="true" style="height:24px;line-height:24px;font-size:1px;">&nbsp;</div>'
  },
  {
    id: 'header-block',
    label: 'Header',
    iconType: T.HEADER,
    labelKey: 'templates.builderComponentHeader',
    groupKey: 'templates.builderGroupLayout',
    formats: ['all'],
    content: `<header data-header-block="true" style="padding:16px 0;border-bottom:1px solid #e5e7eb;"><strong>${mergeField('Organization.name')}</strong></header>`
  },
  {
    id: 'footer-block',
    label: 'Footer',
    iconType: T.FOOTER,
    labelKey: 'templates.builderComponentFooter',
    groupKey: 'templates.builderGroupLayout',
    formats: ['all'],
    content: `<footer data-footer-block="true" style="padding:16px 0;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${mergeField('Organization.name')} · ${mergeField('Organization.website')}</footer>`
  },

  // Typography
  {
    id: 'heading',
    label: 'Heading',
    iconType: T.HEADING,
    labelKey: 'templates.builderComponentHeading',
    groupKey: 'templates.builderGroupTypography',
    formats: ['all'],
    content:
      '<h2 data-heading="true" style="margin:0 0 12px;font-size:24px;font-weight:700;line-height:1.3;color:#111827;">Heading</h2>'
  },
  {
    id: 'paragraph',
    label: 'Paragraph',
    iconType: T.PARAGRAPH,
    labelKey: 'templates.builderComponentParagraph',
    groupKey: 'templates.builderGroupTypography',
    formats: ['all'],
    content:
      '<p data-paragraph="true" style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">Start typing your paragraph text here.</p>'
  },
  {
    id: 'text-block',
    label: 'Text',
    iconType: T.PARAGRAPH,
    labelKey: 'templates.builderComponentText',
    groupKey: 'templates.builderGroupTypography',
    formats: ['all'],
    content:
      '<div data-text-block="true" style="font-size:14px;line-height:1.5;color:#374151;">Text</div>'
  },
  {
    id: 'rich-text',
    label: 'Rich text',
    iconType: T.RICH_TEXT,
    labelKey: 'templates.builderComponentRichText',
    groupKey: 'templates.builderGroupTypography',
    formats: ['all'],
    content:
      '<div data-rich-text="true" style="font-size:14px;line-height:1.6;color:#374151;"><p style="margin:0 0 8px;"><strong>Rich text</strong> with <em>formatting</em>.</p></div>'
  },
  {
    id: 'list-block',
    label: 'List',
    iconType: T.LIST,
    labelKey: 'templates.builderComponentList',
    groupKey: 'templates.builderGroupTypography',
    formats: ['print'],
    content:
      '<ul data-list="true" style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.6;color:#374151;"><li>List item one</li><li>List item two</li></ul>'
  },

  // Media
  {
    id: 'logo',
    label: 'Logo',
    iconType: T.LOGO,
    labelKey: 'templates.builderComponentLogo',
    groupKey: 'templates.builderGroupMedia',
    formats: ['all'],
    content: `<img data-logo="true" data-company-logo="true" data-merge-src="${mergeToken('CurrentOrganization.logoUrl')}" src="${mergeToken('CurrentOrganization.logoUrl')}" alt="${mergeToken('CurrentOrganization.name')}" style="max-height:64px;max-width:200px;height:auto;" />`
  },
  {
    id: 'icon-block',
    label: 'Icon',
    iconType: T.ICON,
    labelKey: 'templates.builderComponentIcon',
    groupKey: 'templates.builderGroupMedia',
    formats: ['all'],
    content:
      '<span data-icon="true" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#eef2ff;color:#4338ca;font-size:16px;">★</span>'
  },
  {
    id: 'qr-code',
    label: 'QR code',
    iconType: T.QR_CODE,
    labelKey: 'templates.builderComponentQrCode',
    groupKey: 'templates.builderGroupMedia',
    formats: ['all'],
    content: `<div data-qr-code="true" data-value="{{Record.id}}" style="width:96px;height:96px;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#64748b;text-align:center;padding:4px;">QR<br/>${mergeField('Record.id')}</div>`
  },
  {
    id: 'barcode',
    label: 'Barcode',
    iconType: T.BARCODE,
    labelKey: 'templates.builderComponentBarcode',
    groupKey: 'templates.builderGroupMedia',
    formats: ['all'],
    content: `<div data-barcode="true" data-format="code128" style="padding:8px 12px;border:1px solid #e5e7eb;font-family:monospace;font-size:12px;letter-spacing:2px;">${mergeField('Record.number')}</div>`
  },
  {
    id: 'signature',
    label: 'Signature',
    iconType: T.SIGNATURE,
    labelKey: 'templates.builderComponentSignature',
    groupKey: 'templates.builderGroupMedia',
    formats: ['all'],
    content:
      `<div data-signature="true" style="margin-top:24px;padding-top:8px;border-top:1px solid #d1d5db;max-width:240px;"><div style="height:48px;"></div><div style="font-size:12px;color:#6b7280;">${mergeField('People.fullName')}</div></div>`
  },

  // Data
  {
    id: 'merge-field',
    label: 'Merge field',
    iconType: T.MERGE_TAG,
    labelKey: 'templates.builderComponentMergeField',
    groupKey: 'templates.builderGroupData',
    formats: ['all'],
    content: mergeField('Organization.name')
  },
  {
    id: 'merge-tag',
    label: 'Merge tag',
    iconType: T.MERGE_TAG,
    labelKey: 'templates.builderComponentMergeTag',
    groupKey: 'templates.builderGroupData',
    formats: ['all'],
    content: mergeField('Record.name')
  },
  {
    id: 'variable',
    label: 'Variable',
    iconType: T.VARIABLE,
    labelKey: 'templates.builderComponentVariable',
    groupKey: 'templates.builderGroupData',
    formats: ['all'],
    content:
      '<span data-variable="true" data-name="customVar" style="font-family:monospace;background:#fef3c7;padding:2px 6px;border-radius:4px;color:#92400e;">{{$customVar}}</span>'
  },
  {
    id: 'formula',
    label: 'Formula',
    iconType: T.FORMULA,
    labelKey: 'templates.builderComponentFormula',
    groupKey: 'templates.builderGroupData',
    formats: ['all'],
    content:
      '<span data-formula="true" data-expression="subtotal * 0.1" style="font-family:monospace;background:#ecfdf5;padding:2px 6px;border-radius:4px;color:#047857;">{{formula}}</span>'
  },

  // Collections
  {
    id: 'table',
    label: 'Table',
    iconType: T.TABLE,
    labelKey: 'templates.builderComponentTable',
    groupKey: 'templates.builderGroupCollections',
    formats: ['all'],
    content:
      '<table data-col-widths="50,50" style="width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><thead><tr><th style="border:1px solid #e5e5e5;padding:8px;text-align:left;background:#f9fafb;">Column</th><th style="border:1px solid #e5e5e5;padding:8px;text-align:left;background:#f9fafb;">Column</th></tr></thead><tbody><tr><td style="border:1px solid #e5e5e5;padding:8px;">Cell</td><td style="border:1px solid #e5e5e5;padding:8px;">Cell</td></tr></tbody></table>'
  },
  {
    id: 'line-item',
    label: 'Line items',
    iconType: T.LINE_ITEM,
    labelKey: 'templates.builderComponentLineItem',
    groupKey: 'templates.builderGroupCollections',
    formats: ['all'],
    content: '__LINE_ITEM__'
  },
  {
    id: 'repeater',
    label: 'Repeater',
    iconType: T.REPEATER,
    labelKey: 'templates.builderComponentRepeater',
    groupKey: 'templates.builderGroupCollections',
    formats: ['all'],
    content: `<div data-repeater="true" data-collection="lines" style="padding:8px;border:1px dashed #6366f1;background:#eef2ff;border-radius:6px;"><div data-repeater-item="true" style="padding:6px 0;">${mergeField('line.name')}</div></div>`
  },
  {
    id: 'related-records',
    label: 'Related records',
    iconType: T.RELATED_RECORDS,
    labelKey: 'templates.builderComponentRelatedRecords',
    groupKey: 'templates.builderGroupCollections',
    formats: ['all'],
    content: `<div data-related-records="true" data-relation="contacts" style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;"><strong style="display:block;margin-bottom:8px;font-size:13px;">Related records</strong><div>${mergeField('related.name')}</div></div>`
  },

  // Financial
  {
    id: 'totals',
    label: 'Totals',
    iconType: T.TOTALS,
    labelKey: 'templates.builderComponentTotals',
    groupKey: 'templates.builderGroupFinancial',
    formats: ['all'],
    content: `<div data-totals="true" style="max-width:280px;margin-left:auto;padding:12px;border:1px solid #e5e7eb;border-radius:6px;"><div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Subtotal</span>${mergeField('Quote.subtotal')}</div><div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Tax</span>${mergeField('Quote.taxTotal')}</div><div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:700;border-top:1px solid #e5e7eb;margin-top:4px;padding-top:8px;"><span>Total</span>${mergeField('Quote.grandTotal')}</div></div>`
  },
  {
    id: 'tax-summary',
    label: 'Tax summary',
    iconType: T.TAX_SUMMARY,
    labelKey: 'templates.builderComponentTaxSummary',
    groupKey: 'templates.builderGroupFinancial',
    formats: ['all'],
    content: `<div data-tax-summary="true" style="max-width:280px;margin-left:auto;padding:12px;border:1px solid #e5e7eb;border-radius:6px;"><div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Taxable amount</span>${mergeField('Quote.taxableAmount')}</div><div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:600;"><span>Tax total</span>${mergeField('Quote.taxTotal')}</div></div>`
  },

  // CRM
  {
    id: 'address-block',
    label: 'Address',
    iconType: T.ADDRESS_BLOCK,
    labelKey: 'templates.builderComponentAddressBlock',
    groupKey: 'templates.builderGroupCrm',
    formats: ['all'],
    content: `<div data-address-block="true" style="line-height:1.5;font-size:14px;">${mergeField('Organization.name')}<br/>${mergeField('Organization.address')}<br/>${mergeField('Organization.city')}, ${mergeField('Organization.state')} ${mergeField('Organization.postalCode')}</div>`
  },
  {
    id: 'organization-block',
    label: 'Organization',
    iconType: T.ORGANIZATION_BLOCK,
    labelKey: 'templates.builderComponentOrganizationBlock',
    groupKey: 'templates.builderGroupCrm',
    formats: ['all'],
    content: `<div data-organization-block="true" style="padding:12px;border:1px solid #e5e7eb;border-radius:6px;"><strong>${mergeField('Organization.name')}</strong><br/>${mergeField('Organization.website')}<br/>${mergeField('Organization.phone')}</div>`
  },
  {
    id: 'contact-card',
    label: 'Contact card',
    iconType: T.CONTACT_CARD,
    labelKey: 'templates.builderComponentContactCard',
    groupKey: 'templates.builderGroupCrm',
    formats: ['all'],
    content: `<div data-contact-card="true" style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;max-width:280px;"><strong style="display:block;margin-bottom:4px;">${mergeField('People.fullName')}</strong><span style="display:block;font-size:13px;color:#6b7280;">${mergeField('People.email')}</span><span style="display:block;font-size:13px;color:#6b7280;">${mergeField('People.phone')}</span></div>`
  },

  // Interactive
  {
    id: 'cta-button',
    label: 'Button',
    iconType: T.BUTTON,
    labelKey: 'templates.builderComponentButton',
    groupKey: 'templates.builderGroupInteractive',
    formats: ['print'],
    content:
      '<a data-button="true" href="#" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Call to action</a>'
  },
  {
    id: 'email-button',
    label: 'Email button',
    iconType: T.BUTTON,
    labelKey: 'templates.builderComponentButton',
    groupKey: 'templates.builderGroupInteractive',
    formats: ['email'],
    content:
      '<table data-button="true" cellspacing="0" cellpadding="0" role="presentation"><tr><td style="border-radius:6px;background:#4f46e5;"><a href="#" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;font-family:Arial,sans-serif;">Call to action</a></td></tr></table>'
  },
  {
    id: 'social-icons',
    label: 'Social icons',
    iconType: T.SOCIAL_ICONS,
    labelKey: 'templates.builderComponentSocialIcons',
    groupKey: 'templates.builderGroupInteractive',
    formats: ['all'],
    content:
      `<div data-social-icons="true" style="display:flex;flex-wrap:wrap;gap:12px;padding:8px 0;font-size:13px;"><a href="${mergeToken('Organization.linkedinUrl')}" style="color:#4f46e5;text-decoration:none;">LinkedIn</a><a href="${mergeToken('Organization.twitterUrl')}" style="color:#4f46e5;text-decoration:none;">Twitter</a><a href="${mergeToken('Organization.website')}" style="color:#4f46e5;text-decoration:none;">Website</a></div>`
  },

  // Print
  {
    id: 'page-break',
    label: 'Page break',
    iconType: T.PAGE_BREAK,
    labelKey: 'templates.builderComponentPageBreak',
    groupKey: 'templates.builderGroupPrint',
    formats: ['print'],
    content: '<div data-page-break="true" style="height:1px;page-break-after:always;"></div>'
  },
  {
    id: 'page-number',
    label: 'Page number',
    iconType: T.PAGE_NUMBER,
    labelKey: 'templates.builderComponentPageNumber',
    groupKey: 'templates.builderGroupPrint',
    formats: ['print'],
    content: mergeField('System.pageNumber')
  },
  {
    id: 'watermark',
    label: 'Watermark',
    iconType: T.WATERMARK,
    labelKey: 'templates.builderComponentWatermark',
    groupKey: 'templates.builderGroupPrint',
    formats: ['print'],
    content:
      '<div data-watermark="true" style="text-align:center;font-size:48px;font-weight:700;color:rgba(148,163,184,0.35);transform:rotate(-30deg);margin:32px 0;pointer-events:none;user-select:none;">DRAFT</div>'
  },

  // Logic
  {
    id: 'conditional-block',
    label: 'Conditional',
    iconType: T.CONDITIONAL_BLOCK,
    labelKey: 'templates.builderComponentConditionalBlock',
    groupKey: 'templates.builderGroupLogic',
    formats: ['all'],
    content:
      '<div data-conditional="true" data-condition="{{Record.status}} == \'Draft\'" style="padding:12px;border:1px dashed #f59e0b;background:#fffbeb;border-radius:6px;">Conditional content</div>'
  },
  {
    id: 'loop',
    label: 'Loop',
    iconType: T.LOOP,
    labelKey: 'templates.builderComponentLoop',
    groupKey: 'templates.builderGroupLogic',
    formats: ['all'],
    content: `<div data-loop="true" data-collection="lines" style="padding:8px;border:1px dashed #8b5cf6;background:#faf5ff;border-radius:6px;"><div style="padding:6px 0;">${mergeField('line.name')}</div></div>`
  },
  {
    id: 'html-block',
    label: 'HTML',
    iconType: T.HTML,
    labelKey: 'templates.builderComponentHtml',
    groupKey: 'templates.builderGroupLogic',
    formats: ['all'],
    content:
      '<div data-html-block="true" style="padding:12px;border:1px dashed #94a3b8;background:#f8fafc;border-radius:6px;font-family:monospace;font-size:12px;color:#475569;">&lt;!-- Custom HTML --&gt;</div>'
  }
];

export function arivuBlockToCatalogEntry(block: ArivuBlockDefinition): BlockCatalogEntry {
  return {
    id: block.id,
    iconType: block.iconType,
    labelKey: block.labelKey,
    groupKey: block.groupKey,
    source: 'arivu',
    formats: block.formats
  };
}

export function getArivuCatalogEntries(format: BlockCatalogFormat): BlockCatalogEntry[] {
  return ARIVU_BLOCK_DEFINITIONS.filter(
    (block) => block.formats.includes('all') || block.formats.includes(format)
  ).map(arivuBlockToCatalogEntry);
}

export function getArivuBlockDefinition(blockId: string): ArivuBlockDefinition | undefined {
  return ARIVU_BLOCK_DEFINITIONS.find((block) => block.id === blockId);
}
