'use strict';

const { normalizeEmbedUrl } = require('./normalizeEmbedUrl');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarks(text, marks = []) {
  let output = escapeHtml(text);
  for (const mark of marks) {
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

function renderInlineContent(nodes = []) {
  return (nodes || [])
    .map((node) => {
      if (!node) return '';
      if (node.type === 'text') return renderMarks(node.text || '', node.marks);
      if (node.type === 'hardBreak') return '<br />';
      return '';
    })
    .join('');
}

function renderElementAttrs(attrs = {}, extraClasses = []) {
  const classes = extraClasses.filter(Boolean).map((value) => String(value));
  const styles = [];

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

  const parts = [];
  if (attrs.anchorId) parts.push(` id="${escapeHtml(String(attrs.anchorId))}"`);
  if (classes.length) parts.push(` class="${classes.join(' ')}"`);
  if (styles.length) parts.push(` style="${styles.join(';')}"`);
  return parts.join('');
}

function renderBlockAttrs(attrs = {}) {
  return renderElementAttrs(attrs);
}

function normalizeImageTextWrap(value) {
  if (value === 'wrap-left' || value === 'wrap-right') return value;
  return 'block';
}

function normalizeImagePosition(value) {
  if (value === 'left' || value === 'right') return value;
  return 'center';
}

function normalizeGalleryLayout(value) {
  const layout = String(value || 'grid').trim().toLowerCase();
  if (layout === 'scroll') return 'scroll';
  if (layout === 'carousel' || layout === 'slider') return 'carousel';
  return 'grid';
}

function buildGalleryFigureStyle(layout = 'grid') {
  if (layout === 'scroll') {
    return 'width:min(100%,320px);max-width:100%;margin:0;flex:0 0 auto';
  }
  if (layout === 'carousel') {
    return 'width:100%;max-width:100%;margin:0;flex:0 0 100%';
  }
  return 'width:100%;max-width:100%;margin:0;min-width:0;box-sizing:border-box';
}

function renderGalleryLayoutStyle(layout) {
  if (layout === 'grid') {
    return 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.75rem;width:100%';
  }
  if (layout === 'scroll') {
    return 'display:flex;flex-direction:row;flex-wrap:nowrap;gap:0.75rem;overflow-x:auto;width:100%';
  }
  return '';
}

function renderCarouselGallery(node, context, images, wrapperAttrs) {
  const groupId = `content-gallery-${Math.random().toString(36).slice(2, 9)}`;
  const inputs = images
    .map((_child, index) => {
      const id = `${groupId}-${index}`;
      const checked = index === 0 ? ' checked' : '';
      return `<input type="radio" name="${groupId}" id="${id}" class="content-gallery__input"${checked} />`;
    })
    .join('');
  const figures = images
    .map((child) => renderBlockNode(child, { ...context, inGallery: true, galleryLayout: 'carousel' }))
    .join('');
  const dots = images
    .map((_child, index) =>
      `<button type="button" class="content-gallery__dot${index === 0 ? ' content-gallery__dot--active' : ''}" aria-label="Slide ${index + 1}"></button>`,
    )
    .join('');
  const controls =
    images.length > 1
      ? `<div class="content-gallery__controls"><button type="button" class="content-gallery__arrow content-gallery__arrow--prev" aria-label="Previous slide">&#8249;</button><div class="content-gallery__dots">${dots}</div><button type="button" class="content-gallery__arrow content-gallery__arrow--next" aria-label="Next slide">&#8250;</button></div>`
      : '';
  return `<div data-content-gallery=""${wrapperAttrs} data-gallery-layout="carousel">${inputs}<div class="content-gallery__viewport">${figures}</div>${controls}</div>`;
}

function renderGalleryBlock(node, context = {}) {
  const layout = normalizeGalleryLayout(node.attrs?.layout);
  const images = (node.content || []).filter((child) => child.type === 'image');
  const wrapperAttrs = renderElementAttrs(node.attrs, ['content-gallery', `content-gallery--${layout}`]);
  if (layout === 'carousel') {
    return renderCarouselGallery(node, context, images, wrapperAttrs);
  }
  const layoutStyle = renderGalleryLayoutStyle(layout);
  const viewportStyle = layoutStyle ? ` style="${layoutStyle}"` : '';
  const inner = images
    .map((child) => renderBlockNode(child, { ...context, inGallery: true, galleryLayout: layout }))
    .join('');
  return `<div data-content-gallery=""${wrapperAttrs} data-gallery-layout="${escapeHtml(layout)}"><div class="content-gallery__viewport"${viewportStyle}>${inner}</div></div>`;
}

function buildImageFigureStyle(attrs = {}) {
  const parts = [];
  const width = String(attrs.width || '100%').trim() || '100%';
  parts.push(`width:${escapeHtml(width)}`, 'max-width:100%');

  const textWrap = normalizeImageTextWrap(attrs.textWrap);
  const position = normalizeImagePosition(attrs.imagePosition);

  if (textWrap === 'wrap-left') {
    parts.push('float:left', 'margin-right:1rem', 'margin-bottom:0.5rem');
  } else if (textWrap === 'wrap-right') {
    parts.push('float:right', 'margin-left:1rem', 'margin-bottom:0.5rem');
  } else {
    parts.push('display:block');
    if (position === 'center') {
      parts.push('margin-left:auto', 'margin-right:auto');
    } else if (position === 'right') {
      parts.push('margin-left:auto', 'margin-right:0');
    } else {
      parts.push('margin-left:0', 'margin-right:auto');
    }
  }

  return parts.join(';');
}

const IMAGE_CAPTION_STYLE =
  'margin:0;border:0;background:#f5f5f5;padding:0.5rem 0.75rem;font-size:0.875rem;line-height:1.4;color:#525252;text-align:center;border-radius:0 0 0.75rem 0.75rem';
const IMAGE_WITH_CAPTION_STYLE = 'width:100%;height:auto;display:block;border-radius:0.75rem 0.75rem 0 0';
const IMAGE_WITHOUT_CAPTION_STYLE = 'width:100%;height:auto;display:block;border-radius:0.75rem';

function resolveCellWidthPx(attrs) {
  if (Array.isArray(attrs?.colwidth) && attrs.colwidth[0]) {
    const parsed = Number(attrs.colwidth[0]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (attrs?.colWidth) {
    const parsed = Number.parseInt(String(attrs.colWidth), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function renderTableColgroup(tableNode) {
  const firstRow = (tableNode.content || []).find((row) => row?.type === 'tableRow');
  if (!firstRow) return '';
  const cols = (firstRow.content || []).map((cell) => {
    const width = resolveCellWidthPx(cell?.attrs);
    if (!width) return '<col />';
    return `<col style="width:${width}px" />`;
  });
  return cols.length ? `<colgroup>${cols.join('')}</colgroup>` : '';
}

function renderTableCellNode(node) {
  const tag = node.type === 'tableHeader' || node.attrs?.isHeader ? 'th' : 'td';
  const styles = [];
  if (node.attrs?.textColor) styles.push(`color:${escapeHtml(String(node.attrs.textColor))}`);
  if (node.attrs?.backgroundColor) styles.push(`background-color:${escapeHtml(String(node.attrs.backgroundColor))}`);
  if (node.attrs?.textAlign) styles.push(`text-align:${escapeHtml(String(node.attrs.textAlign))}`);
  if (node.attrs?.fontSize) styles.push(`font-size:${escapeHtml(String(node.attrs.fontSize))}`);
  if (node.attrs?.lineHeight) styles.push(`line-height:${escapeHtml(String(node.attrs.lineHeight))}`);
  if (Array.isArray(node.attrs?.colwidth) && node.attrs.colwidth[0]) {
    styles.push(`width:${escapeHtml(String(node.attrs.colwidth[0]))}px`);
  } else if (node.attrs?.colWidth) {
    styles.push(`width:${escapeHtml(String(node.attrs.colWidth))}`);
  }
  const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
  const colspan = Number(node.attrs?.colspan) > 1 ? ` colspan="${Number(node.attrs.colspan)}"` : '';
  const rowspan = Number(node.attrs?.rowspan) > 1 ? ` rowspan="${Number(node.attrs.rowspan)}"` : '';
  return `<${tag} class="content-table-cell"${colspan}${rowspan}${styleAttr}>${(node.content || []).map(renderBlockNode).join('')}</${tag}>`;
}

function slugifyHeading(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function extractNodeText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  return (node.content || []).map(extractNodeText).join('');
}

function collectHeadings(doc, minLevel = 2, maxLevel = 3) {
  const items = [];
  function walk(node) {
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
  (doc?.content || []).forEach(walk);
  return items;
}

function renderBlockNode(node, context = {}) {
  if (!node || !node.type) return '';

  switch (node.type) {
    case 'paragraph':
      return `<p${renderBlockAttrs(node.attrs)}>${renderInlineContent(node.content)}</p>`;
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 4);
      return `<h${level}${renderBlockAttrs(node.attrs)}>${renderInlineContent(node.content)}</h${level}>`;
    }
    case 'bulletList':
      return `<ul${renderBlockAttrs(node.attrs)}>${(node.content || []).map(renderBlockNode).join('')}</ul>`;
    case 'orderedList':
      return `<ol${renderBlockAttrs(node.attrs)}>${(node.content || []).map(renderBlockNode).join('')}</ol>`;
    case 'listItem':
      return `<li${renderBlockAttrs(node.attrs)}>${(node.content || []).map(renderBlockNode).join('')}</li>`;
    case 'taskList':
      return `<ul class="content-checklist"${renderBlockAttrs(node.attrs)}>${(node.content || []).map(renderBlockNode).join('')}</ul>`;
    case 'taskItem': {
      const checked = Boolean(node.attrs?.checked);
      const inner = (node.content || []).map(renderBlockNode).join('');
      return `<li data-checked="${checked}" class="content-checklist-item"><input type="checkbox" disabled${checked ? ' checked' : ''} />${inner}</li>`;
    }
    case 'blockquote':
      return `<blockquote${renderBlockAttrs(node.attrs)}>${(node.content || []).map(renderBlockNode).join('')}</blockquote>`;
    case 'codeBlock': {
      const code = (node.content || [])
        .map((child) => (child.type === 'text' ? child.text : ''))
        .join('');
      return `<pre${renderElementAttrs(node.attrs)}><code>${escapeHtml(code)}</code></pre>`;
    }
    case 'horizontalRule':
      return `<hr${renderElementAttrs(node.attrs)} />`;
    case 'image': {
      const src = escapeHtml(String(node.attrs?.src || ''));
      const alt = escapeHtml(String(node.attrs?.alt || ''));
      if (!src) return '';
      const caption = String(node.attrs?.caption || '').trim();
      const imgStyle = caption ? IMAGE_WITH_CAPTION_STYLE : IMAGE_WITHOUT_CAPTION_STYLE;
      const figcaption = caption
        ? `<figcaption class="content-image-caption" style="${IMAGE_CAPTION_STYLE}">${escapeHtml(caption)}</figcaption>`
        : '';

      if (context.inGallery) {
        const galleryLayout = context.galleryLayout || 'grid';
        const figureStyle = buildGalleryFigureStyle(galleryLayout);
        return `<figure class="content-image-figure content-gallery__figure" style="${figureStyle}"><img src="${src}" alt="${alt}" class="content-image" style="${imgStyle}" loading="lazy" />${figcaption}</figure>`;
      }

      const width = String(node.attrs?.width || '100%').trim() || '100%';
      const textWrap = normalizeImageTextWrap(node.attrs?.textWrap);
      const position = normalizeImagePosition(node.attrs?.imagePosition);
      const figureAttrs = renderElementAttrs(node.attrs, ['content-image-figure']);
      const figureStyle = buildImageFigureStyle(node.attrs);
      return `<figure${figureAttrs} data-width="${escapeHtml(width)}" data-text-wrap="${textWrap}" data-image-position="${position}" style="${figureStyle}"><img src="${src}" alt="${alt}" class="content-image" style="${imgStyle}" loading="lazy" />${figcaption}</figure>`;
    }
    case 'embed': {
      const rawSrc = String(node.attrs?.src || '').trim();
      const src = normalizeEmbedUrl(rawSrc);
      const title = escapeHtml(String(node.attrs?.title || 'Embedded content'));
      const height = Math.min(Math.max(Number(node.attrs?.height) || 360, 180), 900);
      const embedWidth = String(node.attrs?.embedWidth || 'full');
      const iframeWidth =
        embedWidth === 'full'
          ? '100%'
          : embedWidth === 'large'
            ? '85%'
            : embedWidth === 'medium'
              ? '70%'
              : '50%';
      const figureAttrs = renderElementAttrs(node.attrs, [
        'content-embed',
        `content-embed--width-${embedWidth}`,
      ]);

      const info = escapeHtml(String(node.attrs?.info || '').trim());
      const infoHtml = info ? `<p class="content-embed__info">${info}</p>` : '';

      if (!src) {
        if (!rawSrc) return '';
        const href = escapeHtml(rawSrc);
        const blockedFigureAttrs = renderElementAttrs(node.attrs, [
          'content-embed',
          'content-embed--blocked',
          `content-embed--width-${embedWidth}`,
        ]);
        return `<figure${blockedFigureAttrs} data-embed-blocked="true"><div class="content-embed__fallback"><a href="${href}" class="content-embed__fallback-link" target="_blank" rel="noopener noreferrer">${href}</a>${infoHtml}</div></figure>`;
      }

      const iframeStyle = `width:${iframeWidth};height:${height}px;border:0;border-radius:12px;display:block;margin:0 auto`;
      return `<figure${figureAttrs}><iframe src="${src}" title="${title}" style="${iframeStyle}" loading="lazy" frameborder="0" allowfullscreen></iframe>${infoHtml}</figure>`;
    }
    case 'callout': {
      const variant = escapeHtml(String(node.attrs?.variant || 'info'));
      const attrs = renderElementAttrs(node.attrs, [
        'content-callout',
        `content-callout--${variant}`,
      ]);
      return `<aside${attrs} role="note">${(node.content || []).map(renderBlockNode).join('')}</aside>`;
    }
    case 'steps': {
      const orientation = node.attrs?.orientation === 'horizontal' ? 'horizontal' : 'vertical';
      const titleLayout = node.attrs?.titleLayout === 'below' ? 'below' : 'inline';
      const headerAlign = node.attrs?.headerAlign === 'center' ? 'center' : 'start';
      const contentAlign = node.attrs?.contentAlign === 'center'
        ? 'center'
        : node.attrs?.contentAlign === 'end'
          ? 'end'
          : 'start';
      const classes = [
        'content-steps',
        `content-steps--${orientation}`,
        titleLayout === 'below' ? 'content-steps--title-below' : '',
        headerAlign === 'center' ? 'content-steps--header-center' : '',
        contentAlign === 'center' ? 'content-steps--content-center' : '',
        contentAlign === 'end' ? 'content-steps--content-end' : '',
      ].filter(Boolean);
      return `<div${renderElementAttrs(node.attrs, classes)} data-steps data-orientation="${orientation}" data-title-layout="${titleLayout}" data-header-align="${headerAlign}" data-content-align="${contentAlign}">${(node.content || []).map(renderBlockNode).join('')}</div>`;
    }
    case 'step': {
      const title = escapeHtml(String(node.attrs?.title || 'Step title'));
      const inner = (node.content || []).map(renderBlockNode).join('');
      return `<div class="content-step" data-step data-title="${title}"><div class="content-step__header"><span class="content-step__number" aria-hidden="true"></span><div class="content-step__title">${title}</div></div><div class="content-step__body">${inner}</div></div>`;
    }
    case 'faq':
      return `<div${renderElementAttrs(node.attrs, ['content-faq'])}>${(node.content || []).map(renderBlockNode).join('')}</div>`;
    case 'faqItem': {
      const question = escapeHtml(String(node.attrs?.question || 'Question?'));
      const inner = (node.content || []).map(renderBlockNode).join('');
      return `<details class="content-faq-item" data-faq-item data-question="${question}"><summary class="content-faq-item__question">${question}</summary><div class="content-faq-item__body">${inner}</div></details>`;
    }
    case 'relatedArticles':
    case 'related_articles': {
      const title = escapeHtml(String(node.attrs?.title || 'Related articles'));
      const items = Array.isArray(node.attrs?.items) ? node.attrs.items : [];
      const linkPrefix = String(context.articleLinkPrefix || '/portal/knowledge/');
      const listItems = items.map((item) => {
        const slug = String(item?.slug || item?.id || '').trim();
        const label = escapeHtml(String(item?.title || 'Article'));
        if (!slug) return `<li><span class="content-related-articles__label">${label}</span></li>`;
        const href = escapeHtml(`${linkPrefix}${slug}`);
        return `<li><a href="${href}" class="content-related-articles__link">${label}</a></li>`;
      }).join('');
      return `<section class="content-related-articles"><h3 class="content-related-articles__title">${title}</h3><ul class="content-related-articles__list">${listItems}</ul></section>`;
    }
    case 'table': {
      const tableWidth = node.attrs?.tableWidth ? String(node.attrs.tableWidth) : '';
      const widthAttr = tableWidth
        ? ` data-table-width="${escapeHtml(tableWidth)}" style="width:${escapeHtml(tableWidth)}"`
        : '';
      const colgroup = renderTableColgroup(node);
      const tableHtml = `<table${renderElementAttrs(node.attrs, ['content-table'])}${widthAttr}>${colgroup}<tbody>${(node.content || []).map(renderBlockNode).join('')}</tbody></table>`;
      return `<div class="ld-table-scroll">${tableHtml}</div>`;
    }
    case 'tableRow': {
      const rowStyles = [];
      if (node.attrs?.backgroundColor) {
        rowStyles.push(`background-color:${escapeHtml(String(node.attrs.backgroundColor))}`);
      }
      const rowStyleAttr = rowStyles.length ? ` style="${rowStyles.join(';')}"` : '';
      const inner = (node.content || []).map(renderTableCellNode).join('');
      return `<tr${rowStyleAttr}>${inner}</tr>`;
    }
    case 'tableCell':
    case 'tableHeader':
      return renderTableCellNode(node);
    case 'spacer': {
      const height = Math.min(Math.max(Number(node.attrs?.height) || 48, 8), 240);
      return `<div${renderElementAttrs(node.attrs, ['content-spacer'])} style="height:${height}px" aria-hidden="true"></div>`;
    }
    case 'button': {
      const label = escapeHtml(String(node.attrs?.label || 'Learn more'));
      const href = escapeHtml(String(node.attrs?.href || '#'));
      const variant = escapeHtml(String(node.attrs?.variant || 'primary'));
      return `<p${renderElementAttrs(node.attrs, ['content-button'])}><a href="${href}" class="content-button__link content-button__link--${variant}" rel="noopener noreferrer">${label}</a></p>`;
    }
    case 'audio': {
      const src = String(node.attrs?.src || '').trim();
      if (!src) return '';
      const title = escapeHtml(String(node.attrs?.title || '').trim());
      const info = escapeHtml(String(node.attrs?.info || '').trim());
      const controls = node.attrs?.controls === false ? '' : ' controls';
      const autoplay = node.attrs?.autoplay ? ' autoplay' : '';
      const loop = node.attrs?.loop ? ' loop' : '';
      const muted = node.attrs?.muted ? ' muted' : '';
      const preloadValue = node.attrs?.preload != null ? String(node.attrs.preload) : 'metadata';
      const preload = preloadValue ? ` preload="${escapeHtml(preloadValue)}"` : '';
      const audioHtml = `<audio${renderElementAttrs(node.attrs, ['content-audio'])} src="${escapeHtml(src)}"${controls}${autoplay}${loop}${muted}${preload}></audio>`;
      if (!title && !info) return audioHtml;
      const titleHtml = title ? `<p class="content-audio__title">${title}</p>` : '';
      const infoHtml = info ? `<p class="content-audio__info">${info}</p>` : '';
      return `<figure class="content-audio-block">${titleHtml}${audioHtml}${infoHtml}</figure>`;
    }
    case 'file': {
      const label = escapeHtml(String(node.attrs?.label || 'Download file'));
      const href = escapeHtml(String(node.attrs?.href || '#'));
      const info = escapeHtml(String(node.attrs?.info || '').trim());
      const linkHtml = `<a${renderElementAttrs(node.attrs, ['content-file'])} href="${href}" rel="noopener noreferrer">${label}</a>`;
      if (!info) return linkHtml;
      return `<div class="content-file-block">${linkHtml}<p class="content-file__info">${info}</p></div>`;
    }
    case 'gallery':
      return renderGalleryBlock(node, context);
    case 'timeline':
      return `<ol${renderElementAttrs(node.attrs, ['content-timeline'])}>${(node.content || []).map(renderBlockNode).join('')}</ol>`;
    case 'timelineItem': {
      const title = escapeHtml(String(node.attrs?.title || ''));
      const date = escapeHtml(String(node.attrs?.date || ''));
      const inner = (node.content || []).map((child) => renderBlockNode(child, context)).join('');
      const titleHtml = title ? `<strong>${title}</strong>` : '';
      return `<li class="content-timeline-item" data-title="${title}" data-date="${date}">${titleHtml}${date ? `<span class="content-timeline-item__date">${date}</span>` : ''}${inner}</li>`;
    }
    case 'tabs': {
      const items = (node.content || []).filter((child) => child.type === 'tabItem');
      const groupId = `content-tabs-${Math.random().toString(36).slice(2, 9)}`;
      const controls = items
        .map((item, index) => {
          const label = escapeHtml(String(item.attrs?.label || `Tab ${index + 1}`));
          const inputId = `${groupId}-${index}`;
          const checked = index === 0 ? ' checked' : '';
          return `<input type="radio" name="${groupId}" id="${inputId}" class="content-tabs__input"${checked} /><label for="${inputId}" class="content-tabs__tab" role="tab">${label}</label>`;
        })
        .join('');
      const panels = items.map((child) => renderBlockNode(child, context)).join('');
      return `<div${renderElementAttrs(node.attrs, ['content-tabs'])} data-tab-count="${items.length}"><div class="content-tabs__bar" role="tablist">${controls}</div><div class="content-tabs__panels">${panels}</div></div>`;
    }
    case 'tabItem': {
      const label = escapeHtml(String(node.attrs?.label || 'Tab'));
      const inner = (node.content || []).map((child) => renderBlockNode(child, context)).join('');
      return `<section class="content-tab-item" data-tab-label="${label}"><h4 class="content-tab-item__label">${label}</h4>${inner}</section>`;
    }
    case 'columns': {
      const count = Math.min(Math.max(Number(node.attrs?.columnCount) || 2, 2), 3);
      return `<div${renderElementAttrs(node.attrs, ['content-columns', `content-columns--${count}`])} data-column-count="${count}">${(node.content || []).map((child) => renderBlockNode(child, context)).join('')}</div>`;
    }
    case 'column':
      return `<div${renderElementAttrs(node.attrs, ['content-column'])}>${(node.content || []).map((child) => renderBlockNode(child, context)).join('')}</div>`;
    case 'section': {
      const variant = escapeHtml(String(node.attrs?.variant || 'default'));
      return `<section${renderElementAttrs(node.attrs, ['content-section', `content-section--${variant}`])} data-section-variant="${variant}">${(node.content || []).map((child) => renderBlockNode(child, context)).join('')}</section>`;
    }
    case 'toc': {
      const minLevel = Math.min(Math.max(Number(node.attrs?.minLevel) || 2, 1), 4);
      const maxLevel = Math.min(Math.max(Number(node.attrs?.maxLevel) || 3, minLevel), 4);
      const title = escapeHtml(String(node.attrs?.title || 'On this page'));
      const headings = collectHeadings(context.doc, minLevel, maxLevel);
      const items = headings
        .map((item) => {
          const indent = item.level - minLevel;
          return `<li class="content-toc__item content-toc__item--level-${item.level}" style="margin-left:${indent * 0.75}rem"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`;
        })
        .join('');
      return `<nav${renderElementAttrs(node.attrs, ['content-toc'])} aria-label="${title}"><p class="content-toc__title">${title}</p><ol class="content-toc__list">${items}</ol></nav>`;
    }
    case 'form': {
      const title = escapeHtml(String(node.attrs?.title || 'Contact us'));
      const description = escapeHtml(String(node.attrs?.description || ''));
      const submitLabel = escapeHtml(String(node.attrs?.submitLabel || 'Submit'));
      const showMessage = node.attrs?.showMessageField !== false;
      const messageField = showMessage
        ? '<label class="content-form__field">Message<textarea name="message" rows="4"></textarea></label>'
        : '';
      return `<form${renderElementAttrs(node.attrs, ['content-form'])} action="#" method="post"><h3 class="content-form__title">${title}</h3><p class="content-form__description">${description}</p><label class="content-form__field">Name<input type="text" name="name" required /></label><label class="content-form__field">Email<input type="email" name="email" required /></label>${messageField}<button type="submit" class="content-form__submit">${submitLabel}</button></form>`;
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
        .map((item) => `<a href="${escapeHtml(String(node.attrs[item.key]))}" class="content-social__link content-social__link--${item.key}" rel="noopener noreferrer" target="_blank">${item.label}</a>`)
        .join('');
      return `<div${renderElementAttrs(node.attrs, ['content-social'])}>${links}</div>`;
    }
    case 'rating': {
      const value = Number(node.attrs?.value) || 0;
      const max = Math.min(Math.max(Number(node.attrs?.max) || 5, 1), 10);
      const label = escapeHtml(String(node.attrs?.label || 'Rating'));
      return `<div${renderElementAttrs(node.attrs, ['content-rating'])} data-rating-value="${value}" data-rating-max="${max}"><span class="content-rating__label">${label}</span><span class="content-rating__value">${value} / ${max}</span></div>`;
    }
    case 'progress': {
      const value = Math.min(Math.max(Number(node.attrs?.value) || 0, 0), 100);
      const label = escapeHtml(String(node.attrs?.label || 'Progress'));
      return `<div${renderElementAttrs(node.attrs, ['content-progress'])}><div class="content-progress__header">${label}<span>${value}%</span></div><div class="content-progress__track" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><div class="content-progress__bar" style="width:${value}%"></div></div></div>`;
    }
    case 'hero': {
      const title = escapeHtml(String(node.attrs?.title || 'Hero title'));
      const subtitle = escapeHtml(String(node.attrs?.subtitle || ''));
      const imageUrl = escapeHtml(String(node.attrs?.imageUrl || '').trim());
      const buttonLabel = escapeHtml(String(node.attrs?.buttonLabel || 'Get started'));
      const buttonHref = escapeHtml(String(node.attrs?.buttonHref || '#'));
      const imageHtml = imageUrl ? `<img src="${imageUrl}" alt="" class="content-hero__image" />` : '';
      return `<section${renderElementAttrs(node.attrs, ['content-hero'])}>${imageHtml}<div class="content-hero__content"><h2 class="content-hero__title">${title}</h2><p class="content-hero__subtitle">${subtitle}</p><a href="${buttonHref}" class="content-hero__button" rel="noopener noreferrer">${buttonLabel}</a></div></section>`;
    }
    case 'newsletterSignup': {
      const title = escapeHtml(String(node.attrs?.title || 'Subscribe to our newsletter'));
      const description = escapeHtml(String(node.attrs?.description || ''));
      const placeholder = escapeHtml(String(node.attrs?.placeholder || 'Enter your email'));
      const buttonLabel = escapeHtml(String(node.attrs?.buttonLabel || 'Subscribe'));
      return `<div${renderElementAttrs(node.attrs, ['content-newsletter'])}><h3 class="content-newsletter__title">${title}</h3><p class="content-newsletter__description">${description}</p><form class="content-newsletter__form" action="#" method="post"><input type="email" name="email" placeholder="${placeholder}" required /><button type="submit">${buttonLabel}</button></form></div>`;
    }
    default:
      return (node.content || []).map((child) => renderBlockNode(child, context)).join('');
  }
}

function renderBlocksToHtml(blocks, options = {}) {
  const doc = blocks && blocks.type === 'doc' ? blocks : { type: 'doc', content: [] };
  const context = {
    doc,
    articleLinkPrefix: options.articleLinkPrefix || '/portal/knowledge/',
  };
  const body = (doc.content || []).map((node) => renderBlockNode(node, context)).join('\n');
  if (options.bodyOnly) return body;
  const title = options.title ? `<h1 class="content-title">${escapeHtml(options.title)}</h1>` : '';
  const subtitle = options.subtitle
    ? `<p class="content-subtitle">${escapeHtml(options.subtitle)}</p>`
    : '';
  return `${title}${subtitle}${body}`;
}

function blocksToPlainText(blocks) {
  const doc = blocks && blocks.type === 'doc' ? blocks : { type: 'doc', content: [] };

  function walk(node) {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    return (node.content || []).map(walk).join(node.type === 'paragraph' ? '\n' : ' ');
  }

  return (doc.content || []).map(walk).join('\n').trim();
}

module.exports = {
  renderBlocksToHtml,
  blocksToPlainText,
  escapeHtml,
};
