'use strict';

const CONTENT_PLATFORM_EVENT_TYPES = Object.freeze({
  TEMPLATE_CREATED: 'content.template.created',
  TEMPLATE_UPDATED: 'content.template.updated',
  TEMPLATE_PUBLISHED: 'content.template.published',
  TEMPLATE_ARCHIVED: 'content.template.archived',
  VERSION_RESTORED: 'content.template.version.restored',
  RENDER_REQUESTED: 'content.render.requested',
  RENDER_COMPLETED: 'content.render.completed',
  RENDER_FAILED: 'content.render.failed',
  VALIDATION_PASSED: 'content.validation.passed',
  VALIDATION_FAILED: 'content.validation.failed',
  ASSET_UPLOADED: 'content.asset.uploaded',
  THEME_PUBLISHED: 'content.theme.published',
  SNIPPET_UPDATED: 'content.snippet.updated',
  PACKAGE_IMPORTED: 'content.package.imported'
});

module.exports = {
  CONTENT_PLATFORM_EVENT_TYPES
};
