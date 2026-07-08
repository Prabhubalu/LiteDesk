;(function () {
  'use strict';

  function getAttr(el, name, fallback) {
    var value = el.getAttribute(name);
    return value == null || value === '' ? fallback : value;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function resolveApiOrigin(script, marker) {
    var explicit = script && getAttr(script, 'data-api-origin', '');
    if (explicit) return explicit.replace(/\/$/, '');
    var src = (script && script.src) || '';
    var idx = marker ? src.indexOf(marker) : -1;
    if (idx > 0) return src.slice(0, idx);
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    return '';
  }

  function normalizeSlug(value) {
    return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
  }

  function normalizeLinkPrefix(value) {
    var prefix = String(value || '/help/').trim();
    if (!prefix) return '/help/';
    if (prefix.indexOf('?') >= 0) return prefix;
    if (!prefix.endsWith('/')) prefix += '/';
    if (!prefix.startsWith('/')) prefix = '/' + prefix;
    return prefix;
  }

  function normalizeHomePrefix(value) {
    var prefix = String(value || '/help/').trim();
    if (!prefix) return '/help/';
    if (prefix.indexOf('?') >= 0) return prefix;
    if (!prefix.endsWith('/')) prefix += '/';
    if (!prefix.startsWith('/')) prefix = '/' + prefix;
    return prefix;
  }

  function isQueryPrefix(prefix) {
    return String(prefix || '').indexOf('?') >= 0;
  }

  function buildHomeHref(homePrefix) {
    return normalizeHomePrefix(homePrefix);
  }

  function buildCategoryHref(linkPrefix, slug) {
    var safeSlug = normalizeSlug(slug);
    if (!safeSlug) return linkPrefix;
    if (isQueryPrefix(linkPrefix)) {
      return linkPrefix + encodeURIComponent(safeSlug);
    }
    return linkPrefix + encodeURIComponent(safeSlug);
  }

  function buildSectionHref(linkPrefix, section, parentSlug) {
    var slug = normalizeSlug(typeof section === 'string' ? section : section.slug);
    if (!slug) return linkPrefix;
    var parent = normalizeSlug(parentSlug || (typeof section === 'object' ? section.parentSlug : ''));
    if (isQueryPrefix(linkPrefix)) {
      var href = linkPrefix + encodeURIComponent(slug);
      if (parent) href += '&parent=' + encodeURIComponent(parent);
      return href;
    }
    if (parent) {
      return linkPrefix + encodeURIComponent(parent) + '/' + encodeURIComponent(slug);
    }
    return linkPrefix + encodeURIComponent(slug);
  }

  function buildArticleHref(linkPrefix, article, sectionContext) {
    var slug = normalizeSlug(article.slug);
    if (!slug) return linkPrefix;
    if (isQueryPrefix(linkPrefix)) {
      return linkPrefix + encodeURIComponent(slug);
    }
    var collectionSlug = normalizeSlug(
      sectionContext && sectionContext.slug ? sectionContext.slug : article.collectionSlug,
    );
    var parentSlug = normalizeSlug(
      sectionContext && sectionContext.parentSlug ? sectionContext.parentSlug : '',
    );
    if (parentSlug && collectionSlug) {
      return linkPrefix + encodeURIComponent(parentSlug) + '/' + encodeURIComponent(collectionSlug) + '/' + encodeURIComponent(slug);
    }
    if (collectionSlug) {
      return linkPrefix + encodeURIComponent(collectionSlug) + '/' + encodeURIComponent(slug);
    }
    return linkPrefix + encodeURIComponent(slug);
  }

  function buildArticleBasePath(linkPrefix, sectionContext) {
    if (isQueryPrefix(linkPrefix)) {
      return linkPrefix;
    }
    var parentSlug = normalizeSlug(sectionContext && sectionContext.parentSlug);
    var collectionSlug = normalizeSlug(
      sectionContext && sectionContext.slug ? sectionContext.slug : sectionContext && sectionContext.collectionSlug,
    );
    if (parentSlug && collectionSlug) {
      return linkPrefix + encodeURIComponent(parentSlug) + '/' + encodeURIComponent(collectionSlug) + '/';
    }
    if (collectionSlug) {
      return linkPrefix + encodeURIComponent(collectionSlug) + '/';
    }
    return linkPrefix;
  }

  function formatStats(articleCount, sectionCount, labels) {
    var articleLabel = articleCount === 1 ? labels.articleSingular : labels.articlePlural;
    var parts = [articleCount + ' ' + articleLabel];
    if (sectionCount > 0) {
      var sectionLabel = sectionCount === 1 ? labels.sectionSingular : labels.sectionPlural;
      parts.push(sectionCount + ' ' + sectionLabel);
    }
    return parts.join(' · ');
  }

  function ensureStylesheet(origin) {
    if (
      document.querySelector('link[data-arivu-headless-blocks-css]')
      || document.querySelector('link[data-ld-headless-blocks-css]')
    ) {
      return;
    }
    var href = origin + '/embed/headless-blocks.css';
    var preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'style';
    preload.href = href;
    document.head.appendChild(preload);
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-arivu-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }

  function buildSkeletonLines(count) {
    var html = '';
    var total = Math.max(Number(count) || 3, 1);
    for (var i = 0; i < total; i++) {
      var modifier = i === total - 1 ? ' ld-help-skeleton__line--short' : '';
      html += '<div class="ld-help-skeleton__line' + modifier + '"></div>';
    }
    return html;
  }

  function buildHomeGridSkeleton(count) {
    var html = '';
    var total = Math.max(Number(count) || 6, 1);
    for (var i = 0; i < total; i++) {
      html += '<div class="ld-help-skeleton__card" aria-hidden="true"></div>';
    }
    return html;
  }

  function buildMountSkeleton(options) {
    var type = String((options && options.type) || 'page');
    var showSidebar = !options || options.showSidebar !== false;

    if (type === 'home') {
      return (
        '<div class="ld-help-home ld-help-skeleton" aria-busy="true" aria-label="Loading">' +
          '<div class="ld-help-skeleton__search" aria-hidden="true"></div>' +
          '<div class="ld-help-home__grid">' + buildHomeGridSkeleton(6) + '</div>' +
        '</div>'
      );
    }

    var layoutClass = showSidebar
      ? 'ld-help-page__layout'
      : 'ld-help-page__layout ld-help-page__layout--single';
    var sidebarHtml = showSidebar
      ? (
        '<aside class="ld-help-page__sidebar" aria-hidden="true">' +
          '<div class="ld-help-skeleton__sidebar-block"></div>' +
          '<div class="ld-help-skeleton__sidebar-block"></div>' +
          '<div class="ld-help-skeleton__sidebar-block"></div>' +
        '</aside>'
      )
      : '';

    return (
      '<div class="ld-help-page ld-help-skeleton" aria-busy="true" aria-label="Loading">' +
        '<div class="ld-help-skeleton__breadcrumbs" aria-hidden="true"></div>' +
        '<div class="' + layoutClass + '">' +
          '<main class="ld-help-page__main" aria-hidden="true">' +
            '<div class="ld-help-skeleton__title"></div>' +
            buildSkeletonLines(4) +
            '<div class="ld-help-skeleton__block"></div>' +
            '<div class="ld-help-skeleton__block ld-help-skeleton__block--short"></div>' +
          '</main>' +
          sidebarHtml +
        '</div>' +
      '</div>'
    );
  }

  function fetchArticleSidebarWidgets(contentBase, options) {
    var showPopular = options.showPopular !== false;
    return Promise.all([
      showPopular ? fetchPopularArticles(contentBase, options) : Promise.resolve([]),
      fetchRecentArticles(contentBase, options),
    ]).then(function (results) {
      return { popular: results[0], recent: results[1] };
    });
  }

  function buildArticleSidebarWidgetsHtml(widgets, options) {
    var sectionContext = options.sectionContext || null;
    var showPopular = options.showPopular !== false;
    var html = '';

    if (showPopular) {
      html += buildSidebarBlock(
        options.popularTitle,
        buildRecentListHtml(
          widgets.popular,
          options.articlePrefix,
          options.popularEmptyLabel,
          sectionContext,
        ),
      );
    }

    html += buildSidebarBlock(
      options.recentTitle,
      buildRecentListHtml(
        widgets.recent,
        options.articlePrefix,
        options.recentEmptyLabel,
        sectionContext,
      ),
    );

    return html;
  }

  function absolutizeEmbedAssetUrl(url, apiOrigin) {
    var raw = String(url || '').trim();
    var origin = String(apiOrigin || '').replace(/\/$/, '');
    if (!raw || !origin) return raw;
    if (raw.indexOf('://') >= 0 || raw.indexOf('data:') === 0) return raw;
    if (raw.indexOf('/api/files/download') === 0 || raw.indexOf('/api/uploads/') === 0) {
      return origin + raw;
    }
    return raw;
  }

  function absolutizeEmbedHtml(html, apiOrigin) {
    if (!html || !apiOrigin) return html;
    var origin = String(apiOrigin).replace(/\/$/, '');
    return String(html).replace(
      /(\s(?:src|href)=["'])(\/api\/(?:files\/download|uploads)[^"']*)(["'])/gi,
      function (_match, prefix, path, suffix) {
        return prefix + origin + path + suffix;
      },
    );
  }

  var embedFetchCacheMode = 'default';

  function configureEmbedCache(options) {
    if (options && options.cache === 'local') {
      embedFetchCacheMode = 'local';
    }
  }

  function localCacheKey(url) {
    return 'arivu:headless:' + url;
  }

  function readLocalCache(url) {
    if (embedFetchCacheMode !== 'local' || typeof localStorage === 'undefined') return null;
    try {
      var raw = localStorage.getItem(localCacheKey(url));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  function writeLocalCache(url, payload) {
    if (embedFetchCacheMode !== 'local' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(localCacheKey(url), JSON.stringify({
        payload: payload,
        cachedAt: Date.now(),
      }));
    } catch (_error) {
      // Ignore quota errors.
    }
  }

  function shouldBypassEmbedCache(url, options) {
    if (options && options.cache === 'no-store') return true;
    return String(url || '').indexOf('search=') >= 0;
  }

  function fetchJson(url, options) {
    options = options || {};
    var bypassCache = shouldBypassEmbedCache(url, options);
    if (!bypassCache) {
      var cached = readLocalCache(url);
      if (cached && cached.payload) {
        return Promise.resolve({
          response: { ok: true },
          payload: cached.payload,
          fromCache: true,
        });
      }
    }

    return fetch(url, bypassCache ? { cache: 'no-store' } : {}).then(function (response) {
      return response.json().then(function (payload) {
        if (!bypassCache && embedFetchCacheMode === 'local' && payload && payload.success) {
          writeLocalCache(url, payload);
        }
        return { response: response, payload: payload };
      });
    });
  }

  function indexCollections(tree, parentPath) {
    var index = [];
    (tree || []).forEach(function (node) {
      var path = (parentPath || []).concat([node]);
      index.push({
        node: node,
        path: path,
        slug: normalizeSlug(node.slug),
        parentSlug: normalizeSlug(node.parentSlug),
      });
      if (Array.isArray(node.children) && node.children.length) {
        index = index.concat(indexCollections(node.children, path));
      }
    });
    return index;
  }

  function findCollectionEntry(index, slug, parentSlug) {
    var normalizedSlug = normalizeSlug(slug);
    var normalizedParent = parentSlug ? normalizeSlug(parentSlug) : '';
    if (!normalizedSlug) return null;

    if (normalizedParent) {
      return index.find(function (entry) {
        return entry.slug === normalizedSlug && entry.parentSlug === normalizedParent;
      }) || null;
    }

    var matches = index.filter(function (entry) {
      return entry.slug === normalizedSlug;
    });
    if (matches.length === 1) return matches[0];
    return matches.find(function (entry) {
      return !entry.parentSlug;
    }) || matches[0] || null;
  }

  function buildBreadcrumbHtml(options) {
    var homePrefix = normalizeHomePrefix(options.homePrefix);
    var categoryPrefix = normalizeLinkPrefix(options.categoryPrefix || options.linkPrefix);
    var sectionPrefix = normalizeLinkPrefix(options.sectionPrefix || options.linkPrefix);
    var homeLabel = String(options.homeLabel || 'Home');
    var items = [{
      label: homeLabel,
      href: buildHomeHref(homePrefix),
    }];

    (options.path || []).forEach(function (node, index) {
      var isLast = index === options.path.length - 1 && !options.currentLabel;
      var href = '';
      if (!isLast) {
        if (index === 0) {
          href = buildCategoryHref(categoryPrefix, node.slug);
        } else {
          href = buildSectionHref(sectionPrefix, node, node.parentSlug);
        }
      }
      items.push({
        label: node.name || node.slug,
        href: href,
        current: isLast,
      });
    });

    if (options.currentLabel) {
      items.push({
        label: options.currentLabel,
        href: '',
        current: true,
      });
    }

    return (
      '<nav class="ld-help-breadcrumbs" aria-label="' + escapeHtml(options.breadcrumbLabel || 'Breadcrumb') + '">' +
        '<ol class="ld-help-breadcrumbs__list">' +
          items.map(function (item) {
            if (item.current || !item.href) {
              return '<li class="ld-help-breadcrumbs__item" aria-current="page">' + escapeHtml(item.label) + '</li>';
            }
            return (
              '<li class="ld-help-breadcrumbs__item">' +
                '<a class="ld-help-breadcrumbs__link" href="' + escapeHtml(item.href) + '">' + escapeHtml(item.label) + '</a>' +
              '</li>'
            );
          }).join('') +
        '</ol>' +
      '</nav>'
    );
  }

  function buildSectionRow(section, linkPrefix, labels) {
    var stats = formatStats(
      Number(section.articleCount) || 0,
      Number(section.sectionCount) || 0,
      labels,
    );
    var description = String(section.description || '').trim();
    var descriptionHtml = description
      ? '<p class="ld-help-sections__desc">' + escapeHtml(description) + '</p>'
      : '';

    return (
      '<li class="ld-help-sections__item">' +
        '<a class="ld-help-sections__link" href="' + escapeHtml(buildSectionHref(linkPrefix, section, section.parentSlug)) + '">' +
          '<div class="ld-help-sections__body">' +
            '<h2 class="ld-help-sections__title">' + escapeHtml(section.name || section.slug) + '</h2>' +
            descriptionHtml +
            '<p class="ld-help-sections__stats">' + escapeHtml(stats) + '</p>' +
          '</div>' +
        '</a>' +
      '</li>'
    );
  }

  function buildArticleListItem(article, linkPrefix, sectionContext) {
    var title = escapeHtml(article.title || 'Untitled');
    var summary = String(article.summary || '').trim();
    var summaryHtml = summary ? '<p class="ld-help-list__summary">' + escapeHtml(summary) + '</p>' : '';
    var dateValue = article.publishedAt || article.updatedAt;
    var dateHtml = dateValue
      ? '<time class="ld-help-list__date" datetime="' + escapeHtml(String(dateValue)) + '">' + escapeHtml(formatDate(dateValue)) + '</time>'
      : '';

    return (
      '<li class="ld-help-list__item">' +
        '<a class="ld-help-list__link" href="' + escapeHtml(buildArticleHref(linkPrefix, article, sectionContext)) + '">' +
          '<h2 class="ld-help-list__title">' + title + '</h2>' +
          summaryHtml +
          dateHtml +
        '</a>' +
      '</li>'
    );
  }

  function buildSidebarBlock(title, bodyHtml) {
    return (
      '<section class="ld-help-sidebar__block">' +
        '<h2 class="ld-help-sidebar__title">' + escapeHtml(title) + '</h2>' +
        '<div class="ld-help-sidebar__body">' + bodyHtml + '</div>' +
      '</section>'
    );
  }

  function buildRecentListHtml(articles, linkPrefix, emptyLabel, sectionContext) {
    if (!Array.isArray(articles) || !articles.length) {
      return '<p class="ld-help-sidebar__empty">' + escapeHtml(emptyLabel) + '</p>';
    }
    return (
      '<ul class="ld-help-sidebar__links">' +
        articles.map(function (article) {
          return (
            '<li class="ld-help-sidebar__link-item">' +
              '<a class="ld-help-sidebar__link" href="' + escapeHtml(buildArticleHref(linkPrefix, article, sectionContext)) + '">' +
                escapeHtml(article.title || article.slug) +
              '</a>' +
            '</li>'
          );
        }).join('') +
      '</ul>'
    );
  }

  function buildSectionTreeHtml(nodes, options) {
    var currentSlug = normalizeSlug(options.currentSlug);
    var currentParentSlug = normalizeSlug(options.currentParentSlug);
    var linkPrefix = normalizeLinkPrefix(options.linkPrefix);
    var openSlugs = {};

    (options.openPath || []).forEach(function (node) {
      openSlugs[normalizeSlug(node.slug)] = true;
    });

    function renderNodes(list, depth) {
      if (!Array.isArray(list) || !list.length) return '';
      return (
        '<ul class="ld-help-tree' + (depth > 0 ? ' ld-help-tree--nested' : '') + '">' +
          list.map(function (node) {
            var slug = normalizeSlug(node.slug);
            var isCurrent = slug === currentSlug && normalizeSlug(node.parentSlug) === currentParentSlug;
            var isOpen = openSlugs[slug] || isCurrent;
            var hasChildren = Array.isArray(node.children) && node.children.length > 0;
            var itemClass = 'ld-help-tree__item' + (isCurrent ? ' is-current' : '') + (isOpen ? ' is-open' : '');
            var toggleHtml = hasChildren
              ? '<button type="button" class="ld-help-tree__toggle" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-label="Toggle section"></button>'
              : '<span class="ld-help-tree__spacer" aria-hidden="true"></span>';
            var childrenHtml = hasChildren && isOpen
              ? '<div class="ld-help-tree__children">' + renderNodes(node.children, depth + 1) + '</div>'
              : (hasChildren ? '<div class="ld-help-tree__children" hidden>' + renderNodes(node.children, depth + 1) + '</div>' : '');

            return (
              '<li class="' + itemClass + '">' +
                '<div class="ld-help-tree__row">' +
                  toggleHtml +
                  '<a class="ld-help-tree__link" href="' + escapeHtml(buildSectionHref(linkPrefix, node, node.parentSlug)) + '">' +
                    escapeHtml(node.name || node.slug) +
                  '</a>' +
                '</div>' +
                childrenHtml +
              '</li>'
            );
          }).join('') +
        '</ul>'
      );
    }

    return renderNodes(nodes, 0);
  }

  function bindSectionTree(root) {
    root.querySelectorAll('.ld-help-tree__toggle').forEach(function (button) {
      button.addEventListener('click', function () {
        var item = button.closest('.ld-help-tree__item');
        if (!item) return;
        var children = item.querySelector(':scope > .ld-help-tree__children');
        if (!children) return;
        var isOpen = !children.hidden;
        children.hidden = isOpen;
        item.classList.toggle('is-open', !isOpen);
        button.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      });
    });
  }

  function fetchCollections(contentBase) {
    return fetchJson(contentBase + '/collections').then(function (result) {
      if (!result.response.ok || !result.payload || !result.payload.success) {
        throw new Error((result.payload && result.payload.message) || 'Failed to load collections');
      }
      var tree = Array.isArray(result.payload.data) ? result.payload.data : [];
      return {
        tree: tree,
        index: indexCollections(tree, []),
        organization: result.payload.organization,
      };
    });
  }

  function fetchRecentArticles(contentBase, options) {
    var limit = Math.min(Math.max(Number(options.limit) || 5, 1), 25);
    var url = contentBase + '/articles/recent?limit=' + limit;
    if (options.collection) url += '&collection=' + encodeURIComponent(options.collection);
    if (options.deep) url += '&deep=1';

    return fetchJson(url).then(function (result) {
      if (!result.response.ok || !result.payload || !result.payload.success) {
        throw new Error((result.payload && result.payload.message) || 'Failed to load recent articles');
      }
      return Array.isArray(result.payload.data) ? result.payload.data : [];
    });
  }

  function fetchPopularArticles(contentBase, options) {
    var limit = Math.min(Math.max(Number(options.limit) || 5, 1), 25);
    var url = contentBase + '/articles/popular?limit=' + limit;
    if (options.collection) url += '&collection=' + encodeURIComponent(options.collection);
    if (options.deep) url += '&deep=1';

    return fetchJson(url).then(function (result) {
      if (!result.response.ok || !result.payload || !result.payload.success) {
        throw new Error((result.payload && result.payload.message) || 'Failed to load popular articles');
      }
      return Array.isArray(result.payload.data) ? result.payload.data : [];
    });
  }

  function appendArticleSidebarWidgets(sidebarEl, contentBase, options) {
    return fetchArticleSidebarWidgets(contentBase, options).then(function (widgets) {
      sidebarEl.insertAdjacentHTML('beforeend', buildArticleSidebarWidgetsHtml(widgets, options));
    });
  }

  function buildCategoryPageHtml(options) {
    return (
      '<div class="ld-help-page" data-ld-help-category>' +
        '<div class="ld-help-page__breadcrumbs">' + options.breadcrumbsHtml + '</div>' +
        '<div class="ld-help-page__layout">' +
          '<main class="ld-help-page__main">' +
            (options.statusHtml || '') +
            options.headerHtml +
            options.mainHtml +
          '</main>' +
          '<aside class="ld-help-page__sidebar">' + options.sidebarHtml + '</aside>' +
        '</div>' +
      '</div>'
    );
  }

  function buildSectionPageHtml(options) {
    return (
      '<div class="ld-help-page" data-ld-help-section>' +
        '<div class="ld-help-page__breadcrumbs">' + options.breadcrumbsHtml + '</div>' +
        '<div class="ld-help-page__layout">' +
          '<main class="ld-help-page__main">' +
            (options.statusHtml || '') +
            options.headerHtml +
            options.mainHtml +
          '</main>' +
          '<aside class="ld-help-page__sidebar">' + options.sidebarHtml + '</aside>' +
        '</div>' +
      '</div>'
    );
  }

  function fetchArticles(contentBase, options) {
    var limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
    var page = Math.max(Number(options.page) || 1, 1);
    var url = contentBase + '/articles?page=' + page + '&limit=' + limit;
    if (options.collection) url += '&collection=' + encodeURIComponent(options.collection);
    if (options.deep) url += '&deep=1';
    if (options.search) url += '&search=' + encodeURIComponent(options.search);

    return fetchJson(url).then(function (result) {
      if (!result.response.ok || !result.payload || !result.payload.success) {
        throw new Error((result.payload && result.payload.message) || 'Failed to load articles');
      }
      return {
        articles: Array.isArray(result.payload.data) ? result.payload.data : [],
        pagination: result.payload.pagination || {},
      };
    });
  }

  if (typeof document !== 'undefined') {
    var localCacheScript = document.querySelector('script[data-cache="local"][src*="/embed/headless"]');
    if (localCacheScript) {
      configureEmbedCache({ cache: 'local' });
    }
  }

  var helpCommonApi = {
    getAttr: getAttr,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    resolveApiOrigin: resolveApiOrigin,
    normalizeSlug: normalizeSlug,
    normalizeLinkPrefix: normalizeLinkPrefix,
    normalizeHomePrefix: normalizeHomePrefix,
    buildHomeHref: buildHomeHref,
    buildCategoryHref: buildCategoryHref,
    buildSectionHref: buildSectionHref,
    buildArticleHref: buildArticleHref,
    buildArticleBasePath: buildArticleBasePath,
    formatStats: formatStats,
    ensureStylesheet: ensureStylesheet,
    indexCollections: indexCollections,
    findCollectionEntry: findCollectionEntry,
    buildBreadcrumbHtml: buildBreadcrumbHtml,
    buildSectionRow: buildSectionRow,
    buildArticleListItem: buildArticleListItem,
    buildSidebarBlock: buildSidebarBlock,
    buildRecentListHtml: buildRecentListHtml,
    buildSectionTreeHtml: buildSectionTreeHtml,
    bindSectionTree: bindSectionTree,
    fetchCollections: fetchCollections,
    fetchRecentArticles: fetchRecentArticles,
    fetchPopularArticles: fetchPopularArticles,
    appendArticleSidebarWidgets: appendArticleSidebarWidgets,
    fetchArticleSidebarWidgets: fetchArticleSidebarWidgets,
    buildArticleSidebarWidgetsHtml: buildArticleSidebarWidgetsHtml,
    buildMountSkeleton: buildMountSkeleton,
    buildHomeGridSkeleton: buildHomeGridSkeleton,
    buildCategoryPageHtml: buildCategoryPageHtml,
    buildSectionPageHtml: buildSectionPageHtml,
    absolutizeEmbedAssetUrl: absolutizeEmbedAssetUrl,
    absolutizeEmbedHtml: absolutizeEmbedHtml,
    configureEmbedCache: configureEmbedCache,
    fetchArticles: fetchArticles,
  };
  window.LiteDeskHeadlessHelpCommon = helpCommonApi;
  window.ArivuHeadlessHelpCommon = helpCommonApi;
})(typeof window !== 'undefined' ? window : globalThis);
