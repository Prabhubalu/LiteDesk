import { CONTENT_COMPONENT_TYPES as T } from '@/constants/contentComponentRegistry';
import { getArivuCatalogEntries } from './arivuBlockContent';

export type BlockCatalogFormat = 'print' | 'email' | 'all';

export interface BlockCatalogEntry {
  id: string;
  iconType: string;
  labelKey: string;
  groupKey: string;
  source: 'grapes' | 'arivu';
  formats: BlockCatalogFormat[];
}

/** Official GrapesJS blocks — registered by grapesjs-blocks-basic + preset-webpage. */
const PRINT_OFFICIAL_BLOCKS: BlockCatalogEntry[] = [
  { id: 'column1', iconType: T.COLUMN, labelKey: 'templates.grapesBlockColumn1', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['print'] },
  { id: 'column2', iconType: T.ROW, labelKey: 'templates.grapesBlockColumn2', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['print'] },
  { id: 'column3', iconType: T.ROW, labelKey: 'templates.grapesBlockColumn3', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['print'] },
  { id: 'column3-7', iconType: T.ROW, labelKey: 'templates.grapesBlockColumn37', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['print'] },
  { id: 'image', iconType: T.IMAGE, labelKey: 'templates.builderComponentImage', groupKey: 'templates.builderGroupMedia', source: 'grapes', formats: ['print'] },
  { id: 'video', iconType: T.IMAGE, labelKey: 'templates.grapesBlockVideo', groupKey: 'templates.builderGroupMedia', source: 'grapes', formats: ['print'] },
  { id: 'map', iconType: T.ICON, labelKey: 'templates.grapesBlockMap', groupKey: 'templates.builderGroupMedia', source: 'grapes', formats: ['print'] }
];

/** Official GrapesJS blocks — registered by grapesjs-preset-newsletter. */
const EMAIL_OFFICIAL_BLOCKS: BlockCatalogEntry[] = [
  { id: 'sect100', iconType: T.SECTION, labelKey: 'templates.grapesBlockSect100', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['email'] },
  { id: 'sect50', iconType: T.ROW, labelKey: 'templates.grapesBlockSect50', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['email'] },
  { id: 'sect30', iconType: T.ROW, labelKey: 'templates.grapesBlockSect30', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['email'] },
  { id: 'sect37', iconType: T.ROW, labelKey: 'templates.grapesBlockSect37', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['email'] },
  { id: 'button', iconType: T.BUTTON, labelKey: 'templates.builderComponentButton', groupKey: 'templates.builderGroupInteractive', source: 'grapes', formats: ['email'] },
  { id: 'divider', iconType: T.DIVIDER, labelKey: 'templates.builderComponentDivider', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['email'] },
  { id: 'image', iconType: T.IMAGE, labelKey: 'templates.builderComponentImage', groupKey: 'templates.builderGroupMedia', source: 'grapes', formats: ['email'] },
  { id: 'grid-items', iconType: T.ROW, labelKey: 'templates.grapesBlockGridItems', groupKey: 'templates.builderGroupLayout', source: 'grapes', formats: ['email'] }
];

/** Arivu CRM / document extensions — registered on top of GrapesJS plugins. */
function getArivuExtensionBlocks(format: BlockCatalogFormat): BlockCatalogEntry[] {
  return getArivuCatalogEntries(format);
}

const GROUP_ORDER = [
  'templates.builderGroupLayout',
  'templates.builderGroupTypography',
  'templates.builderGroupMedia',
  'templates.builderGroupData',
  'templates.builderGroupCollections',
  'templates.builderGroupFinancial',
  'templates.builderGroupCrm',
  'templates.builderGroupInteractive',
  'templates.builderGroupPrint',
  'templates.builderGroupLogic'
];

export function resolveCatalogFormat(outputFormat: string): BlockCatalogFormat {
  return outputFormat === 'email' ? 'email' : 'print';
}

export function getBlockCatalogForFormat(outputFormat = 'pdf'): BlockCatalogEntry[] {
  const format = resolveCatalogFormat(outputFormat);
  const official = format === 'email' ? EMAIL_OFFICIAL_BLOCKS : PRINT_OFFICIAL_BLOCKS;
  const extensions = getArivuExtensionBlocks(format);
  return [...official, ...extensions];
}

export function getBlockCatalogGroups(
  outputFormat = 'pdf'
): Array<[string, BlockCatalogEntry[]]> {
  const blocks = getBlockCatalogForFormat(outputFormat);
  const groups = new Map<string, BlockCatalogEntry[]>();

  for (const block of blocks) {
    const list = groups.get(block.groupKey) || [];
    list.push(block);
    groups.set(block.groupKey, list);
  }

  return GROUP_ORDER.map(
    (groupKey) => [groupKey, groups.get(groupKey) || []] as [string, BlockCatalogEntry[]]
  ).filter(([, items]) => items.length > 0);
}

export function getBlockCatalogEntry(
  blockId: string,
  outputFormat = 'pdf'
): BlockCatalogEntry | undefined {
  return getBlockCatalogForFormat(outputFormat).find((block) => block.id === blockId);
}
