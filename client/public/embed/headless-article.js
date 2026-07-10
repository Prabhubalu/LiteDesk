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

  function normalizeSlug(value) {
    return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
  }

  function resolveApiOrigin(script) {
    var explicit = getAttr(script, 'data-api-origin', '');
    if (explicit) return explicit.replace(/\/$/, '');
    var src = script.src || '';
    var idx = src.indexOf('/embed/headless-article.js');
    if (idx > 0) return src.slice(0, idx);
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    return '';
  }

  var SUBTITLE_SIZES = { sm: true, md: true, lg: true, xl: true };
  var DEFAULT_HEADING_COLOR = '#111827';
  var DEFAULT_SUBHEADING_COLOR = '#4b5563';
  var OVERLAP_HEADING_COLOR = '#ffffff';
  var OVERLAP_SUBHEADING_COLOR = 'rgba(255,255,255,0.9)';

  function normalizeHexColor(value) {
    var raw = String(value || '').trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return '';
    if (raw.length === 4) {
      return '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
    }
    return raw.toLowerCase();
  }

  function normalizePresentation(presentation) {
    var source = presentation && typeof presentation === 'object' ? presentation : {};
    var coverPosition = source.coverPosition === 'above-title' ? 'above-title' : 'below-title';
    var subtitleSize = SUBTITLE_SIZES[source.subtitleSize] ? source.subtitleSize : 'md';
    var titleOverlapCover = coverPosition === 'above-title' && Boolean(source.titleOverlapCover);
    return {
      coverFirst: coverPosition === 'above-title',
      useHeroOverlap: titleOverlapCover,
      subtitleSize: subtitleSize,
      headingColor: normalizeHexColor(source.headingColor),
      subheadingColor: normalizeHexColor(source.subheadingColor),
    };
  }

  function resolveChromeColors(presentation, heroOverlap) {
    return {
      heading: presentation.headingColor || (heroOverlap ? OVERLAP_HEADING_COLOR : DEFAULT_HEADING_COLOR),
      subheading: presentation.subheadingColor || (heroOverlap ? OVERLAP_SUBHEADING_COLOR : DEFAULT_SUBHEADING_COLOR),
    };
  }

  function colorStyleAttr(color) {
    return color ? ' style="color:' + color + '"' : '';
  }

  function buildTitle(text, options) {
    if (!text) return '';
    var classes = 'ld-article__title';
    if (options.overlap) classes += ' ld-article__title--overlap';
    if (options.afterCover) classes += ' ld-article__title--after-cover';
    return '<h1 class="' + classes + '"' + colorStyleAttr(options.color) + '>' + escapeHtml(text) + '</h1>';
  }

  function buildSubtitle(text, options) {
    if (!text) return '';
    var sizeClass = options.overlap
      ? 'ld-article__subtitle--overlap-' + options.size
      : 'ld-article__subtitle--' + options.size;
    var classes = 'ld-article__subtitle ' + sizeClass;
    if (options.overlap) classes += ' ld-article__subtitle--overlap';
    return '<p class="' + classes + '"' + colorStyleAttr(options.color) + '>' + escapeHtml(text) + '</p>';
  }

  function absolutizeEmbedAssetUrl(url, apiOrigin) {
    var common = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
    if (common && common.absolutizeEmbedAssetUrl) {
      return common.absolutizeEmbedAssetUrl(url, apiOrigin);
    }
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
    var common = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
    if (common && common.absolutizeEmbedHtml) {
      return common.absolutizeEmbedHtml(html, apiOrigin);
    }
    if (!html || !apiOrigin) return html;
    var origin = String(apiOrigin).replace(/\/$/, '');
    return String(html).replace(
      /(\s(?:src|href)=["'])(\/api\/(?:files\/download|uploads)[^"']*)(["'])/gi,
      function (_match, prefix, path, suffix) {
        return prefix + origin + path + suffix;
      },
    );
  }

  function buildCover(coverImage, apiOrigin) {
    if (!coverImage || !coverImage.url) return '';
    var src = absolutizeEmbedAssetUrl(coverImage.url, apiOrigin);
    return (
      '<img class="ld-article__cover" src="' + escapeHtml(src) + '" alt="' + escapeHtml(coverImage.alt || '') + '" loading="lazy" />'
    );
  }

  function buildHeroOverlap(data, colors, presentation, apiOrigin) {
    var coverImage = data.coverImage;
    var src = absolutizeEmbedAssetUrl(coverImage.url, apiOrigin);
    return (
      '<div class="ld-article__hero">' +
        '<img class="ld-article__hero-cover" src="' + escapeHtml(src) + '" alt="' + escapeHtml(coverImage.alt || '') + '" loading="lazy" />' +
        '<div class="ld-article__hero-gradient" aria-hidden="true"></div>' +
        '<div class="ld-article__hero-text">' +
          buildTitle(data.title, { overlap: true, color: colors.heading }) +
          buildSubtitle(data.subtitle, { overlap: true, size: presentation.subtitleSize, color: colors.subheading }) +
        '</div>' +
      '</div>'
    );
  }

  function buildArticleHeader(data, presentation, colors, apiOrigin) {
    var coverImage = data.coverImage && data.coverImage.url ? data.coverImage : null;
    var useHeroOverlap = presentation.useHeroOverlap && coverImage;

    if (useHeroOverlap) {
      return buildHeroOverlap(data, colors, presentation, apiOrigin);
    }

    var titleOptions = { color: colors.heading, afterCover: presentation.coverFirst };
    var subtitleOptions = { size: presentation.subtitleSize, color: colors.subheading };
    var title = buildTitle(data.title, titleOptions);
    var cover = buildCover(coverImage, apiOrigin);
    var subtitle = buildSubtitle(data.subtitle, subtitleOptions);

    // Cover below title: keep title+subtitle together, then cover.
    // Cover above title: cover first, then title+subtitle.
    if (presentation.coverFirst) {
      return cover + title + subtitle;
    }
    return title + subtitle + cover;
  }

  function buildArticleShell(data, bodyHtml, footerHtml, apiOrigin) {
    var presentation = normalizePresentation(data.presentation);
    var colors = resolveChromeColors(presentation, presentation.useHeroOverlap && Boolean(data.coverImage && data.coverImage.url));
    var metaParts = [];
    if (data.authorName) metaParts.push('<span>' + escapeHtml(data.authorName) + '</span>');
    if (data.publishedAt) metaParts.push('<span>' + escapeHtml(formatDate(data.publishedAt)) + '</span>');
    var meta = metaParts.length ? '<div class="ld-article__meta ld-article__meta--secondary">' + metaParts.join('') + '</div>' : '';
    var footer = footerHtml || '';

    return (
      '<article class="ld-article">' +
        '<header class="ld-article__header">' +
          buildArticleHeader(data, presentation, colors, apiOrigin) +
          buildArticleChromeMeta(data) +
          meta +
        '</header>' +
        '<div class="ld-article__body">' + bodyHtml + '</div>' +
        footer +
      '</article>'
    );
  }

  var THUMB_UP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z"/></svg>';
  var THUMB_DOWN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.01.05.027.1.05.148.593 1.2.925 2.55.925 3.977 0 1.487-.36 2.89-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.5-.96a8.958 8.958 0 0 0 .303-.54"/></svg>';
  var SHARE_ICONS = {
    facebook: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 8.5V6.8c0-.7.5-1.3 1.2-1.3h1.8V2h-2.4c-2.4 0-4 1.5-4 4v2.5H8v3.2h2.6V22h3.4v-10.3H18v-3.2h-4z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23 22h-6.7l-5.2-6.8L5.2 22H2l7.3-8.4L1 2h6.9l4.7 6.2L18.9 2zm-1.2 18h1.8L7.1 3.9H5.2L17.7 20z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.5 8.8V21H2.8V8.8h3.7zM4.6 2c1.2 0 2.1 1 2.1 2.1S5.8 6.2 4.6 6.2 2.5 5.3 2.5 4.1 3.4 2 4.6 2zM21 21h-3.7v-5.9c0-1.4-.5-2.4-1.8-2.4-1 0-1.6.7-1.9 1.3-.1.2-.1.5-.1.8V21H10V8.8h3.5v1.6c.5-.8 1.4-1.9 3.4-1.9 2.5 0 4.4 1.6 4.4 5.1V21z"/></svg>',
  };

  function buildShareUrl(platform, pageUrl, title) {
    var encodedUrl = encodeURIComponent(pageUrl);
    var encodedTitle = encodeURIComponent(title || '');
    if (platform === 'facebook') {
      return 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
    }
    if (platform === 'linkedin') {
      return 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl;
    }
    return 'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedTitle;
  }

  function buildArticleFooter(options) {
    if (!options.enabled) return '';
    var shareUrl = options.pageUrl || (typeof window !== 'undefined' ? window.location.href : '');
    var title = options.title || '';
    return (
      '<div class="ld-article__footer" data-ld-article-footer role="group" aria-label="' + escapeHtml(options.helpfulLabel) + '">' +
        '<div class="ld-article__feedback">' +
          '<span class="ld-article__footer-label">' + escapeHtml(options.helpfulLabel) + '</span>' +
          '<div class="ld-article__feedback-actions" role="group" aria-label="' + escapeHtml(options.helpfulLabel) + '">' +
            '<button type="button" class="ld-article__feedback-btn" data-vote="yes" aria-label="' + escapeHtml(options.yesLabel) + '">' + THUMB_UP_ICON + '</button>' +
            '<button type="button" class="ld-article__feedback-btn" data-vote="no" aria-label="' + escapeHtml(options.noLabel) + '">' + THUMB_DOWN_ICON + '</button>' +
          '</div>' +
          '<p class="ld-article__feedback-thanks" hidden data-feedback-thanks>' + escapeHtml(options.thanksLabel) + '</p>' +
        '</div>' +
        '<div class="ld-article__share">' +
          '<span class="ld-article__footer-label">' + escapeHtml(options.shareLabel) + '</span>' +
          '<div class="ld-article__share-actions">' +
            '<a class="ld-article__share-btn ld-article__share-btn--facebook" href="' + escapeHtml(buildShareUrl('facebook', shareUrl, title)) + '" data-share="facebook" target="_blank" rel="noopener noreferrer" aria-label="Facebook">' + SHARE_ICONS.facebook + '</a>' +
            '<a class="ld-article__share-btn ld-article__share-btn--x" href="' + escapeHtml(buildShareUrl('x', shareUrl, title)) + '" data-share="x" target="_blank" rel="noopener noreferrer" aria-label="X">' + SHARE_ICONS.x + '</a>' +
            '<a class="ld-article__share-btn ld-article__share-btn--linkedin" href="' + escapeHtml(buildShareUrl('linkedin', shareUrl, title)) + '" data-share="linkedin" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">' + SHARE_ICONS.linkedin + '</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function feedbackStorageKey(org, slug) {
    return 'ld-help-feedback:' + org + ':' + slug;
  }

  function readStoredVote(org, slug) {
    try {
      return sessionStorage.getItem(feedbackStorageKey(org, slug)) || '';
    } catch (err) {
      return '';
    }
  }

  function storeVote(org, slug, vote) {
    try {
      sessionStorage.setItem(feedbackStorageKey(org, slug), vote);
    } catch (err) {
      /* optional */
    }
  }

  function submitArticleFeedback(apiOrigin, org, slug, payload) {
    var url = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org) + '/articles/' + encodeURIComponent(slug) + '/feedback';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || !body || !body.success) {
          throw new Error((body && body.message) || ('HTTP ' + response.status));
        }
        return body;
      });
    });
  }

  function applyStoredVoteState(footerEl, vote) {
    if (!footerEl || !vote) return;
    var buttons = footerEl.querySelectorAll('[data-vote]');
    buttons.forEach(function (button) {
      var isActive = button.getAttribute('data-vote') === vote;
      button.classList.toggle('is-active', isActive);
      button.disabled = isActive;
    });
    var thanksEl = footerEl.querySelector('[data-feedback-thanks]');
    if (thanksEl && vote) {
      thanksEl.hidden = false;
    }
  }

  function bindArticleFooter(mountEl, context) {
    if (!context.enabled) return;
    var footerEl = mountEl.querySelector('[data-ld-article-footer]');
    if (!footerEl) return;

    applyStoredVoteState(footerEl, readStoredVote(context.org, context.slug));

    footerEl.addEventListener('click', function (event) {
      var voteButton = event.target.closest('[data-vote]');
      if (voteButton && !voteButton.disabled) {
        var vote = voteButton.getAttribute('data-vote');
        var helpful = vote === 'yes';
        voteButton.disabled = true;
        submitArticleFeedback(context.apiOrigin, context.org, context.slug, { helpful: helpful })
          .then(function () {
            storeVote(context.org, context.slug, vote);
            applyStoredVoteState(footerEl, vote);
          })
          .catch(function () {
            voteButton.disabled = false;
          });
        return;
      }

      var shareLink = event.target.closest('[data-share]');
      if (!shareLink) return;
      var platform = shareLink.getAttribute('data-share');
      void submitArticleFeedback(context.apiOrigin, context.org, context.slug, {
        action: 'share',
        platform: platform,
      }).catch(function () {
        /* share window still opens */
      });
    });
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

  function ensureBlocksScript(origin) {
    return new Promise(function (resolve, reject) {
      if (window.LiteDeskHeadlessBlocks) {
        resolve(window.LiteDeskHeadlessBlocks);
        return;
      }
      var existing = document.querySelector('script[data-ld-headless-blocks-js]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.LiteDeskHeadlessBlocks); });
        existing.addEventListener('error', reject);
        return;
      }
      var script = document.createElement('script');
      script.src = origin + '/embed/headless-blocks.js';
      script.async = true;
      script.setAttribute('data-ld-headless-blocks-js', 'true');
      script.onload = function () { resolve(window.LiteDeskHeadlessBlocks); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function ensureHelpCommonScript(origin) {
    return new Promise(function (resolve, reject) {
      if (window.LiteDeskHeadlessHelpCommon) {
        resolve(window.LiteDeskHeadlessHelpCommon);
        return;
      }
      var existing = document.querySelector('script[data-ld-headless-help-common-js]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.LiteDeskHeadlessHelpCommon); });
        existing.addEventListener('error', reject);
        return;
      }
      var script = document.createElement('script');
      script.src = origin + '/embed/headless-help-common.js';
      script.async = true;
      script.setAttribute('data-ld-headless-help-common-js', 'true');
      script.onload = function () { resolve(window.LiteDeskHeadlessHelpCommon); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function normalizeLinkPrefix(value) {
    var prefix = String(value || '/help/').trim();
    if (!prefix) return '/help/';
    if (prefix.indexOf('?') >= 0) return prefix;
    if (!prefix.endsWith('/')) prefix += '/';
    if (!prefix.startsWith('/')) prefix = '/' + prefix;
    return prefix;
  }

  function buildArticleChromeMeta(article) {
    var categoryName = String(article.collectionName || '').trim();
    var readMinutes = Number(article.readMinutes) || 0;
    var readLabel = readMinutes > 0 ? readMinutes + ' min read' : '';
    if (!categoryName && !readLabel) return '';
    return (
      '<div class="ld-article-chrome__meta">' +
        (categoryName ? '<span class="ld-article-chrome__chip">' + escapeHtml(categoryName) + '</span>' : '') +
        (readLabel ? '<span class="ld-article-chrome__read">' + escapeHtml(readLabel) + '</span>' : '') +
      '</div>' +
      '<hr class="ld-article-chrome__divider" aria-hidden="true" />'
    );
  }

  function buildChromeShell(options) {
    return options.common.buildArticlePageHtml({
      topbarHtml: options.topbarHtml,
      navHtml: options.navHtml,
      mainHtml: options.articleHtml,
      railHtml: options.railHtml,
    });
  }

  function resolveChromeOptions(options) {
    var showSidebar = options.showSidebar === true || options.showSidebar === 'true';
    var showBreadcrumbs = showSidebar
      || options.showBreadcrumbs === true
      || options.showBreadcrumbs === 'true';
    return {
      enabled: showSidebar || showBreadcrumbs,
      showSidebar: showSidebar,
      showBreadcrumbs: showBreadcrumbs,
      homePrefix: normalizeLinkPrefix(options.homePrefix || '/help/'),
      categoryPrefix: normalizeLinkPrefix(options.categoryPrefix || options.linkPrefix || '/help/'),
      sectionPrefix: normalizeLinkPrefix(options.sectionPrefix || options.linkPrefix || '/help/'),
      articlePrefix: normalizeLinkPrefix(options.articlePrefix || options.linkPrefix || '/help/'),
      collectionSlug: normalizeSlug(options.collection || options.parent || ''),
      sectionSlug: normalizeSlug(options.section || ''),
      homeLabel: String(options.homeLabel || 'Support'),
      popularTitle: String(options.popularTitle || 'Popular articles'),
      recentTitle: String(options.recentTitle || 'Recent articles'),
      topicsTitle: String(options.topicsTitle || 'Topics'),
      popularEmptyLabel: String(options.popularEmptyLabel || 'No popular articles yet.'),
      recentEmptyLabel: String(options.recentEmptyLabel || 'No recent articles.'),
      recentLimit: Math.min(Math.max(Number(options.recentLimit) || 5, 1), 25),
      breadcrumbLabel: String(options.breadcrumbLabel || 'Breadcrumb'),
      showFeedbackFooter: options.showFeedbackFooter !== false && options.showFeedbackFooter !== 'false',
      helpfulLabel: String(options.helpfulLabel || 'Helpful?'),
      shareLabel: String(options.shareLabel || 'Share :'),
      yesLabel: String(options.yesLabel || 'Yes'),
      noLabel: String(options.noLabel || 'No'),
      thanksLabel: String(options.thanksLabel || 'Thanks for your feedback.'),
      pageUrl: String(options.pageUrl || ''),
      searchPlaceholder: String(options.searchPlaceholder || 'Search'),
    };
  }

  function mountArticle(options) {
    var org = String(options.org || '').trim();
    var slug = normalizeSlug(options.slug);
    var target = options.target;
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    var chrome = resolveChromeOptions(options);

    if (!org || !slug) return Promise.reject(new Error('org and slug are required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);
    var articleUrl = contentBase + '/articles/' + encodeURIComponent(slug);
    var renderUrl = apiOrigin + '/api/public/v1/content/render-blocks';
    var sectionSlug = chrome.sectionSlug;
    var parentSlug = chrome.collectionSlug;
    var widgetOptions = {
      collection: sectionSlug || '',
      deep: true,
      limit: chrome.recentLimit,
      articlePrefix: chrome.articlePrefix,
      sectionContext: { slug: sectionSlug, parentSlug: parentSlug, collectionSlug: sectionSlug },
      popularTitle: chrome.popularTitle,
      recentTitle: chrome.recentTitle,
      popularEmptyLabel: chrome.popularEmptyLabel,
      recentEmptyLabel: chrome.recentEmptyLabel,
    };

    if (!mountEl.querySelector('.ld-help-skeleton')) {
      var commonForSkeleton = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
      mountEl.innerHTML = commonForSkeleton
        ? commonForSkeleton.buildMountSkeleton({ type: 'page', showRail: chrome.showSidebar })
        : '<div class="ld-help-site ld-help-skeleton" aria-busy="true" aria-label="Loading"></div>';
    }
    ensureStylesheet(apiOrigin);

    var collectionsPromise = chrome.enabled
      ? ensureHelpCommonScript(apiOrigin).then(function (common) {
        return common.fetchCollections(contentBase);
      })
      : Promise.resolve(null);

    return Promise.all([
      fetch(articleUrl).then(function (response) {
        return response.json().then(function (payload) {
          return { response: response, payload: payload };
        });
      }),
      collectionsPromise,
    ])
      .then(function (results) {
        var articleResult = results[0];
        var collectionsResult = results[1];

        if (!articleResult.response.ok || !articleResult.payload || !articleResult.payload.success) {
          throw new Error((articleResult.payload && articleResult.payload.message) || ('HTTP ' + articleResult.response.status));
        }

        var article = articleResult.payload.data;
        var common = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
        var resolvedSectionSlug = chrome.sectionSlug || normalizeSlug(article.collectionSlug);
        var resolvedParentSlug = chrome.collectionSlug;
        var collectionEntry = null;
        var sectionContext = { slug: resolvedSectionSlug, parentSlug: resolvedParentSlug, collectionSlug: resolvedSectionSlug };
        widgetOptions.collection = resolvedSectionSlug || normalizeSlug(article.collectionSlug) || '';
        widgetOptions.sectionContext = sectionContext;

        if (collectionsResult && common) {
          collectionEntry = common.findCollectionEntry(
            collectionsResult.index,
            resolvedSectionSlug,
            resolvedParentSlug || undefined,
          );
          if (collectionEntry) {
            sectionContext = collectionEntry.node;
            widgetOptions.sectionContext = sectionContext;
            widgetOptions.collection = sectionContext.slug || widgetOptions.collection;
          }
        }

        var articleLinkPrefix = common
          ? common.buildArticleBasePath(chrome.articlePrefix, sectionContext)
          : chrome.articlePrefix;

        return fetch(renderUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            blocks: article.blocks,
            bodyOnly: true,
            articleLinkPrefix: articleLinkPrefix,
          }),
        }).then(function (renderResponse) {
          return renderResponse.json().then(function (renderPayload) {
            return {
              article: article,
              renderPayload: renderPayload,
              renderResponse: renderResponse,
              collectionsResult: collectionsResult,
              collectionEntry: collectionEntry,
              sectionContext: sectionContext,
              common: common,
              sidebarWidgets: null,
            };
          });
        });
      })
      .then(function (result) {
        if (!result.renderResponse.ok || !result.renderPayload || !result.renderPayload.success) {
          throw new Error((result.renderPayload && result.renderPayload.message) || 'Failed to render article blocks');
        }

        var bodyHtml = absolutizeEmbedHtml(result.renderPayload.html, apiOrigin);
        if (chrome.showSidebar && result.common) {
          bodyHtml = result.common.injectHeadingIds(bodyHtml);
        }
        var articleHtml = buildArticleShell(
          result.article,
          bodyHtml,
          buildArticleFooter({
            enabled: chrome.showFeedbackFooter,
            helpfulLabel: chrome.helpfulLabel,
            shareLabel: chrome.shareLabel,
            yesLabel: chrome.yesLabel,
            noLabel: chrome.noLabel,
            thanksLabel: chrome.thanksLabel,
            pageUrl: chrome.pageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
            title: result.article.title || result.article.slug,
          }),
          apiOrigin,
        );
        var pageHtml = articleHtml;

        if (chrome.enabled && result.common) {
          var breadcrumbsHtml = '';
          if (chrome.showBreadcrumbs) {
            breadcrumbsHtml = result.common.buildBreadcrumbHtml({
              path: result.collectionEntry ? result.collectionEntry.path : [],
              homePrefix: chrome.homePrefix,
              categoryPrefix: chrome.categoryPrefix,
              sectionPrefix: chrome.sectionPrefix,
              homeLabel: chrome.homeLabel,
              breadcrumbLabel: chrome.breadcrumbLabel,
              currentLabel: result.article.title || result.article.slug,
            });
          }

          var topbarHtml = result.common.buildHelpTopbar({
            breadcrumbsHtml: breadcrumbsHtml,
            searchPlaceholder: chrome.searchPlaceholder,
            homePrefix: chrome.homePrefix,
          });

          var railHtml = '';

          return paintChromePage();

          function paintChromePage() {
            if (chrome.showSidebar) {
              var tocHtml = result.common.buildTocHtml(bodyHtml);
              railHtml = result.common.buildArticleRailHtml(tocHtml);
            }

            mountEl.innerHTML = buildChromeShell({
              common: result.common,
              topbarHtml: topbarHtml,
              navHtml: '',
              articleHtml: articleHtml,
              railHtml: railHtml,
            });

            var chromeRoot = mountEl.querySelector('[data-ld-help-article]');
            if (chromeRoot) {
              result.common.bindHelpSiteChrome(chromeRoot, {
                homePrefix: chrome.homePrefix,
                homeLabel: chrome.homeLabel,
                org: org,
                apiOrigin: apiOrigin,
                articlePrefix: chrome.articlePrefix,
                linkPrefix: chrome.articlePrefix,
                collectionIndex: result.collectionsResult ? result.collectionsResult.index : [],
              });
            }
            return finishMount(result.article, mountEl, apiOrigin, org, slug, chrome);
          }
        }

        mountEl.innerHTML = pageHtml;
        return finishMount(result.article, mountEl, apiOrigin, org, slug, chrome);
      })
      .catch(function (error) {
        mountEl.innerHTML = '<p class="ld-article__error">' + escapeHtml(error.message || 'Failed to load article') + '</p>';
        throw error;
      });
  }

  function finishMount(article, mountEl, apiOrigin, org, slug, chrome) {
    bindArticleFooter(mountEl, {
      enabled: chrome.showFeedbackFooter,
      apiOrigin: apiOrigin,
      org: org,
      slug: slug,
    });
    return ensureBlocksScript(apiOrigin).then(function (blocks) {
      blocks.init(mountEl);
      var common = window.LiteDeskHeadlessHelpCommon || window.ArivuHeadlessHelpCommon;
      var chromeRoot = mountEl.querySelector('[data-ld-help-article]');
      if (chromeRoot && common) {
        if (common.bindArticleTocRail) common.bindArticleTocRail(chromeRoot);
        if (common.bindTocSmoothScroll) common.bindTocSmoothScroll(chromeRoot);
      }
      return article;
    });
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-article.js"]');
  }

  window.LiteDeskHeadlessArticle = {
    mount: mountArticle,
  };
  window.ArivuHeadlessHelpArticle = window.LiteDeskHeadlessArticle;

  if (script) {
    var org = getAttr(script, 'data-org', '');
    var slug = getAttr(script, 'data-slug', '');
    var target = getAttr(script, 'data-target', '#ld-article');
    var apiOrigin = resolveApiOrigin(script);
    var linkPrefix = getAttr(script, 'data-link-prefix', '/help/');
    var showSidebar = getAttr(script, 'data-show-sidebar', 'false') === 'true';
    var showBreadcrumbs = getAttr(script, 'data-show-breadcrumbs', showSidebar ? 'true' : 'false') === 'true';
    if (org && slug) {
      mountArticle({
        org: org,
        slug: slug,
        target: target,
        apiOrigin: apiOrigin,
        showSidebar: showSidebar,
        showBreadcrumbs: showBreadcrumbs,
        showFeedbackFooter: getAttr(script, 'data-show-feedback-footer', 'true') !== 'false',
        linkPrefix: linkPrefix,
        homePrefix: getAttr(script, 'data-home-prefix', '/help/'),
        categoryPrefix: getAttr(script, 'data-category-prefix', linkPrefix),
        sectionPrefix: getAttr(script, 'data-section-prefix', linkPrefix),
        articlePrefix: getAttr(script, 'data-article-prefix', linkPrefix),
        collection: getAttr(script, 'data-collection', ''),
        section: getAttr(script, 'data-section', ''),
        helpfulLabel: getAttr(script, 'data-helpful-label', ''),
        shareLabel: getAttr(script, 'data-share-label', ''),
        yesLabel: getAttr(script, 'data-feedback-yes-label', ''),
        noLabel: getAttr(script, 'data-feedback-no-label', ''),
        thanksLabel: getAttr(script, 'data-feedback-thanks-label', ''),
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      }).catch(function (error) {
        console.error('[LiteDeskHeadlessArticle]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
