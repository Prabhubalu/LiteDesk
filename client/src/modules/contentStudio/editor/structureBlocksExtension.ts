import { Node, mergeAttributes } from '@tiptap/core';
import { renderLayoutAttrs } from './blockLayout';
import { createContentStudioTabsNodeView } from './tabsNodeView';
import { splitTabItemParagraph } from './blockCommands';
import { createTabsAccidentalInsertGuardPlugin } from './tabsGuardPlugin';

export const ContentStudioTabItem = Node.create({
  name: 'tabItem',
  priority: 300,
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      label: { default: 'Tab' },
    };
  },
  parseHTML() {
    return [{ tag: 'section[data-tab-item]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-tab-item': '',
        'data-tab-label': String(node.attrs.label || 'Tab'),
        class: 'content-tab-item',
      }),
      0,
    ];
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => splitTabItemParagraph(editor),
    };
  },
});

export const ContentStudioTabs = Node.create({
  name: 'tabs',
  group: 'block',
  content: 'tabItem+',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-content-tabs]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-content-tabs': '', class: 'content-tabs' }), 0];
  },
  addNodeView() {
    return createContentStudioTabsNodeView();
  },
  addProseMirrorPlugins() {
    return [createTabsAccidentalInsertGuardPlugin()];
  },
});

export const ContentStudioColumn = Node.create({
  name: 'column',
  content: 'block+',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-content-column]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-content-column': '', class: 'content-column' }), 0];
  },
});

export const ContentStudioColumns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      columnCount: { default: 2 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-content-columns]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const count = Math.min(Math.max(Number(node.attrs.columnCount) || 2, 2), 3);
    const layout = renderLayoutAttrs(node.attrs);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-columns': '',
        'data-column-count': String(count),
        class: ['content-columns', `content-columns--${count}`, layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
      }),
      0,
    ];
  },
});

export const ContentStudioSection = Node.create({
  name: 'section',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      variant: { default: 'default' },
    };
  },
  parseHTML() {
    return [{ tag: 'section[data-content-section]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const variant = String(node.attrs.variant || 'default');
    const layout = renderLayoutAttrs(node.attrs);
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-content-section': '',
        'data-section-variant': variant,
        class: ['content-section', `content-section--${variant}`, layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
      }),
      0,
    ];
  },
});

export const ContentStudioToc = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'On this page' },
      minLevel: { default: 2 },
      maxLevel: { default: 3 },
    };
  },
  parseHTML() {
    return [{ tag: 'nav[data-content-toc]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    return [
      'nav',
      mergeAttributes(HTMLAttributes, {
        'data-content-toc': '',
        'data-toc-min-level': String(node.attrs.minLevel ?? 2),
        'data-toc-max-level': String(node.attrs.maxLevel ?? 3),
        class: ['content-toc', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
        'aria-label': String(node.attrs.title || 'On this page'),
      }),
      ['p', { class: 'content-toc__title' }, String(node.attrs.title || 'On this page')],
      ['ol', { class: 'content-toc__list' }],
    ];
  },
});

export const ContentStudioForm = Node.create({
  name: 'form',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'Contact us' },
      description: { default: 'Send us a message and we will get back to you.' },
      submitLabel: { default: 'Submit' },
      showMessageField: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'form[data-content-form]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    const showMessage = node.attrs.showMessageField !== false;
    return [
      'form',
      mergeAttributes(HTMLAttributes, {
        'data-content-form': '',
        class: ['content-form', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
        action: '#',
        method: 'post',
      }),
      ['h3', { class: 'content-form__title' }, String(node.attrs.title || 'Contact us')],
      ['p', { class: 'content-form__description' }, String(node.attrs.description || '')],
      ['label', { class: 'content-form__field' }, 'Name', ['input', { type: 'text', name: 'name', required: 'true' }]],
      ['label', { class: 'content-form__field' }, 'Email', ['input', { type: 'email', name: 'email', required: 'true' }]],
      ...(showMessage
        ? [
            ['label', { class: 'content-form__field' }, 'Message', ['textarea', { name: 'message', rows: '4' }]],
          ]
        : []),
      ['button', { type: 'submit', class: 'content-form__submit' }, String(node.attrs.submitLabel || 'Submit')],
    ];
  },
});

export const ContentStudioSocial = Node.create({
  name: 'social',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      twitter: { default: '' },
      linkedin: { default: '' },
      facebook: { default: '' },
      instagram: { default: '' },
      youtube: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-content-social]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    const links = [
      { key: 'twitter', label: 'Twitter' },
      { key: 'linkedin', label: 'LinkedIn' },
      { key: 'facebook', label: 'Facebook' },
      { key: 'instagram', label: 'Instagram' },
      { key: 'youtube', label: 'YouTube' },
    ].filter((item) => String(node.attrs[item.key] || '').trim());

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-social': '',
        class: ['content-social', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
      }),
      ...links.map((item) => [
        'a',
        {
          href: String(node.attrs[item.key]),
          class: `content-social__link content-social__link--${item.key}`,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        item.label,
      ]),
    ];
  },
});

export const ContentStudioRating = Node.create({
  name: 'rating',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      value: { default: 4.5 },
      max: { default: 5 },
      label: { default: 'Rating' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-content-rating]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    const value = Number(node.attrs.value) || 0;
    const max = Math.min(Math.max(Number(node.attrs.max) || 5, 1), 10);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-rating': '',
        class: ['content-rating', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
        'data-rating-value': String(value),
        'data-rating-max': String(max),
      }),
      ['span', { class: 'content-rating__label' }, String(node.attrs.label || 'Rating')],
      ['span', { class: 'content-rating__value' }, `${value} / ${max}`],
    ];
  },
});

export const ContentStudioProgress = Node.create({
  name: 'progress',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      value: { default: 65 },
      label: { default: 'Progress' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-content-progress]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    const value = Math.min(Math.max(Number(node.attrs.value) || 0, 0), 100);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-progress': '',
        class: ['content-progress', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
      }),
      ['div', { class: 'content-progress__header' }, String(node.attrs.label || 'Progress'), ['span', {}, `${value}%`]],
      ['div', { class: 'content-progress__track', role: 'progressbar', 'aria-valuenow': String(value), 'aria-valuemin': '0', 'aria-valuemax': '100' },
        ['div', { class: 'content-progress__bar', style: `width:${value}%` }],
      ],
    ];
  },
});

export const ContentStudioHero = Node.create({
  name: 'hero',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'Hero title' },
      subtitle: { default: 'Add a compelling subtitle for this section.' },
      imageUrl: { default: '' },
      buttonLabel: { default: 'Get started' },
      buttonHref: { default: 'https://' },
    };
  },
  parseHTML() {
    return [{ tag: 'section[data-content-hero]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    const imageUrl = String(node.attrs.imageUrl || '').trim();
    const children: Array<unknown> = [];
    if (imageUrl) {
      children.push(['img', { src: imageUrl, alt: '', class: 'content-hero__image' }]);
    }
    children.push(
      ['div', { class: 'content-hero__content' },
        ['h2', { class: 'content-hero__title' }, String(node.attrs.title || 'Hero title')],
        ['p', { class: 'content-hero__subtitle' }, String(node.attrs.subtitle || '')],
        ['a', {
          href: String(node.attrs.buttonHref || '#'),
          class: 'content-hero__button',
          rel: 'noopener noreferrer',
        }, String(node.attrs.buttonLabel || 'Get started')],
      ],
    );
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-content-hero': '',
        class: ['content-hero', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
      }),
      ...children,
    ];
  },
});

export const ContentStudioNewsletterSignup = Node.create({
  name: 'newsletterSignup',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'Subscribe to our newsletter' },
      description: { default: 'Get the latest updates delivered to your inbox.' },
      placeholder: { default: 'Enter your email' },
      buttonLabel: { default: 'Subscribe' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-content-newsletter]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const layout = renderLayoutAttrs(node.attrs);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-newsletter': '',
        class: ['content-newsletter', layout.className].filter(Boolean).join(' '),
        style: layout.style || undefined,
      }),
      ['h3', { class: 'content-newsletter__title' }, String(node.attrs.title || 'Subscribe to our newsletter')],
      ['p', { class: 'content-newsletter__description' }, String(node.attrs.description || '')],
      ['form', { class: 'content-newsletter__form', action: '#', method: 'post' },
        ['input', { type: 'email', name: 'email', placeholder: String(node.attrs.placeholder || 'Enter your email'), required: 'true' }],
        ['button', { type: 'submit' }, String(node.attrs.buttonLabel || 'Subscribe')],
      ],
    ];
  },
});
