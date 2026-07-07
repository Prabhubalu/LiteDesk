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
    var recentLimit = Math.min(Math.max(Number(options.recentLimit) || 5, 1), 25);
    var homeLabel = String(options.homeLabel || 'Home');
    var popularTitle = String(options.popularTitle || 'Popular articles');
    var recentTitle = String(options.recentTitle || 'Recent articles');
    var popularEmptyLabel = String(options.popularEmptyLabel || 'No popular articles yet.');
    var recentEmptyLabel = String(options.recentEmptyLabel || 'No recent articles.');
    var sectionsEmptyLabel = String(options.sectionsEmptyLabel || 'No sections in this category yet.');
    var notFoundLabel = String(options.notFoundLabel || 'Category not found.');
    var loadFailedLabel = String(options.loadFailedLabel || 'Failed to load category');
    var breadcrumbLabel = String(options.breadcrumbLabel || 'Breadcrumb');
    var labels = {
      articleSingular: String(options.labelArticle || 'Article'),
      articlePlural: String(options.labelArticles || 'Articles'),
      sectionSingular: String(options.labelSection || 'Section'),
      sectionPlural: String(options.labelSections || 'Sections'),
    };

    if (!org) return Promise.reject(new Error('org is required'));
    if (!collectionSlug) return Promise.reject(new Error('collection is required'));
    if (!mountEl) return Promise.reject(new Error('target element not found'));
    if (!apiOrigin) return Promise.reject(new Error('api origin could not be resolved'));

    var contentBase = apiOrigin + '/api/public/v1/content/' + encodeURIComponent(org);

    if (!mountEl.querySelector('.ld-help-skeleton')) {
      mountEl.innerHTML = common.buildMountSkeleton({ type: 'page', showSidebar: true });
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
          categoryPrefix: linkPrefix,
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

        var sidebarHtml = common.buildSidebarBlock(
          node.name || node.slug,
          descText
            ? '<p class="ld-help-sidebar__text">' + common.escapeHtml(descText) + '</p>'
            : '<p class="ld-help-sidebar__empty">' + common.escapeHtml(sectionsEmptyLabel) + '</p>',
        );

        function paintPage(statusHtml, mainHtml, widgets) {
          mountEl.innerHTML = common.buildCategoryPageHtml({
            breadcrumbsHtml: breadcrumbsHtml,
            statusHtml: statusHtml,
            headerHtml: headerHtml,
            mainHtml: mainHtml,
            sidebarHtml: sidebarHtml + common.buildArticleSidebarWidgetsHtml(widgets, widgetOptions),
          });
        }

        if (!children.length) {
          if (Number(node.articleCount) > 0) {
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
                : '<div class="ld-help-page__status">' + common.escapeHtml(sectionsEmptyLabel) + '</div>';
              var mainHtml = (
                '<ul class="ld-help-list__items">' +
                  articles.map(function (article) {
                    return common.buildArticleListItem(article, articlePrefix, node);
                  }).join('') +
                '</ul>'
              );
              paintPage(statusHtml, mainHtml, widgets);
              return {
                collection: node,
                sections: children,
                articles: articles,
                organization: collectionsResult.organization,
              };
            });
          }

          return common.fetchArticleSidebarWidgets(contentBase, widgetOptions).then(function (widgets) {
            paintPage(
              '<div class="ld-help-page__status">' + common.escapeHtml(sectionsEmptyLabel) + '</div>',
              '<ul class="ld-help-sections"></ul>',
              widgets,
            );
            return {
              collection: node,
              sections: children,
              articles: [],
              organization: collectionsResult.organization,
            };
          });
        }

        return common.fetchArticleSidebarWidgets(contentBase, widgetOptions).then(function (widgets) {
          var mainHtml = (
            '<ul class="ld-help-sections">' +
              children.map(function (section) {
                return common.buildSectionRow(section, sectionPrefix, labels);
              }).join('') +
            '</ul>'
          );
          paintPage('', mainHtml, widgets);
          return {
            collection: node,
            sections: children,
            articles: [],
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
