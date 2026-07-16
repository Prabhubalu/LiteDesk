import type { ContentStudioBlockRegistryItem, ContentStudioMode } from '../types/contentStudio';

const BASE_BLOCKS: ContentStudioBlockRegistryItem[] = [
  { type: 'paragraph', labelKey: 'contentStudio.blockParagraph', category: 'basic', icon: 'paragraph' },
  { type: 'heading', labelKey: 'contentStudio.blockHeading', category: 'basic', icon: 'heading' },
  { type: 'image', labelKey: 'contentStudio.blockImage', category: 'basic', icon: 'image' },
  { type: 'list', insertType: 'bulletList', labelKey: 'contentStudio.blockList', category: 'basic', icon: 'list' },
  { type: 'blockquote', labelKey: 'contentStudio.blockQuote', category: 'basic', icon: 'quote' },
  { type: 'horizontalRule', labelKey: 'contentStudio.blockDivider', category: 'basic', icon: 'divider' },
  { type: 'taskList', labelKey: 'contentStudio.blockChecklist', category: 'basic', icon: 'checklist', searchTerms: ['todo', 'check'] },

  { type: 'gallery', labelKey: 'contentStudio.blockGallery', category: 'media', icon: 'gallery' },
  { type: 'audio', labelKey: 'contentStudio.blockAudio', category: 'media', icon: 'audio' },
  { type: 'file', labelKey: 'contentStudio.blockFile', category: 'media', icon: 'file', searchTerms: ['download', 'attachment'] },
  { type: 'codeBlock', labelKey: 'contentStudio.blockCode', category: 'media', icon: 'code' },
  { type: 'embed', labelKey: 'contentStudio.blockEmbed', category: 'media', icon: 'embed', searchTerms: ['iframe', 'video', 'youtube', 'vimeo', 'map', 'google maps'] },

  { type: 'table', labelKey: 'contentStudio.blockTable', category: 'content', icon: 'table' },
  { type: 'tabs', labelKey: 'contentStudio.blockTabs', category: 'content', icon: 'tabs' },
  { type: 'callout', labelKey: 'contentStudio.blockCallout', category: 'content', icon: 'callout', searchTerms: ['alert', 'note', 'tip', 'warning'] },
  { type: 'timeline', labelKey: 'contentStudio.blockTimeline', category: 'content', icon: 'timeline' },
  { type: 'faq', labelKey: 'contentStudio.blockFaq', category: 'content', icon: 'faq', searchTerms: ['accordion', 'question', 'answer'] },
  { type: 'steps', labelKey: 'contentStudio.blockSteps', category: 'content', icon: 'steps', searchTerms: ['howto', 'how-to', 'guide', 'tutorial'] },

  { type: 'columns', labelKey: 'contentStudio.blockColumns', category: 'layout', icon: 'columns' },
  { type: 'section', labelKey: 'contentStudio.blockSection', category: 'layout', icon: 'section' },
  { type: 'spacer', labelKey: 'contentStudio.blockSpacer', category: 'layout', icon: 'spacer' },
  { type: 'button', labelKey: 'contentStudio.blockButton', category: 'layout', icon: 'button', searchTerms: ['cta'] },
  { type: 'toc', labelKey: 'contentStudio.blockToc', category: 'layout', icon: 'toc', searchTerms: ['table of contents', 'outline'] },
  { type: 'form', labelKey: 'contentStudio.blockForm', category: 'layout', icon: 'form', searchTerms: ['contact'] },
  { type: 'social', labelKey: 'contentStudio.blockSocial', category: 'layout', icon: 'social' },
  { type: 'rating', labelKey: 'contentStudio.blockRating', category: 'layout', icon: 'rating', searchTerms: ['stars', 'review'] },
  { type: 'progress', labelKey: 'contentStudio.blockProgress', category: 'layout', icon: 'progress' },
];

const BLOG_BLOCKS: ContentStudioBlockRegistryItem[] = [
  { type: 'hero', labelKey: 'contentStudio.blockHero', category: 'layout', icon: 'section' },
  { type: 'newsletter_signup', insertType: 'newsletterSignup', labelKey: 'contentStudio.blockNewsletter', category: 'layout', icon: 'form' },
];

const ARTICLE_BLOCKS: ContentStudioBlockRegistryItem[] = [
  {
    type: 'relatedArticles',
    labelKey: 'contentStudio.blockRelatedArticles',
    category: 'content',
    icon: 'link',
    searchTerms: ['related', 'links', 'articles'],
  },
];

export const BLOCK_CATEGORY_ORDER = ['basic', 'media', 'content', 'layout'] as const;

export const BLOCK_CATEGORY_LABEL_KEYS: Record<string, string> = {
  basic: 'contentStudio.categoryBasic',
  media: 'contentStudio.categoryMedia',
  content: 'contentStudio.categoryContent',
  layout: 'contentStudio.categoryLayout',
};

const ALL_BLOCKS = [...BASE_BLOCKS, ...ARTICLE_BLOCKS, ...BLOG_BLOCKS];
const BLOG_LAYOUT_TYPES = new Set(BLOG_BLOCKS.map((block) => block.type));

export function getBlocksForMode(mode: ContentStudioMode): ContentStudioBlockRegistryItem[] {
  const blocks = mode === 'blog'
    ? [...BASE_BLOCKS, ...BLOG_BLOCKS]
    : [...BASE_BLOCKS, ...ARTICLE_BLOCKS];
  return blocks.filter((block) => {
    if (block.category !== 'layout') return true;
    return mode === 'blog' && BLOG_LAYOUT_TYPES.has(block.type);
  });
}

export function findBlockRegistryItem(type: string): ContentStudioBlockRegistryItem | undefined {
  return ALL_BLOCKS.find((block) => block.type === type);
}

export function resolveInsertBlockType(type: string): string {
  return findBlockRegistryItem(type)?.insertType || type;
}

export function resolveInsertBlockAttrs(type: string): Record<string, unknown> {
  return { ...(findBlockRegistryItem(type)?.insertAttrs || {}) };
}
