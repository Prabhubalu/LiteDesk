'use strict';

const { readBool } = require('../astra/flags');

/** @returns {boolean} whether Astra Studio is enabled. Default true when Astra v2 is on. */
function isAstraStudioEnabled() {
  return readBool(process.env.ASTRA_STUDIO, true);
}

/** Public web research for competitor panels (Tavily / Brave / DuckDuckGo). */
function isWebResearchEnabled() {
  return readBool(process.env.ASTRA_WEB_RESEARCH, true);
}

module.exports = {
  isAstraStudioEnabled,
  isWebResearchEnabled,
};
