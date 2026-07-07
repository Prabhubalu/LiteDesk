;(function () {
  'use strict';

  var common = window.LiteDeskHeadlessHelpCommon;
  if (!common) {
    console.error('[LiteDeskHeadlessHelpSection] headless-help-common.js must be loaded first');
    return;
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

    if (!mountEl.querySelector('.ld-help-skeleton')) {
      mountEl.innerHTML = common.buildMountSkeleton({ type: 'page', showSidebar: true });
    }
    common.ensureStylesheet(apiOrigin);

    return common.fetchCollections(contentBase)
      .then(function (collectionsResult) {
        var entry = common.findCollectionEntry(collectionsResult.index, sectionSlug, parentSlug || undefined);
        if (!entry) {
          throw new Error(notFoundLabel);
        }

        var node = entry.node;
        var path = entry.path;
        var rootTree = collectionsResult.tree;
        var widgetOptions = {
          collection: node.slug,
          deep: true,
          limit: recentLimit,
          articlePrefix: articlePrefix,
          sectionContext: node,
          popularTitle: popularTitle,
          recentTitle: recentTitle,
          popularEmptyLabel: popularEmptyLabel,
          recentEmptyLabel: recentEmptyLabel,
        };

        var breadcrumbsHtml = common.buildBreadcrumbHtml({
          path: path,
          homePrefix: homePrefix,
          categoryPrefix: categoryPrefix,
          sectionPrefix: sectionPrefix,
          homeLabel: homeLabel,
          breadcrumbLabel: breadcrumbLabel,
        });

        var descText = String(node.description || '').trim();
        var headerHtml = (
          '<header class="ld-help-page__header">' +
            '<h1 class="ld-help-page__title">' + common.escapeHtml(node.name || node.slug) + '</h1>' +
            (descText
              ? '<p class="ld-help-page__desc">' + common.escapeHtml(descText) + '</p>'
              : '') +
          '</header>'
        );

        var sidebarTreeHtml = common.buildSidebarBlock(
          sectionsTitle,
          common.buildSectionTreeHtml(rootTree, {
            currentSlug: node.slug,
            currentParentSlug: node.parentSlug,
            openPath: path,
            linkPrefix: sectionPrefix,
          }),
        );

        return Promise.all([
          common.fetchArticles(contentBase, {
            collection: node.slug,
            limit: 50,
          }),
          common.fetchArticleSidebarWidgets(contentBase, widgetOptions),
        ]).then(function (results) {
          var articlesResult = results[0];
          var widgets = results[1];
          var articles = articlesResult.articles;
          var statusHtml = articles.length
            ? ''
            : '<div class="ld-help-page__status">' + common.escapeHtml(articlesEmptyLabel) + '</div>';
          var mainHtml = (
            '<ul class="ld-help-list__items">' +
              articles.map(function (article) {
                return common.buildArticleListItem(article, articlePrefix, node);
              }).join('') +
            '</ul>'
          );

          mountEl.innerHTML = common.buildSectionPageHtml({
            breadcrumbsHtml: breadcrumbsHtml,
            statusHtml: statusHtml,
            headerHtml: headerHtml,
            mainHtml: mainHtml,
            sidebarHtml: sidebarTreeHtml + common.buildArticleSidebarWidgetsHtml(widgets, widgetOptions),
          });

          var root = mountEl.querySelector('[data-ld-help-section]');
          if (root) {
            common.bindSectionTree(root);
          }

          return {
            section: node,
            articles: articles,
            organization: collectionsResult.organization,
          };
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
  window.ArivuHeadlessHelpSection = window.LiteDeskHeadlessHelpSection;

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
