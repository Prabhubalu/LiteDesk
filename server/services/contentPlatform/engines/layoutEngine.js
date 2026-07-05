'use strict';

const {
  PAPER_DIMENSIONS_MM,
  resolvePageDimensions,
  resolvePageConfig,
  DEFAULT_PAGE_MARGINS_MM
} = require('../../../constants/contentPaperSizes');

const DEFAULT_MARGINS_MM = DEFAULT_PAGE_MARGINS_MM;

/**
 * @param {object} template
 */
function resolvePageConfigWithMargins(template) {
  const pageConfig = resolvePageConfig(template || {});
  const margins = {
    ...DEFAULT_MARGINS_MM,
    ...(template?.margins || {})
  };

  return {
    ...pageConfig,
    margins
  };
}

module.exports = {
  PAPER_DIMENSIONS_MM,
  DEFAULT_MARGINS_MM,
  resolvePageDimensions,
  resolvePageConfig: resolvePageConfigWithMargins
};
