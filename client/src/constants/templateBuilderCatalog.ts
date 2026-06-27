import {
  CONTENT_COMPONENT_TYPES,
  type ContentComponentNode
} from '@/constants/contentComponentRegistry';
import { createNodeId } from '@/utils/templateBuilderTree';
import { createFreshTableBindings } from '@/utils/builderTableBindings';
import { createLineItemNode } from '@/constants/lineItemDefaults';

export interface BuilderCatalogItem {
  type: string;
  labelKey: string;
  groupKey: string;
  createDefault: () => ContentComponentNode;
}

export const BUILDER_CATALOG_GROUP_ORDER = [
  'templates.builderGroupLayout',
  'templates.builderGroupText',
  'templates.builderGroupMedia',
  'templates.builderGroupData',
  'templates.builderGroupCollections',
  'templates.builderGroupFinancial',
  'templates.builderGroupCrm',
  'templates.builderGroupInteractive',
  'templates.builderGroupPrint',
  'templates.builderGroupLogic'
] as const;

function node(
  type: string,
  name: string,
  bindings: Record<string, unknown> = {},
  children: ContentComponentNode[] = [],
  style: Record<string, unknown> = {}
): ContentComponentNode {
  return {
    id: createNodeId(type.toLowerCase()),
    type,
    name,
    bindings,
    style,
    children
  };
}

export const BUILDER_CATALOG: BuilderCatalogItem[] = [
  // Layout
  {
    type: CONTENT_COMPONENT_TYPES.SECTION,
    labelKey: 'templates.builderComponentSection',
    groupKey: 'templates.builderGroupLayout',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.SECTION, 'Section')
  },
  {
    type: CONTENT_COMPONENT_TYPES.CONTAINER,
    labelKey: 'templates.builderComponentContainer',
    groupKey: 'templates.builderGroupLayout',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.CONTAINER, 'Container')
  },
  {
    type: CONTENT_COMPONENT_TYPES.ROW,
    labelKey: 'templates.builderComponentRow',
    groupKey: 'templates.builderGroupLayout',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.ROW, 'Row', { gap: 8 }, [
      node(CONTENT_COMPONENT_TYPES.COLUMN, 'Column', { span: 6 }),
      node(CONTENT_COMPONENT_TYPES.COLUMN, 'Column', { span: 6 })
    ])
  },
  {
    type: CONTENT_COMPONENT_TYPES.COLUMN,
    labelKey: 'templates.builderComponentColumn',
    groupKey: 'templates.builderGroupLayout',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.COLUMN, 'Column', { span: 6 })
  },
  {
    type: CONTENT_COMPONENT_TYPES.DIVIDER,
    labelKey: 'templates.builderComponentDivider',
    groupKey: 'templates.builderGroupLayout',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.DIVIDER, 'Divider')
  },
  {
    type: CONTENT_COMPONENT_TYPES.SPACER,
    labelKey: 'templates.builderComponentSpacer',
    groupKey: 'templates.builderGroupLayout',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.SPACER, 'Spacer', { height: 16 })
  },
  {
    type: CONTENT_COMPONENT_TYPES.PAGE_BREAK,
    labelKey: 'templates.builderComponentPageBreak',
    groupKey: 'templates.builderGroupLayout',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.PAGE_BREAK, 'Page break')
  },

  // Text
  {
    type: CONTENT_COMPONENT_TYPES.HEADING,
    labelKey: 'templates.builderComponentHeading',
    groupKey: 'templates.builderGroupText',
    createDefault: () => node(
      CONTENT_COMPONENT_TYPES.HEADING,
      'Heading',
      { level: 1, text: 'Heading' },
      [],
      { typography: { fontSize: 20, fontWeight: 700 } }
    )
  },
  {
    type: CONTENT_COMPONENT_TYPES.PARAGRAPH,
    labelKey: 'templates.builderComponentText',
    groupKey: 'templates.builderGroupText',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.PARAGRAPH, 'Text', { text: 'Text' })
  },
  {
    type: CONTENT_COMPONENT_TYPES.RICH_TEXT,
    labelKey: 'templates.builderComponentRichText',
    groupKey: 'templates.builderGroupText',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.RICH_TEXT, 'Rich text', {
      html: '<p>Rich text content</p>'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.LINK,
    labelKey: 'templates.builderComponentLink',
    groupKey: 'templates.builderGroupText',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.LINK, 'Link', {
      text: 'Link',
      href: '{{Organization.website}}'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.LIST,
    labelKey: 'templates.builderComponentList',
    groupKey: 'templates.builderGroupText',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.LIST, 'List', {
      items: ['Item 1', 'Item 2'],
      ordered: false
    })
  },

  // Media
  {
    type: CONTENT_COMPONENT_TYPES.IMAGE,
    labelKey: 'templates.builderComponentImage',
    groupKey: 'templates.builderGroupMedia',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.IMAGE, 'Image', { src: '', alt: '' })
  },
  {
    type: CONTENT_COMPONENT_TYPES.LOGO,
    labelKey: 'templates.builderComponentLogo',
    groupKey: 'templates.builderGroupMedia',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.LOGO, 'Logo', { src: '', alt: 'Logo' })
  },
  {
    type: CONTENT_COMPONENT_TYPES.ICON,
    labelKey: 'templates.builderComponentIcon',
    groupKey: 'templates.builderGroupMedia',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.ICON, 'Icon', { name: 'star', size: 24 })
  },
  {
    type: CONTENT_COMPONENT_TYPES.QR_CODE,
    labelKey: 'templates.builderComponentQrCode',
    groupKey: 'templates.builderGroupMedia',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.QR_CODE, 'QR code', {
      value: '{{Record.id}}',
      size: 120
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.BARCODE,
    labelKey: 'templates.builderComponentBarcode',
    groupKey: 'templates.builderGroupMedia',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.BARCODE, 'Barcode', {
      value: '{{Quote.quoteNumber}}',
      format: 'code128'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.SIGNATURE,
    labelKey: 'templates.builderComponentSignature',
    groupKey: 'templates.builderGroupMedia',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.SIGNATURE, 'Signature', { label: 'Signature' })
  },

  // Data
  {
    type: CONTENT_COMPONENT_TYPES.MERGE_TAG,
    labelKey: 'templates.builderComponentMergeField',
    groupKey: 'templates.builderGroupData',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.MERGE_TAG, 'Merge field', {
      path: 'Organization.name',
      format: 'text'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.VARIABLE,
    labelKey: 'templates.builderComponentVariable',
    groupKey: 'templates.builderGroupData',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.VARIABLE, 'Variable', {
      name: 'myVariable',
      defaultValue: ''
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.FORMULA,
    labelKey: 'templates.builderComponentFormula',
    groupKey: 'templates.builderGroupData',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.FORMULA, 'Formula', {
      expression: '{{Quote.subtotal}} * 0.1'
    })
  },

  // Collections
  {
    type: CONTENT_COMPONENT_TYPES.TABLE,
    labelKey: 'templates.builderComponentTable',
    groupKey: 'templates.builderGroupCollections',
    createDefault: () => ({
      id: createNodeId('table'),
      type: CONTENT_COMPONENT_TYPES.TABLE,
      name: 'Table',
      bindings: createFreshTableBindings(3, 3),
      style: {},
      children: []
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.REPEATER,
    labelKey: 'templates.builderComponentRepeater',
    groupKey: 'templates.builderGroupCollections',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.REPEATER, 'Repeater', {
      collection: 'lines',
      itemAlias: 'line'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.LINE_ITEM,
    labelKey: 'templates.builderComponentLineItem',
    groupKey: 'templates.builderGroupCollections',
    createDefault: () => createLineItemNode()
  },
  {
    type: CONTENT_COMPONENT_TYPES.RELATED_RECORDS,
    labelKey: 'templates.builderComponentRelatedRecords',
    groupKey: 'templates.builderGroupCollections',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.RELATED_RECORDS, 'Related records', {
      relation: 'lines',
      moduleScope: 'quotes'
    })
  },

  // Financial
  {
    type: CONTENT_COMPONENT_TYPES.TOTALS,
    labelKey: 'templates.builderComponentTotals',
    groupKey: 'templates.builderGroupFinancial',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.TOTALS, 'Totals', {
      showSubtotal: true,
      showTax: true,
      showGrandTotal: true
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.TAX_SUMMARY,
    labelKey: 'templates.builderComponentTaxSummary',
    groupKey: 'templates.builderGroupFinancial',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.TAX_SUMMARY, 'Tax summary', {
      showTaxBreakdown: true
    })
  },

  // CRM
  {
    type: CONTENT_COMPONENT_TYPES.ADDRESS_BLOCK,
    labelKey: 'templates.builderComponentAddressBlock',
    groupKey: 'templates.builderGroupCrm',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.ADDRESS_BLOCK, 'Address block', {
      path: 'Organization'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.CONTACT_CARD,
    labelKey: 'templates.builderComponentContactCard',
    groupKey: 'templates.builderGroupCrm',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.CONTACT_CARD, 'Contact card', {
      path: 'People'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.ORGANIZATION_BLOCK,
    labelKey: 'templates.builderComponentOrganizationBlock',
    groupKey: 'templates.builderGroupCrm',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.ORGANIZATION_BLOCK, 'Organization block', {
      path: 'Organization'
    })
  },

  // Interactive
  {
    type: CONTENT_COMPONENT_TYPES.BUTTON,
    labelKey: 'templates.builderComponentButton',
    groupKey: 'templates.builderGroupInteractive',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.BUTTON, 'Button', {
      text: 'Button',
      href: '#'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.SOCIAL_ICONS,
    labelKey: 'templates.builderComponentSocialIcons',
    groupKey: 'templates.builderGroupInteractive',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.SOCIAL_ICONS, 'Social icons', {
      networks: ['linkedin', 'twitter']
    })
  },

  // Print
  {
    type: CONTENT_COMPONENT_TYPES.HEADER,
    labelKey: 'templates.builderComponentHeader',
    groupKey: 'templates.builderGroupPrint',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.HEADER, 'Header')
  },
  {
    type: CONTENT_COMPONENT_TYPES.FOOTER,
    labelKey: 'templates.builderComponentFooter',
    groupKey: 'templates.builderGroupPrint',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.FOOTER, 'Footer')
  },
  {
    type: CONTENT_COMPONENT_TYPES.PAGE_NUMBER,
    labelKey: 'templates.builderComponentPageNumber',
    groupKey: 'templates.builderGroupPrint',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.PAGE_NUMBER, 'Page number', {
      format: 'Page {{System.PageCount}}'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.WATERMARK,
    labelKey: 'templates.builderComponentWatermark',
    groupKey: 'templates.builderGroupPrint',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.WATERMARK, 'Watermark', {
      text: 'DRAFT'
    })
  },

  // Logic
  {
    type: CONTENT_COMPONENT_TYPES.CONDITIONAL_BLOCK,
    labelKey: 'templates.builderComponentConditionalBlock',
    groupKey: 'templates.builderGroupLogic',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.CONDITIONAL_BLOCK, 'Conditional block', {
      condition: '{{Record.status}} == "Draft"'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.LOOP,
    labelKey: 'templates.builderComponentLoop',
    groupKey: 'templates.builderGroupLogic',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.LOOP, 'Loop', {
      collection: 'lines',
      itemAlias: 'line'
    })
  },
  {
    type: CONTENT_COMPONENT_TYPES.HTML,
    labelKey: 'templates.builderComponentHtml',
    groupKey: 'templates.builderGroupLogic',
    createDefault: () => node(CONTENT_COMPONENT_TYPES.HTML, 'HTML', {
      html: '<div>Custom HTML</div>'
    })
  }
];

export function getCatalogGroups(
  catalog: BuilderCatalogItem[]
): Array<[string, BuilderCatalogItem[]]> {
  const groups = new Map<string, BuilderCatalogItem[]>();
  for (const item of catalog) {
    const list = groups.get(item.groupKey) || [];
    list.push(item);
    groups.set(item.groupKey, list);
  }
  return BUILDER_CATALOG_GROUP_ORDER
    .map((groupKey) => [groupKey, groups.get(groupKey) || []] as [string, BuilderCatalogItem[]])
    .filter(([, items]) => items.length > 0);
}

export function createCatalogComponentNode(
  type: string,
  options: { moduleScope?: string } = {}
): ContentComponentNode | null {
  const catalogItem = BUILDER_CATALOG.find((item) => item.type === type);
  if (!catalogItem) return null;
  if (type === CONTENT_COMPONENT_TYPES.LINE_ITEM) {
    return createLineItemNode(String(options.moduleScope || ''));
  }
  return catalogItem.createDefault();
}
