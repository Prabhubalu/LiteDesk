import { normalizeEmbedUrl } from './normalizeEmbedUrl';
import type {
  ContentBlockNode,
  ContentBlocksDoc,
  HeadlessRenderContext,
  HeadlessRenderOptions,
  RelatedArticleItem,
} from './types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarks(text: string, marks: ContentBlockNode['marks'] = []): string {
  let output = escapeHtml(text);
  for (const mark of marks || []) {
    const type = String(mark?.type || '');
    if (type === 'bold') output = `<strong>${output}</strong>`;
    else if (type === 'italic') output = `<em>${output}</em>`;
    else if (type === 'strike') output = `<s>${output}</s>`;
    else if (type === 'code') output = `<code>${output}</code>`;
    else if (type === 'link') {
      const href = escapeHtml(String(mark.attrs?.href || '#'));
      output = `<a href="${href}" rel="noopener noreferrer">${output}</a>`;
    }
  }
  return output;
}

function renderInlineContent(nodes: ContentBlockNode[] = []): string {
  return nodes
    .map((node) => {
      if (!node) return '';
      if (node.type === 'text') return renderMarks(node.text || '', node.marks);
      if (node.type === 'hardBreak') return '<br />';
      return '';
    })
    .join('');
}

function normalizeStyleList(extraStyles: string | string[] = []): string[] {
  const list = Array.isArray(extraStyles) ? extraStyles : [extraStyles];
  return list
    .flatMap((value) => String(value || '').split(';'))
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Editor layout/typography attrs → single style= (no duplicate style attrs). */
function renderElementAttrs(
  attrs: Record<string, unknown> | undefined = {},
  extraClasses: string[] = [],
  extraStyles: string | string[] = [],
): string {
  const classes = extraClasses.filter(Boolean).map((value) => String(value));
  const styles = normalizeStyleList(extraStyles);

  if (attrs.textAlign) styles.push(`text-align:${escapeHtml(String(attrs.textAlign))}`);
  const blockWidth = attrs.blockWidth ? String(attrs.blockWidth) : '';
  if (blockWidth && blockWidth !== 'content') classes.push(`content-block-width-${blockWidth}`);
  if (attrs.cssClass) classes.push(escapeHtml(String(attrs.cssClass)));
  if (attrs.fontSize) styles.push(`font-size:${escapeHtml(String(attrs.fontSize))}`);
  if (attrs.textColor) styles.push(`color:${escapeHtml(String(attrs.textColor))}`);
  if (attrs.lineHeight) styles.push(`line-height:${escapeHtml(String(attrs.lineHeight))}`);
  if (attrs.marginTop != null && Number(attrs.marginTop) > 0) {
    styles.push(`margin-top:${Number(attrs.marginTop)}px`);
  }
  if (attrs.marginBottom != null && Number(attrs.marginBottom) > 0) {
    styles.push(`margin-bottom:${Number(attrs.marginBottom)}px`);
  }
  if (attrs.padding != null && Number(attrs.padding) > 0) {
    styles.push(`padding:${Number(attrs.padding)}px`);
  }

  const parts: string[] = [];
  if (attrs.anchorId) parts.push(` id="${escapeHtml(String(attrs.anchorId))}"`);
  if (classes.length) parts.push(` class="${classes.join(' ')}"`);
  if (styles.length) parts.push(` style="${styles.join(';')}"`);
  return parts.join('');
}

function renderBlockAttrs(attrs: Record<string, unknown> | undefined): string {
  return renderElementAttrs(attrs);
}

function slugifyHeading(text: string): string {
  return (
    String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'section'
  );
}

function extractNodeText(node: ContentBlockNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  return (node.content || []).map(extractNodeText).join('');
}

function collectHeadings(doc: ContentBlocksDoc, minLevel = 2, maxLevel = 3) {
  const items: Array<{ level: number; text: string; id: string }> = [];

  function walk(node: ContentBlockNode | undefined) {
    if (!node) return;
    if (node.type === 'heading') {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 4);
      if (level >= minLevel && level <= maxLevel) {
        const text = extractNodeText(node).trim();
        if (text) {
          const id = String(node.attrs?.anchorId || slugifyHeading(text));
          items.push({ level, text, id });
        }
      }
    }
    (node.content || []).forEach(walk);
  }

  (doc.content || []).forEach(walk);
  return items;
}

function renderBlockNode(
  node: ContentBlockNode,
  context: HeadlessRenderContext,
  components?: HeadlessRenderOptions['components'],
): string {
  if (!node?.type) return '';

  const custom = components?.[node.type];
  if (custom) return custom(node, context);

  switch (node.type) {
    case 'paragraph': {
      const inner = renderInlineContent(node.content);
      return `<p${renderBlockAttrs(node.attrs)}>${inner || '<br />'}</p>`;
    }
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 4);
      const text = extractNodeText(node).trim();
      const attrs = { ...(node.attrs || {}) };
      if (!attrs.anchorId && text) attrs.anchorId = slugifyHeading(text);
      const inner = renderInlineContent(node.content);
      return `<h${level}${renderBlockAttrs(attrs)}>${inner || '<br />'}</h${level}>`;
    }
    case 'bulletList':
      return `<ul${renderBlockAttrs(node.attrs)}>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</ul>`;
    case 'orderedList':
      return `<ol${renderBlockAttrs(node.attrs)}>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</ol>`;
    case 'listItem':
      return `<li${renderBlockAttrs(node.attrs)}>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</li>`;
    case 'taskList':
      return `<ul class="content-checklist"${renderBlockAttrs(node.attrs)}>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</ul>`;
    case 'taskItem': {
      const checked = Boolean(node.attrs?.checked);
      const inner = (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
      return `<li class="content-checklist-item" data-checked="${checked}"><input type="checkbox" disabled${checked ? ' checked' : ''} aria-hidden="true" />${inner}</li>`;
    }
    case 'blockquote':
      return `<blockquote${renderBlockAttrs(node.attrs)}>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</blockquote>`;
    case 'codeBlock': {
      const code = (node.content || [])
        .map((child) => (child.type === 'text' ? child.text : ''))
        .join('');
      return `<pre${renderBlockAttrs(node.attrs)}><code>${escapeHtml(code)}</code></pre>`;
    }
    case 'horizontalRule':
      return `<hr${renderBlockAttrs(node.attrs)} />`;
    case 'image': {
      const src = escapeHtml(String(node.attrs?.src || ''));
      const alt = escapeHtml(String(node.attrs?.alt || ''));
      if (!src) return '';
      const caption = String(node.attrs?.caption || '').trim();
      const img = `<img src="${src}" alt="${alt}" loading="lazy" />`;
      const figureOpen = `<figure${renderBlockAttrs(node.attrs)}>`;
      if (!caption) return `${figureOpen}${img}</figure>`;
      return `${figureOpen}${img}<figcaption>${escapeHtml(caption)}</figcaption></figure>`;
    }
    case 'embed': {
      const rawSrc = String(node.attrs?.src || '').trim();
      const src = normalizeEmbedUrl(rawSrc);
      const title = escapeHtml(String(node.attrs?.title || 'Embedded content'));
      const height = Math.min(Math.max(Number(node.attrs?.height) || 360, 180), 900);
      const info = escapeHtml(String(node.attrs?.info || '').trim());

      if (!src) {
        if (!rawSrc) return '';
        const href = escapeHtml(rawSrc);
        const infoHtml = info ? `<p>${info}</p>` : '';
        return `<figure><p><a href="${href}" rel="noopener noreferrer">${href}</a></p>${infoHtml}</figure>`;
      }

      const infoHtml = info ? `<p>${info}</p>` : '';
      return `<figure><iframe src="${src}" title="${title}" height="${height}" loading="lazy" frameborder="0" allowfullscreen></iframe>${infoHtml}</figure>`;
    }
    case 'callout': {
      const variant = escapeHtml(String(node.attrs?.variant || 'info'));
      const inner = (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
      return `<aside role="note" data-variant="${variant}"${renderElementAttrs(node.attrs)}>${inner}</aside>`;
    }
    case 'steps':
      return `<div data-block="steps">${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</div>`;
    case 'step': {
      const title = escapeHtml(String(node.attrs?.title || 'Step'));
      const inner = (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
      return `<section data-block="step"><h3>${title}</h3>${inner}</section>`;
    }
    case 'faq':
      return `<div data-block="faq">${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</div>`;
    case 'faqItem': {
      const question = escapeHtml(String(node.attrs?.question || 'Question?'));
      const inner = (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
      return `<details><summary>${question}</summary>${inner}</details>`;
    }
    case 'relatedArticles':
    case 'related_articles': {
      const title = escapeHtml(String(node.attrs?.title || 'Related articles'));
      const items = Array.isArray(node.attrs?.items) ? (node.attrs.items as RelatedArticleItem[]) : [];
      const linkPrefix = context.articleLinkPrefix;
      const listItems = items
        .map((item) => {
          const slug = String(item?.slug || item?.id || '').trim();
          const label = escapeHtml(String(item?.title || 'Article'));
          if (!slug) return `<li><span>${label}</span></li>`;
          const href = escapeHtml(`${linkPrefix}${slug}`);
          return `<li><a href="${href}">${label}</a></li>`;
        })
        .join('');
      return `<section><h3>${title}</h3><ul>${listItems}</ul></section>`;
    }
    case 'table':
      return `<table><tbody>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</tbody></table>`;
    case 'tableRow':
      return `<tr>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</tr>`;
    case 'tableCell':
    case 'tableHeader': {
      const tag = node.type === 'tableHeader' || node.attrs?.isHeader ? 'th' : 'td';
      return `<${tag}>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</${tag}>`;
    }
    case 'spacer': {
      const height = Math.min(Math.max(Number(node.attrs?.height) || 48, 8), 240);
      return `<div aria-hidden="true" data-block="spacer" data-height="${height}"${renderElementAttrs(node.attrs, ['content-spacer'], [`height:${height}px`])}></div>`;
    }
    case 'button': {
      const label = escapeHtml(String(node.attrs?.label || 'Learn more'));
      const href = escapeHtml(String(node.attrs?.href || '#'));
      return `<p><a href="${href}" rel="noopener noreferrer">${label}</a></p>`;
    }
    case 'audio': {
      const src = String(node.attrs?.src || '').trim();
      if (!src) return '';
      const title = escapeHtml(String(node.attrs?.title || '').trim());
      const info = escapeHtml(String(node.attrs?.info || '').trim());
      const controls = node.attrs?.controls === false ? '' : ' controls';
      const audioHtml = `<audio src="${escapeHtml(src)}"${controls}></audio>`;
      if (!title && !info) return audioHtml;
      const titleHtml = title ? `<p>${title}</p>` : '';
      const infoHtml = info ? `<p>${info}</p>` : '';
      return `<figure>${titleHtml}${audioHtml}${infoHtml}</figure>`;
    }
    case 'file': {
      const label = escapeHtml(String(node.attrs?.label || 'Download file'));
      const href = escapeHtml(String(node.attrs?.href || '#'));
      const info = escapeHtml(String(node.attrs?.info || '').trim());
      const linkHtml = `<a href="${href}" rel="noopener noreferrer">${label}</a>`;
      if (!info) return linkHtml;
      return `<div>${linkHtml}<p>${info}</p></div>`;
    }
    case 'gallery': {
      const layout = String(node.attrs?.layout || 'grid');
      const figures = (node.content || [])
        .filter((child) => child.type === 'image')
        .map((child) => renderBlockNode(child, context, components))
        .join('');
      return `<div data-block="gallery" data-layout="${escapeHtml(layout)}">${figures}</div>`;
    }
    case 'timeline':
      return `<ol>${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</ol>`;
    case 'timelineItem': {
      const title = escapeHtml(String(node.attrs?.title || ''));
      const date = escapeHtml(String(node.attrs?.date || ''));
      const inner = (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
      const titleHtml = title ? `<strong>${title}</strong>` : '';
      const dateHtml = date ? `<time>${date}</time>` : '';
      return `<li>${titleHtml}${dateHtml}${inner}</li>`;
    }
    case 'tabs': {
      const panels = (node.content || [])
        .filter((child) => child.type === 'tabItem')
        .map((child) => renderBlockNode(child, context, components))
        .join('');
      return `<div data-block="tabs">${panels}</div>`;
    }
    case 'tabItem': {
      const label = escapeHtml(String(node.attrs?.label || 'Tab'));
      const inner = (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
      return `<section data-block="tab"><h4>${label}</h4>${inner}</section>`;
    }
    case 'columns': {
      const count = Math.min(Math.max(Number(node.attrs?.columnCount) || 2, 2), 3);
      const inner = (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
      return `<div data-block="columns" data-column-count="${count}">${inner}</div>`;
    }
    case 'column':
      return `<div data-block="column">${(node.content || []).map((child) => renderBlockNode(child, context, components)).join('')}</div>`;
    case 'section': {
      const variant = escapeHtml(String(node.attrs?.variant || 'default'));
      const inner = (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
      return `<section data-variant="${variant}">${inner}</section>`;
    }
    case 'toc': {
      const minLevel = Math.min(Math.max(Number(node.attrs?.minLevel) || 2, 1), 4);
      const maxLevel = Math.min(Math.max(Number(node.attrs?.maxLevel) || 3, minLevel), 4);
      const title = escapeHtml(String(node.attrs?.title || 'On this page'));
      const headings = collectHeadings(context.doc, minLevel, maxLevel);
      const items = headings
        .map((item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`)
        .join('');
      return `<nav aria-label="${title}"><p>${title}</p><ol>${items}</ol></nav>`;
    }
    case 'form': {
      const title = escapeHtml(String(node.attrs?.title || 'Contact us'));
      const description = escapeHtml(String(node.attrs?.description || ''));
      const submitLabel = escapeHtml(String(node.attrs?.submitLabel || 'Submit'));
      const showMessage = node.attrs?.showMessageField !== false;
      const messageField = showMessage
        ? '<label>Message<textarea name="message" rows="4"></textarea></label>'
        : '';
      return `<form action="#" method="post"><h3>${title}</h3><p>${description}</p><label>Name<input type="text" name="name" required /></label><label>Email<input type="email" name="email" required /></label>${messageField}<button type="submit">${submitLabel}</button></form>`;
    }
    case 'social': {
      const platforms = [
        { key: 'twitter', label: 'Twitter' },
        { key: 'linkedin', label: 'LinkedIn' },
        { key: 'facebook', label: 'Facebook' },
        { key: 'instagram', label: 'Instagram' },
        { key: 'youtube', label: 'YouTube' },
      ].filter((item) => String(node.attrs?.[item.key] || '').trim());
      const links = platforms
        .map((item) => {
          const href = escapeHtml(String(node.attrs?.[item.key]));
          return `<a href="${href}" rel="noopener noreferrer">${item.label}</a>`;
        })
        .join('');
      return `<div>${links}</div>`;
    }
    case 'rating': {
      const value = Number(node.attrs?.value) || 0;
      const max = Math.min(Math.max(Number(node.attrs?.max) || 5, 1), 10);
      const label = escapeHtml(String(node.attrs?.label || 'Rating'));
      return `<div data-block="rating" aria-label="${label}"><span>${value} / ${max}</span></div>`;
    }
    case 'progress': {
      const value = Math.min(Math.max(Number(node.attrs?.value) || 0, 0), 100);
      const label = escapeHtml(String(node.attrs?.label || 'Progress'));
      return `<div role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" aria-label="${label}"><span>${label}</span><span>${value}%</span></div>`;
    }
    case 'hero': {
      const title = escapeHtml(String(node.attrs?.title || 'Hero title'));
      const subtitle = escapeHtml(String(node.attrs?.subtitle || ''));
      const imageUrl = escapeHtml(String(node.attrs?.imageUrl || '').trim());
      const buttonLabel = escapeHtml(String(node.attrs?.buttonLabel || 'Get started'));
      const buttonHref = escapeHtml(String(node.attrs?.buttonHref || '#'));
      const imageHtml = imageUrl ? `<img src="${imageUrl}" alt="" />` : '';
      return `<section>${imageHtml}<h2>${title}</h2><p>${subtitle}</p><a href="${buttonHref}" rel="noopener noreferrer">${buttonLabel}</a></section>`;
    }
    case 'newsletterSignup': {
      const title = escapeHtml(String(node.attrs?.title || 'Subscribe to our newsletter'));
      const description = escapeHtml(String(node.attrs?.description || ''));
      const placeholder = escapeHtml(String(node.attrs?.placeholder || 'Enter your email'));
      const buttonLabel = escapeHtml(String(node.attrs?.buttonLabel || 'Subscribe'));
      return `<div><h3>${title}</h3><p>${description}</p><form action="#" method="post"><input type="email" name="email" placeholder="${placeholder}" required /><button type="submit">${buttonLabel}</button></form></div>`;
    }
    default:
      return (node.content || []).map((child) => renderBlockNode(child, context, components)).join('');
  }
}

export function blocksToPlainText(blocks: ContentBlocksDoc | null | undefined): string {
  const doc = blocks?.type === 'doc' ? blocks : { type: 'doc' as const, content: [] };

  function walk(node: ContentBlockNode | undefined): string {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'horizontalRule') return '\n';
    if (node.type === 'image' || node.type === 'embed' || node.type === 'spacer') return '';
    const blockBreakTypes = new Set([
      'paragraph',
      'heading',
      'blockquote',
      'listItem',
      'taskItem',
      'callout',
      'step',
      'faqItem',
      'timelineItem',
      'tabItem',
    ]);
    const inner = (node.content || []).map(walk).join('');
    return blockBreakTypes.has(node.type) ? `${inner}\n` : inner;
  }

  return (doc.content || [])
    .map(walk)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderBlocksToHtml(
  blocks: ContentBlocksDoc | null | undefined,
  options: HeadlessRenderOptions = {},
): string {
  const doc: ContentBlocksDoc = blocks?.type === 'doc' ? blocks : { type: 'doc', content: [] };
  const context: HeadlessRenderContext = {
    doc,
    articleLinkPrefix: options.articleLinkPrefix || '/articles/',
  };
  const body = (doc.content || [])
    .map((node) => renderBlockNode(node, context, options.components))
    .join('\n');

  if (options.bodyOnly) return body;

  const title = options.title ? `<h1>${escapeHtml(options.title)}</h1>` : '';
  const subtitle = options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : '';
  return [title, subtitle, body].filter(Boolean).join('\n');
}

export function renderBlocksToElement(
  blocks: ContentBlocksDoc | null | undefined,
  options: HeadlessRenderOptions = {},
): HTMLElement {
  const wrapper = document.createElement('article');
  wrapper.innerHTML = renderBlocksToHtml(blocks, options);
  return wrapper;
}

export function mountArticleBlocks(
  target: HTMLElement | string,
  blocks: ContentBlocksDoc | null | undefined,
  options: HeadlessRenderOptions = {},
): HTMLElement {
  const element = renderBlocksToElement(blocks, options);
  const mount = typeof target === 'string' ? document.querySelector(target) : target;
  if (!mount) {
    throw new Error('mountArticleBlocks: target element not found');
  }
  mount.replaceChildren(element);
  return element;
}
