import { Node, mergeAttributes } from '@tiptap/core';
import { backspaceTimelineItem, splitTimelineItemParagraph } from './blockCommands';
import { createContentStudioGalleryNodeView } from './galleryNodeView';
import { renderLayoutAttrs } from './blockLayout';

export type GalleryLayout = 'grid' | 'scroll' | 'carousel';

export function normalizeGalleryLayout(value: unknown): GalleryLayout {
  const layout = String(value || 'grid').trim().toLowerCase();
  if (layout === 'scroll') return 'scroll';
  if (layout === 'carousel' || layout === 'slider') return 'carousel';
  return 'grid';
}

export const ContentStudioSpacer = Node.create({
  name: 'spacer',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      height: { default: 48 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-content-spacer]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const height = Math.min(Math.max(Number(node.attrs.height) || 48, 8), 240);
    const layout = renderLayoutAttrs(node.attrs);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-spacer': '',
        class: ['content-spacer', layout.className].filter(Boolean).join(' '),
        style: [layout.style, `height:${height}px`].filter(Boolean).join(';'),
        'aria-hidden': 'true',
      }),
    ];
  },
});

export const ContentStudioButton = Node.create({
  name: 'button',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      label: { default: 'Learn more' },
      href: { default: 'https://' },
      variant: { default: 'primary' },
    };
  },
  parseHTML() {
    return [{ tag: 'p[data-content-button]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    const variant = String(node.attrs.variant || 'primary');
    return [
      'p',
      mergeAttributes(HTMLAttributes, {
        'data-content-button': '',
        class: ['content-button', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
      }),
      [
        'a',
        {
          href: String(node.attrs.href || '#'),
          class: `content-button__link content-button__link--${variant}`,
          rel: 'noopener noreferrer',
        },
        String(node.attrs.label || 'Learn more'),
      ],
    ];
  },
});

export const ContentStudioFile = Node.create({
  name: 'file',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      label: { default: 'Download file' },
      href: { default: '' },
      fileName: { default: '' },
      info: { default: '' },
    };
  },
  parseHTML() {
    return [
      { tag: 'a[data-content-file]' },
      {
        tag: 'div.content-file-block',
        getAttrs: (element) => {
          const link = element.querySelector('a[data-content-file], a.content-file');
          if (!link) return false;
          const href = link.getAttribute('href');
          if (!href) return false;
          return {
            label: link.textContent?.trim() || 'Download file',
            href,
            fileName: link.getAttribute('download') || '',
            info: element.querySelector('.content-file__info')?.textContent?.trim() || '',
          };
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    const label = String(node.attrs.label || 'Download file');
    const info = String(node.attrs.info || '').trim();
    const linkAttrs = mergeAttributes(HTMLAttributes, {
      'data-content-file': '',
      href: String(node.attrs.href || '#'),
      class: ['content-file', layout.className].filter(Boolean).join(' '),
      style: layout.style || undefined,
      download: node.attrs.fileName ? String(node.attrs.fileName) : undefined,
      rel: 'noopener noreferrer',
    });

    if (!info) {
      return ['a', linkAttrs, label];
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: ['content-file-block', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
      }),
      ['a', linkAttrs, label],
      ['p', { class: 'content-file__info' }, info],
    ];
  },
});

export const ContentStudioTimelineItem = Node.create({
  name: 'timelineItem',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      title: { default: '' },
      date: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'li[data-timeline-item]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'li',
      mergeAttributes(HTMLAttributes, {
        'data-timeline-item': '',
        'data-title': String(node.attrs.title || ''),
        'data-date': String(node.attrs.date || ''),
        class: 'content-timeline-item',
      }),
      0,
    ];
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => splitTimelineItemParagraph(editor),
      Backspace: ({ editor }) => backspaceTimelineItem(editor),
    };
  },
});

export const ContentStudioTimeline = Node.create({
  name: 'timeline',
  group: 'block',
  content: 'timelineItem+',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'ol[data-timeline]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ol', mergeAttributes(HTMLAttributes, { 'data-timeline': '', class: 'content-timeline' }), 0];
  },
});

export const ContentStudioGallery = Node.create({
  name: 'gallery',
  group: 'block',
  content: 'image+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      layout: {
        default: 'grid',
        parseHTML: (element) => normalizeGalleryLayout(element.getAttribute('data-gallery-layout')),
        renderHTML: (attributes) => {
          const layout = normalizeGalleryLayout(attributes.layout);
          return {
            'data-gallery-layout': layout,
            class: `content-gallery content-gallery--${layout}`,
          };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-content-gallery]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-gallery': '',
      }),
      0,
    ];
  },
  addNodeView() {
    return createContentStudioGalleryNodeView();
  },
});
