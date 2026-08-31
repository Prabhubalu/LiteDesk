;(function (global) {
  'use strict';
  if (global.ArivuLegacyBrand) return;
  function brandSlug() { return ['lite', 'desk'].join(''); }
  function brandPascal() { return 'Lite' + 'Desk'; }
  function readWindowGlobal(suffix) { return global[brandPascal() + suffix]; }
  function publishWindowGlobal(suffix, value) { global[brandPascal() + suffix] = value; }
  global.ArivuLegacyBrand = { readWindowGlobal: readWindowGlobal, publishWindowGlobal: publishWindowGlobal };
})(typeof window !== 'undefined' ? window : globalThis);

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

  function resolveApiOrigin(script) {
    var explicit = getAttr(script, 'data-api-origin', '');
    if (explicit) return explicit.replace(/\/$/, '');
    var src = script.src || '';
    var idx = src.indexOf('/embed/headless-help-home.js');
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

  function buildCollectionHref(linkPrefix, slug) {
    var safeSlug = normalizeSlug(slug);
    if (!safeSlug) return linkPrefix;
    return linkPrefix + encodeURIComponent(safeSlug);
  }

  function buildArticleHref(linkPrefix, article) {
    var slug = normalizeSlug(article.slug);
    if (!slug) return linkPrefix;
    if (String(linkPrefix || '').indexOf('?') >= 0) {
      return linkPrefix + encodeURIComponent(slug);
    }
    var collectionSlug = normalizeSlug(article.collectionSlug);
    if (collectionSlug) {
      return linkPrefix + encodeURIComponent(collectionSlug) + '/' + encodeURIComponent(slug);
    }
    return linkPrefix + encodeURIComponent(slug);
  }

  var SEARCH_ICON_SVG = (
    '<svg class="ld-help-home__search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
      '<path d="M9 16a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm8 2-3.35-3.35" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />' +
    '</svg>'
  );

  var CARD_ICON_COLORS = [
    'ld-help-home__card-icon--green',
    'ld-help-home__card-icon--dark',
    'ld-help-home__card-icon--dark',
    'ld-help-home__card-icon--orange',
    'ld-help-home__card-icon--purple',
    'ld-help-home__card-icon--dark',
    'ld-help-home__card-icon--blue',
    'ld-help-home__card-icon--red',
    'ld-help-home__card-icon--maroon',
  ];

  function ensureHeroiconPaths(origin) {
    if (window.ArivuHeadlessHeroiconPaths || window.ArivuLegacyBrand.readWindowGlobal('HeadlessHeroiconPaths')) {
      return Promise.resolve();
    }
    if (document.querySelector('script[data-ld-headless-heroicon-paths]')) {
      return new Promise(function (resolve) {
        var existing = document.querySelector('script[data-ld-headless-heroicon-paths]');
        existing.addEventListener('load', function () { resolve(); });
      });
    }
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = origin + '/embed/headless-heroicon-paths.js';
      script.async = true;
      script.setAttribute('data-ld-headless-heroicon-paths', 'true');
      script.onload = function () { resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function getHeroiconPaths() {
    return window.ArivuHeadlessHeroiconPaths || window.ArivuLegacyBrand.readWindowGlobal('HeadlessHeroiconPaths') || {};
  }

  function buildHeroIconSvg(iconKey) {
    var key = String(iconKey || '').trim().toLowerCase();
    var paths = getHeroiconPaths()[key];
    if (!paths || !paths.length) return '';
    var pathHtml = paths.map(function (d) {
      return '<path stroke-linecap="round" stroke-linejoin="round" d="' + escapeHtml(d) + '" />';
    }).join('');
    return (
      '<svg class="ld-help-home__card-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
        pathHtml +
      '</svg>'
    );
  }

  function normalizeHeroIconColor(value) {
    var raw = String(value || '').trim();
    if (!raw) return '#111827';
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      var hex = raw.slice(1);
      return '#' + hex.split('').map(function (ch) { return ch + ch; }).join('').toLowerCase();
    }
    return '#111827';
  }
  function resolveHeroIconKey(collection) {
    var key = String(collection.heroIconKey || '').trim().toLowerCase();
    if (!key) return '';
    return getHeroiconPaths()[key] ? key : '';
  }

  function buildHomeShell(options) {
    var searchEnabled = options.searchEnabled !== false;
    var title = String(options.title || 'How can we help?').trim();
    var searchButtonLabel = String(options.searchButtonLabel || 'Search').trim();
    var searchHtml = searchEnabled
      ? (
        '<form class="ld-help-home__search" role="search">' +
          '<label class="ld-help-home__search-label">' +
            '<span class="ld-help-home__search-text">' + escapeHtml(options.searchLabel) + '</span>' +
            '<div class="ld-help-home__search-box">' +
              SEARCH_ICON_SVG +
              '<input class="ld-help-home__search-input" type="search" name="q" value="' + escapeHtml(options.searchQuery || '') + '" placeholder="' + escapeHtml(options.searchPlaceholder) + '" autocomplete="off" />' +
              '<button type="submit" class="ld-help-home__search-btn">' + escapeHtml(searchButtonLabel) + '</button>' +
            '</div>' +
          '</label>' +
        '</form>'
      )
      : '';

    var categoriesTitleHtml = options.categoriesTitle
      ? (
        '<div class="ld-help-home__section-head">' +
          '<h2 class="ld-help-home__section-title">' + escapeHtml(options.categoriesTitle) + '</h2>' +
          '<div class="ld-help-home__section-divider" aria-hidden="true"></div>' +
        '</div>'
      )
      : '';

    return (
      '<div class="ld-help-home" data-ld-help-home>' +
        '<section class="ld-help-home__hero">' +
          '<h1 class="ld-help-home__title">' + escapeHtml(title) + '</h1>' +
          searchHtml +
          '<div class="ld-help-home__tags" hidden></div>' +
        '</section>' +
        '<div class="ld-help-home__status" aria-live="polite"></div>' +
        '<section class="ld-help-home__categories">' +
          categoriesTitleHtml +
          '<div class="ld-help-home__grid" aria-busy="true">' + buildHomeGridSkeleton(6) + '</div>' +
        '</section>' +
        '<div class="ld-help-home__search-results" hidden>' +
          '<div class="ld-help-home__search-results-header">' +
            '<button type="button" class="ld-help-home__back-btn">' + escapeHtml(options.backLabel) + '</button>' +
          '</div>' +
          '<ul class="ld-help-list__items"></ul>' +
        '</div>' +
      '</div>'
    );
  }

  function buildCollectionCard(collection, linkPrefix, index) {
    var slug = String(collection.slug || '').trim();
    var rawName = String(collection.name || 'Untitled').trim();
    var name = escapeHtml(rawName);
    var description = String(collection.description || '').trim();
    var descriptionHtml = description
      ? '<p class="ld-help-home__card-desc">' + escapeHtml(description) + '</p>'
      : '';
    var emoji = String(collection.emoji || '').trim();
    var imageUrl = String(collection.imageUrl || '').trim();
    var heroIconKey = resolveHeroIconKey(collection);
    var iconHtml = '';
    if (imageUrl) {
      iconHtml = (
        '<span class="ld-help-home__card-icon ld-help-home__card-icon--image" aria-hidden="true">' +
          '<img class="ld-help-home__card-icon-img" src="' + escapeHtml(imageUrl) + '" alt="" loading="lazy" decoding="async" />' +
        '</span>'
      );
    } else if (heroIconKey) {
      var iconColor = normalizeHeroIconColor(collection.heroIconColor);
      iconHtml = (
        '<span class="ld-help-home__card-icon ld-help-home__card-icon--hero" style="background-color:' + escapeHtml(iconColor) + '" aria-hidden="true">' +
          buildHeroIconSvg(heroIconKey) +
        '</span>'
      );
    } else {
      var iconContent = emoji || escapeHtml(rawName.charAt(0).toUpperCase() || '?');
      var iconModifier = emoji ? '' : ' ld-help-home__card-icon--letter';
      var colorClass = CARD_ICON_COLORS[Math.abs(Number(index) || 0) % CARD_ICON_COLORS.length];
      iconHtml = '<span class="ld-help-home__card-icon ' + colorClass + iconModifier + '" aria-hidden="true">' + iconContent + '</span>';
    }

    return (
      '<a class="ld-help-home__card" href="' + escapeHtml(buildCollectionHref(linkPrefix, slug)) + '">' +
        '<div class="ld-help-home__card-body">' +
          iconHtml +
          '<h2 class="ld-help-home__card-title">' + name + '</h2>' +
          descriptionHtml +
        '</div>' +
        '<span class="ld-help-home__card-arrow" aria-hidden="true">→</span>' +
      '</a>'
    );
  }

  function buildQuickTagsHtml(collections, linkPrefix, limit) {
    var items = Array.isArray(collections) ? collections.slice(0, Math.max(Number(limit) || 4, 1)) : [];
    if (!items.length) return '';
    return items.map(function (collection) {
      var label = escapeHtml(String(collection.name || collection.slug || '').trim());
      if (!label) return '';
      return (
        '<a class="ld-help-home__tag" href="' + escapeHtml(buildCollectionHref(linkPrefix, collection.slug)) + '">' +
          label +
        '</a>'
      );
    }).join('');
  }

  function buildSearchResultItem(article, linkPrefix) {
    var title = escapeHtml(article.title || 'Untitled');
    var summary = String(article.summary || '').trim();
    var summaryHtml = summary ? '<p class="ld-help-list__summary">' + escapeHtml(summary) + '</p>' : '';
    var dateValue = article.publishedAt || article.updatedAt;
    var dateHtml = dateValue
      ? '<time class="ld-help-list__date" datetime="' + escapeHtml(String(dateValue)) + '">' + escapeHtml(formatDate(dateValue)) + '</time>'
      : '';

    return (
      '<li class="ld-help-list__item">' +
        '<a class="ld-help-list__link" href="' + escapeHtml(buildArticleHref(linkPrefix, article)) + '">' +
          '<h2 class="ld-help-list__title">' + title + '</h2>' +
          summaryHtml +
          dateHtml +
        '</a>' +
      '</li>'
    );
  }

  function ensureStylesheet(origin) {
    if (
      document.querySelector('link[data-arivu-headless-blocks-css]')
      || document.querySelector('link[data-ld-headless-blocks-css]')
    ) {
      return;
    }
    var href = origin + '/embed/headless-blocks.css';
    if (!document.querySelector('link[rel="preload"][href="' + href + '"]')) {
      var preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'style';
      preload.href = href;
      document.head.appendChild(preload);
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-arivu-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }

  function buildHomeGridSkeleton(count) {
    var html = '';
    var total = Math.max(Number(count) || 6, 1);
    for (var i = 0; i < total; i++) {
      html += '<div class="ld-help-skeleton__card" aria-hidden="true"></div>';
    }
    return html;
  }

  function readSearchQueryFromUrl() {
    if (typeof window === 'undefined' || !window.location) return '';
    try {
      var params = new URLSearchParams(window.location.search);
      return String(params.get('q') || params.get('search') || '').trim();
    } catch (_error) {
      return '';
    }
  }

  function mountHome(options) {
    var org = String(options.org || '').trim();
    var target = options.target;
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    var linkPrefix = normalizeLinkPrefix(options.linkPrefix);
    var articlePrefix = normalizeLinkPrefix(options.articlePrefix || options.linkPrefix);
    var searchEnabled = options.searchEnabled !== false;
    var searchQuery = String(options.search || readSearchQueryFromUrl() || '').trim();
    var title = String(options.title || 'How can we help?').trim();
    var categoriesTitle = String(options.categoriesTitle || '').trim();
    var searchLabel = String(options.searchLabel || 'Search articles');
    var searchPlaceholder = String(options.searchPlaceholder || 'Ask me anything');
    var searchButtonLabel = String(options.searchButtonLabel || 'Search');
    var quickTagsLimit = Math.min(Math.max(Number(options.quickTagsLimit) || 4, 0), 8);
    var emptyLabel = String(options.emptyLabel || 'No help categories yet.');
    var searchEmptyLabel = String(options.searchEmptyLabel || 'No articles match your search.');
    var loadFailedLabel = String(options.loadFailedLabel || 'Failed to load help center');
    var backLabel = String(options.backLabel || 'Back to categories');
    var labels = {
      articleSingular: String(options.labelArticle || 'Article'),
      articlePlural: String(options.labelArticles || 'Articles'),
      sectionSingular: String(options.labelSection || 'Section'),
      sectionPlural: String(options.labelSections || 'Sections'),
    };

    if (!org) return Promise.reject(new Error('org is required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);
    var collectionsUrl = contentBase + '/collections';

    ensureStylesheet(apiOrigin);

    var root = mountEl.querySelector('.ld-help-home');
    if (root && root.classList.contains('ld-help-skeleton')) {
      mountEl.innerHTML = buildHomeShell({
        searchEnabled: searchEnabled,
        searchQuery: searchQuery,
        searchLabel: searchLabel,
        searchPlaceholder: searchPlaceholder,
        searchButtonLabel: searchButtonLabel,
        title: title,
        categoriesTitle: categoriesTitle,
        backLabel: backLabel,
      });
      root = mountEl.querySelector('[data-ld-help-home]');
    } else if (!root) {
      mountEl.innerHTML = buildHomeShell({
        searchEnabled: searchEnabled,
        searchQuery: searchQuery,
        searchLabel: searchLabel,
        searchPlaceholder: searchPlaceholder,
        searchButtonLabel: searchButtonLabel,
        title: title,
        categoriesTitle: categoriesTitle,
        backLabel: backLabel,
      });
      root = mountEl.querySelector('[data-ld-help-home]');
    }

    var statusEl = root.querySelector('.ld-help-home__status');
    var categoriesEl = root.querySelector('.ld-help-home__categories');
    var gridEl = root.querySelector('.ld-help-home__grid');
    var tagsEl = root.querySelector('.ld-help-home__tags');
    var searchResultsEl = root.querySelector('.ld-help-home__search-results');
    var searchItemsEl = searchResultsEl.querySelector('.ld-help-list__items');
    var backBtn = searchResultsEl.querySelector('.ld-help-home__back-btn');

    function showGrid() {
      searchResultsEl.hidden = true;
      if (categoriesEl) categoriesEl.hidden = false;
      statusEl.textContent = '';
    }

    function showSearchResults() {
      if (categoriesEl) categoriesEl.hidden = true;
      searchResultsEl.hidden = false;
    }

    function renderLoading() {
      statusEl.textContent = '';
      searchResultsEl.hidden = true;
      if (categoriesEl) categoriesEl.hidden = false;
      gridEl.setAttribute('aria-busy', 'true');
      gridEl.innerHTML = buildHomeGridSkeleton(6);
      searchItemsEl.innerHTML = '';
    }

    function bindSearch() {
      if (!searchEnabled) return { runSearch: function () {} };

      var form = root.querySelector('.ld-help-home__search');
      var input = form.querySelector('.ld-help-home__search-input');
      var debounceTimer = null;
      var requestId = 0;
      var MIN_CHARS = 3;
      var DEBOUNCE_MS = 280;

      function runSearch(query) {
        var safeQuery = String(query || '').trim();
        if (!safeQuery) {
          showGrid();
          return;
        }

        var currentRequest = ++requestId;
        statusEl.textContent = 'Searching…';
        showSearchResults();
        searchItemsEl.innerHTML = '';

        fetch(contentBase + '/articles?search=' + encodeURIComponent(safeQuery) + '&limit=20', { cache: 'no-store' })
          .then(function (response) {
            return response.json().then(function (payload) {
              return { response: response, payload: payload };
            });
          })
          .then(function (result) {
            if (currentRequest !== requestId) return;
            if (!result.response.ok || !result.payload || !result.payload.success) {
              throw new Error((result.payload && result.payload.message) || loadFailedLabel);
            }
            var articles = Array.isArray(result.payload.data) ? result.payload.data : [];
            statusEl.textContent = articles.length ? '' : searchEmptyLabel;
            searchItemsEl.innerHTML = articles.map(function (article) {
              return buildSearchResultItem(article, articlePrefix);
            }).join('');
          })
          .catch(function (error) {
            if (currentRequest !== requestId) return;
            statusEl.textContent = '';
            searchItemsEl.innerHTML = '<li class="ld-help-list__item"><p class="ld-article__error">' + escapeHtml(error.message || loadFailedLabel) + '</p></li>';
          });
      }

      function scheduleLiveSearch() {
        var query = input ? String(input.value || '').trim() : '';
        if (debounceTimer) clearTimeout(debounceTimer);
        if (query.length < MIN_CHARS) {
          requestId += 1;
          showGrid();
          return;
        }
        debounceTimer = setTimeout(function () {
          runSearch(query);
        }, DEBOUNCE_MS);
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (debounceTimer) clearTimeout(debounceTimer);
        var query = input ? String(input.value || '').trim() : '';
        if (!query) {
          requestId += 1;
          showGrid();
          return;
        }
        runSearch(query);
      });

      if (input) {
        input.addEventListener('input', scheduleLiveSearch);
      }

      backBtn.addEventListener('click', function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        requestId += 1;
        if (input) input.value = '';
        showGrid();
      });

      return { runSearch: runSearch };
    }

    renderLoading();

    return ensureHeroiconPaths(apiOrigin).then(function () {
      return fetch(collectionsUrl, { cache: 'no-store' })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { response: response, payload: payload };
        });
      })
      .then(function (result) {
        if (!result.response.ok || !result.payload || !result.payload.success) {
          throw new Error((result.payload && result.payload.message) || loadFailedLabel);
        }

        var collections = Array.isArray(result.payload.data) ? result.payload.data : [];
        statusEl.textContent = '';
        if (!collections.length) {
          statusEl.textContent = emptyLabel;
        }

        gridEl.innerHTML = collections.map(function (collection, index) {
          return buildCollectionCard(collection, linkPrefix, index);
        }).join('');
        gridEl.hidden = false;
        gridEl.removeAttribute('aria-busy');

        if (tagsEl && quickTagsLimit > 0) {
          var tagsHtml = buildQuickTagsHtml(collections, linkPrefix, quickTagsLimit);
          if (tagsHtml) {
            tagsEl.innerHTML = tagsHtml;
            tagsEl.hidden = false;
          } else {
            tagsEl.hidden = true;
          }
        }

        var searchApi = bindSearch();

        if (searchQuery) {
          searchApi.runSearch(searchQuery);
        }

        return {
          collections: collections,
          organization: result.payload.organization,
        };
      })
      .catch(function (error) {
        statusEl.textContent = '';
        gridEl.hidden = true;
        searchResultsEl.hidden = true;
        mountEl.innerHTML = '<p class="ld-article__error">' + escapeHtml(error.message || loadFailedLabel) + '</p>';
        throw error;
      });
    });
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-help-home.js"]');
  }

  window.ArivuHeadlessHelpHome = {
    mount: mountHome,
  };
  window.ArivuLegacyBrand.publishWindowGlobal('HeadlessHelpHome', window.ArivuHeadlessHelpHome);

  if (script) {
    var org = getAttr(script, 'data-org', '');
    var target = getAttr(script, 'data-target', '#ld-help-home');
    var apiOrigin = resolveApiOrigin(script);
    var linkPrefix = getAttr(script, 'data-link-prefix', '/help/');
    var searchEnabled = getAttr(script, 'data-search', 'true') !== 'false';
    var title = getAttr(script, 'data-title', '');
    if (org) {
      mountHome({
        org: org,
        target: target,
        apiOrigin: apiOrigin,
        linkPrefix: linkPrefix,
        searchEnabled: searchEnabled,
        title: title,
      }).catch(function (error) {
        console.error('[ArivuHeadlessHelpHome]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
