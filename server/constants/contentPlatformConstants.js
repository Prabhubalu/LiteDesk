'use strict';

const CONTENT_TEMPLATE_STATUSES = [
  'draft',
  'review',
  'approved',
  'published',
  'deprecated',
  'archived'
];

const CONTENT_OUTPUT_FORMATS = [
  'pdf',
  'html',
  'email',
  'png',
  'jpg',
  'docx'
];

const { CONTENT_PAPER_SIZES } = require('./contentPaperSizes');

const CONTENT_ORIENTATIONS = ['portrait', 'landscape'];

const CONTENT_RENDER_JOB_STATUSES = [
  'queued',
  'preparing',
  'rendering',
  'completed',
  'failed',
  'cancelled',
  'retrying'
];

const CONTENT_RENDER_JOB_PRIORITIES = ['low', 'normal', 'high', 'critical'];

const CONTENT_ASSET_TYPES = [
  'image',
  'logo',
  'icon',
  'watermark',
  'svg',
  'background',
  'signature'
];

const CONTENT_FONT_SOURCES = ['upload', 'google', 'system'];

const CONTENT_DEPENDENCY_TYPES = [
  'field',
  'module',
  'asset',
  'font',
  'component',
  'theme',
  'snippet',
  'variable'
];

const CONTENT_AUDIT_ACTIONS = [
  'template.created',
  'template.updated',
  'template.published',
  'template.archived',
  'template.deleted',
  'template.restored',
  'theme.created',
  'theme.updated',
  'theme.published',
  'asset.uploaded',
  'asset.deleted',
  'render.requested',
  'render.completed',
  'render.failed',
  'validation.passed',
  'validation.failed',
  'module_document.default_template_set',
  'module_document.default_template_cleared',
  'document.shadow_parity',
  'document.shadow_parity_error'
];

module.exports = {
  CONTENT_TEMPLATE_STATUSES,
  CONTENT_OUTPUT_FORMATS,
  CONTENT_PAPER_SIZES,
  CONTENT_ORIENTATIONS,
  CONTENT_RENDER_JOB_STATUSES,
  CONTENT_RENDER_JOB_PRIORITIES,
  CONTENT_ASSET_TYPES,
  CONTENT_FONT_SOURCES,
  CONTENT_DEPENDENCY_TYPES,
  CONTENT_AUDIT_ACTIONS
};
