import { Extension } from '@tiptap/core';

const BLOCK_TYPES_WITH_LAYOUT = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'callout',
  'image',
  'horizontalRule',
  'steps',
  'faq',
  'table',
  'embed',
  'taskList',
  'bulletList',
  'orderedList',
  'spacer',
  'button',
  'audio',
  'file',
  'gallery',
  'timeline',
  'tabs',
  'columns',
  'section',
  'toc',
  'form',
  'social',
  'rating',
  'progress',
  'hero',
  'newsletterSignup',
];

const BLOCK_TYPES_WITH_TYPOGRAPHY = [
  'paragraph',
  'heading',
  'blockquote',
];

function parsePxValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function renderPxStyle(property: string, value: number | null | undefined) {
  if (value == null || value <= 0) return {};
  return { style: `${property}:${value}px` };
}

export const ContentStudioBlockAttributes = Extension.create({
  name: 'contentStudioBlockAttributes',

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES_WITH_LAYOUT,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || element.getAttribute('data-text-align') || null,
            renderHTML: (attributes) => {
              if (!attributes.textAlign) return {};
              return {
                style: `text-align:${attributes.textAlign}`,
                'data-text-align': String(attributes.textAlign),
              };
            },
          },
          blockWidth: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-block-width') || null,
            renderHTML: (attributes) => {
              const width = attributes.blockWidth;
              if (!width || width === 'content') return {};
              return {
                'data-block-width': String(width),
                class: `content-block-width-${width}`,
              };
            },
          },
          marginTop: {
            default: null,
            parseHTML: (element) => parsePxValue(element.style.marginTop),
            renderHTML: (attributes) => renderPxStyle('margin-top', attributes.marginTop),
          },
          marginBottom: {
            default: null,
            parseHTML: (element) => parsePxValue(element.style.marginBottom),
            renderHTML: (attributes) => renderPxStyle('margin-bottom', attributes.marginBottom),
          },
          padding: {
            default: null,
            parseHTML: (element) => parsePxValue(element.style.padding),
            renderHTML: (attributes) => renderPxStyle('padding', attributes.padding),
          },
          anchorId: {
            default: null,
            parseHTML: (element) => element.getAttribute('id') || null,
            renderHTML: (attributes) => {
              if (!attributes.anchorId) return {};
              return { id: String(attributes.anchorId) };
            },
          },
          cssClass: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-css-class') || null,
            renderHTML: (attributes) => {
              if (!attributes.cssClass) return {};
              return { 'data-css-class': String(attributes.cssClass), class: String(attributes.cssClass) };
            },
          },
        },
      },
      {
        types: BLOCK_TYPES_WITH_TYPOGRAPHY,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || element.getAttribute('data-font-size') || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size:${attributes.fontSize}`,
                'data-font-size': String(attributes.fontSize),
              };
            },
          },
          textColor: {
            default: null,
            parseHTML: (element) => element.style.color || element.getAttribute('data-text-color') || null,
            renderHTML: (attributes) => {
              if (!attributes.textColor) return {};
              return {
                style: `color:${attributes.textColor}`,
                'data-text-color': String(attributes.textColor),
              };
            },
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-line-height') || element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return {
                style: `line-height:${attributes.lineHeight}`,
                'data-line-height': String(attributes.lineHeight),
              };
            },
          },
        },
      },
    ];
  },
});
