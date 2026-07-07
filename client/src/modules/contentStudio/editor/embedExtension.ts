import { Node, mergeAttributes } from '@tiptap/core';
import { normalizeEmbedUrl } from '../utils/normalizeEmbedUrl';
import { renderLayoutAttrs } from './blockLayout';

export const ContentStudioEmbed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      title: { default: '' },
      info: { default: '' },
      height: { default: 360 },
      embedWidth: {
        default: 'full',
        parseHTML: (element) => element.getAttribute('data-embed-width') || 'full',
        renderHTML: (attributes) => ({
          'data-embed-width': attributes.embedWidth || 'full',
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'iframe[data-content-embed]' }, { tag: 'figure[data-content-embed]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const height = Math.min(Math.max(Number(node.attrs.height) || 360, 180), 900);
    const rawSrc = String(node.attrs.src || '').trim();
    const src = normalizeEmbedUrl(rawSrc);
    const embedWidth = String(node.attrs.embedWidth || 'full');
    const layout = renderLayoutAttrs(node.attrs);
    const figureClasses = ['content-embed', `content-embed--width-${embedWidth}`, layout.className]
      .filter(Boolean)
      .join(' ');
    const figureStyle = layout.style || undefined;
    const iframeWidth = embedWidth === 'full' ? '100%' : embedWidth === 'large' ? '85%' : embedWidth === 'medium' ? '70%' : '50%';

    if (!src) {
      const fallbackHref = rawSrc || '#';
      const blockedInfo = String(node.attrs.info || '').trim();
      const fallbackChildren: Array<[string, Record<string, string>, string]> = [
        [
          'a',
          {
            href: fallbackHref,
            class: 'content-embed__fallback-link',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          rawSrc || 'Invalid embed URL',
        ],
      ];
      if (blockedInfo) {
        fallbackChildren.push(['p', { class: 'content-embed__info' }, blockedInfo]);
      }
      return [
        'figure',
        mergeAttributes(HTMLAttributes, {
          'data-content-embed': '',
          'data-embed-blocked': 'true',
          class: [figureClasses, 'content-embed--blocked'].filter(Boolean).join(' '),
          style: figureStyle,
        }),
        ['div', { class: 'content-embed__fallback' }, ...fallbackChildren],
      ];
    }

    const info = String(node.attrs.info || '').trim();
    const iframeContent: Array<[string, Record<string, unknown>] | [string, Record<string, string>, string]> = [
      [
        'iframe',
        mergeAttributes(HTMLAttributes, {
          src,
          title: String(node.attrs.title || 'Embedded content'),
          'data-content-embed': '',
          frameborder: '0',
          allowfullscreen: 'true',
          loading: 'lazy',
          style: `width:${iframeWidth};height:${height}px;border:0;border-radius:12px;display:block;margin:0 auto`,
        }),
      ],
    ];
    if (info) {
      iframeContent.push(['p', { class: 'content-embed__info' }, info]);
    }

    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-content-embed': '',
        class: figureClasses,
        style: figureStyle,
      }),
      ...iframeContent,
    ];
  },
});
