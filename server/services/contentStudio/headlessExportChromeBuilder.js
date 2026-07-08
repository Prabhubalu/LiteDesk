'use strict';

function normalizeExportPathPrefix(prefix) {
  const raw = String(prefix || '/help/').trim();
  if (!raw) return '/help/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function buildCollectionExportPath({
  collectionPathSlugs = [],
  pathPrefix = '/help/',
} = {}) {
  const prefix = normalizeExportPathPrefix(pathPrefix);
  const segments = collectionPathSlugs.map((entry) => normalizeSlug(entry)).filter(Boolean);
  if (!segments.length) return `${prefix}index.html`;
  return `${prefix}${segments.map(encodeURIComponent).join('/')}/index.html`;
}

function buildCustomerHref(exportPath) {
  return String(exportPath || '').replace(/\/index\.html$/i, '/');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeSlug(value) {
  return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
}

function normalizeLinkPrefix(prefix) {
  const raw = normalizeExportPathPrefix(prefix);
  return raw;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatStats(articleCount = 0, sectionCount = 0) {
  const parts = [];
  if (articleCount) parts.push(`${articleCount} article${articleCount === 1 ? '' : 's'}`);
  if (sectionCount) parts.push(`${sectionCount} section${sectionCount === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function buildHomeHref(pathPrefix) {
  return normalizeLinkPrefix(pathPrefix);
}

function buildCategoryHref(pathPrefix, slug) {
  const prefix = normalizeLinkPrefix(pathPrefix);
  const safeSlug = normalizeSlug(slug);
  return safeSlug ? `${prefix}${encodeURIComponent(safeSlug)}` : prefix;
}

function buildSectionHref(pathPrefix, slug, parentSlug = '') {
  const prefix = normalizeLinkPrefix(pathPrefix);
  const safeSlug = normalizeSlug(slug);
  const safeParent = normalizeSlug(parentSlug);
  if (!safeSlug) return prefix;
  if (safeParent) {
    return `${prefix}${encodeURIComponent(safeParent)}/${encodeURIComponent(safeSlug)}`;
  }
  return `${prefix}${encodeURIComponent(safeSlug)}`;
}

function buildArticleHref(pathPrefix, articleSlug, collectionPathSlugs = []) {
  const prefix = normalizeLinkPrefix(pathPrefix);
  const slug = normalizeSlug(articleSlug);
  if (!slug) return prefix;
  const segments = [
    ...collectionPathSlugs.map((entry) => normalizeSlug(entry)),
    slug,
  ].filter(Boolean);
  return `${prefix}${segments.map(encodeURIComponent).join('/')}`;
}

function colorStyleAttr(color) {
  return color ? ` style="color:${escapeHtml(color)}"` : '';
}

function normalizePresentation(presentation) {
  const source = presentation && typeof presentation === 'object' ? presentation : {};
  const coverPosition = source.coverPosition === 'above-title' ? 'above-title' : 'below-title';
  const subtitleSizes = new Set(['sm', 'md', 'lg', 'xl']);
  const subtitleSize = subtitleSizes.has(source.subtitleSize) ? source.subtitleSize : 'md';
  const titleOverlapCover = coverPosition === 'above-title' && Boolean(source.titleOverlapCover);
  return {
    coverFirst: coverPosition === 'above-title',
    useHeroOverlap: titleOverlapCover,
    subtitleSize,
    headingColor: String(source.headingColor || '').trim(),
    subheadingColor: String(source.subheadingColor || '').trim(),
  };
}

function resolveChromeColors(presentation, heroOverlap) {
  const defaultHeading = heroOverlap ? '#ffffff' : '#111827';
  const defaultSubheading = heroOverlap ? 'rgba(255,255,255,0.9)' : '#4b5563';
  return {
    heading: presentation.headingColor || defaultHeading,
    subheading: presentation.subheadingColor || defaultSubheading,
  };
}

function buildTitle(text, options = {}) {
  if (!text) return '';
  let classes = 'ld-article__title';
  if (options.overlap) classes += ' ld-article__title--overlap';
  if (options.afterCover) classes += ' ld-article__title--after-cover';
  return `<h1 class="${classes}"${colorStyleAttr(options.color)}>${escapeHtml(text)}</h1>`;
}

function buildSubtitle(text, options = {}) {
  if (!text) return '';
  const sizeClass = options.overlap
    ? `ld-article__subtitle--overlap-${options.size}`
    : `ld-article__subtitle--${options.size}`;
  let classes = `ld-article__subtitle ${sizeClass}`;
  if (options.overlap) classes += ' ld-article__subtitle--overlap';
  return `<p class="${classes}"${colorStyleAttr(options.color)}>${escapeHtml(text)}</p>`;
}

function buildCover(coverImage) {
  if (!coverImage?.url) return '';
  return `<img class="ld-article__cover" src="${escapeHtml(coverImage.url)}" alt="${escapeHtml(coverImage.alt || '')}" loading="lazy" />`;
}

function buildHeroOverlap(article, presentation, colors) {
  const coverImage = article.coverImage;
  return (
    '<div class="ld-article__hero">'
    + `<img class="ld-article__hero-cover" src="${escapeHtml(coverImage.url)}" alt="${escapeHtml(coverImage.alt || '')}" loading="lazy" />`
    + '<div class="ld-article__hero-gradient" aria-hidden="true"></div>'
    + '<div class="ld-article__hero-text">'
    + buildTitle(article.title, { overlap: true, color: colors.heading })
    + buildSubtitle(article.subtitle, { overlap: true, size: presentation.subtitleSize, color: colors.subheading })
    + '</div>'
    + '</div>'
  );
}

function buildArticleHeader(article, presentation, colors) {
  const coverImage = article.coverImage?.url ? article.coverImage : null;
  const useHeroOverlap = presentation.useHeroOverlap && coverImage;

  if (useHeroOverlap) {
    return buildHeroOverlap(article, presentation, colors);
  }

  const titleOptions = { color: colors.heading, afterCover: presentation.coverFirst };
  const subtitleOptions = { size: presentation.subtitleSize, color: colors.subheading };
  const title = buildTitle(article.title, titleOptions);
  const cover = buildCover(coverImage);
  const subtitle = buildSubtitle(article.subtitle, subtitleOptions);

  if (presentation.coverFirst) {
    return cover + title + subtitle;
  }
  return title + cover + subtitle;
}

function buildArticleShell(article, bodyHtml) {
  const presentation = normalizePresentation(article.presentation);
  const colors = resolveChromeColors(
    presentation,
    presentation.useHeroOverlap && Boolean(article.coverImage?.url),
  );
  const metaParts = [];
  if (article.authorName) metaParts.push(`<span>${escapeHtml(article.authorName)}</span>`);
  if (article.publishedAt) metaParts.push(`<span>${escapeHtml(formatDate(article.publishedAt))}</span>`);
  if (article.readMinutes) metaParts.push(`<span>${escapeHtml(String(article.readMinutes))} min read</span>`);
  if (article.collectionName) metaParts.push(`<span>${escapeHtml(article.collectionName)}</span>`);
  const meta = metaParts.length ? `<div class="ld-article__meta">${metaParts.join('')}</div>` : '';

  return (
    '<article class="ld-article">'
    + '<header class="ld-article__header">'
    + buildArticleHeader(article, presentation, colors)
    + meta
    + '</header>'
    + `<div class="ld-article__body">${bodyHtml || ''}</div>`
    + '</article>'
  );
}

function findCollectionPathNodes(tree, collectionPathSlugs = []) {
  const path = [];
  let nodes = tree || [];
  for (const slug of collectionPathSlugs) {
    const node = nodes.find((entry) => normalizeSlug(entry.slug) === normalizeSlug(slug)) || null;
    if (!node) break;
    path.push(node);
    nodes = node.children || [];
  }
  return path;
}

function buildBreadcrumbHtml({
  pathPrefix = '/help/',
  path = [],
  currentLabel = '',
  homeLabel = 'Home',
}) {
  const items = [{
    label: homeLabel,
    href: buildHomeHref(pathPrefix),
    current: false,
  }];

  path.forEach((node, index) => {
    const isLast = index === path.length - 1 && !currentLabel;
    let href = '';
    if (!isLast) {
      if (index === 0) {
        href = buildCategoryHref(pathPrefix, node.slug);
      } else {
        href = buildSectionHref(pathPrefix, node.slug, node.parentSlug || path[index - 1]?.slug);
      }
    }
    items.push({
      label: node.name || node.slug,
      href,
      current: isLast,
    });
  });

  if (currentLabel) {
    items.push({ label: currentLabel, href: '', current: true });
  }

  return (
    '<nav class="ld-help-breadcrumbs" aria-label="Breadcrumb">'
    + '<ol class="ld-help-breadcrumbs__list">'
    + items.map((item) => {
      if (item.current || !item.href) {
        return `<li class="ld-help-breadcrumbs__item" aria-current="page"><span class="ld-help-breadcrumbs__current">${escapeHtml(item.label)}</span></li>`;
      }
      return (
        '<li class="ld-help-breadcrumbs__item">'
        + `<a class="ld-help-breadcrumbs__link" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
        + '</li>'
      );
    }).join('')
    + '</ol>'
    + '</nav>'
  );
}

function buildSidebarBlock(title, bodyHtml) {
  return (
    '<section class="ld-help-sidebar__block">'
    + `<h2 class="ld-help-sidebar__title">${escapeHtml(title)}</h2>`
    + `<div class="ld-help-sidebar__body">${bodyHtml}</div>`
    + '</section>'
  );
}

function buildSectionTreeHtml(nodes, options = {}) {
  const currentSlug = normalizeSlug(options.currentSlug);
  const currentParentSlug = normalizeSlug(options.currentParentSlug);
  const pathPrefix = normalizeLinkPrefix(options.pathPrefix);
  const openSlugs = new Set(
    (options.openPath || []).map((node) => normalizeSlug(node.slug)),
  );

  function renderNodes(list, depth) {
    if (!Array.isArray(list) || !list.length) return '';
    return (
      `<ul class="ld-help-tree${depth > 0 ? ' ld-help-tree--nested' : ''}">`
      + list.map((node) => {
        const slug = normalizeSlug(node.slug);
        const isCurrent = slug === currentSlug && normalizeSlug(node.parentSlug) === currentParentSlug;
        const isOpen = openSlugs.has(slug) || isCurrent;
        const hasChildren = Array.isArray(node.children) && node.children.length > 0;
        const itemClass = `ld-help-tree__item${isCurrent ? ' is-current' : ''}${isOpen ? ' is-open' : ''}`;
        const toggleHtml = hasChildren
          ? `<button type="button" class="ld-help-tree__toggle" aria-expanded="${isOpen ? 'true' : 'false'}" aria-label="Toggle section"></button>`
          : '<span class="ld-help-tree__spacer" aria-hidden="true"></span>';
        const childrenHtml = hasChildren
          ? `<div class="ld-help-tree__children"${isOpen ? '' : ' hidden'}>${renderNodes(node.children, depth + 1)}</div>`
          : '';

        return (
          `<li class="${itemClass}">`
          + '<div class="ld-help-tree__row">'
          + toggleHtml
          + `<a class="ld-help-tree__link" href="${escapeHtml(buildSectionHref(pathPrefix, node.slug, node.parentSlug))}">${escapeHtml(node.name || node.slug)}</a>`
          + '</div>'
          + childrenHtml
          + '</li>'
        );
      }).join('')
      + '</ul>'
    );
  }

  return renderNodes(nodes, 0);
}

function buildRecentListHtml(articles, pathPrefix, collectionPathSlugs = []) {
  if (!Array.isArray(articles) || !articles.length) {
    return '<p class="ld-help-sidebar__empty">No recent articles yet.</p>';
  }
  return (
    '<ul class="ld-help-sidebar__list">'
    + articles.map((article) => {
      const href = buildArticleHref(pathPrefix, article.slug, collectionPathSlugs.length
        ? collectionPathSlugs
        : (article.collectionSlug ? [article.collectionSlug] : []));
      return (
        '<li class="ld-help-sidebar__list-item">'
        + `<a class="ld-help-sidebar__link" href="${escapeHtml(href)}">${escapeHtml(article.title || article.slug)}</a>`
        + '</li>'
      );
    }).join('')
    + '</ul>'
  );
}

function buildArticleSidebarWidgetsHtml({
  recent = [],
  popular = [],
  pathPrefix = '/help/',
  collectionPathSlugs = [],
}) {
  const popularHtml = Array.isArray(popular) && popular.length
    ? buildRecentListHtml(popular, pathPrefix, collectionPathSlugs)
    : '<p class="ld-help-sidebar__empty">No popular articles yet.</p>';
  const recentHtml = buildRecentListHtml(recent, pathPrefix, collectionPathSlugs);

  return (
    buildSidebarBlock('Popular articles', popularHtml)
    + buildSidebarBlock('Recent articles', recentHtml)
  );
}

function buildHelpPageShell({
  breadcrumbsHtml = '',
  mainHtml = '',
  sidebarHtml = '',
  showSidebar = true,
  dataAttr = '',
}) {
  const layoutClass = showSidebar
    ? 'ld-help-page__layout'
    : 'ld-help-page__layout ld-help-page__layout--single';
  const sidebar = showSidebar
    ? `<aside class="ld-help-page__sidebar">${sidebarHtml}</aside>`
    : '';

  return (
    `<div class="ld-help-page"${dataAttr ? ` ${dataAttr}` : ''}>`
    + breadcrumbsHtml
    + `<div class="${layoutClass}">`
    + `<main class="ld-help-page__main">${mainHtml}</main>`
    + sidebar
    + '</div>'
    + '</div>'
  );
}

function buildArticlePageChrome({
  article,
  bodyHtml,
  pathPrefix = '/help/',
  collectionPathSlugs = [],
  tree = [],
  recent = [],
  popular = [],
}) {
  const articleHtml = buildArticleShell(article, bodyHtml);
  const pathNodes = findCollectionPathNodes(tree, collectionPathSlugs);
  const breadcrumbWithArticle = buildBreadcrumbHtml({
    pathPrefix,
    path: pathNodes,
    currentLabel: article.title || article.slug,
  });

  const currentSection = pathNodes[pathNodes.length - 1] || { slug: '', parentSlug: '' };
  const sectionContext = currentSection;
  const sidebarHtml = (
    buildSidebarBlock(
      'Sections',
      buildSectionTreeHtml(tree, {
        currentSlug: sectionContext.slug,
        currentParentSlug: sectionContext.parentSlug,
        openPath: pathNodes,
        pathPrefix,
      }),
    )
    + buildArticleSidebarWidgetsHtml({
      recent,
      popular,
      pathPrefix,
      collectionPathSlugs,
    })
  );

  return buildHelpPageShell({
    breadcrumbsHtml: breadcrumbWithArticle,
    mainHtml: articleHtml,
    sidebarHtml,
    showSidebar: true,
    dataAttr: 'data-ld-help-article',
  });
}

function buildHomeCollectionCard(node, pathPrefix) {
  const href = buildCustomerHref(buildCollectionExportPath({
    collectionPathSlugs: [node.slug],
    pathPrefix,
  }));
  const description = String(node.description || '').trim();
  const descriptionHtml = description
    ? `<p class="ld-help-home__card-desc">${escapeHtml(description)}</p>`
    : '';
  const stats = formatStats(Number(node.articleCount) || 0, Number(node.sectionCount) || 0);

  return (
    `<a class="ld-help-home__card" href="${escapeHtml(href)}">`
    + '<div class="ld-help-home__card-top">'
    + `<h2 class="ld-help-home__card-title">${escapeHtml(node.name || node.slug)}</h2>`
    + '<span class="ld-help-home__card-arrow" aria-hidden="true">&rarr;</span>'
    + '</div>'
    + descriptionHtml
    + `<p class="ld-help-home__card-stats">${escapeHtml(stats)}</p>`
    + '</a>'
  );
}

function buildHomeExportChrome({
  title = 'Help Center',
  description = '',
  tree = [],
  pathPrefix = '/help/',
}) {
  const cards = (tree || []).map((node) => buildHomeCollectionCard(node, pathPrefix)).join('');
  const descriptionHtml = description
    ? `<p class="ld-help-home__desc">${escapeHtml(description)}</p>`
    : '';

  return (
    '<div class="ld-help-home" data-ld-help-home>'
    + '<header class="ld-help-home__hero">'
    + '<p class="ld-help-home__eyebrow">Help Center</p>'
    + `<h1 class="ld-help-home__title">${escapeHtml(title)}</h1>`
    + descriptionHtml
    + '</header>'
    + '<section class="ld-help-home__topics" aria-labelledby="ld-help-home-topics">'
    + '<h2 id="ld-help-home-topics" class="ld-help-home__section-title">Browse topics</h2>'
    + `<div class="ld-help-home__grid">${cards}</div>`
    + '</section>'
    + '</div>'
  );
}

function buildSectionRow(section, pathPrefix, parentSlug = '') {
  const href = buildCustomerHref(buildCollectionExportPath({
    collectionPathSlugs: parentSlug
      ? [parentSlug, section.slug]
      : [section.slug],
    pathPrefix,
  }));
  const description = String(section.description || '').trim();
  const descriptionHtml = description
    ? `<p class="ld-help-sections__desc">${escapeHtml(description)}</p>`
    : '';
  const stats = formatStats(Number(section.articleCount) || 0, Number(section.sectionCount) || 0);

  return (
    '<li class="ld-help-sections__item">'
    + `<a class="ld-help-sections__link" href="${escapeHtml(href)}">`
    + '<div class="ld-help-sections__body">'
    + '<div class="ld-help-sections__row">'
    + `<h2 class="ld-help-sections__title">${escapeHtml(section.name || section.slug)}</h2>`
    + '<span class="ld-help-sections__arrow" aria-hidden="true">&rarr;</span>'
    + '</div>'
    + descriptionHtml
    + `<p class="ld-help-sections__meta">${escapeHtml(stats)}</p>`
    + '</div>'
    + '</a>'
    + '</li>'
  );
}

function buildArticleListItemFromExport(item) {
  const summary = String(item.meta || '').trim();
  const summaryHtml = summary ? `<p class="ld-help-list__summary">${escapeHtml(summary)}</p>` : '';
  return (
    '<li class="ld-help-list__item">'
    + `<a class="ld-help-list__link" href="${escapeHtml(item.href)}">`
    + `<h2 class="ld-help-list__title">${escapeHtml(item.label)}</h2>`
    + summaryHtml
    + '</a>'
    + '</li>'
  );
}

function buildCollectionExportChrome({
  title = '',
  description = '',
  items = [],
  treeNode = null,
  collectionPathSlugs = [],
  tree = [],
  pathPrefix = '/help/',
  recent = [],
  popular = [],
  listingType = 'sections',
}) {
  const pathNodes = findCollectionPathNodes(tree, collectionPathSlugs);
  const breadcrumbsHtml = buildBreadcrumbHtml({
    pathPrefix,
    path: pathNodes.slice(0, -1),
    currentLabel: treeNode?.name || title,
  });

  const headerHtml = (
    '<header class="ld-help-page__header">'
    + `<h1 class="ld-help-page__title">${escapeHtml(title)}</h1>`
    + (description ? `<p class="ld-help-page__desc">${escapeHtml(description)}</p>` : '')
    + '</header>'
  );

  let mainHtml = '';
  if (listingType === 'sections') {
    const children = treeNode?.children || [];
    mainHtml = (
      '<ul class="ld-help-sections">'
      + children.map((section) => buildSectionRow(
        section,
        pathPrefix,
        section.parentSlug || '',
      )).join('')
      + '</ul>'
    );
  } else {
    mainHtml = (
      '<ul class="ld-help-list__items">'
      + items.map((item) => buildArticleListItemFromExport(item)).join('')
      + '</ul>'
    );
  }

  const currentSection = pathNodes[pathNodes.length - 1] || treeNode || { slug: '', parentSlug: '' };
  const sidebarHtml = (
    buildSidebarBlock(
      'Sections',
      buildSectionTreeHtml(tree, {
        currentSlug: currentSection.slug,
        currentParentSlug: currentSection.parentSlug,
        openPath: pathNodes,
        pathPrefix,
      }),
    )
    + buildArticleSidebarWidgetsHtml({
      recent,
      popular,
      pathPrefix,
      collectionPathSlugs,
    })
  );

  return buildHelpPageShell({
    breadcrumbsHtml,
    mainHtml: headerHtml + mainHtml,
    sidebarHtml,
    showSidebar: true,
    dataAttr: listingType === 'sections' ? 'data-ld-help-category' : 'data-ld-help-section',
  });
}

module.exports = {
  buildArticleShell,
  buildArticlePageChrome,
  buildHomeExportChrome,
  buildCollectionExportChrome,
  buildBreadcrumbHtml,
  buildSectionTreeHtml,
  findCollectionPathNodes,
};
