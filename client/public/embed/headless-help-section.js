;(function () {
  'use strict';

  var common = window.ArivuLegacyBrand.headlessHelpCommon();
  if (!common) {
    console.error('[ArivuHeadlessHelpSection] headless-help-common.js must be loaded first');
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
    var homeLabel = String(options.homeLabel || 'Support');
    var topicsTitle = String(options.topicsTitle || 'Topics');
    var articlesEmptyLabel = String(options.articlesEmptyLabel || 'No articles in this section yet.');
    var notFoundLabel = String(options.notFoundLabel || 'Section not found.');
    var loadFailedLabel = String(options.loadFailedLabel || 'Failed to load section');
    var breadcrumbLabel = String(options.breadcrumbLabel || 'Breadcrumb');
    var searchPlaceholder = String(options.searchPlaceholder || 'Search');
    var articlesLabel = String(options.articlesLabel || 'Articles');

    if (!org) return Promise.reject(new Error('org is required'));
    if (!sectionSlug) return Promise.reject(new Error('section is required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);

    if (!mountEl.querySelector('.ld-help-skeleton')) {
      mountEl.innerHTML = common.buildMountSkeleton({ type: 'page' });
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
        var sectionContextBySlug = common.buildSectionContextMap(rootTree);
        var openCategorySlug = path.length ? common.normalizeSlug(path[0].slug) : '';

        return Promise.all([
          common.fetchArticles(contentBase, {
            collection: node.slug,
            limit: 50,
          }),
          openCategorySlug
            ? common.fetchArticles(contentBase, {
              collection: openCategorySlug,
              deep: true,
              limit: 100,
            })
            : Promise.resolve({ articles: [] }),
        ]).then(function (results) {
          var articles = results[0].articles;
          var scopedArticles = openCategorySlug
            ? common.groupArticlesByCollectionSlug(results[1].articles)
            : common.groupArticlesByCollectionSlug(articles);
          var breadcrumbsHtml = common.buildBreadcrumbHtml({
            path: path,
            homePrefix: homePrefix,
            categoryPrefix: categoryPrefix,
            sectionPrefix: sectionPrefix,
            homeLabel: homeLabel,
            breadcrumbLabel: breadcrumbLabel,
          });
          var topbarHtml = common.buildHelpTopbar({
            breadcrumbsHtml: breadcrumbsHtml,
          });
          var railHtml = common.buildHelpRailHtml({
            searchPlaceholder: searchPlaceholder,
            homePrefix: homePrefix,
          });
          var navHtml = common.buildTopicsNavHtml(rootTree, common.buildTreeOptions({
            currentSlug: node.slug,
            currentParentSlug: node.parentSlug,
            categoryPrefix: categoryPrefix,
            sectionPrefix: sectionPrefix,
            articlePrefix: articlePrefix,
            openPath: path,
            articlesBySlug: scopedArticles,
            sectionContextBySlug: sectionContextBySlug,
            topicsTitle: topicsTitle,
          }));

          var mainHtml = common.buildCategoryHeroHtml(node);
          if (articles.length) {
            mainHtml += common.buildSectionArticlesHtml(articles, articlePrefix, node, { articlesLabel: articlesLabel });
          } else {
            mainHtml += '<div class="ld-help-page__status">' + common.escapeHtml(articlesEmptyLabel) + '</div>';
          }

          mountEl.innerHTML = common.buildSectionPageHtml({
            topbarHtml: topbarHtml,
            navHtml: navHtml,
            mainHtml: mainHtml,
            railHtml: railHtml,
          });

          var root = mountEl.querySelector('[data-ld-help-section]');
          common.bindHelpSiteChrome(root, {
            homePrefix: homePrefix,
            homeLabel: homeLabel,
            org: org,
            apiOrigin: apiOrigin,
            articlePrefix: articlePrefix,
            linkPrefix: linkPrefix,
            collectionIndex: collectionsResult.index,
          });

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

  window.ArivuHeadlessHelpSection = {
    mount: mountSection,
  };
  window.ArivuLegacyBrand.publishWindowGlobal('HeadlessHelpSection', window.ArivuHeadlessHelpSection);

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
        console.error('[ArivuHeadlessHelpSection]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
