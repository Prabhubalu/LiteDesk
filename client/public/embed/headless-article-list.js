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
    var idx = src.indexOf('/embed/headless-article-list.js');
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

  function buildArticleHref(linkPrefix, slug) {
    var safeSlug = normalizeSlug(slug);
    if (!safeSlug) return linkPrefix;
    return linkPrefix + encodeURIComponent(safeSlug);
  }

  function buildListShell(options) {
    var searchEnabled = options.searchEnabled !== false;
    var searchHtml = searchEnabled
      ? (
        '<form class="ld-help-list__search" role="search">' +
          '<label class="ld-help-list__search-label">' +
            '<span class="ld-help-list__search-text">' + escapeHtml(options.searchLabel) + '</span>' +
            '<input class="ld-help-list__search-input" type="search" name="q" value="' + escapeHtml(options.searchQuery || '') + '" placeholder="' + escapeHtml(options.searchPlaceholder) + '" autocomplete="off" />' +
          '</label>' +
        '</form>'
      )
      : '';

    return (
      '<div class="ld-help-list" data-ld-help-list>' +
        searchHtml +
        '<div class="ld-help-list__status" aria-live="polite"></div>' +
        '<ul class="ld-help-list__items"></ul>' +
        '<nav class="ld-help-list__pagination" aria-label="Articles pagination"></nav>' +
      '</div>'
    );
  }

  function buildListItem(article, linkPrefix) {
    var slug = String(article.slug || '').trim();
    var title = escapeHtml(article.title || 'Untitled');
    var summary = String(article.summary || '').trim();
    var summaryHtml = summary ? '<p class="ld-help-list__summary">' + escapeHtml(summary) + '</p>' : '';
    var dateValue = article.publishedAt || article.updatedAt;
    var dateHtml = dateValue
      ? '<time class="ld-help-list__date" datetime="' + escapeHtml(String(dateValue)) + '">' + escapeHtml(formatDate(dateValue)) + '</time>'
      : '';

    return (
      '<li class="ld-help-list__item">' +
        '<a class="ld-help-list__link" href="' + escapeHtml(buildArticleHref(linkPrefix, slug)) + '">' +
          '<h2 class="ld-help-list__title">' + title + '</h2>' +
          summaryHtml +
          dateHtml +
        '</a>' +
      '</li>'
    );
  }

  function buildPagination(page, totalPages) {
    if (totalPages <= 1) return '';
    var parts = [];
    if (page > 1) {
      parts.push('<button type="button" class="ld-help-list__page-btn" data-page="' + (page - 1) + '">Previous</button>');
    }
    parts.push('<span class="ld-help-list__page-status">Page ' + page + ' of ' + totalPages + '</span>');
    if (page < totalPages) {
      parts.push('<button type="button" class="ld-help-list__page-btn" data-page="' + (page + 1) + '">Next</button>');
    }
    return parts.join('');
  }

  function ensureStylesheet(origin) {
    if (document.querySelector('link[data-ld-headless-blocks-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = origin + '/embed/headless-blocks.css';
    link.setAttribute('data-ld-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }

  function mountList(options) {
    var org = String(options.org || '').trim();
    var target = options.target;
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    var linkPrefix = normalizeLinkPrefix(options.linkPrefix);
    var searchEnabled = options.searchEnabled !== false;
    var limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
    var page = Math.max(Number(options.page) || 1, 1);
    var searchQuery = String(options.search || '').trim();
    var searchLabel = String(options.searchLabel || 'Search articles');
    var searchPlaceholder = String(options.searchPlaceholder || 'Search help articles…');
    var emptyLabel = String(options.emptyLabel || 'No published articles yet.');
    var loadFailedLabel = String(options.loadFailedLabel || 'Failed to load articles');

    if (!org) return Promise.reject(new Error('org is required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);
    var listUrl = contentBase + '/articles?page=' + page + '&limit=' + limit;
    if (searchQuery) listUrl += '&search=' + encodeURIComponent(searchQuery);

    mountEl.innerHTML = buildListShell({
      searchEnabled: searchEnabled,
      searchQuery: searchQuery,
      searchLabel: searchLabel,
      searchPlaceholder: searchPlaceholder,
    });
    ensureStylesheet(apiOrigin);

    var root = mountEl.querySelector('[data-ld-help-list]');
    var statusEl = root.querySelector('.ld-help-list__status');
    var itemsEl = root.querySelector('.ld-help-list__items');
    var paginationEl = root.querySelector('.ld-help-list__pagination');

    function renderLoading() {
      statusEl.textContent = 'Loading…';
      itemsEl.innerHTML = '';
      paginationEl.innerHTML = '';
    }

    function bindControls(state) {
      if (searchEnabled) {
        var form = root.querySelector('.ld-help-list__search');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var input = form.querySelector('.ld-help-list__search-input');
          mountList(Object.assign({}, state, {
            target: mountEl,
            search: input ? input.value : '',
            page: 1,
          })).catch(function (error) {
            console.error('[LiteDeskHeadlessArticleList]', error);
          });
        });
      }

      paginationEl.querySelectorAll('[data-page]').forEach(function (button) {
        button.addEventListener('click', function () {
          var nextPage = Number(button.getAttribute('data-page'));
          if (!Number.isFinite(nextPage)) return;
          mountList(Object.assign({}, state, {
            target: mountEl,
            page: nextPage,
          })).catch(function (error) {
            console.error('[LiteDeskHeadlessArticleList]', error);
          });
        });
      });
    }

    renderLoading();

    return fetch(listUrl, { cache: 'no-store' })
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
        var pagination = result.payload.pagination || {};
        var totalPages = Math.max(Number(pagination.totalPages) || 1, 1);
        var currentPage = Math.max(Number(pagination.page) || page, 1);

        statusEl.textContent = '';
        if (!articles.length) {
          statusEl.textContent = emptyLabel;
        }

        itemsEl.innerHTML = articles.map(function (article) {
          return buildListItem(article, linkPrefix);
        }).join('');

        paginationEl.innerHTML = buildPagination(currentPage, totalPages);

        var state = {
          org: org,
          apiOrigin: apiOrigin,
          linkPrefix: linkPrefix,
          searchEnabled: searchEnabled,
          limit: limit,
          search: searchQuery,
          searchLabel: searchLabel,
          searchPlaceholder: searchPlaceholder,
          emptyLabel: emptyLabel,
          loadFailedLabel: loadFailedLabel,
        };
        bindControls(state);

        return {
          articles: articles,
          pagination: pagination,
          organization: result.payload.organization,
        };
      })
      .catch(function (error) {
        statusEl.textContent = '';
        itemsEl.innerHTML = '';
        paginationEl.innerHTML = '';
        mountEl.innerHTML = '<p class="ld-article__error">' + escapeHtml(error.message || loadFailedLabel) + '</p>';
        throw error;
      });
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-article-list.js"]');
  }

  window.LiteDeskHeadlessArticleList = {
    mount: mountList,
  };
  window.ArivuHeadlessArticleList = window.LiteDeskHeadlessArticleList;

  if (script) {
    var org = getAttr(script, 'data-org', '');
    var target = getAttr(script, 'data-target', '#ld-help-list');
    var apiOrigin = resolveApiOrigin(script);
    var linkPrefix = getAttr(script, 'data-link-prefix', '/help/');
    var searchEnabled = getAttr(script, 'data-search', 'true') !== 'false';
    var limit = getAttr(script, 'data-limit', '25');
    if (org) {
      mountList({
        org: org,
        target: target,
        apiOrigin: apiOrigin,
        linkPrefix: linkPrefix,
        searchEnabled: searchEnabled,
        limit: limit,
      }).catch(function (error) {
        console.error('[LiteDeskHeadlessArticleList]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
