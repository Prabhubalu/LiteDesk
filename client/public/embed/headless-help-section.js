;(function () {
  'use strict';

  var common = window.LiteDeskHeadlessHelpCommon;
  if (!common) {
    console.error('[LiteDeskHeadlessHelpSection] headless-help-common.js must be loaded first');
    return;
  }

  function buildSectionShell() {
    return (
      '<div class="ld-help-page" data-ld-help-section>' +
        '<div class="ld-help-page__breadcrumbs"></div>' +
        '<div class="ld-help-page__layout">' +
          '<main class="ld-help-page__main">' +
            '<div class="ld-help-page__status" aria-live="polite"></div>' +
            '<header class="ld-help-page__header" hidden>' +
              '<h1 class="ld-help-page__title"></h1>' +
              '<p class="ld-help-page__desc"></p>' +
            '</header>' +
            '<ul class="ld-help-list__items"></ul>' +
          '</main>' +
          '<aside class="ld-help-page__sidebar"></aside>' +
        '</div>' +
      '</div>'
    );
  }

  function mountSection(options) {
    var org = String(options.org || '').trim();
    var sectionSlug = common.normalizeSlug(options.section);
    var parentSlug = common.normalizeSlug(options.parent || '');
    var target = options.target;
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    var linkPrefix = common.normalizeLinkPrefix(options.linkPrefix);
    var categoryPrefix = common.normalizeLinkPrefix(options.categoryPrefix || options.linkPrefix);
    var sectionPrefix = common.normalizeLinkPrefix(options.sectionPrefix || options.linkPrefix);
    var homePrefix = common.normalizeHomePrefix(options.homePrefix || '/help/');
    var articlePrefix = common.normalizeLinkPrefix(options.articlePrefix || options.linkPrefix);
    var recentLimit = Math.min(Math.max(Number(options.recentLimit) || 5, 1), 25);
    var homeLabel = String(options.homeLabel || 'Home');
    var popularTitle = String(options.popularTitle || 'Popular articles');
    var recentTitle = String(options.recentTitle || 'Recent articles');
    var sectionsTitle = String(options.sectionsTitle || 'Sections');
    var popularEmptyLabel = String(options.popularEmptyLabel || 'No popular articles yet.');
    var recentEmptyLabel = String(options.recentEmptyLabel || 'No recent articles.');
    var articlesEmptyLabel = String(options.articlesEmptyLabel || 'No articles in this section yet.');
    var notFoundLabel = String(options.notFoundLabel || 'Section not found.');
    var loadFailedLabel = String(options.loadFailedLabel || 'Failed to load section');
    var breadcrumbLabel = String(options.breadcrumbLabel || 'Breadcrumb');

    if (!org) return Promise.reject(new Error('org is required'));
    if (!sectionSlug) return Promise.reject(new Error('section is required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);

    mountEl.innerHTML = buildSectionShell();
    common.ensureStylesheet(apiOrigin);

    var root = mountEl.querySelector('[data-ld-help-section]');
    var breadcrumbsEl = root.querySelector('.ld-help-page__breadcrumbs');
    var statusEl = root.querySelector('.ld-help-page__status');
    var headerEl = root.querySelector('.ld-help-page__header');
    var titleEl = root.querySelector('.ld-help-page__title');
    var descEl = root.querySelector('.ld-help-page__desc');
    var articlesEl = root.querySelector('.ld-help-list__items');
    var sidebarEl = root.querySelector('.ld-help-page__sidebar');

    statusEl.textContent = 'Loading…';

    return common.fetchCollections(contentBase)
      .then(function (collectionsResult) {
        var entry = common.findCollectionEntry(collectionsResult.index, sectionSlug, parentSlug || undefined);
        if (!entry) {
          throw new Error(notFoundLabel);
        }

        var node = entry.node;
        var path = entry.path;
        var rootTree = collectionsResult.tree;

        breadcrumbsEl.innerHTML = common.buildBreadcrumbHtml({
          path: path,
          homePrefix: homePrefix,
          categoryPrefix: categoryPrefix,
          sectionPrefix: sectionPrefix,
          homeLabel: homeLabel,
          breadcrumbLabel: breadcrumbLabel,
        });

        titleEl.textContent = node.name || node.slug;
        if (node.description) {
          descEl.textContent = node.description;
          descEl.hidden = false;
        } else {
          descEl.hidden = true;
        }
        headerEl.hidden = false;

        sidebarEl.innerHTML = common.buildSidebarBlock(
          sectionsTitle,
          common.buildSectionTreeHtml(rootTree, {
            currentSlug: node.slug,
            currentParentSlug: node.parentSlug,
            openPath: path,
            linkPrefix: sectionPrefix,
          }),
        );
        common.bindSectionTree(sidebarEl);

        return common.fetchArticles(contentBase, {
          collection: node.slug,
          limit: 50,
        }).then(function (articlesResult) {
          statusEl.textContent = '';
          var articles = articlesResult.articles;
          if (!articles.length) {
            statusEl.textContent = articlesEmptyLabel;
          }
          articlesEl.innerHTML = articles.map(function (article) {
            return common.buildArticleListItem(article, articlePrefix, node);
          }).join('');

          return common.appendArticleSidebarWidgets(sidebarEl, contentBase, {
            collection: node.slug,
            deep: true,
            limit: recentLimit,
            articlePrefix: articlePrefix,
            sectionContext: node,
            popularTitle: popularTitle,
            recentTitle: recentTitle,
            popularEmptyLabel: popularEmptyLabel,
            recentEmptyLabel: recentEmptyLabel,
          }).then(function () {
            return {
              section: node,
              articles: articles,
              organization: collectionsResult.organization,
            };
          });
        });
      })
      .catch(function (error) {
        mountEl.innerHTML = '<p class="ld-article__error">' + common.escapeHtml(error.message || loadFailedLabel) + '</p>';
        throw error;
      });
  }

  var script = document.currentScript;
  if (!script) {
    script = document.querySelector('script[src*="/embed/headless-help-section.js"]');
  }

  window.LiteDeskHeadlessHelpSection = {
    mount: mountSection,
  };

  if (script) {
    var org = common.getAttr(script, 'data-org', '');
    var section = common.getAttr(script, 'data-section', '');
    var parent = common.getAttr(script, 'data-parent', '');
    var target = common.getAttr(script, 'data-target', '#ld-help-section');
    var apiOrigin = common.resolveApiOrigin(script, '/embed/headless-help-section.js');
    var linkPrefix = common.getAttr(script, 'data-link-prefix', '/help/');
    var categoryPrefix = common.getAttr(script, 'data-category-prefix', linkPrefix);
    var sectionPrefix = common.getAttr(script, 'data-section-prefix', linkPrefix);
    var homePrefix = common.getAttr(script, 'data-home-prefix', '/help/');
    var articlePrefix = common.getAttr(script, 'data-article-prefix', linkPrefix);
    if (org && section) {
      mountSection({
        org: org,
        section: section,
        parent: parent,
        target: target,
        apiOrigin: apiOrigin,
        linkPrefix: linkPrefix,
        categoryPrefix: categoryPrefix,
        sectionPrefix: sectionPrefix,
        homePrefix: homePrefix,
        articlePrefix: articlePrefix,
      }).catch(function (error) {
        console.error('[LiteDeskHeadlessHelpSection]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
