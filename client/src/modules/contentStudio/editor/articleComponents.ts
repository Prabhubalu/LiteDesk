import type { ProseMirrorJson } from '../types/contentStudio';

export interface ArticleComponentDefinition {
  id: string;
  labelKey: string;
  descriptionKey: string;
  category: 'content' | 'layout' | 'help';
  content: ProseMirrorJson[];
}

export const ARTICLE_COMPONENTS: ArticleComponentDefinition[] = [
  {
    id: 'tip-callout',
    labelKey: 'contentStudio.componentTipCallout',
    descriptionKey: 'contentStudio.componentTipCalloutDesc',
    category: 'content',
    content: [
      {
        type: 'callout',
        attrs: { variant: 'tip' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tip: Add helpful guidance for your customers here.' }] }],
      },
    ],
  },
  {
    id: 'warning-callout',
    labelKey: 'contentStudio.componentWarningCallout',
    descriptionKey: 'contentStudio.componentWarningCalloutDesc',
    category: 'content',
    content: [
      {
        type: 'callout',
        attrs: { variant: 'warning' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Warning: Important caution or prerequisite information.' }] }],
      },
    ],
  },
  {
    id: 'three-steps',
    labelKey: 'contentStudio.componentThreeSteps',
    descriptionKey: 'contentStudio.componentThreeStepsDesc',
    category: 'help',
    content: [
      {
        type: 'steps',
        content: [
          { type: 'step', attrs: { title: 'Step 1' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Describe the first step.' }] }] },
          { type: 'step', attrs: { title: 'Step 2' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Describe the second step.' }] }] },
          { type: 'step', attrs: { title: 'Step 3' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Describe the final step.' }] }] },
        ],
      },
    ],
  },
  {
    id: 'faq-pair',
    labelKey: 'contentStudio.componentFaqPair',
    descriptionKey: 'contentStudio.componentFaqPairDesc',
    category: 'help',
    content: [
      {
        type: 'faq',
        content: [
          {
            type: 'faqItem',
            attrs: { question: 'What is this article about?' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Answer the most common question here.' }] }],
          },
          {
            type: 'faqItem',
            attrs: { question: 'Who is this for?' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Explain the intended audience.' }] }],
          },
        ],
      },
    ],
  },
  {
    id: 'checklist',
    labelKey: 'contentStudio.componentChecklist',
    descriptionKey: 'contentStudio.componentChecklistDesc',
    category: 'help',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Before you begin, make sure you have:' }] },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Required access or permissions' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Any necessary configuration completed' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Supporting documentation at hand' }] }] },
        ],
      },
    ],
  },
  {
    id: 'prerequisites',
    labelKey: 'contentStudio.componentPrerequisites',
    descriptionKey: 'contentStudio.componentPrerequisitesDesc',
    category: 'layout',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Prerequisites' }] },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prerequisite one' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prerequisite two' }] }] },
        ],
      },
      { type: 'horizontalRule' },
    ],
  },
  {
    id: 'related-articles',
    labelKey: 'contentStudio.componentRelatedArticles',
    descriptionKey: 'contentStudio.componentRelatedArticlesDesc',
    category: 'help',
    content: [
      {
        type: 'relatedArticles',
        attrs: {
          title: 'Related articles',
          items: [],
        },
      },
    ],
  },
];

export function getArticleComponentsForMode(mode: 'articles' | 'blog') {
  if (mode === 'blog') {
    return ARTICLE_COMPONENTS.filter((item) => item.category !== 'help');
  }
  return ARTICLE_COMPONENTS;
}
