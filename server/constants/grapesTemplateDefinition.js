'use strict';

const GRAPES_ENGINE = 'grapesjs';
const GRAPES_DEFINITION_VERSION = 1;

/**
 * @param {unknown} jsonDefinition
 * @returns {boolean}
 */
function isGrapesTemplateDefinition(jsonDefinition) {
  return (
    jsonDefinition != null
    && typeof jsonDefinition === 'object'
    && !Array.isArray(jsonDefinition)
    && /** @type {{ engine?: string }} */ (jsonDefinition).engine === GRAPES_ENGINE
  );
}

function createBlankGrapesTemplateDefinition() {
  return {
    engine: GRAPES_ENGINE,
    version: GRAPES_DEFINITION_VERSION,
    project: null,
    html: '',
    css: ''
  };
}

module.exports = {
  GRAPES_ENGINE,
  GRAPES_DEFINITION_VERSION,
  isGrapesTemplateDefinition,
  createBlankGrapesTemplateDefinition
};
