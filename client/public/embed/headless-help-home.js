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

  function formatStats(articleCount, sectionCount, labels) {
    var articleLabel = articleCount === 1 ? labels.articleSingular : labels.articlePlural;
    var parts = [articleCount + ' ' + articleLabel];
    if (sectionCount > 0) {
      var sectionLabel = sectionCount === 1 ? labels.sectionSingular : labels.sectionPlural;
      parts.push(sectionCount + ' ' + sectionLabel);
    }
    return parts.join(' · ');
  }

  function buildHomeShell(options) {
    var searchEnabled = options.searchEnabled !== false;
    var searchHtml = searchEnabled
      ? (
        '<form class="ld-help-home__search" role="search">' +
          '<label class="ld-help-home__search-label">' +
            '<span class="ld-help-home__search-text">' + escapeHtml(options.searchLabel) + '</span>' +
            '<input class="ld-help-home__search-input" type="search" name="q" value="' + escapeHtml(options.searchQuery || '') + '" placeholder="' + escapeHtml(options.searchPlaceholder) + '" autocomplete="off" />' +
          '</label>' +
        '</form>'
      )
      : '';

    var titleHtml = options.title
      ? '<header class="ld-help-home__header"><h1 class="ld-help-home__title">' + escapeHtml(options.title) + '</h1></header>'
      : '';
    var categoriesTitleHtml = options.categoriesTitle
      ? '<h2 class="ld-help-home__section-title">' + escapeHtml(options.categoriesTitle) + '</h2>'
      : '';

    return (
      '<div class="ld-help-home" data-ld-help-home>' +
        titleHtml +
        searchHtml +
        '<div class="ld-help-home__status" aria-live="polite"></div>' +
        categoriesTitleHtml +
        '<div class="ld-help-home__grid" hidden></div>' +
        '<div class="ld-help-home__search-results" hidden>' +
          '<div class="ld-help-home__search-results-header">' +
            '<button type="button" class="ld-help-home__back-btn">' + escapeHtml(options.backLabel) + '</button>' +
          '</div>' +
          '<ul class="ld-help-list__items"></ul>' +
        '</div>' +
      '</div>'
    );
  }

  function buildCollectionCard(collection, linkPrefix, labels) {
    var slug = String(collection.slug || '').trim();
    var name = escapeHtml(collection.name || 'Untitled');
    var description = String(collection.description || '').trim();
    var descriptionHtml = description
      ? '<p class="ld-help-home__card-desc">' + escapeHtml(description) + '</p>'
      : '';
    var stats = formatStats(
      Number(collection.articleCount) || 0,
      Number(collection.sectionCount) || 0,
      labels,
    );
    var emoji = String(collection.emoji || '').trim();
    var emojiHtml = emoji
      ? '<span class="ld-help-home__card-icon" aria-hidden="true">' + escapeHtml(emoji) + '</span>'
      : '';

    return (
      '<a class="ld-help-home__card" href="' + escapeHtml(buildCollectionHref(linkPrefix, slug)) + '">' +
        (emojiHtml ? '<div class="ld-help-home__card-header">' + emojiHtml + '<h2 class="ld-help-home__card-title">' + name + '</h2></div>' : '<h2 class="ld-help-home__card-title">' + name + '</h2>') +
        descriptionHtml +
        '<p class="ld-help-home__card-stats">' + escapeHtml(stats) + '</p>' +
      '</a>'
    );
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
    if (document.querySelector('link[data-ld-headless-blocks-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = origin + '/embed/headless-blocks.css';
    link.setAttribute('data-ld-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }

  function mountHome(options) {
    var org = String(options.org || '').trim();
    var target = options.target;
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    var linkPrefix = normalizeLinkPrefix(options.linkPrefix);
    var articlePrefix = normalizeLinkPrefix(options.articlePrefix || options.linkPrefix);
    var searchEnabled = options.searchEnabled !== false;
    var searchQuery = String(options.search || '').trim();
    var title = String(options.title || '').trim();
    var categoriesTitle = String(options.categoriesTitle || '').trim();
    var searchLabel = String(options.searchLabel || 'Search articles');
    var searchPlaceholder = String(options.searchPlaceholder || 'Search help articles…');
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

    mountEl.innerHTML = buildHomeShell({
      searchEnabled: searchEnabled,
      searchQuery: searchQuery,
      searchLabel: searchLabel,
      searchPlaceholder: searchPlaceholder,
      title: title,
      categoriesTitle: categoriesTitle,
      backLabel: backLabel,
    });
    ensureStylesheet(apiOrigin);

    var root = mountEl.querySelector('[data-ld-help-home]');
    var statusEl = root.querySelector('.ld-help-home__status');
    var gridEl = root.querySelector('.ld-help-home__grid');
    var searchResultsEl = root.querySelector('.ld-help-home__search-results');
    var searchItemsEl = searchResultsEl.querySelector('.ld-help-list__items');
    var backBtn = searchResultsEl.querySelector('.ld-help-home__back-btn');

    function showGrid() {
      searchResultsEl.hidden = true;
      gridEl.hidden = false;
      statusEl.textContent = '';
    }

    function showSearchResults() {
      gridEl.hidden = true;
      searchResultsEl.hidden = false;
    }

    function renderLoading() {
      statusEl.textContent = 'Loading…';
      gridEl.hidden = true;
      searchResultsEl.hidden = true;
      gridEl.innerHTML = '';
      searchItemsEl.innerHTML = '';
    }

    function bindSearch(state) {
      if (!searchEnabled) return;

      var form = root.querySelector('.ld-help-home__search');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var input = form.querySelector('.ld-help-home__search-input');
        var query = input ? String(input.value || '').trim() : '';
        if (!query) {
          showGrid();
          return;
        }

        statusEl.textContent = 'Searching…';
        showSearchResults();
        searchItemsEl.innerHTML = '';

        fetch(contentBase + '/articles?search=' + encodeURIComponent(query) + '&limit=20', { cache: 'no-store' })
          .then(function (response) {
            return response.json().then(function (payload) {
              return { response: response, payload: payload };
            });
          })
          .then(function (result) {
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
            statusEl.textContent = '';
            searchItemsEl.innerHTML = '<li class="ld-help-list__item"><p class="ld-article__error">' + escapeHtml(error.message || loadFailedLabel) + '</p></li>';
          });
      });

      backBtn.addEventListener('click', function () {
        var input = form.querySelector('.ld-help-home__search-input');
        if (input) input.value = '';
        showGrid();
      });
    }

    renderLoading();

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

        gridEl.innerHTML = collections.map(function (collection) {
          return buildCollectionCard(collection, linkPrefix, labels);
        }).join('');
        gridEl.hidden = false;

        var state = {
          org: org,
          apiOrigin: apiOrigin,
          linkPrefix: linkPrefix,
          searchEnabled: searchEnabled,
          title: title,
          searchLabel: searchLabel,
          searchPlaceholder: searchPlaceholder,
          emptyLabel: emptyLabel,
          searchEmptyLabel: searchEmptyLabel,
          loadFailedLabel: loadFailedLabel,
          backLabel: backLabel,
          labelArticle: labels.articleSingular,
          labelArticles: labels.articlePlural,
          labelSection: labels.sectionSingular,
          labelSections: labels.sectionPlural,
        };
        bindSearch(state);

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
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-help-home.js"]');
  }

  window.LiteDeskHeadlessHelpHome = {
    mount: mountHome,
  };
  window.ArivuHeadlessHelpHome = window.LiteDeskHeadlessHelpHome;

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
        console.error('[LiteDeskHeadlessHelpHome]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
