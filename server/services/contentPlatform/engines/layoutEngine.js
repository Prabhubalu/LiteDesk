'use strict';

const {
  PAPER_DIMENSIONS_MM,
  resolvePageDimensions,
  resolvePageConfig
} = require('../../../constants/contentPaperSizes');

const DEFAULT_MARGINS_MM = Object.freeze({
  top: 12,
  right: 12,
  bottom: 12,
  left: 12
});

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
