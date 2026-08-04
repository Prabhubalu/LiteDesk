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
    var showRail = Boolean(options && options.showRail);

    if (type === 'home') {
      return (
        '<div class="ld-help-home ld-help-skeleton" aria-busy="true" aria-label="Loading">' +
          '<section class="ld-help-home__hero">' +
            '<div class="ld-help-skeleton__title" aria-hidden="true"></div>' +
            '<div class="ld-help-skeleton__search" aria-hidden="true"></div>' +
          '</section>' +
          '<div class="ld-help-home__grid">' + buildHomeGridSkeleton(6) + '</div>' +
        '</div>'
      );
    }

    var bodyClass = 'ld-help-site__body ld-help-skeleton__site-body' + (showRail ? ' ld-help-site__body--article-no-nav' : '');
    return (
      '<div class="ld-help-site ld-help-skeleton" aria-busy="true" aria-label="Loading">' +
        '<div class="ld-help-skeleton__topbar" aria-hidden="true"></div>' +
        '<div class="' + bodyClass + '">' +
          '<main class="ld-help-site__main" aria-hidden="true">' +
            '<div class="ld-help-skeleton__hero"></div>' +
            buildSkeletonLines(3) +
            '<div class="ld-help-skeleton__block"></div>' +
          '</main>' +
          (showRail
            ? '<aside class="ld-help-site__rail" aria-hidden="true"><div class="ld-help-skeleton__sidebar-block"></div></aside>'
            : '') +
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

  /**
   * Marketing hosts (www) do not proxy /api/files — rewrite to the API origin.
   * Override with window.__ARIVU_FILE_ORIGIN if needed.
   */
  function resolveEmbedFileOrigin(apiOrigin) {
    var explicit = '';
    try {
      if (typeof window !== 'undefined' && window.__ARIVU_FILE_ORIGIN) {
        explicit = String(window.__ARIVU_FILE_ORIGIN || '').replace(/\/$/, '');
      }
    } catch (e) { /* ignore */ }
    if (explicit) return explicit;

    var origin = String(apiOrigin || '').replace(/\/$/, '');
    if (!origin) return 'https://api.arivusystems.com';
    try {
      var host = new URL(origin).hostname.toLowerCase();
      if (host === 'www.arivusystems.com' || host === 'arivusystems.com') {
        return 'https://api.arivusystems.com';
      }
    } catch (e) { /* ignore */ }
    return origin;
  }

  function absolutizeEmbedAssetUrl(url, apiOrigin) {
    var raw = String(url || '').trim();
    if (!raw) return raw;
    if (raw.indexOf('data:') === 0) return raw;

    var fileOrigin = resolveEmbedFileOrigin(apiOrigin);

    if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) {
      try {
        var parsed = new URL(raw);
        var path = parsed.pathname || '';
        if (
          (path.indexOf('/api/files/download') === 0 || path.indexOf('/api/uploads/') === 0)
          && (parsed.hostname.toLowerCase() === 'www.arivusystems.com'
            || parsed.hostname.toLowerCase() === 'arivusystems.com')
        ) {
          return fileOrigin + path + parsed.search;
        }
      } catch (e) { /* keep raw */ }
      return raw;
    }

    if (raw.indexOf('/api/files/download') === 0 || raw.indexOf('/api/uploads/') === 0) {
      return fileOrigin + raw;
    }
    return raw;
  }

  function absolutizeEmbedHtml(html, apiOrigin) {
    if (!html) return html;
    var fileOrigin = resolveEmbedFileOrigin(apiOrigin);
    if (!fileOrigin) return html;
    return String(html).replace(
      /(\s(?:src|href)=["'])(\/api\/(?:files\/download|uploads)[^"']*)(["'])/gi,
      function (_match, prefix, path, suffix) {
        return prefix + fileOrigin + path + suffix;
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
    var raw = String(url || '');
    if (raw.indexOf('search=') >= 0) return true;
    if (raw.indexOf('/collections') >= 0) return true;
    return false;
  }

  function groupArticlesByCollectionSlug(articles) {
    var map = {};
    (articles || []).forEach(function (article) {
      var key = normalizeSlug(article.collectionSlug);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(article);
    });
    return map;
  }

  var HELP_SEARCH_ICON = (
    '<svg class="ld-help-site__search-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
      '<path d="M9 16a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm8 2-3.35-3.35" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />' +
    '</svg>'
  );

  function buildHelpSearchFormHtml(options) {
    var placeholder = String(options.searchPlaceholder || 'Search');
    var value = String(options.searchQuery || '').trim();
    return (
      '<form class="ld-help-site__search" role="search" data-ld-help-search>' +
        '<label class="ld-help-site__search-label">' +
          '<span class="ld-help-site__search-text">' + escapeHtml(options.searchLabel || 'Search') + '</span>' +
          '<div class="ld-help-site__search-box">' +
            HELP_SEARCH_ICON +
            '<input class="ld-help-site__search-input" type="search" name="q" value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(placeholder) + '" autocomplete="off" />' +
          '</div>' +
        '</label>' +
        '<div class="ld-help-site__search-dropdown" data-ld-help-search-dropdown hidden>' +
          '<ul class="ld-help-site__search-results" role="listbox"></ul>' +
          '<a class="ld-help-site__search-view-all" href="#">' + escapeHtml(options.viewAllResultsLabel || 'View all results') + '</a>' +
        '</div>' +
      '</form>'
    );
  }

  function buildHelpTopbar(options) {
    if (!options.breadcrumbsHtml) return '';
    return (
      '<header class="ld-help-site__topbar">' +
        '<div class="ld-help-site__topbar-inner">' +
          '<div class="ld-help-site__crumbs">' + (options.breadcrumbsHtml || '') + '</div>' +
        '</div>' +
      '</header>'
    );
  }

  function buildHelpRailHtml(options) {
    options = options || {};
    var searchHtml = options.searchEnabled === false
      ? ''
      : buildHelpSearchFormHtml(options);
    var tocHtml = String(options.tocHtml || '').trim();
    if (!searchHtml && !tocHtml) return '';
    return (
      (searchHtml ? '<div class="ld-help-site__rail-search">' + searchHtml + '</div>' : '') +
      tocHtml
    );
  }

  function buildTopicsNavHtml(tree, options) {
    return (
      '<div class="ld-help-site__nav-inner">' +
        '<h2 class="ld-help-site__nav-title">' + escapeHtml(options.topicsTitle || 'Topics') + '</h2>' +
        buildSectionTreeHtml(tree, options) +
      '</div>'
    );
  }

  function buildCategoryHeroHtml(node) {
    var desc = String(node.description || '').trim();
    return (
      '<section class="ld-help-hero">' +
        '<h1 class="ld-help-hero__title">' + escapeHtml(node.name || node.slug) + '</h1>' +
        (desc ? '<p class="ld-help-hero__desc">' + escapeHtml(desc) + '</p>' : '') +
      '</section>'
    );
  }

  function buildSubcategoryCardHtml(section, articles, options) {
    var previewLimit = Math.min(Math.max(Number(options.previewLimit) || 5, 1), 8);
    var preview = (articles || []).slice(0, previewLimit);
    var remaining = Math.max((articles || []).length - preview.length, 0);
    var sectionHref = buildSectionHref(options.sectionPrefix, section, section.parentSlug);
    var articlePrefix = options.articlePrefix;
    var sectionContext = section;
    var listHtml = preview.map(function (article) {
      return (
        '<li class="ld-help-topic-card__item">' +
          '<a class="ld-help-topic-card__link" href="' + escapeHtml(buildArticleHref(articlePrefix, article, sectionContext)) + '">' +
            escapeHtml(article.title || article.slug || 'Untitled') +
          '</a>' +
        '</li>'
      );
    }).join('');
    var footerHtml = '';
    if ((articles || []).length) {
      footerHtml = (
        '<footer class="ld-help-topic-card__footer">' +
          (remaining > 0
            ? '<span class="ld-help-topic-card__count">+ ' + remaining + ' ' + escapeHtml(options.articlesMoreLabel || 'articles') + '</span>'
            : '<span class="ld-help-topic-card__count"></span>') +
          '<a class="ld-help-topic-card__more" href="' + escapeHtml(sectionHref) + '">' + escapeHtml(options.showAllLabel || 'Show all') + '</a>' +
        '</footer>'
      );
    }
    return (
      '<article class="ld-help-topic-card">' +
        '<h3 class="ld-help-topic-card__title">' +
          '<a class="ld-help-topic-card__title-link" href="' + escapeHtml(sectionHref) + '">' + escapeHtml(section.name || section.slug) + '</a>' +
        '</h3>' +
        (listHtml ? '<ul class="ld-help-topic-card__list">' + listHtml + '</ul>' : '') +
        footerHtml +
      '</article>'
    );
  }

  function buildSectionArticleRowHtml(article, linkPrefix, sectionContext) {
    return (
      '<li class="ld-help-article-row">' +
        '<a class="ld-help-article-row__link" href="' + escapeHtml(buildArticleHref(linkPrefix, article, sectionContext)) + '">' +
          '<span class="ld-help-article-row__title">' + escapeHtml(article.title || article.slug || 'Untitled') + '</span>' +
          '<span class="ld-help-article-row__arrow" aria-hidden="true">→</span>' +
        '</a>' +
      '</li>'
    );
  }

  function buildSectionArticlesHtml(articles, linkPrefix, sectionContext, options) {
    var label = String((options && options.articlesLabel) || 'Articles');
    var rows = (articles || []).map(function (article) {
      return buildSectionArticleRowHtml(article, linkPrefix, sectionContext);
    }).join('');
    return (
      '<section class="ld-help-articles">' +
        '<h2 class="ld-help-articles__label">' + escapeHtml(label) + '</h2>' +
        '<ul class="ld-help-articles__list">' + rows + '</ul>' +
      '</section>'
    );
  }

  function buildHelpSiteShell(options) {
    var railHtml = options.railHtml
      ? (
        '<aside class="ld-help-site__rail">' +
          '<div class="ld-help-site__rail-sticky" data-ld-help-toc-rail>' + options.railHtml + '</div>' +
        '</aside>'
      )
      : '';
    var navHtml = String(options.navHtml || '').trim();
    var navAside = navHtml
      ? '<aside class="ld-help-site__nav">' + navHtml + '</aside>'
      : '';
    var bodyClass = 'ld-help-site__body';
    if (options.railHtml) {
      bodyClass += navHtml ? ' ld-help-site__body--article' : ' ld-help-site__body--article-no-nav';
    }
    return (
      '<div class="ld-help-site"' + (options.dataAttr ? ' ' + options.dataAttr : '') + '>' +
        (options.topbarHtml || '') +
        '<div class="' + bodyClass + '">' +
          navAside +
          '<main class="ld-help-site__main">' +
            (options.statusHtml || '') +
            (options.mainHtml || '') +
          '</main>' +
          railHtml +
        '</div>' +
      '</div>'
    );
  }

  function injectHeadingIds(bodyHtml) {
    var index = 0;
    return String(bodyHtml || '').replace(/<h([23])([^>]*)>/gi, function (_full, level, attrs) {
      if (/\bid=/.test(attrs)) return '<h' + level + attrs + '>';
      var id = 'ld-toc-' + (index++);
      return '<h' + level + attrs + ' id="' + id + '">';
    });
  }

  function buildTocHtml(bodyHtml) {
    var headings = [];
    var re = /<h([23])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
    var match;
    while ((match = re.exec(String(bodyHtml || ''))) !== null) {
      headings.push({
        level: match[1],
        id: match[2],
        text: String(match[3] || '').replace(/<[^>]+>/g, '').trim(),
      });
    }
    if (!headings.length) return '';
    return (
      '<nav class="ld-help-toc" aria-label="On this page">' +
        '<h2 class="ld-help-toc__title">On this page</h2>' +
        '<ul class="ld-help-toc__list">' +
          headings.map(function (heading) {
            return (
              '<li class="ld-help-toc__item ld-help-toc__item--h' + heading.level + '">' +
                '<a class="ld-help-toc__link" href="#' + escapeHtml(heading.id) + '">' + escapeHtml(heading.text) + '</a>' +
              '</li>'
            );
          }).join('') +
        '</ul>' +
      '</nav>'
    );
  }

  function buildArticleRailHtml(tocHtml, searchOptions) {
    return buildHelpRailHtml(Object.assign({}, searchOptions || {}, {
      tocHtml: tocHtml || '',
    }));
  }

  function getStickyTopOffset(root) {
    var el = root && (root.classList && root.classList.contains('ld-help-site')
      ? root
      : root.querySelector('.ld-help-site')) || root;
    var raw = el ? getComputedStyle(el).getPropertyValue('--ld-help-sticky-top').trim() : '';
    if (!raw) return 80;
    if (raw.indexOf('rem') >= 0) {
      var rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return parseFloat(raw) * rootFont || 80;
    }
    return parseFloat(raw) || 80;
  }

  function bindArticleTocRail(root) {
    if (!root || !root.hasAttribute('data-ld-help-article')) return;
    var railColumn = root.querySelector('.ld-help-site__rail');
    var sticky = root.querySelector('[data-ld-help-toc-rail]');
    var bodyEl = root.querySelector('.ld-help-site__body');
    if (!railColumn || !sticky || !bodyEl) return;

    if (typeof root.__ldTocRailSchedule === 'function') {
      root.__ldTocRailSchedule();
      return;
    }

    var mediaQuery = window.matchMedia('(min-width: 960px)');
    var pending = false;

    function clearFixedStyles() {
      sticky.classList.remove('ld-help-site__rail-sticky--fixed');
      sticky.style.position = '';
      sticky.style.top = '';
      sticky.style.left = '';
      sticky.style.width = '';
      sticky.style.maxHeight = '';
      sticky.style.overflowY = '';
    }

    function update() {
      if (!mediaQuery.matches) {
        clearFixedStyles();
        return;
      }

      var topOffset = getStickyTopOffset(root);
      var columnRect = railColumn.getBoundingClientRect();
      var bodyRect = bodyEl.getBoundingClientRect();
      var stickyHeight = sticky.offsetHeight;
      var top = topOffset;

      if (bodyRect.bottom - stickyHeight < topOffset) {
        top = bodyRect.bottom - stickyHeight;
      }
      if (bodyRect.top > topOffset) {
        top = bodyRect.top;
      }

      sticky.classList.add('ld-help-site__rail-sticky--fixed');
      sticky.style.position = 'fixed';
      sticky.style.top = Math.max(0, top) + 'px';
      sticky.style.left = columnRect.left + 'px';
      sticky.style.width = columnRect.width + 'px';
      sticky.style.maxHeight = Math.max(120, window.innerHeight - topOffset - 16) + 'px';
      sticky.style.overflowY = 'auto';
    }

    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        update();
      });
    }

    root.__ldTocRailSchedule = schedule;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', schedule);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(schedule);
    }
    schedule();
  }

  function bindTocSmoothScroll(root) {
    if (!root || root.getAttribute('data-ld-toc-scroll-bound') === 'true') return;
    var links = root.querySelectorAll('.ld-help-toc__link[href^="#"]');
    if (!links.length) return;
    root.setAttribute('data-ld-toc-scroll-bound', 'true');

    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var hash = String(link.getAttribute('href') || '');
        if (hash.length < 2) return;
        var id = decodeURIComponent(hash.slice(1));
        var target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        var offset = getStickyTopOffset(root) + 16;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', hash);
        }
      });
    });
  }

  function buildArticleSearchPathLabel(article, collectionIndex, homeLabel) {
    var parts = [String(homeLabel || 'Support')];
    var collectionSlug = normalizeSlug(article && article.collectionSlug);
    var entry = collectionSlug ? findCollectionEntry(collectionIndex || [], collectionSlug) : null;
    if (entry && Array.isArray(entry.path) && entry.path.length) {
      entry.path.forEach(function (node) {
        parts.push(node.name || node.slug);
      });
    } else if (article && article.collectionName) {
      parts.push(article.collectionName);
    }
    return parts.join(' > ');
  }

  function buildTypeaheadResultItem(article, options) {
    var sectionContext = null;
    var collectionSlug = normalizeSlug(article.collectionSlug);
    var entry = collectionSlug ? findCollectionEntry(options.collectionIndex || [], collectionSlug) : null;
    if (entry) sectionContext = entry.node;
    var href = buildArticleHref(options.articlePrefix || options.linkPrefix, article, sectionContext);
    var pathLabel = buildArticleSearchPathLabel(article, options.collectionIndex, options.homeLabel);
    return (
      '<li class="ld-help-site__search-result">' +
        '<a class="ld-help-site__search-result-link" href="' + escapeHtml(href) + '">' +
          '<span class="ld-help-site__search-result-title">' + escapeHtml(article.title || article.slug || 'Untitled') + '</span>' +
          '<span class="ld-help-site__search-result-path">' + escapeHtml(pathLabel) + '</span>' +
        '</a>' +
      '</li>'
    );
  }

  function bindHelpSiteChrome(root, options) {
    if (!root) return;
    bindSectionTree(root);
    bindTocSmoothScroll(root);

    var searchForm = root.querySelector('[data-ld-help-search]');
    if (!searchForm || !options || !options.homePrefix) return;

    var input = searchForm.querySelector('.ld-help-site__search-input');
    var dropdown = searchForm.querySelector('[data-ld-help-search-dropdown]');
    var resultsEl = searchForm.querySelector('.ld-help-site__search-results');
    var viewAllLink = searchForm.querySelector('.ld-help-site__search-view-all');
    var home = buildHomeHref(options.homePrefix);
    var org = String(options.org || '').trim();
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var contentBase = org && apiOrigin
      ? apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org)
      : '';
    var debounceTimer = null;
    var requestId = 0;
    var blurTimer = null;
    var MIN_CHARS = 3;
    var DEBOUNCE_MS = 280;
    var RESULT_LIMIT = 8;

    function viewAllHref(query) {
      var joiner = home.indexOf('?') >= 0 ? '&' : '?';
      return home + joiner + 'q=' + encodeURIComponent(query);
    }

    function hideDropdown() {
      if (!dropdown) return;
      dropdown.hidden = true;
      if (resultsEl) resultsEl.innerHTML = '';
    }

    function showDropdown() {
      if (dropdown) dropdown.hidden = false;
    }

    function goHomeSearch(query) {
      var safeQuery = String(query || '').trim();
      if (!safeQuery) {
        window.location.href = home;
        return;
      }
      window.location.href = viewAllHref(safeQuery);
    }

    function renderResults(articles, query) {
      if (!resultsEl || !dropdown) return;
      if (!articles.length) {
        resultsEl.innerHTML = '<li class="ld-help-site__search-empty">No articles match your search.</li>';
        if (viewAllLink) {
          viewAllLink.hidden = true;
        }
        showDropdown();
        return;
      }
      resultsEl.innerHTML = articles.map(function (article) {
        return buildTypeaheadResultItem(article, options);
      }).join('');
      if (viewAllLink) {
        viewAllLink.hidden = false;
        viewAllLink.href = viewAllHref(query);
      }
      showDropdown();
    }

    function runLiveSearch(query) {
      var safeQuery = String(query || '').trim();
      if (safeQuery.length < MIN_CHARS || !contentBase) {
        hideDropdown();
        return;
      }

      var currentRequest = ++requestId;
      fetchArticles(contentBase, { search: safeQuery, limit: RESULT_LIMIT })
        .then(function (result) {
          if (currentRequest !== requestId) return;
          renderResults(result.articles || [], safeQuery);
        })
        .catch(function () {
          if (currentRequest !== requestId) return;
          hideDropdown();
        });
    }

    function scheduleLiveSearch() {
      var query = input ? String(input.value || '').trim() : '';
      if (debounceTimer) clearTimeout(debounceTimer);
      if (query.length < MIN_CHARS) {
        requestId += 1;
        hideDropdown();
        return;
      }
      debounceTimer = setTimeout(function () {
        runLiveSearch(query);
      }, DEBOUNCE_MS);
    }

    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (debounceTimer) clearTimeout(debounceTimer);
      var query = input ? String(input.value || '').trim() : '';
      goHomeSearch(query);
    });

    if (input) {
      input.addEventListener('input', scheduleLiveSearch);
      input.addEventListener('focus', function () {
        if (blurTimer) clearTimeout(blurTimer);
        var query = String(input.value || '').trim();
        if (query.length >= MIN_CHARS && resultsEl && resultsEl.children.length) {
          showDropdown();
        }
      });
      input.addEventListener('blur', function () {
        blurTimer = setTimeout(hideDropdown, 150);
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          hideDropdown();
          input.blur();
        }
      });
    }

    if (dropdown) {
      dropdown.addEventListener('mousedown', function (event) {
        event.preventDefault();
      });
    }
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
    var currentArticleSlug = normalizeSlug(options.currentArticleSlug);
    var categoryPrefix = normalizeLinkPrefix(options.categoryPrefix || options.linkPrefix);
    var linkPrefix = normalizeLinkPrefix(options.linkPrefix);
    var articlePrefix = normalizeLinkPrefix(options.articlePrefix || options.linkPrefix);
    var articlesBySlug = options.articlesBySlug || {};
    var sectionContextBySlug = options.sectionContextBySlug || {};
    var openSlugs = {};

    (options.openPath || []).forEach(function (node) {
      openSlugs[normalizeSlug(node.slug)] = true;
    });

    function buildNodeHref(node) {
      if (!node.parentSlug) {
        return buildCategoryHref(categoryPrefix, node.slug);
      }
      return buildSectionHref(linkPrefix, node, node.parentSlug);
    }

    function buildArticleLinks(sectionNode, isOpen) {
      var slug = normalizeSlug(sectionNode.slug);
      var articles = articlesBySlug[slug] || [];
      if (!isOpen || !articles.length) return '';
      var context = sectionContextBySlug[slug] || sectionNode;
      return (
        '<ul class="ld-help-tree ld-help-tree--articles">' +
          articles.map(function (article) {
            var articleSlug = normalizeSlug(article.slug);
            var isCurrentArticle = articleSlug && articleSlug === currentArticleSlug;
            return (
              '<li class="ld-help-tree__article-item' + (isCurrentArticle ? ' is-current' : '') + '">' +
                '<a class="ld-help-tree__article-link" href="' + escapeHtml(buildArticleHref(articlePrefix, article, context)) + '">' +
                  escapeHtml(article.title || article.slug || 'Untitled') +
                '</a>' +
              '</li>'
            );
          }).join('') +
        '</ul>'
      );
    }

    function renderNodes(list, depth) {
      if (!Array.isArray(list) || !list.length) return '';
      return (
        '<ul class="ld-help-tree' + (depth > 0 ? ' ld-help-tree--nested' : '') + '">' +
          list.map(function (node) {
            var slug = normalizeSlug(node.slug);
            var isCurrent = slug === currentSlug && normalizeSlug(node.parentSlug) === currentParentSlug;
            var isOpen = openSlugs[slug] || isCurrent;
            var hasChildren = Array.isArray(node.children) && node.children.length > 0;
            var hasArticles = Array.isArray(articlesBySlug[slug]) && articlesBySlug[slug].length > 0;
            var canExpand = hasChildren || hasArticles;
            var itemClass = 'ld-help-tree__item' + (isCurrent ? ' is-current' : '') + (isOpen ? ' is-open' : '');
            var toggleHtml = canExpand
              ? '<button type="button" class="ld-help-tree__toggle" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-label="Toggle section"></button>'
              : '<span class="ld-help-tree__spacer" aria-hidden="true"></span>';
            var childrenHtml = hasChildren && isOpen
              ? '<div class="ld-help-tree__children">' + renderNodes(node.children, depth + 1) + '</div>'
              : (hasChildren ? '<div class="ld-help-tree__children" hidden>' + renderNodes(node.children, depth + 1) + '</div>' : '');
            var articlesHtml = buildArticleLinks(node, isOpen);

            return (
              '<li class="' + itemClass + '">' +
                '<div class="ld-help-tree__row">' +
                  toggleHtml +
                  '<a class="ld-help-tree__link" href="' + escapeHtml(buildNodeHref(node)) + '">' +
                    escapeHtml(node.name || node.slug) +
                  '</a>' +
                '</div>' +
                childrenHtml +
                articlesHtml +
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
        var articles = item.querySelector(':scope > .ld-help-tree--articles');
        var isOpen = item.classList.contains('is-open');
        if (children) children.hidden = isOpen;
        if (articles) articles.hidden = isOpen;
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
    return buildHelpSiteShell({
      dataAttr: 'data-ld-help-category',
      topbarHtml: options.topbarHtml,
      navHtml: options.navHtml,
      statusHtml: options.statusHtml,
      mainHtml: options.mainHtml,
      railHtml: options.railHtml,
    });
  }

  function buildSectionPageHtml(options) {
    return buildHelpSiteShell({
      dataAttr: 'data-ld-help-section',
      topbarHtml: options.topbarHtml,
      navHtml: options.navHtml,
      statusHtml: options.statusHtml,
      mainHtml: options.mainHtml,
      railHtml: options.railHtml,
    });
  }

  function buildArticlePageHtml(options) {
    return buildHelpSiteShell({
      dataAttr: 'data-ld-help-article',
      topbarHtml: options.topbarHtml,
      navHtml: options.navHtml,
      mainHtml: options.mainHtml,
      railHtml: options.railHtml,
    });
  }

  function buildSectionContextMap(tree) {
    var map = {};
    function walk(nodes) {
      (nodes || []).forEach(function (node) {
        map[normalizeSlug(node.slug)] = node;
        if (node.children && node.children.length) walk(node.children);
      });
    }
    walk(tree);
    return map;
  }

  function buildTreeOptions(options) {
    return {
      currentSlug: options.currentSlug,
      currentParentSlug: options.currentParentSlug,
      currentArticleSlug: options.currentArticleSlug,
      categoryPrefix: options.categoryPrefix,
      linkPrefix: options.sectionPrefix || options.linkPrefix,
      articlePrefix: options.articlePrefix,
      openPath: options.openPath || [],
      articlesBySlug: options.articlesBySlug || {},
      sectionContextBySlug: options.sectionContextBySlug || {},
      topicsTitle: options.topicsTitle,
    };
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
    bindHelpSiteChrome: bindHelpSiteChrome,
    bindArticleTocRail: bindArticleTocRail,
    bindTocSmoothScroll: bindTocSmoothScroll,
    getStickyTopOffset: getStickyTopOffset,
    groupArticlesByCollectionSlug: groupArticlesByCollectionSlug,
    buildHelpTopbar: buildHelpTopbar,
    buildHelpSearchFormHtml: buildHelpSearchFormHtml,
    buildHelpRailHtml: buildHelpRailHtml,
    buildTopicsNavHtml: buildTopicsNavHtml,
    buildCategoryHeroHtml: buildCategoryHeroHtml,
    buildSubcategoryCardHtml: buildSubcategoryCardHtml,
    buildSectionArticleRowHtml: buildSectionArticleRowHtml,
    buildSectionArticlesHtml: buildSectionArticlesHtml,
    buildHelpSiteShell: buildHelpSiteShell,
    injectHeadingIds: injectHeadingIds,
    buildTocHtml: buildTocHtml,
    buildArticleRailHtml: buildArticleRailHtml,
    buildArticlePageHtml: buildArticlePageHtml,
    buildSectionContextMap: buildSectionContextMap,
    buildTreeOptions: buildTreeOptions,
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
