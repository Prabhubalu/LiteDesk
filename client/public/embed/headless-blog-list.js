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
    var idx = src.indexOf('/embed/headless-blog-list.js');
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
    var prefix = String(value || '/blog/').trim();
    if (!prefix) return '/blog/';
    if (prefix.indexOf('?') >= 0) return prefix;
    if (!prefix.endsWith('/')) prefix += '/';
    if (!prefix.startsWith('/')) prefix = '/' + prefix;
    return prefix;
  }

  function buildPostHref(linkPrefix, slug) {
    var safeSlug = normalizeSlug(slug);
    if (!safeSlug) return linkPrefix;
    return linkPrefix + encodeURIComponent(safeSlug);
  }

  function coverUrl(post) {
    return (post && post.coverImage && post.coverImage.url) || '';
  }

  function authorName(post) {
    var name = String((post && post.authorName) || '').trim();
    if (!name || /^author$/i.test(name)) return '';
    return name;
  }

  function authorInitials(name) {
    var parts = String(name || 'A').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join('') || 'A';
  }

  function authorAvatarHtml(post) {
    var name = authorName(post);
    var avatar = String((post && post.authorAvatar) || '').trim();
    if (avatar) {
      return '<img class="ld-blog-home__avatar" src="' + escapeHtml(avatar) + '" alt="" />';
    }
    return '<span class="ld-blog-home__avatar ld-blog-home__avatar--fallback" aria-hidden="true">'
      + escapeHtml(authorInitials(name))
      + '</span>';
  }

  function categoryLabel(post) {
    return String((post && (post.collectionName || (post.tags && post.tags[0]))) || '').trim();
  }

  function flattenCollections(nodes, out) {
    if (!Array.isArray(nodes)) return out || [];
    var result = out || [];
    nodes.forEach(function (node) {
      if (!node) return;
      result.push({
        name: node.name || node.slug || 'Category',
        slug: node.slug || '',
      });
      if (Array.isArray(node.children) && node.children.length) {
        flattenCollections(node.children, result);
      }
    });
    return result;
  }

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      return response.json().then(function (payload) {
        return { response: response, payload: payload };
      });
    });
  }

  function buildFeaturedCard(post, linkPrefix, size) {
    if (!post) return '';
    var href = buildPostHref(linkPrefix, post.slug);
    var cover = coverUrl(post);
    var category = categoryLabel(post);
    var dateValue = post.publishedAt || post.updatedAt;
    var mediaHtml = cover
      ? '<img class="ld-blog-home__featured-media" src="' + escapeHtml(cover) + '" alt="" loading="lazy" />'
      : '<span class="ld-blog-home__featured-media ld-blog-home__featured-media--empty" aria-hidden="true"></span>';

    return (
      '<a class="ld-blog-home__featured-card ld-blog-home__featured-card--' + size + '" href="' + escapeHtml(href) + '">' +
        mediaHtml +
        '<span class="ld-blog-home__featured-scrim" aria-hidden="true"></span>' +
        '<span class="ld-blog-home__featured-body">' +
          (category
            ? '<span class="ld-blog-home__chip ld-blog-home__chip--on-media">' + escapeHtml(category) + '</span>'
            : '') +
          '<span class="ld-blog-home__featured-title">' + escapeHtml(post.title || 'Untitled') + '</span>' +
          '<span class="ld-blog-home__featured-meta">' +
            authorAvatarHtml(post) +
            (authorName(post) ? '<span>' + escapeHtml(authorName(post)) + '</span>' : '') +
            (dateValue
              ? '<time datetime="' + escapeHtml(String(dateValue)) + '">' + escapeHtml(formatDate(dateValue)) + '</time>'
              : '') +
          '</span>' +
        '</span>' +
      '</a>'
    );
  }

  function buildFeedCard(post, linkPrefix, readMoreLabel) {
    var href = buildPostHref(linkPrefix, post.slug);
    var cover = coverUrl(post);
    var category = categoryLabel(post);
    var summary = String(post.summary || '').trim();
    var dateValue = post.publishedAt || post.updatedAt;
    var name = authorName(post);
    var media = cover
      ? '<img class="ld-blog-home__feed-cover" src="' + escapeHtml(cover) + '" alt="" loading="lazy" />'
      : '<div class="ld-blog-home__feed-cover ld-blog-home__feed-cover--empty" aria-hidden="true"></div>';

    return (
      '<article class="ld-blog-home__feed-card">' +
        '<a class="ld-blog-home__feed-media" href="' + escapeHtml(href) + '">' + media + '</a>' +
        '<div class="ld-blog-home__feed-body">' +
          '<div class="ld-blog-home__feed-byline">' +
            authorAvatarHtml(post) +
            (name ? '<span>' + escapeHtml(name) + '</span>' : '') +
            (dateValue
              ? '<time datetime="' + escapeHtml(String(dateValue)) + '">' + escapeHtml(formatDate(dateValue)) + '</time>'
              : '') +
          '</div>' +
          (category
            ? '<span class="ld-blog-home__chip">' + escapeHtml(category) + '</span>'
            : '') +
          '<h3 class="ld-blog-home__feed-title"><a href="' + escapeHtml(href) + '">' + escapeHtml(post.title || 'Untitled') + '</a></h3>' +
          (summary ? '<p class="ld-blog-home__feed-excerpt">' + escapeHtml(summary) + '</p>' : '') +
          '<a class="ld-blog-home__read-more" href="' + escapeHtml(href) + '">' + escapeHtml(readMoreLabel) + '</a>' +
        '</div>' +
      '</article>'
    );
  }

  function buildAuthors(posts) {
    var seen = {};
    var authors = [];
    (posts || []).forEach(function (post) {
      var name = authorName(post);
      if (!name) return;
      var key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      authors.push({
        name: name,
        avatar: String(post.authorAvatar || '').trim(),
      });
    });
    return authors.slice(0, 6);
  }

  function buildPagination(page, totalPages) {
    if (totalPages <= 1) return '';
    var parts = [];
    if (page > 1) {
      parts.push('<button type="button" class="ld-blog-home__page-btn" data-page="' + (page - 1) + '">Previous</button>');
    }
    parts.push('<span class="ld-blog-home__page-status">Page ' + page + ' of ' + totalPages + '</span>');
    if (page < totalPages) {
      parts.push('<button type="button" class="ld-blog-home__page-btn" data-page="' + (page + 1) + '">Next</button>');
    }
    return parts.join('');
  }

  function ensureStylesheet(origin) {
    if (
      document.querySelector('link[data-arivu-headless-blocks-css]')
      || document.querySelector('link[data-ld-headless-blocks-css]')
    ) {
      return;
    }
    var href = origin + '/embed/headless-blocks.css';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-arivu-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }

  function ensureRssAlternate(rssUrl, title, marker) {
    if (!rssUrl || typeof document === 'undefined') return;
    var attr = marker || 'data-arivu-blog-rss';
    var existing = document.querySelector('link[' + attr + ']');
    if (existing) {
      existing.setAttribute('href', rssUrl);
      if (title) existing.setAttribute('title', title);
      return;
    }
    var link = document.createElement('link');
    link.rel = 'alternate';
    link.type = 'application/rss+xml';
    link.href = rssUrl;
    link.title = title || 'Blog RSS';
    link.setAttribute(attr, 'true');
    document.head.appendChild(link);
  }

  function buildRssHref(apiOrigin, org) {
    return apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org) + '/blog/rss.xml';
  }

  function buildCollectionRssHref(apiOrigin, org, collectionSlug) {
    var slug = String(collectionSlug || '').trim();
    if (!slug) return '';
    return apiOrigin
      + '/api/public/v1/content/'
      + encodeURIComponent(org)
      + '/blog/collections/'
      + encodeURIComponent(slug)
      + '/rss.xml';
  }

  function mountHome(options) {
    var org = String(options.org || '').trim();
    var target = options.target;
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    var linkPrefix = normalizeLinkPrefix(options.linkPrefix);
    var searchEnabled = options.searchEnabled !== false;
    var limit = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
    var page = Math.max(Number(options.page) || 1, 1);
    var searchQuery = String(options.search || '').trim();
    var collectionFilter = String(options.collection || '').trim();
    var searchLabel = String(options.searchLabel || 'Search posts');
    var searchPlaceholder = String(options.searchPlaceholder || 'Search posts…');
    var emptyLabel = String(options.emptyLabel || 'No published posts yet.');
    var loadFailedLabel = String(options.loadFailedLabel || 'Failed to load posts');
    var topPostsLabel = String(options.topPostsLabel || 'Top Posts');
    var latestPostsLabel = String(options.latestPostsLabel || 'Latest Posts');
    var categoriesLabel = String(options.categoriesLabel || 'Recommended Categories');
    var authorsLabel = String(options.authorsLabel || 'Popular Authors');
    var followLabel = String(options.followLabel || 'Follow');
    var viewMoreCategoriesLabel = String(options.viewMoreCategoriesLabel || 'View more Categories');
    var newsletterTitle = String(options.newsletterTitle || 'Subscribe to our newsletter');
    var newsletterDesc = String(options.newsletterDesc || 'Get product updates and stories in your inbox.');
    var newsletterPlaceholder = String(options.newsletterPlaceholder || 'you@example.com');
    var newsletterButton = String(options.newsletterButton || 'Subscribe');
    var readMoreLabel = String(options.readMoreLabel || 'Read More →');

    if (!org) return Promise.reject(new Error('org is required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);
    var listUrl = contentBase + '/blog?page=' + page + '&limit=' + limit;
    if (searchQuery) listUrl += '&search=' + encodeURIComponent(searchQuery);
    if (collectionFilter) listUrl += '&collection=' + encodeURIComponent(collectionFilter);

    ensureStylesheet(apiOrigin);
    mountEl.innerHTML = (
      '<div class="ld-blog-home" data-ld-blog-home aria-busy="true">' +
        '<div class="ld-blog-home__skeleton" aria-hidden="true"></div>' +
      '</div>'
    );

    var popularUrl = contentBase + '/blog/popular?limit=3';
    var collectionsUrl = contentBase + '/blog/collections';

    return Promise.all([
      fetchJson(listUrl),
      page === 1 && !searchQuery && !collectionFilter
        ? fetchJson(popularUrl).catch(function () { return null; })
        : Promise.resolve(null),
      fetchJson(collectionsUrl).catch(function () { return null; }),
    ]).then(function (results) {
      var listResult = results[0];
      var popularResult = results[1];
      var collectionsResult = results[2];

      if (!listResult.response.ok || !listResult.payload || !listResult.payload.success) {
        throw new Error((listResult.payload && listResult.payload.message) || loadFailedLabel);
      }

      var posts = Array.isArray(listResult.payload.data) ? listResult.payload.data : [];
      var pagination = listResult.payload.pagination || {};
      var totalPages = Math.max(Number(pagination.totalPages) || 1, 1);
      var currentPage = Math.max(Number(pagination.page) || page, 1);
      var publishing = listResult.payload.publishing || {};
      var rssEnabled = options.rssEnabled !== false && publishing.rssEnabled !== false;
      var blogRssHref = rssEnabled ? buildRssHref(apiOrigin, org) : '';
      var categoryRssHref = rssEnabled && collectionFilter
        ? buildCollectionRssHref(apiOrigin, org, collectionFilter)
        : '';
      var rssHref = categoryRssHref || blogRssHref;
      var rssLabel = categoryRssHref
        ? (options.rssCategoryLabel || 'Category RSS')
        : (options.rssLabel || 'RSS');
      if (blogRssHref) ensureRssAlternate(blogRssHref, options.rssTitle || 'Blog RSS', 'data-arivu-blog-rss');
      if (categoryRssHref) {
        ensureRssAlternate(categoryRssHref, options.rssCategoryTitle || 'Category RSS', 'data-arivu-blog-category-rss');
      } else {
        var staleCategoryLink = document.querySelector('link[data-arivu-blog-category-rss]');
        if (staleCategoryLink && staleCategoryLink.parentNode) staleCategoryLink.parentNode.removeChild(staleCategoryLink);
      }

      var popular = popularResult
        && popularResult.response
        && popularResult.response.ok
        && popularResult.payload
        && popularResult.payload.success
        && Array.isArray(popularResult.payload.data)
        ? popularResult.payload.data
        : [];
      var collectionsTree = collectionsResult
        && collectionsResult.response
        && collectionsResult.response.ok
        && collectionsResult.payload
        && collectionsResult.payload.success
        && Array.isArray(collectionsResult.payload.data)
        ? collectionsResult.payload.data
        : [];
      var categories = flattenCollections(collectionsTree).slice(0, 12);
      var topPosts = popular.length ? popular.slice(0, 3) : posts.slice(0, 3);
      var authors = buildAuthors(posts.concat(popular));
      var showTop = page === 1 && !searchQuery && !collectionFilter && topPosts.length > 0;

      var searchHtml = searchEnabled
        ? (
          '<form class="ld-blog-home__search" role="search">' +
            '<label class="ld-blog-home__search-label">' +
              '<span class="ld-blog-home__sr">' + escapeHtml(searchLabel) + '</span>' +
              '<input class="ld-blog-home__search-input" type="search" name="q" value="' + escapeHtml(searchQuery) + '" placeholder="' + escapeHtml(searchPlaceholder) + '" autocomplete="off" />' +
            '</label>' +
          '</form>'
        )
        : '';

      var rssLinkHtml = rssHref
        ? (
          '<a class="ld-blog-home__rss" href="' + escapeHtml(rssHref) + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="ld-blog-home__rss-badge" aria-hidden="true"></span>' +
            escapeHtml(rssLabel) +
          '</a>'
        )
        : '';

      var featuredHtml = '';
      if (showTop) {
        featuredHtml = (
          '<section class="ld-blog-home__top" aria-labelledby="ld-blog-top-posts">' +
            '<h2 id="ld-blog-top-posts" class="ld-blog-home__section-title">' + escapeHtml(topPostsLabel) + '</h2>' +
            '<div class="ld-blog-home__featured-grid">' +
              buildFeaturedCard(topPosts[0], linkPrefix, 'hero') +
              '<div class="ld-blog-home__featured-stack">' +
                buildFeaturedCard(topPosts[1], linkPrefix, 'secondary') +
                buildFeaturedCard(topPosts[2], linkPrefix, 'secondary') +
              '</div>' +
            '</div>' +
          '</section>'
        );
      }

      var feedHtml = posts.length
        ? posts.map(function (post) {
          return buildFeedCard(post, linkPrefix, readMoreLabel);
        }).join('')
        : '<p class="ld-blog-home__empty">' + escapeHtml(emptyLabel) + '</p>';

      var categoriesHtml = categories.length
        ? (
          '<div class="ld-blog-home__tags">' +
            categories.map(function (cat) {
              return (
                '<button type="button" class="ld-blog-home__tag' + (collectionFilter && collectionFilter === cat.slug ? ' is-active' : '') + '" data-collection="' + escapeHtml(cat.slug || '') + '">' +
                  escapeHtml(cat.name) +
                '</button>'
              );
            }).join('') +
          '</div>' +
          '<button type="button" class="ld-blog-home__linkish" data-clear-collection="1">' +
            escapeHtml(viewMoreCategoriesLabel) +
          '</button>'
        )
        : '<p class="ld-blog-home__muted">No categories yet.</p>';

      var authorsHtml = authors.length
        ? (
          '<ul class="ld-blog-home__authors">' +
            authors.map(function (author) {
              var avatar = author.avatar
                ? '<img class="ld-blog-home__avatar" src="' + escapeHtml(author.avatar) + '" alt="" />'
                : '<span class="ld-blog-home__avatar ld-blog-home__avatar--fallback" aria-hidden="true">'
                  + escapeHtml(authorInitials(author.name))
                  + '</span>';
              return (
                '<li class="ld-blog-home__author">' +
                  avatar +
                  '<span class="ld-blog-home__author-name">' + escapeHtml(author.name) + '</span>' +
                  '<button type="button" class="ld-blog-home__follow" disabled>' + escapeHtml(followLabel) + '</button>' +
                '</li>'
              );
            }).join('') +
          '</ul>'
        )
        : '<p class="ld-blog-home__muted">Authors appear as you publish posts.</p>';

      var rssWidgetHtml = rssEnabled
        ? (
          '<section class="ld-blog-home__widget">' +
            '<h3 class="ld-blog-home__widget-title">' + escapeHtml(options.rssLabel || 'RSS') + '</h3>' +
            '<p class="ld-blog-home__muted">' + escapeHtml(options.rssDesc || 'Subscribe to new posts in any feed reader.') + '</p>' +
            (blogRssHref
              ? '<a class="ld-blog-home__rss ld-blog-home__rss--block" href="' + escapeHtml(blogRssHref) + '" target="_blank" rel="noopener noreferrer">'
                + escapeHtml(options.rssSubscribeLabel || 'Blog RSS feed')
                + '</a>'
              : '') +
            (categoryRssHref
              ? '<a class="ld-blog-home__rss ld-blog-home__rss--block" href="' + escapeHtml(categoryRssHref) + '" target="_blank" rel="noopener noreferrer">'
                + escapeHtml(options.rssCategorySubscribeLabel || 'This category RSS')
                + '</a>'
              : '') +
          '</section>'
        )
        : '';

      mountEl.innerHTML = (
        '<div class="ld-blog-home" data-ld-blog-home>' +
          featuredHtml +
          '<div class="ld-blog-home__body">' +
            '<section class="ld-blog-home__main" aria-labelledby="ld-blog-latest-posts">' +
              '<div class="ld-blog-home__main-head">' +
                '<h2 id="ld-blog-latest-posts" class="ld-blog-home__section-title">' + escapeHtml(latestPostsLabel) + '</h2>' +
                '<div class="ld-blog-home__main-actions">' +
                  rssLinkHtml +
                  searchHtml +
                '</div>' +
              '</div>' +
              '<div class="ld-blog-home__feed">' + feedHtml + '</div>' +
              '<nav class="ld-blog-home__pagination" aria-label="Posts pagination">' +
                buildPagination(currentPage, totalPages) +
              '</nav>' +
            '</section>' +
            '<aside class="ld-blog-home__aside" aria-label="Blog sidebar">' +
              '<section class="ld-blog-home__widget">' +
                '<h3 class="ld-blog-home__widget-title">' + escapeHtml(categoriesLabel) + '</h3>' +
                categoriesHtml +
              '</section>' +
              '<section class="ld-blog-home__widget">' +
                '<h3 class="ld-blog-home__widget-title">' + escapeHtml(authorsLabel) + '</h3>' +
                authorsHtml +
              '</section>' +
              rssWidgetHtml +
              '<section class="ld-blog-home__widget ld-blog-home__newsletter">' +
                '<h3 class="ld-blog-home__widget-title">' + escapeHtml(newsletterTitle) + '</h3>' +
                '<p class="ld-blog-home__muted">' + escapeHtml(newsletterDesc) + '</p>' +
                '<form class="ld-blog-home__newsletter-form">' +
                  '<label class="ld-blog-home__sr" for="ld-blog-newsletter-email">Email</label>' +
                  '<input id="ld-blog-newsletter-email" class="ld-blog-home__newsletter-input" type="email" name="email" placeholder="' + escapeHtml(newsletterPlaceholder) + '" required />' +
                  '<button type="submit" class="ld-blog-home__newsletter-btn">' + escapeHtml(newsletterButton) + '</button>' +
                '</form>' +
              '</section>' +
            '</aside>' +
          '</div>' +
        '</div>'
      );

      var root = mountEl.querySelector('[data-ld-blog-home]');
      var state = {
        org: org,
        apiOrigin: apiOrigin,
        linkPrefix: linkPrefix,
        searchEnabled: searchEnabled,
        limit: limit,
        search: searchQuery,
        collection: collectionFilter,
        searchLabel: searchLabel,
        searchPlaceholder: searchPlaceholder,
        emptyLabel: emptyLabel,
        loadFailedLabel: loadFailedLabel,
        topPostsLabel: topPostsLabel,
        latestPostsLabel: latestPostsLabel,
        categoriesLabel: categoriesLabel,
        authorsLabel: authorsLabel,
        followLabel: followLabel,
        viewMoreCategoriesLabel: viewMoreCategoriesLabel,
        newsletterTitle: newsletterTitle,
        newsletterDesc: newsletterDesc,
        newsletterPlaceholder: newsletterPlaceholder,
        newsletterButton: newsletterButton,
        readMoreLabel: readMoreLabel,
        rssEnabled: rssEnabled,
        rssLabel: rssLabel,
        rssTitle: options.rssTitle || 'Blog RSS',
        rssDesc: options.rssDesc || 'Subscribe to new posts in any feed reader.',
        rssSubscribeLabel: options.rssSubscribeLabel || 'Open RSS feed',
      };

      if (searchEnabled) {
        var form = root.querySelector('.ld-blog-home__search');
        if (form) {
          form.addEventListener('submit', function (event) {
            event.preventDefault();
            var input = form.querySelector('.ld-blog-home__search-input');
            mountHome(Object.assign({}, state, {
              target: mountEl,
              search: input ? input.value : '',
              page: 1,
            })).catch(function (error) {
              console.error('[LiteDeskHeadlessBlogList]', error);
            });
          });
        }
      }

      root.querySelectorAll('[data-page]').forEach(function (button) {
        button.addEventListener('click', function () {
          var nextPage = Number(button.getAttribute('data-page'));
          if (!Number.isFinite(nextPage)) return;
          mountHome(Object.assign({}, state, {
            target: mountEl,
            page: nextPage,
          })).catch(function (error) {
            console.error('[LiteDeskHeadlessBlogList]', error);
          });
        });
      });

      root.querySelectorAll('[data-collection]').forEach(function (button) {
        button.addEventListener('click', function () {
          mountHome(Object.assign({}, state, {
            target: mountEl,
            collection: button.getAttribute('data-collection') || '',
            page: 1,
            search: '',
          })).catch(function (error) {
            console.error('[LiteDeskHeadlessBlogList]', error);
          });
        });
      });

      var clearBtn = root.querySelector('[data-clear-collection]');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          mountHome(Object.assign({}, state, {
            target: mountEl,
            collection: '',
            page: 1,
          })).catch(function (error) {
            console.error('[LiteDeskHeadlessBlogList]', error);
          });
        });
      }

      var newsletterForm = root.querySelector('.ld-blog-home__newsletter-form');
      if (newsletterForm) {
        newsletterForm.addEventListener('submit', function (event) {
          event.preventDefault();
        });
      }

      return {
        posts: posts,
        popular: popular,
        collections: categories,
        pagination: pagination,
        organization: listResult.payload.organization,
      };
    }).catch(function (error) {
      mountEl.innerHTML = '<p class="ld-post__error">' + escapeHtml(error.message || loadFailedLabel) + '</p>';
      throw error;
    });
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-blog-list.js"]');
  }

  window.LiteDeskHeadlessBlogList = {
    mount: mountHome,
  };
  window.ArivuHeadlessBlogList = window.LiteDeskHeadlessBlogList;

  if (script) {
    var org = getAttr(script, 'data-org', '');
    var target = getAttr(script, 'data-target', '#ld-blog-home');
    var apiOrigin = resolveApiOrigin(script);
    var linkPrefix = getAttr(script, 'data-link-prefix', '/blog/');
    var searchEnabled = getAttr(script, 'data-search', 'true') !== 'false';
    var limit = getAttr(script, 'data-limit', '10');
    if (org) {
      mountHome({
        org: org,
        target: target,
        apiOrigin: apiOrigin,
        linkPrefix: linkPrefix,
        searchEnabled: searchEnabled,
        limit: limit,
      }).catch(function (error) {
        console.error('[LiteDeskHeadlessBlogList]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
