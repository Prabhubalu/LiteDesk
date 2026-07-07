import type { ProseMirrorJson } from '../types/contentStudio';

export interface ArticleTemplateDefinition {
  id: string;
  labelKey: string;
  descriptionKey: string;
  titleKey: string;
  subtitleKey: string;
  summaryKey: string;
  blocks: ProseMirrorJson;
}

export const ARTICLE_TEMPLATES: ArticleTemplateDefinition[] = [
  {
    id: 'how-to',
    labelKey: 'contentStudio.templateHowTo',
    descriptionKey: 'contentStudio.templateHowToDesc',
    titleKey: 'contentStudio.templateHowToTitle',
    subtitleKey: 'contentStudio.templateHowToSubtitle',
    summaryKey: 'contentStudio.templateHowToSummary',
    blocks: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Use this guide to complete the task from start to finish.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Before you start' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confirm you have the required permissions' }] }] },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Steps' }] },
        {
          type: 'steps',
          content: [
            { type: 'step', attrs: { title: 'Step 1' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First action to take.' }] }] },
            { type: 'step', attrs: { title: 'Step 2' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second action to take.' }] }] },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Need more help?' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Contact support if you run into issues.' }] },
      ],
    },
  },
  {
    id: 'troubleshooting',
    labelKey: 'contentStudio.templateTroubleshooting',
    descriptionKey: 'contentStudio.templateTroubleshootingDesc',
    titleKey: 'contentStudio.templateTroubleshootingTitle',
    subtitleKey: 'contentStudio.templateTroubleshootingSubtitle',
    summaryKey: 'contentStudio.templateTroubleshootingSummary',
    blocks: {
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { variant: 'info' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This article helps you diagnose and fix a common issue.' }] }],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Symptoms' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Describe what the user sees' }] }] },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Resolution' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Explain how to fix the issue.' }] },
      ],
    },
  },
  {
    id: 'faq-page',
    labelKey: 'contentStudio.templateFaq',
    descriptionKey: 'contentStudio.templateFaqDesc',
    titleKey: 'contentStudio.templateFaqTitle',
    subtitleKey: 'contentStudio.templateFaqSubtitle',
    summaryKey: 'contentStudio.templateFaqSummary',
    blocks: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Answers to the most common questions.' }] },
        {
          type: 'faq',
          content: [
            {
              type: 'faqItem',
              attrs: { question: 'Question one?' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Answer one.' }] }],
            },
            {
              type: 'faqItem',
              attrs: { question: 'Question two?' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Answer two.' }] }],
            },
            {
              type: 'faqItem',
              attrs: { question: 'Question three?' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Answer three.' }] }],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'policy',
    labelKey: 'contentStudio.templatePolicy',
    descriptionKey: 'contentStudio.templatePolicyDesc',
    titleKey: 'contentStudio.templatePolicyTitle',
    subtitleKey: 'contentStudio.templatePolicySubtitle',
    summaryKey: 'contentStudio.templatePolicySummary',
    blocks: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Overview of the policy and why it matters.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Policy details' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Describe the policy in clear language.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Exceptions' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'List any exceptions or special cases.' }] },
      ],
    },
  },
];

export function getArticleTemplatesForMode(mode: 'articles' | 'blog') {
  if (mode === 'blog') {
    return ARTICLE_TEMPLATES.filter((item) => item.id !== 'troubleshooting');
  }
  return ARTICLE_TEMPLATES;
}
