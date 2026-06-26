/**
 * Content component metadata contract (PRD source of truth).
 * @see docs/architecture/content-component-library.md
 * Keep in sync with server/constants/contentComponentMetadata.js
 */

import { CONTENT_COMPONENT_TYPES } from '@/constants/contentComponentRegistry';

export type OutputSupportLevel = 'full' | 'partial' | 'none' | 'single_page';

export interface ComponentOutputSupport {
  print?: OutputSupportLevel;
  pdf?: OutputSupportLevel;
  email?: OutputSupportLevel;
  html?: OutputSupportLevel;
  portal?: OutputSupportLevel;
  label?: OutputSupportLevel;
}

export type AllowedChildrenPolicy = 'all' | 'all_except_page' | 'none' | string[];

export interface ContentComponentMetadataEntry {
  type: string;
  category: string;
  purpose: string;
  howItWorks: string[];
  supportedOutputs: ComponentOutputSupport;
  allowedChildren: AllowedChildrenPolicy;
  keyProperties: string[];
  specialBehaviors: string[];
  dataBinding?: string[];
  validationRules?: string[];
  aiDescription: string;
  inBuilderCatalog?: boolean;
}

export const CONTENT_COMPONENT_OUTPUT_LEVELS = {
  FULL: 'full',
  PARTIAL: 'partial',
  NONE: 'none',
  SINGLE_PAGE: 'single_page'
} as const;

export const CONTENT_COMPONENT_CHILDREN_POLICIES = {
  ALL: 'all',
  ALL_EXCEPT_PAGE: 'all_except_page',
  NONE: 'none'
} as const;

const OUTPUT = CONTENT_COMPONENT_OUTPUT_LEVELS;
const CHILDREN = CONTENT_COMPONENT_CHILDREN_POLICIES;

export const CONTENT_COMPONENT_METADATA: Readonly<Record<string, ContentComponentMetadataEntry>> = {
  [CONTENT_COMPONENT_TYPES.PAGE]: {
    type: CONTENT_COMPONENT_TYPES.PAGE,
    category: 'layout',
    purpose: 'Represents a single printable page or email body.',
    howItWorks: [
      'Root container of the template.',
      'Defines paper size and margins.',
      'Multiple pages can exist in a single template.',
      'Email templates contain only one page.'
    ],
    supportedOutputs: {
      print: OUTPUT.FULL,
      pdf: OUTPUT.FULL,
      email: OUTPUT.SINGLE_PAGE,
      html: OUTPUT.FULL
    },
    allowedChildren: CHILDREN.ALL,
    keyProperties: ['paperSize', 'orientation', 'margins', 'background', 'header', 'footer'],
    specialBehaviors: ['Root-only node; not in builder catalog.', 'Email enforces single-page constraint.'],
    dataBinding: ['pageSettings', 'runtimeParameters'],
    validationRules: ['Must be template root.', 'Email templates: max one Page node.'],
    aiDescription: 'Root page container defining paper size, margins, and page-level header/footer slots.',
    inBuilderCatalog: false
  },
  [CONTENT_COMPONENT_TYPES.SECTION]: {
    type: CONTENT_COMPONENT_TYPES.SECTION,
    category: 'layout',
    purpose: 'Groups related content into logical sections.',
    howItWorks: [
      'Semantic container with optional background, spacing, and borders.',
      'Automatically grows based on content.'
    ],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['background', 'padding', 'margin', 'border', 'visibility'],
    specialBehaviors: ['Typical document sections: header, customer, items, totals, footer.'],
    dataBinding: ['visibility'],
    aiDescription: 'Semantic section grouping invoice header, customer details, line items, or footer blocks.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.CONTAINER]: {
    type: CONTENT_COMPONENT_TYPES.CONTAINER,
    category: 'layout',
    purpose: 'Generic layout wrapper (HTML div equivalent).',
    howItWorks: ['Used for background, border, padding, shadow, and rounded corners.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['background', 'border', 'padding', 'shadow', 'borderRadius'],
    specialBehaviors: ['Non-semantic wrapper; prefer Section for document meaning.'],
    aiDescription: 'Generic div wrapper for visual styling without semantic document meaning.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.ROW]: {
    type: CONTENT_COMPONENT_TYPES.ROW,
    category: 'layout',
    purpose: 'Horizontal layout container.',
    howItWorks: ['Arranges children horizontally with equal, auto, or fixed width.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['gap', 'alignment', 'distribution', 'wrap'],
    specialBehaviors: ['Example: logo beside invoice number.'],
    aiDescription: 'Horizontal flex row for side-by-side layout such as logo and invoice metadata.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.COLUMN]: {
    type: CONTENT_COMPONENT_TYPES.COLUMN,
    category: 'layout',
    purpose: 'Vertical container inside Row.',
    howItWorks: ['Stacks children vertically.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['gap', 'alignment', 'width', 'flexGrow'],
    specialBehaviors: ['Example: name, address, phone, email stacked.'],
    aiDescription: 'Vertical stack inside a row for address blocks or label-value pairs.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.DIVIDER]: {
    type: CONTENT_COMPONENT_TYPES.DIVIDER,
    category: 'layout',
    purpose: 'Visual separator.',
    howItWorks: ['Horizontal or vertical line; solid, dashed, or dotted; optional center icon.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['orientation', 'style', 'color', 'thickness', 'icon'],
    specialBehaviors: [],
    aiDescription: 'Horizontal or vertical divider line between document sections.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.SPACER]: {
    type: CONTENT_COMPONENT_TYPES.SPACER,
    category: 'layout',
    purpose: 'Creates empty space.',
    howItWorks: ['Adjustable height or width; no visible content.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['height', 'width'],
    specialBehaviors: ['Whitespace only; invisible except spacing.'],
    aiDescription: 'Fixed whitespace gap between blocks.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.PAGE_BREAK]: {
    type: CONTENT_COMPONENT_TYPES.PAGE_BREAK,
    category: 'layout',
    purpose: 'Forces a new page in print/PDF output.',
    howItWorks: ['Inserts CSS break-after: page in print pipeline.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.NONE, html: OUTPUT.PARTIAL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: [],
    specialBehaviors: ['Ignored for email.', 'HTML effect requires print stylesheet.'],
    aiDescription: 'Page break for multi-page PDF and print documents.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.HEADING]: {
    type: CONTENT_COMPONENT_TYPES.HEADING,
    category: 'text',
    purpose: 'Titles and section headers (H1–H6).',
    howItWorks: ['Renders heading level with optional merge tags.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['level', 'text', 'typography', 'alignment'],
    specialBehaviors: ['Inline editing in builder.'],
    dataBinding: ['mergeTags'],
    aiDescription: 'Document heading from H1 to H6 with merge tag support.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.PARAGRAPH]: {
    type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
    category: 'text',
    purpose: 'Simple paragraph text block.',
    howItWorks: ['Plain text with optional inline formatting, merge tags, and variables.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['text', 'typography', 'alignment'],
    specialBehaviors: ['Builder catalog label: Text.'],
    dataBinding: ['mergeTags', 'variables'],
    aiDescription: 'Basic paragraph for body copy, labels, and merge-driven text.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.RICH_TEXT]: {
    type: CONTENT_COMPONENT_TYPES.RICH_TEXT,
    category: 'text',
    purpose: 'Advanced formatted HTML content.',
    howItWorks: ['WYSIWYG block for bold, lists, tables, images, and merge tags.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.PARTIAL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['html', 'typography'],
    specialBehaviors: ['Ideal for Terms & Conditions.', 'Email output sanitized.'],
    dataBinding: ['mergeTags', 'variables', 'html'],
    aiDescription: 'Rich HTML block for terms, policies, and formatted legal copy.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.LINK]: {
    type: CONTENT_COMPONENT_TYPES.LINK,
    category: 'text',
    purpose: 'Clickable hyperlink.',
    howItWorks: ['Renders anchor with static or dynamic href (website, email, phone, portal).'],
    supportedOutputs: {
      print: OUTPUT.PARTIAL,
      pdf: OUTPUT.PARTIAL,
      email: OUTPUT.FULL,
      html: OUTPUT.FULL,
      portal: OUTPUT.FULL
    },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['text', 'href', 'target'],
    specialBehaviors: ['Print/PDF may show URL as text fallback.'],
    dataBinding: ['mergeTags'],
    aiDescription: 'Hyperlink with dynamic URL from merge fields or portal routes.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.LIST]: {
    type: CONTENT_COMPONENT_TYPES.LIST,
    category: 'text',
    purpose: 'Bulleted or numbered lists.',
    howItWorks: ['Static items or collection-driven dynamic list.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['items', 'ordered', 'bulletStyle', 'collection'],
    specialBehaviors: ['Supports nested lists and custom bullets.'],
    dataBinding: ['collection', 'repeater'],
    aiDescription: 'Ordered or unordered list with optional dynamic data binding.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.IMAGE]: {
    type: CONTENT_COMPONENT_TYPES.IMAGE,
    category: 'media',
    purpose: 'Displays PNG, JPEG, WebP, or SVG images.',
    howItWorks: ['Binds to asset URL or merge field with fit/fill/crop options.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['src', 'alt', 'fit', 'fill', 'crop', 'borderRadius'],
    specialBehaviors: ['Lazy loading in HTML output.'],
    dataBinding: ['assets', 'mergeTags'],
    aiDescription: 'General-purpose image block from asset library or merge field URL.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.LOGO]: {
    type: CONTENT_COMPONENT_TYPES.LOGO,
    category: 'media',
    purpose: 'Organization logo image.',
    howItWorks: ['Auto-binds to company, organization, or branch logo.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['src', 'alt', 'themeOverride'],
    specialBehaviors: ['Falls back to tenant branding when src empty.'],
    dataBinding: ['Organization.logo', 'theme'],
    aiDescription: 'Branded logo block with automatic organization binding.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.ICON]: {
    type: CONTENT_COMPONENT_TYPES.ICON,
    category: 'media',
    purpose: 'Symbolic icon display.',
    howItWorks: ['SVG, Font Awesome, or Material Icons by name.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.PARTIAL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['name', 'size', 'color', 'rotation'],
    specialBehaviors: ['Email may rasterize or use Unicode fallback.'],
    aiDescription: 'Named icon with configurable size and color.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.QR_CODE]: {
    type: CONTENT_COMPONENT_TYPES.QR_CODE,
    category: 'media',
    purpose: 'Dynamic QR code generation.',
    howItWorks: ['Encodes URL, text, record ID, payment link, or vCard at render time.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.PARTIAL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['value', 'size', 'errorCorrection'],
    specialBehaviors: ['Rendered as SVG or PNG per output adapter.'],
    dataBinding: ['mergeTags'],
    aiDescription: 'QR code for payment links, record URLs, or contact vCards.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.BARCODE]: {
    type: CONTENT_COMPONENT_TYPES.BARCODE,
    category: 'media',
    purpose: 'Linear barcode generation.',
    howItWorks: ['Encodes merge field value; supports Code128, EAN, UPC.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.NONE, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['value', 'format', 'height', 'displayValue'],
    specialBehaviors: ['QR fallback when format unsupported.'],
    dataBinding: ['mergeTags'],
    aiDescription: 'Barcode for SKU, invoice number, or product identifiers.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.SIGNATURE]: {
    type: CONTENT_COMPONENT_TYPES.SIGNATURE,
    category: 'media',
    purpose: 'Signature display block.',
    howItWorks: ['Uploaded image, user signature asset, or placeholder line.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.PARTIAL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['imageSrc', 'label', 'signerName'],
    specialBehaviors: ['Display only; e-signature execution is out of scope.'],
    aiDescription: 'Signature line or image for approval blocks on quotes and contracts.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.MERGE_TAG]: {
    type: CONTENT_COMPONENT_TYPES.MERGE_TAG,
    category: 'data',
    purpose: 'Displays CRM record fields.',
    howItWorks: ['Resolves merge path with optional format pipe at render time.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['path', 'format', 'fallback'],
    specialBehaviors: ['Builder catalog label: Merge Field.'],
    dataBinding: ['mergeTags'],
    aiDescription: 'Single merge field such as customer name, invoice number, or case title.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.VARIABLE]: {
    type: CONTENT_COMPONENT_TYPES.VARIABLE,
    category: 'data',
    purpose: 'Displays named calculated or session values.',
    howItWorks: ['Resolves template or runtime variable by name.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['name', 'defaultValue', 'format'],
    specialBehaviors: ['Requires Variable Engine (C4).'],
    dataBinding: ['variables'],
    validationRules: ['Variable must exist in template scope.'],
    aiDescription: 'Named variable such as grand total, subtotal, or today date.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.FORMULA]: {
    type: CONTENT_COMPONENT_TYPES.FORMULA,
    category: 'data',
    purpose: 'Runtime calculated expression.',
    howItWorks: ['Evaluates expression against data scope; supports nested formulas.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['expression', 'format', 'fallback'],
    specialBehaviors: ['Example: Quantity × Price.', 'Requires Formula Engine (C4).'],
    dataBinding: ['formulas', 'mergeTags'],
    validationRules: ['Expression must parse and resolve without circular refs.'],
    aiDescription: 'Calculated value from arithmetic or aggregate expressions.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.TABLE]: {
    type: CONTENT_COMPONENT_TYPES.TABLE,
    category: 'collections',
    purpose: 'Tabular rows and columns.',
    howItWorks: ['Grid with header/body/footer; dynamic repeat rows from collection.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.PARTIAL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['grid', 'collection', 'columnWidths', 'cellMerge', 'sort'],
    specialBehaviors: ['Supports cell merge, totals row, and column width control.'],
    dataBinding: ['collection', 'mergeTags'],
    aiDescription: 'Flexible data table with merge tags and repeating rows.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.REPEATER]: {
    type: CONTENT_COMPONENT_TYPES.REPEATER,
    category: 'collections',
    purpose: 'Repeats child components for each collection item.',
    howItWorks: ['Iterates collection; renders children in per-item scope.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['collection', 'itemAlias', 'emptyState'],
    specialBehaviors: ['Example: task card repeated for each task.'],
    dataBinding: ['collection', 'repeater'],
    aiDescription: 'Repeat any child layout for each item in a related collection.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.LINE_ITEM]: {
    type: CONTENT_COMPONENT_TYPES.LINE_ITEM,
    category: 'collections',
    purpose: 'Specialized invoice/quote line table.',
    howItWorks: [
      'Pre-built grid with sections, lines, section totals, and document totals.',
      'Resolves from quote/invoice record at render.'
    ],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.PARTIAL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['columns', 'showSections', 'showSectionTotals', 'showDocumentTotals', 'columnWidths'],
    specialBehaviors: [
      'Built-in columns: product, qty, price, discount, tax, amount.',
      'Builder catalog label: Line Items.'
    ],
    dataBinding: ['lines', 'sections', 'totals'],
    aiDescription: 'Quote and invoice line item table with sections and automatic totals.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.RELATED_RECORDS]: {
    type: CONTENT_COMPONENT_TYPES.RELATED_RECORDS,
    category: 'collections',
    purpose: 'Displays related CRM module records.',
    howItWorks: ['Loads related collection by relation and module scope.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.PARTIAL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['relation', 'moduleScope', 'displayFields', 'limit'],
    specialBehaviors: ['Examples: tasks, comments, activities, contacts, invoices.'],
    dataBinding: ['relatedRecords'],
    aiDescription: 'Related list block for tasks, activities, or linked module records.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.TOTALS]: {
    type: CONTENT_COMPONENT_TYPES.TOTALS,
    category: 'financial',
    purpose: 'Document financial summary.',
    howItWorks: ['Auto-resolves subtotal, discount, tax, shipping, grand total.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['showSubtotal', 'showTax', 'showGrandTotal', 'currency'],
    specialBehaviors: ['Currency formatting included.', 'Module-aware for quotes/invoices.'],
    dataBinding: ['totals', 'mergeTags'],
    aiDescription: 'Financial totals block with subtotal, tax, and grand total.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.TAX_SUMMARY]: {
    type: CONTENT_COMPONENT_TYPES.TAX_SUMMARY,
    category: 'financial',
    purpose: 'Grouped tax breakdown.',
    howItWorks: ['Lists tax lines by rate and name from record tax data.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['showTaxBreakdown', 'groupBy'],
    specialBehaviors: ['Example: GST 18%, VAT, Service Tax.'],
    dataBinding: ['taxes'],
    aiDescription: 'Tax rate breakdown table for invoices and quotes.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.ADDRESS_BLOCK]: {
    type: CONTENT_COMPONENT_TYPES.ADDRESS_BLOCK,
    category: 'crm',
    purpose: 'Formatted postal address.',
    howItWorks: ['Resolves address fields from bound record path.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['path', 'addressType', 'format'],
    specialBehaviors: ['Supports customer, organization, billing, and shipping contexts.'],
    dataBinding: ['mergeTags'],
    aiDescription: 'Multi-line address block for billing or shipping.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.CONTACT_CARD]: {
    type: CONTENT_COMPONENT_TYPES.CONTACT_CARD,
    category: 'crm',
    purpose: 'Person summary block.',
    howItWorks: ['Displays photo, name, phone, email, title, department.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['path', 'visibleFields', 'photoSize'],
    specialBehaviors: ['Photo falls back to initials when missing.'],
    dataBinding: ['People'],
    aiDescription: 'Contact card with photo and communication details.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.ORGANIZATION_BLOCK]: {
    type: CONTENT_COMPONENT_TYPES.ORGANIZATION_BLOCK,
    category: 'crm',
    purpose: 'Company summary block.',
    howItWorks: ['Displays logo, name, address, tax number, website, phone.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['path', 'visibleFields', 'logoOverride'],
    specialBehaviors: ['Combines branding and organization merge fields.'],
    dataBinding: ['Organization'],
    aiDescription: 'Organization header with logo, legal name, and tax identifiers.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.BUTTON]: {
    type: CONTENT_COMPONENT_TYPES.BUTTON,
    category: 'interactive',
    purpose: 'Clickable call-to-action.',
    howItWorks: ['Styled link/button with href action.'],
    supportedOutputs: {
      print: OUTPUT.NONE,
      pdf: OUTPUT.NONE,
      email: OUTPUT.FULL,
      html: OUTPUT.FULL,
      portal: OUTPUT.FULL
    },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['text', 'href', 'style', 'target'],
    specialBehaviors: ['Ignored during print and PDF.'],
    aiDescription: 'CTA button for portal pages and HTML documents.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.SOCIAL_ICONS]: {
    type: CONTENT_COMPONENT_TYPES.SOCIAL_ICONS,
    category: 'interactive',
    purpose: 'Social network icon row.',
    howItWorks: ['Linked icons for configured social networks.'],
    supportedOutputs: {
      print: OUTPUT.NONE,
      pdf: OUTPUT.NONE,
      email: OUTPUT.PARTIAL,
      html: OUTPUT.FULL,
      portal: OUTPUT.FULL
    },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['networks', 'size', 'color', 'links'],
    specialBehaviors: ['Clickable in HTML/Portal only.', 'Facebook, LinkedIn, Twitter, Instagram, YouTube.'],
    aiDescription: 'Social media icon links for email footers and portal pages.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.HEADER]: {
    type: CONTENT_COMPONENT_TYPES.HEADER,
    category: 'print',
    purpose: 'Repeating page header region.',
    howItWorks: ['Renders at top of every printed page; may contain logo and page number.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.NONE, html: OUTPUT.PARTIAL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['height', 'repeatOn', 'firstPageOnly'],
    specialBehaviors: ['Bound to Page header slot or standalone Header component.'],
    aiDescription: 'Repeating print header with logo and dynamic fields.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.FOOTER]: {
    type: CONTENT_COMPONENT_TYPES.FOOTER,
    category: 'print',
    purpose: 'Repeating page footer region.',
    howItWorks: ['Renders at bottom of every printed page.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.NONE, html: OUTPUT.PARTIAL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['height', 'repeatOn', 'firstPageOnly'],
    specialBehaviors: ['Common: terms, page number, copyright.'],
    aiDescription: 'Repeating print footer for terms and page numbers.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.PAGE_NUMBER]: {
    type: CONTENT_COMPONENT_TYPES.PAGE_NUMBER,
    category: 'print',
    purpose: 'Current and total page indicator.',
    howItWorks: ['Resolves System.PageNumber and System.PageCount at render.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.NONE, html: OUTPUT.PARTIAL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['format'],
    specialBehaviors: ['Formats: 1, Page 1, Page 1 of 10.'],
    dataBinding: ['System.PageNumber', 'System.PageCount'],
    aiDescription: 'Dynamic page number for multi-page PDF documents.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.WATERMARK]: {
    type: CONTENT_COMPONENT_TYPES.WATERMARK,
    category: 'print',
    purpose: 'Background overlay text or image.',
    howItWorks: ['Renders behind content with reduced opacity.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.NONE, html: OUTPUT.PARTIAL },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['text', 'image', 'opacity', 'rotation', 'color'],
    specialBehaviors: ['Examples: PAID, DRAFT, CONFIDENTIAL.'],
    aiDescription: 'Diagonal watermark for draft or paid document status.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.CONDITIONAL_BLOCK]: {
    type: CONTENT_COMPONENT_TYPES.CONDITIONAL_BLOCK,
    category: 'logic',
    purpose: 'Show or hide content based on expression.',
    howItWorks: ['Evaluates condition; renders children only when true.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['condition', 'elseBranch'],
    specialBehaviors: ['Example: show GST only if Country = India.', 'Requires Expression Engine (C4).'],
    dataBinding: ['expressions'],
    validationRules: ['Condition must parse successfully.'],
    aiDescription: 'Conditional wrapper to show tax or locale-specific sections.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.LOOP]: {
    type: CONTENT_COMPONENT_TYPES.LOOP,
    category: 'logic',
    purpose: 'Logic container repeating children over a collection.',
    howItWorks: ['FOR EACH item, render all child components in item scope.'],
    supportedOutputs: { print: OUTPUT.FULL, pdf: OUTPUT.FULL, email: OUTPUT.FULL, html: OUTPUT.FULL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: ['collection', 'itemAlias', 'indexAlias'],
    specialBehaviors: ['Unlike Repeater, wraps arbitrary nested layout structures.'],
    dataBinding: ['collection', 'repeater'],
    aiDescription: 'Loop container for complex repeated layouts over product or line collections.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.HTML]: {
    type: CONTENT_COMPONENT_TYPES.HTML,
    category: 'logic',
    purpose: 'Embeds custom HTML.',
    howItWorks: ['Raw HTML rendered through output adapter sanitization rules.'],
    supportedOutputs: {
      print: OUTPUT.FULL,
      pdf: OUTPUT.FULL,
      email: OUTPUT.PARTIAL,
      html: OUTPUT.FULL,
      portal: OUTPUT.FULL
    },
    allowedChildren: CHILDREN.NONE,
    keyProperties: ['html', 'sanitize', 'allowScripts'],
    specialBehaviors: [
      'PDF/Print via HTML renderer.',
      'Email: inline styles only.',
      'Third-party widgets: HTML/Portal only.'
    ],
    dataBinding: ['html'],
    validationRules: ['Unsafe HTML stripped per output profile.'],
    aiDescription: 'Custom HTML embed for advanced layouts and portal widgets.',
    inBuilderCatalog: true
  },
  [CONTENT_COMPONENT_TYPES.GRID]: {
    type: CONTENT_COMPONENT_TYPES.GRID,
    category: 'layout',
    purpose: 'Reserved grid layout primitive.',
    howItWorks: ['Internal layout engine primitive — not exposed in builder catalog.'],
    supportedOutputs: { print: OUTPUT.PARTIAL, pdf: OUTPUT.PARTIAL, email: OUTPUT.PARTIAL, html: OUTPUT.PARTIAL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: [],
    specialBehaviors: ['Registry-only; not in builder catalog.'],
    aiDescription: 'Internal grid layout primitive.',
    inBuilderCatalog: false
  },
  [CONTENT_COMPONENT_TYPES.FLEX]: {
    type: CONTENT_COMPONENT_TYPES.FLEX,
    category: 'layout',
    purpose: 'Reserved flex layout primitive.',
    howItWorks: ['Internal layout engine primitive — not exposed in builder catalog.'],
    supportedOutputs: { print: OUTPUT.PARTIAL, pdf: OUTPUT.PARTIAL, email: OUTPUT.PARTIAL, html: OUTPUT.PARTIAL },
    allowedChildren: CHILDREN.ALL_EXCEPT_PAGE,
    keyProperties: [],
    specialBehaviors: ['Registry-only; not in builder catalog.'],
    aiDescription: 'Internal flex layout primitive.',
    inBuilderCatalog: false
  }
};

export function getContentComponentMetadata(type: string): ContentComponentMetadataEntry | null {
  return CONTENT_COMPONENT_METADATA[String(type || '').trim()] ?? null;
}

export function isAllowedChildComponent(parentType: string, childType: string): boolean {
  const parent = getContentComponentMetadata(parentType);
  const child = String(childType || '').trim();
  if (!parent || !child) return false;

  const policy = parent.allowedChildren;
  if (policy === CHILDREN.ALL) return true;
  if (policy === CHILDREN.NONE) return false;
  if (policy === CHILDREN.ALL_EXCEPT_PAGE) return child !== CONTENT_COMPONENT_TYPES.PAGE;
  if (Array.isArray(policy)) return policy.includes(child);
  return false;
}
