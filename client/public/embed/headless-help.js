;(function () {
  'use strict';

  var SCRIPT_MARKER = '/embed/headless-help.js';

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
    var prefix = String(value || '/help/').trim();
    if (!prefix) return '/help/';
    if (prefix.indexOf('?') >= 0) return prefix;
    if (!prefix.endsWith('/')) prefix += '/';
    if (!prefix.startsWith('/')) prefix = '/' + prefix;
    return prefix;
  }

  function parseHelpPath(pathname, pathPrefix) {
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
      category: parts[0] || '',
      section: parts[1] || '',
      article: parts[2] || '',
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
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = origin + '/embed/headless-blocks.css';
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

  function ensureCommon(origin) {
    return loadScript(origin, '/embed/headless-help-common.js', 'data-arivu-headless-help-common-js');
  }

  function resolveMountFn(primary, fallback) {
    if (window[primary]) return window[primary];
    if (window[fallback]) return window[fallback];
    return null;
  }

  function showMountError(target, message) {
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    if (!mountEl) return;
    mountEl.innerHTML = '<p class="ld-article__error">' + String(message || 'Failed to load help center') + '</p>';
  }

  function mountHelp(config) {
    var origin = config.apiOrigin;
    var pathPrefix = normalizeLinkPrefix(config.pathPrefix);
    var parsed = parseHelpPath(config.pathname || window.location.pathname, pathPrefix);
    var target = config.target;
    var org = config.org;
    var linkPrefix = pathPrefix;

    if (!org) {
      showMountError(target, 'Missing data-org on the Arivu help embed script.');
      return Promise.reject(new Error('Missing org'));
    }
    if (!origin) {
      showMountError(target, 'Missing data-api-origin on the Arivu help embed script.');
      return Promise.reject(new Error('Missing api origin'));
    }

    loadStylesheet(origin);

    if (parsed.depth === 0) {
      return loadScript(origin, '/embed/headless-help-home.js', 'data-arivu-headless-help-home-js')
        .then(function () {
          var api = resolveMountFn('ArivuHeadlessHelpHome', 'LiteDeskHeadlessHelpHome');
          if (!api) throw new Error('Help home script failed to load');
          return api.mount({
            org: org,
            target: target,
            apiOrigin: origin,
            linkPrefix: linkPrefix,
            title: config.title || '',
            searchEnabled: config.searchEnabled !== false,
          });
        });
    }

    if (parsed.depth === 1) {
      return ensureCommon(origin)
        .then(function () {
          return loadScript(origin, '/embed/headless-help-category.js', 'data-arivu-headless-help-category-js');
        })
        .then(function () {
          var api = resolveMountFn('ArivuHeadlessHelpCategory', 'LiteDeskHeadlessHelpCategory');
          if (!api) throw new Error('Help category script failed to load');
          return api.mount({
            org: org,
            collection: parsed.category,
            target: target,
            apiOrigin: origin,
            linkPrefix: linkPrefix,
            sectionPrefix: linkPrefix,
            homePrefix: linkPrefix,
            articlePrefix: linkPrefix,
          });
        });
    }

    if (parsed.depth === 2) {
      return ensureCommon(origin)
        .then(function () {
          return loadScript(origin, '/embed/headless-help-section.js', 'data-arivu-headless-help-section-js');
        })
        .then(function () {
          var api = resolveMountFn('ArivuHeadlessHelpSection', 'LiteDeskHeadlessHelpSection');
          if (!api) throw new Error('Help section script failed to load');
          return api.mount({
            org: org,
            section: parsed.section,
            parent: parsed.category,
            target: target,
            apiOrigin: origin,
            linkPrefix: linkPrefix,
            categoryPrefix: linkPrefix,
            sectionPrefix: linkPrefix,
            homePrefix: linkPrefix,
            articlePrefix: linkPrefix,
          });
        });
    }

    return loadScript(origin, '/embed/headless-article.js', 'data-arivu-headless-article-js')
      .then(function () {
        var api = resolveMountFn('ArivuHeadlessHelpArticle', 'LiteDeskHeadlessArticle');
        if (!api) throw new Error('Help article script failed to load');
        return api.mount({
          org: org,
          slug: parsed.article,
          target: target,
          apiOrigin: origin,
          showSidebar: config.showSidebar !== false,
          showBreadcrumbs: config.showBreadcrumbs !== false,
          linkPrefix: linkPrefix,
          homePrefix: linkPrefix,
          categoryPrefix: linkPrefix,
          sectionPrefix: linkPrefix,
          articlePrefix: linkPrefix,
          collection: parsed.category,
          section: parsed.section,
        });
      });
  }

  function readConfig(script) {
    var pathPrefix = getAttr(script, 'data-path-prefix', getAttr(script, 'data-link-prefix', '/help/'));
    return {
      org: getAttr(script, 'data-org', ''),
      target: getAttr(script, 'data-target', '#arivu-help'),
      apiOrigin: resolveApiOrigin(script),
      pathPrefix: pathPrefix,
      title: getAttr(script, 'data-title', 'Help Center'),
      searchEnabled: getAttr(script, 'data-search', 'true') !== 'false',
      showSidebar: getAttr(script, 'data-show-sidebar', 'true') !== 'false',
      showBreadcrumbs: getAttr(script, 'data-show-breadcrumbs', 'true') !== 'false',
    };
  }

  function autoMount(script) {
    var config = readConfig(script);
    return mountHelp(config).catch(function (error) {
      console.error('[ArivuHeadlessHelp]', error);
      showMountError(
        config.target,
        error && error.message
          ? error.message
          : 'Could not load help center. Check Headless API, CORS, and published public articles.',
      );
      throw error;
    });
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-help.js"]');
  }

  var api = {
    mount: mountHelp,
    parseHelpPath: parseHelpPath,
    normalizeLinkPrefix: normalizeLinkPrefix,
  };

  window.ArivuHeadlessHelp = api;
  window.LiteDeskHeadlessHelp = api;

  if (script && getAttr(script, 'data-org', '')) {
    autoMount(script);
  }
})(typeof window !== 'undefined' ? window : globalThis);
