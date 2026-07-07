;(function () {
  'use strict';

  var common = window.LiteDeskHeadlessHelpCommon;
  if (!common) {
    console.error('[LiteDeskHeadlessHelpCategory] headless-help-common.js must be loaded first');
    return;
  }

  function buildCategoryShell() {
    return (
      '<div class="ld-help-page" data-ld-help-category>' +
        '<div class="ld-help-page__breadcrumbs"></div>' +
        '<div class="ld-help-page__layout">' +
          '<main class="ld-help-page__main">' +
            '<div class="ld-help-page__status" aria-live="polite"></div>' +
            '<header class="ld-help-page__header" hidden>' +
              '<h1 class="ld-help-page__title"></h1>' +
              '<p class="ld-help-page__desc"></p>' +
            '</header>' +
            '<ul class="ld-help-sections"></ul>' +
          '</main>' +
          '<aside class="ld-help-page__sidebar"></aside>' +
        '</div>' +
      '</div>'
    );
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

    mountEl.innerHTML = buildCategoryShell();
    common.ensureStylesheet(apiOrigin);

    var root = mountEl.querySelector('[data-ld-help-category]');
    var breadcrumbsEl = root.querySelector('.ld-help-page__breadcrumbs');
    var statusEl = root.querySelector('.ld-help-page__status');
    var headerEl = root.querySelector('.ld-help-page__header');
    var titleEl = root.querySelector('.ld-help-page__title');
    var descEl = root.querySelector('.ld-help-page__desc');
    var sectionsEl = root.querySelector('.ld-help-sections');
    var sidebarEl = root.querySelector('.ld-help-page__sidebar');

    statusEl.textContent = 'Loading…';

    return common.fetchCollections(contentBase)
      .then(function (collectionsResult) {
        var entry = common.findCollectionEntry(collectionsResult.index, collectionSlug);
        if (!entry) {
          throw new Error(notFoundLabel);
        }

        var node = entry.node;
        var path = entry.path;
        var children = Array.isArray(node.children) ? node.children : [];

        breadcrumbsEl.innerHTML = common.buildBreadcrumbHtml({
          path: path,
          homePrefix: homePrefix,
          categoryPrefix: linkPrefix,
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

        statusEl.textContent = '';
        if (!children.length) {
          if (Number(node.articleCount) > 0) {
            return common.fetchArticles(contentBase, {
              collection: node.slug,
              limit: 50,
            }).then(function (articlesResult) {
              if (!articlesResult.articles.length) {
                statusEl.textContent = sectionsEmptyLabel;
              }
              sectionsEl.className = 'ld-help-list__items';
              sectionsEl.innerHTML = articlesResult.articles.map(function (article) {
                return common.buildArticleListItem(article, articlePrefix, node);
              }).join('');

              return finishSidebar(articlesResult.articles);
            });
          }
          statusEl.textContent = sectionsEmptyLabel;
        }

        sectionsEl.innerHTML = children.map(function (section) {
          return common.buildSectionRow(section, sectionPrefix, labels);
        }).join('');

        return finishSidebar([]);

        function finishSidebar(articles) {
          sidebarEl.innerHTML = common.buildSidebarBlock(
            node.name || node.slug,
            node.description
              ? '<p class="ld-help-sidebar__text">' + common.escapeHtml(node.description) + '</p>'
              : '<p class="ld-help-sidebar__empty">' + common.escapeHtml(sectionsEmptyLabel) + '</p>',
          );

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
              collection: node,
              sections: children,
              articles: articles,
              organization: collectionsResult.organization,
            };
          });
        }
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
