'use strict';

const {
  createBlankGrapesTemplateDefinition,
  GRAPES_ENGINE,
  GRAPES_DEFINITION_VERSION
} = require('../../constants/grapesTemplateDefinition');

/**
 * Build a GrapesJS template definition from sanitized email HTML.
 * Visual round-trip uses html/css fields; project is populated on first editor save.
 *
 * @param {{ html: string, css?: string }} params
 * @returns {import('../../constants/grapesTemplateDefinition').GrapesTemplateDefinition}
 */
function htmlToGrapesDefinition(params) {
  const html = String(params?.html || '').trim();
  const css = String(params?.css || '').trim();

  if (!html) {
    return createBlankGrapesTemplateDefinition();
  }

  return {
    engine: GRAPES_ENGINE,
    version: GRAPES_DEFINITION_VERSION,
    project: null,
    html,
    css
  };
}

module.exports = {
  htmlToGrapesDefinition
};
