;(function () {
  'use strict';

  var common = window.LiteDeskHeadlessHelpCommon;
  if (!common) {
    console.error('[LiteDeskHeadlessHelpCategory] headless-help-common.js must be loaded first');
    return;
  }

  function mountCategory(options) {
    var org = String(options.org || '').trim();
    var collectionSlug = common.normalizeSlug(options.collection);
    var target = options.target;
    var apiOrigin = String(options.apiOrigin || '').replace(/\/$/, '');
    var mountEl = typeof target === 'string' ? document.querySelector(target) : target;
    var linkPrefix = common.normalizeLinkPrefix(options.linkPrefix);
    var sectionPrefix = common.normalizeLinkPrefix(options.sectionPrefix || options.linkPrefix);
    var homePrefix = common.normalizeHomePrefix(options.homePrefix || '/help/');
    var articlePrefix = common.normalizeLinkPrefix(options.articlePrefix || options.linkPrefix);
    var homeLabel = String(options.homeLabel || 'Support');
    var topicsTitle = String(options.topicsTitle || 'Topics');
    var sectionsEmptyLabel = String(options.sectionsEmptyLabel || 'No sections in this category yet.');
    var notFoundLabel = String(options.notFoundLabel || 'Category not found.');
    var loadFailedLabel = String(options.loadFailedLabel || 'Failed to load category');
    var breadcrumbLabel = String(options.breadcrumbLabel || 'Breadcrumb');
    var searchPlaceholder = String(options.searchPlaceholder || 'Search');
    var showAllLabel = String(options.showAllLabel || 'Show all');
    var articlesLabel = String(options.articlesLabel || 'Articles');

    if (!org) return Promise.reject(new Error('org is required'));
    if (!collectionSlug) return Promise.reject(new Error('collection is required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);

    if (!mountEl.querySelector('.ld-help-skeleton')) {
      mountEl.innerHTML = common.buildMountSkeleton({ type: 'page' });
    }
    common.ensureStylesheet(apiOrigin);

    return common.fetchCollections(contentBase)
      .then(function (collectionsResult) {
        var entry = common.findCollectionEntry(collectionsResult.index, collectionSlug);
        if (!entry) {
          throw new Error(notFoundLabel);
        }

        var node = entry.node;
        var path = entry.path;
        var children = Array.isArray(node.children) ? node.children : [];
        var sectionContextBySlug = common.buildSectionContextMap(collectionsResult.tree);

        return common.fetchArticles(contentBase, {
          collection: node.slug,
          deep: true,
          limit: 100,
        }).then(function (articlesResult) {
          var articlesBySlug = common.groupArticlesByCollectionSlug(articlesResult.articles);
          var breadcrumbsHtml = common.buildBreadcrumbHtml({
            path: path,
            homePrefix: homePrefix,
            categoryPrefix: linkPrefix,
            sectionPrefix: sectionPrefix,
            homeLabel: homeLabel,
            breadcrumbLabel: breadcrumbLabel,
          });
          var topbarHtml = common.buildHelpTopbar({
            breadcrumbsHtml: breadcrumbsHtml,
            searchPlaceholder: searchPlaceholder,
            homePrefix: homePrefix,
          });
          var navHtml = common.buildTopicsNavHtml(collectionsResult.tree, common.buildTreeOptions({
            currentSlug: node.slug,
            currentParentSlug: node.parentSlug,
            categoryPrefix: linkPrefix,
            sectionPrefix: sectionPrefix,
            articlePrefix: articlePrefix,
            openPath: path,
            articlesBySlug: articlesBySlug,
            sectionContextBySlug: sectionContextBySlug,
            topicsTitle: topicsTitle,
          }));

          var mainHtml = common.buildCategoryHeroHtml(node);
          if (children.length) {
            mainHtml += (
              '<div class="ld-help-topic-grid">' +
                children.map(function (section) {
                  return common.buildSubcategoryCardHtml(section, articlesBySlug[common.normalizeSlug(section.slug)] || [], {
                    sectionPrefix: sectionPrefix,
                    articlePrefix: articlePrefix,
                    showAllLabel: showAllLabel,
                    articlesMoreLabel: 'articles',
                  });
                }).join('') +
              '</div>'
            );
          } else if (Number(node.articleCount) > 0) {
            mainHtml += common.buildSectionArticlesHtml(
              articlesBySlug[common.normalizeSlug(node.slug)] || articlesResult.articles,
              articlePrefix,
              node,
              { articlesLabel: articlesLabel },
            );
          } else {
            mainHtml += '<div class="ld-help-page__status">' + common.escapeHtml(sectionsEmptyLabel) + '</div>';
          }

          mountEl.innerHTML = common.buildCategoryPageHtml({
            topbarHtml: topbarHtml,
            navHtml: navHtml,
            mainHtml: mainHtml,
          });

          var root = mountEl.querySelector('[data-ld-help-category]');
          common.bindHelpSiteChrome(root, { homePrefix: homePrefix });

          return {
            collection: node,
            sections: children,
            articles: articlesResult.articles,
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
    script = document.querySelector('script[src*="/embed/headless-help-category.js"]');
  }

  window.LiteDeskHeadlessHelpCategory = {
    mount: mountCategory,
  };
  window.ArivuHeadlessHelpCategory = window.LiteDeskHeadlessHelpCategory;

  if (script) {
    var org = common.getAttr(script, 'data-org', '');
    var collection = common.getAttr(script, 'data-collection', '');
    var target = common.getAttr(script, 'data-target', '#ld-help-category');
    var apiOrigin = common.resolveApiOrigin(script, '/embed/headless-help-category.js');
    var linkPrefix = common.getAttr(script, 'data-link-prefix', '/help/');
    var sectionPrefix = common.getAttr(script, 'data-section-prefix', linkPrefix);
    var homePrefix = common.getAttr(script, 'data-home-prefix', '/help/');
    var articlePrefix = common.getAttr(script, 'data-article-prefix', linkPrefix);
    if (org && collection) {
      mountCategory({
        org: org,
        collection: collection,
        target: target,
        apiOrigin: apiOrigin,
        linkPrefix: linkPrefix,
        sectionPrefix: sectionPrefix,
        homePrefix: homePrefix,
        articlePrefix: articlePrefix,
      }).catch(function (error) {
        console.error('[LiteDeskHeadlessHelpCategory]', error);
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
