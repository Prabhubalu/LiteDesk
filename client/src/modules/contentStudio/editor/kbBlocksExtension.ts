import { Node, mergeAttributes } from '@tiptap/core';
import { createContentStudioFaqItemNodeView } from './faqItemNodeView';
import { createContentStudioStepItemNodeView } from './stepItemNodeView';

function parseStepOrientation(value: unknown): 'vertical' | 'horizontal' {
  return value === 'horizontal' ? 'horizontal' : 'vertical';
}

function parseStepTitleLayout(value: unknown): 'inline' | 'below' {
  return value === 'below' ? 'below' : 'inline';
}

function parseStepHeaderAlign(value: unknown): 'start' | 'center' {
  return value === 'center' ? 'center' : 'start';
}

function parseStepContentAlign(value: unknown): 'start' | 'center' | 'end' {
  if (value === 'center') return 'center';
  if (value === 'end') return 'end';
  return 'start';
}

export const ContentStudioStep = Node.create({
  name: 'step',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      title: { default: 'Step title' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-step]',
        getAttrs: (element) => ({
          title:
            element.querySelector('.content-step__title')?.textContent?.trim()
            || element.getAttribute('data-title')
            || 'Step title',
        }),
      },
      {
        tag: 'li[data-step]',
        getAttrs: (element) => ({
          title:
            element.querySelector('.content-step__title')?.textContent?.trim()
            || element.getAttribute('data-title')
            || 'Step title',
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const title = String(node.attrs.title || 'Step title');
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-step': '',
        'data-title': title,
        class: 'content-step',
      }),
      [
        'div',
        { class: 'content-step__header' },
        ['span', { class: 'content-step__number', 'aria-hidden': 'true' }],
        ['div', { class: 'content-step__title' }, title],
      ],
      ['div', { class: 'content-step__body' }, 0],
    ];
  },
  addNodeView() {
    return createContentStudioStepItemNodeView();
  },
});

export const ContentStudioSteps = Node.create({
  name: 'steps',
  group: 'block',
  content: 'step+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      orientation: { default: 'vertical' },
      titleLayout: { default: 'inline' },
      headerAlign: { default: 'start' },
      contentAlign: { default: 'start' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-steps]',
        getAttrs: (element) => ({
          orientation: parseStepOrientation(element.getAttribute('data-orientation')),
          titleLayout: parseStepTitleLayout(element.getAttribute('data-title-layout')),
          headerAlign: parseStepHeaderAlign(element.getAttribute('data-header-align')),
          contentAlign: parseStepContentAlign(element.getAttribute('data-content-align')),
        }),
      },
      {
        tag: 'ol[data-steps]',
        getAttrs: () => ({
          orientation: 'vertical',
          titleLayout: 'inline',
          headerAlign: 'start',
          contentAlign: 'start',
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const orientation = parseStepOrientation(node.attrs.orientation);
    const titleLayout = parseStepTitleLayout(node.attrs.titleLayout);
    const headerAlign = parseStepHeaderAlign(node.attrs.headerAlign);
    const contentAlign = parseStepContentAlign(node.attrs.contentAlign);
    const titleLayoutClass = titleLayout === 'below' ? 'content-steps--title-below' : '';
    const headerAlignClass = headerAlign === 'center' ? 'content-steps--header-center' : '';
    const contentAlignClass = contentAlign === 'center'
      ? 'content-steps--content-center'
      : contentAlign === 'end'
        ? 'content-steps--content-end'
        : '';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-steps': '',
        'data-orientation': orientation,
        'data-title-layout': titleLayout,
        'data-header-align': headerAlign,
        'data-content-align': contentAlign,
        class: `content-steps content-steps--${orientation} ${titleLayoutClass} ${headerAlignClass} ${contentAlignClass}`.trim(),
      }),
      0,
    ];
  },
});

export const ContentStudioFaqItem = Node.create({
  name: 'faqItem',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      question: { default: 'Question' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'details[data-faq-item]',
        getAttrs: (element) => ({
          question:
            element.querySelector('summary')?.textContent?.trim()
            || element.getAttribute('data-question')
            || 'Question',
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const question = String(node.attrs.question || 'Question');
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-faq-item': '',
        'data-question': question,
        class: 'content-faq-item',
      }),
      ['summary', { class: 'content-faq-item__question' }, question],
      ['div', { class: 'content-faq-item__body' }, 0],
    ];
  },
  addNodeView() {
    return createContentStudioFaqItemNodeView();
  },
});

export const ContentStudioFaq = Node.create({
  name: 'faq',
  group: 'block',
  content: 'faqItem+',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-faq]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-faq': '', class: 'content-faq' }), 0];
  },
});

export const ContentStudioRelatedArticles = Node.create({
  name: 'relatedArticles',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'Related articles' },
      items: { default: [] },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'section[data-related-articles]',
        getAttrs: (element) => {
          let items: Array<{ id: string; title: string; slug?: string }> = [];
          const raw = element.getAttribute('data-items');
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) items = parsed;
            } catch {
              items = [];
            }
          }
          return {
            title: element.getAttribute('data-title') || 'Related articles',
            items,
          };
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const title = String(node.attrs.title || 'Related articles');
    const items = Array.isArray(node.attrs.items) ? node.attrs.items : [];
    const listItems = items.map((item: { id?: string; title?: string }) => {
      const label = String(item?.title || 'Article');
      const id = String(item?.id || '');
      return ['li', { 'data-article-id': id }, label];
    });
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-related-articles': '',
        'data-title': title,
        'data-items': JSON.stringify(items),
        class: 'content-related-articles',
      }),
      ['h3', { class: 'content-related-articles__title' }, title],
      ['ul', { class: 'content-related-articles__list' }, ...listItems],
    ];
  },
});
