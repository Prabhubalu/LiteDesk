;(function () {
  'use strict';

  var SCRIPT_MARKER = '/embed/headless-blog.js';

  function getAttr(el, name, fallback) {
    var value = el.getAttribute(name);
    return value == null || value === '' ? fallback : value;
  }

  function resolveApiOrigin(script) {
    var explicit = getAttr(script, 'data-api-origin', '');
    if (explicit) return explicit.replace(/\/$/, '');
    var src = script.src || '';
    var idx = src.indexOf(SCRIPT_MARKER);
    if (idx > 0) return src.slice(0, idx);
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    return '';
  }

  function normalizeLinkPrefix(value) {
    var prefix = String(value || '/blog/').trim();
    if (!prefix) return '/blog/';
    if (prefix.indexOf('?') >= 0) return prefix;
    if (!prefix.endsWith('/')) prefix += '/';
    if (!prefix.startsWith('/')) prefix = '/' + prefix;
    return prefix;
  }

  function normalizeSlug(value) {
    return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
  }

  /**
   * Blog path: /blog → list; /blog/{slug} → post.
   * Returns { slug, depth } where depth 0 is the archive.
   */
  function parseBlogPath(pathname, pathPrefix) {
    var normalizedPrefix = normalizeLinkPrefix(pathPrefix);
    var path = String(pathname || '');

    if (normalizedPrefix.indexOf('?') < 0) {
      var prefixNoSlash = normalizedPrefix.replace(/\/$/, '');
      if (path === prefixNoSlash || path === normalizedPrefix.replace(/\/$/, '')) {
        path = '';
      } else if (path.indexOf(normalizedPrefix) === 0) {
        path = path.slice(normalizedPrefix.length);
      } else if (path.indexOf(prefixNoSlash + '/') === 0) {
        path = path.slice(prefixNoSlash.length + 1);
      } else {
        path = '';
      }
    }

    var parts = path.split('/').filter(Boolean).map(function (segment) {
      try {
        return decodeURIComponent(segment);
      } catch (error) {
        return segment;
      }
    });

    return {
      slug: normalizeSlug(parts[0] || ''),
      depth: parts.length,
    };
  }

  function loadStylesheet(origin) {
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

  function loadScript(origin, path, attr) {
    var existing = document.querySelector('script[' + attr + ']');
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        return Promise.resolve();
      }
      return new Promise(function (resolve, reject) {
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('Failed to load ' + path)); });
      });
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = origin + path;
      script.setAttribute(attr, 'true');
      script.async = true;
      script.onload = function () {
        script.setAttribute('data-loaded', 'true');
        resolve();
      };
      script.onerror = function () {
        reject(new Error('Failed to load ' + path));
      };
      document.head.appendChild(script);
    });
  }

  function resolveMountFn(primary, fallback) {
    if (window[primary]) return window[primary];
    if (window[fallback]) return window[fallback];
    return null;
  }

  function showMountError(target, message) {
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    if (!mountEl) return;
    mountEl.innerHTML = '<p class="ld-article__error">' + String(message || 'Failed to load blog') + '</p>';
  }

  function mountList(config) {
    var origin = config.apiOrigin;
    return loadScript(origin, '/embed/headless-blog-list.js', 'data-arivu-headless-blog-list-js')
      .then(function () {
        var api = resolveMountFn('ArivuHeadlessBlogList', 'LiteDeskHeadlessBlogList');
        if (!api || !api.mount) throw new Error('Blog list script failed to load');
        return api.mount({
          org: config.org,
          target: config.target,
          apiOrigin: origin,
          linkPrefix: config.pathPrefix,
          searchEnabled: config.searchEnabled !== false,
          limit: config.limit || '10',
        });
      });
  }

  function mountPost(config, slug) {
    var origin = config.apiOrigin;
    var linkPrefix = config.pathPrefix;
    return loadScript(origin, '/embed/headless-blog-post.js', 'data-arivu-headless-blog-post-js')
      .then(function () {
        var api = resolveMountFn('ArivuHeadlessBlogPost', 'LiteDeskHeadlessBlogPost');
        if (!api || !api.mount) throw new Error('Blog post script failed to load');
        return api.mount({
          org: config.org,
          slug: slug,
          target: config.target,
          apiOrigin: origin,
          showSidebar: config.showSidebar === true,
          showBreadcrumbs: config.showBreadcrumbs === true,
          showFeedbackFooter: config.showFeedbackFooter === true,
          linkPrefix: linkPrefix,
          homePrefix: config.homePrefix || linkPrefix,
          categoryPrefix: config.categoryPrefix || linkPrefix,
          sectionPrefix: config.sectionPrefix || linkPrefix,
          articlePrefix: config.articlePrefix || linkPrefix,
          collection: config.collection || '',
          section: config.section || '',
          helpfulLabel: config.helpfulLabel || '',
          shareLabel: config.shareLabel || '',
          yesLabel: config.yesLabel || '',
          noLabel: config.noLabel || '',
          thanksLabel: config.thanksLabel || '',
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        });
      });
  }

  function mountBlog(config) {
    var origin = config.apiOrigin;
    var pathPrefix = normalizeLinkPrefix(config.pathPrefix);
    var target = config.target;
    var org = config.org;
    var explicitSlug = normalizeSlug(config.slug);

    if (!org) {
      showMountError(target, 'Missing data-org on the Arivu blog embed script.');
      return Promise.reject(new Error('Missing org'));
    }
    if (!origin) {
      showMountError(target, 'Missing data-api-origin on the Arivu blog embed script.');
      return Promise.reject(new Error('Missing api origin'));
    }

    loadStylesheet(origin);

    if (explicitSlug) {
      return mountPost(Object.assign({}, config, { pathPrefix: pathPrefix }), explicitSlug);
    }

    var parsed = parseBlogPath(
      config.pathname || (typeof window !== 'undefined' ? window.location.pathname : ''),
      pathPrefix,
    );

    if (parsed.depth === 0) {
      return mountList(Object.assign({}, config, { pathPrefix: pathPrefix }));
    }

    if (!parsed.slug) {
      showMountError(target, 'Missing blog post slug in the URL path.');
      return Promise.reject(new Error('Missing slug'));
    }

    return mountPost(Object.assign({}, config, { pathPrefix: pathPrefix }), parsed.slug);
  }

  function readConfig(script) {
    var pathPrefix = getAttr(script, 'data-path-prefix', getAttr(script, 'data-link-prefix', '/blog/'));
    return {
      org: getAttr(script, 'data-org', ''),
      target: getAttr(script, 'data-target', '#arivu-blog'),
      apiOrigin: resolveApiOrigin(script),
      pathPrefix: pathPrefix,
      slug: getAttr(script, 'data-slug', ''),
      searchEnabled: getAttr(script, 'data-search', 'true') !== 'false',
      limit: getAttr(script, 'data-limit', '10'),
      showSidebar: getAttr(script, 'data-show-sidebar', 'false') === 'true',
      showBreadcrumbs: getAttr(script, 'data-show-breadcrumbs', 'false') === 'true',
      showFeedbackFooter: getAttr(script, 'data-show-feedback-footer', 'false') === 'true',
      homePrefix: getAttr(script, 'data-home-prefix', pathPrefix),
      categoryPrefix: getAttr(script, 'data-category-prefix', pathPrefix),
      sectionPrefix: getAttr(script, 'data-section-prefix', pathPrefix),
      articlePrefix: getAttr(script, 'data-article-prefix', pathPrefix),
      collection: getAttr(script, 'data-collection', ''),
      section: getAttr(script, 'data-section', ''),
      helpfulLabel: getAttr(script, 'data-helpful-label', ''),
      shareLabel: getAttr(script, 'data-share-label', ''),
      yesLabel: getAttr(script, 'data-feedback-yes-label', ''),
      noLabel: getAttr(script, 'data-feedback-no-label', ''),
      thanksLabel: getAttr(script, 'data-feedback-thanks-label', ''),
    };
  }

  function autoMount(script) {
    var config = readConfig(script);
    loadStylesheet(config.apiOrigin);
    return mountBlog(config).catch(function (error) {
      console.error('[ArivuHeadlessBlog]', error);
      showMountError(
        config.target,
        error && error.message
          ? error.message
          : 'Could not load blog. Check Headless API, CORS, and published public posts.',
      );
      throw error;
    });
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-blog.js"]:not([src*="headless-blog-list"]):not([src*="headless-blog-post"])');
  }

  var api = {
    mount: mountBlog,
    parseBlogPath: parseBlogPath,
    normalizeLinkPrefix: normalizeLinkPrefix,
  };

  window.ArivuHeadlessBlog = api;
  window.LiteDeskHeadlessBlog = api;

  if (script && getAttr(script, 'data-org', '')) {
    autoMount(script);
  }
})(typeof window !== 'undefined' ? window : globalThis);
