import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';
import { createContentStudioImageNodeView } from './imageNodeView';

declare module '@tiptap/extension-image' {
  interface ImageOptions {
    captionPlaceholder?: string;
  }
}

export type ImageTextWrap = 'block' | 'wrap-left' | 'wrap-right';
export type ImagePosition = 'left' | 'center' | 'right';

export const IMAGE_WIDTH_PRESETS = [
  { width: '25%', shortLabel: 'S' },
  { width: '50%', shortLabel: 'M' },
  { width: '75%', shortLabel: 'L' },
  { width: '100%', shortLabel: 'Full' },
] as const;

export const IMAGE_TEXT_WRAP_OPTIONS: ImageTextWrap[] = ['block', 'wrap-left', 'wrap-right'];
export const IMAGE_POSITION_OPTIONS: ImagePosition[] = ['left', 'center', 'right'];

export function normalizeImageWidth(width: string | null | undefined): string {
  const value = String(width || '').trim();
  if (!value || value === '100%') return '100%';
  return value;
}

export function normalizeImageTextWrap(value: string | null | undefined): ImageTextWrap {
  if (value === 'wrap-left' || value === 'wrap-right') return value;
  return 'block';
}

export function normalizeImagePosition(value: string | null | undefined): ImagePosition {
  if (value === 'left' || value === 'right') return value;
  return 'center';
}

function readImageNodeAttrs(element: Element) {
  const img = element.tagName === 'IMG' ? element : element.querySelector('img');
  if (!img?.getAttribute('src')) return false;

  const host = element.tagName === 'FIGURE' ? element : img;
  const captionNode = element.tagName === 'FIGURE' ? element.querySelector('figcaption') : null;

  return {
    src: img.getAttribute('src'),
    alt: img.getAttribute('alt'),
    title: img.getAttribute('title'),
    width: img.getAttribute('data-width') || host.getAttribute('data-width') || img.getAttribute('width') || '100%',
    textWrap: normalizeImageTextWrap(host.getAttribute('data-text-wrap') || img.getAttribute('data-text-wrap')),
    imagePosition: normalizeImagePosition(
      host.getAttribute('data-image-position') || img.getAttribute('data-image-position'),
    ),
    caption: captionNode?.textContent?.trim() || img.getAttribute('data-caption') || null,
    captionEnabled: host.getAttribute('data-caption-enabled') === 'true'
      || Boolean(captionNode?.textContent?.trim() || img.getAttribute('data-caption')),
  };
}

export const ContentStudioImage = Image.extend({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      captionPlaceholder: 'Enter image caption',
    };
  },

  addNodeView() {
    return createContentStudioImageNodeView({
      captionPlaceholder: this.options.captionPlaceholder ?? 'Enter image caption',
    });
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element) => {
          const img = element.tagName === 'IMG' ? element : element.querySelector('img');
          const host = element.tagName === 'FIGURE' ? element : img;
          return (
            img?.getAttribute('data-width')
            || host?.getAttribute('data-width')
            || img?.getAttribute('width')
            || '100%'
          );
        },
        renderHTML: (attributes) => ({
          'data-width': normalizeImageWidth(attributes.width),
        }),
      },
      textWrap: {
        default: 'block',
        parseHTML: (element) => {
          const img = element.tagName === 'IMG' ? element : element.querySelector('img');
          const host = element.tagName === 'FIGURE' ? element : img;
          return normalizeImageTextWrap(host?.getAttribute('data-text-wrap') || img?.getAttribute('data-text-wrap'));
        },
        renderHTML: (attributes) => ({
          'data-text-wrap': normalizeImageTextWrap(attributes.textWrap),
        }),
      },
      imagePosition: {
        default: 'center',
        parseHTML: (element) => {
          const img = element.tagName === 'IMG' ? element : element.querySelector('img');
          const host = element.tagName === 'FIGURE' ? element : img;
          return normalizeImagePosition(
            host?.getAttribute('data-image-position') || img?.getAttribute('data-image-position'),
          );
        },
        renderHTML: (attributes) => ({
          'data-image-position': normalizeImagePosition(attributes.imagePosition),
        }),
      },
      caption: {
        default: null,
        parseHTML: (element) => {
          if (element.tagName === 'FIGCAPTION') {
            return element.textContent?.trim() || null;
          }
          const figcaption = element.querySelector?.('figcaption');
          if (figcaption) return figcaption.textContent?.trim() || null;
          return element.getAttribute('data-caption') || null;
        },
        renderHTML: (attributes) => {
          const caption = String(attributes.caption || '').trim();
          if (!caption) return {};
          return { 'data-caption': caption };
        },
      },
      captionEnabled: {
        default: false,
        parseHTML: (element) => {
          const img = element.tagName === 'IMG' ? element : element.querySelector('img');
          const host = element.tagName === 'FIGURE' ? element : img;
          if (host?.getAttribute('data-caption-enabled') === 'true') return true;
          const figcaption = element.tagName === 'FIGURE' ? element.querySelector('figcaption') : null;
          return Boolean(figcaption?.textContent?.trim() || element.getAttribute('data-caption'));
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.content-image-figure',
        getAttrs: (node) => readImageNodeAttrs(node),
      },
      {
        tag: 'img[src]',
        getAttrs: (node) => readImageNodeAttrs(node),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const caption = String(node.attrs.caption || '').trim();
    const width = normalizeImageWidth(node.attrs.width);
    const textWrap = normalizeImageTextWrap(node.attrs.textWrap);
    const position = normalizeImagePosition(node.attrs.imagePosition);

    const figureAttrs = mergeAttributes(HTMLAttributes, {
      class: 'content-image-figure',
      'data-width': width,
      'data-text-wrap': textWrap,
      'data-image-position': position,
    });

    const imgAttrs = {
      class: 'content-image',
      src: node.attrs.src,
      alt: node.attrs.alt || '',
      title: node.attrs.title || undefined,
      loading: 'lazy',
    };

    if (caption) {
      return ['figure', figureAttrs, ['img', imgAttrs], ['figcaption', { class: 'content-image-caption' }, caption]];
    }

    return ['figure', figureAttrs, ['img', imgAttrs]];
  },
});
