/**
 * MVP component types for the Content & Document Platform (C0 contract).
 * Keep in sync with server/constants/contentComponentRegistry.js
 */

export const CONTENT_COMPONENT_TYPES = {
  PAGE: 'Page',
  SECTION: 'Section',
  CONTAINER: 'Container',
  GRID: 'Grid',
  FLEX: 'Flex',
  ROW: 'Row',
  COLUMN: 'Column',
  DIVIDER: 'Divider',
  SPACER: 'Spacer',
  PAGE_BREAK: 'PageBreak',
  HEADING: 'Heading',
  PARAGRAPH: 'Paragraph',
  RICH_TEXT: 'RichText',
  LIST: 'List',
  LINK: 'Link',
  IMAGE: 'Image',
  LOGO: 'Logo',
  ICON: 'Icon',
  QR_CODE: 'QrCode',
  BARCODE: 'Barcode',
  SIGNATURE: 'Signature',
  MERGE_TAG: 'MergeTag',
  VARIABLE: 'Variable',
  FORMULA: 'Formula',
  TABLE: 'Table',
  LINE_ITEM: 'LineItem',
  REPEATER: 'Repeater',
  RELATED_RECORDS: 'RelatedRecords',
  TOTALS: 'Totals',
  TAX_SUMMARY: 'TaxSummary',
  ADDRESS_BLOCK: 'AddressBlock',
  CONTACT_CARD: 'ContactCard',
  ORGANIZATION_BLOCK: 'OrganizationBlock',
  BUTTON: 'Button',
  SOCIAL_ICONS: 'SocialIcons',
  HEADER: 'Header',
  FOOTER: 'Footer',
  PAGE_NUMBER: 'PageNumber',
  WATERMARK: 'Watermark',
  CONDITIONAL_BLOCK: 'ConditionalBlock',
  LOOP: 'Loop',
  HTML: 'Html'
} as const;

export type ContentComponentType =
  typeof CONTENT_COMPONENT_TYPES[keyof typeof CONTENT_COMPONENT_TYPES];

export interface ContentComponentNode {
  id: string;
  type: ContentComponentType | string;
  name?: string;
  layout?: Record<string, unknown>;
  style?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  visibility?: Record<string, unknown>;
  children?: ContentComponentNode[];
}

const CONTENT_COMPONENT_TYPE_SET = new Set<string>(Object.values(CONTENT_COMPONENT_TYPES));

export function isRegisteredContentComponentType(type: string): boolean {
  return CONTENT_COMPONENT_TYPE_SET.has(String(type || '').trim());
}

export function isRootContentComponentType(type: string): boolean {
  return type === CONTENT_COMPONENT_TYPES.PAGE;
}

export const BUILDER_CONTAINER_COMPONENT_TYPES = new Set<string>([
  CONTENT_COMPONENT_TYPES.SECTION,
  CONTENT_COMPONENT_TYPES.CONTAINER,
  CONTENT_COMPONENT_TYPES.GRID,
  CONTENT_COMPONENT_TYPES.FLEX,
  CONTENT_COMPONENT_TYPES.ROW,
  CONTENT_COMPONENT_TYPES.COLUMN,
  CONTENT_COMPONENT_TYPES.REPEATER,
  CONTENT_COMPONENT_TYPES.LOOP,
  CONTENT_COMPONENT_TYPES.HEADER,
  CONTENT_COMPONENT_TYPES.FOOTER,
  CONTENT_COMPONENT_TYPES.CONDITIONAL_BLOCK
]);

export function isBuilderContainerComponentType(type: string): boolean {
  return BUILDER_CONTAINER_COMPONENT_TYPES.has(String(type || '').trim());
}
