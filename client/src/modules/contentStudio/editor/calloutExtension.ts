import { Node, mergeAttributes } from '@tiptap/core';

export const ContentStudioCallout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-variant') || 'info',
        renderHTML: (attributes) => ({
          'data-variant': attributes.variant,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const variant = String(HTMLAttributes['data-variant'] || 'info');
    return [
      'aside',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        class: `content-callout content-callout--${variant}`,
        role: 'note',
      }),
      0,
    ];
  },
});
