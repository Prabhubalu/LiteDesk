'use strict';

const {
  CONTENT_TEMPLATE_STATUSES,
  CONTENT_OUTPUT_FORMATS,
  CONTENT_PAPER_SIZES,
  CONTENT_ORIENTATIONS
} = require('./contentPlatformConstants');

const INITIAL_TEMPLATE_MODULE_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'purpose', label: 'Purpose', type: 'text' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'moduleScope', label: 'Module Scope', type: 'text' },
  { key: 'status', label: 'Status', type: 'select', options: CONTENT_TEMPLATE_STATUSES, system: true },
  { key: 'latestVersion', label: 'Latest Version', type: 'number', system: true },
  { key: 'latestPublishedVersion', label: 'Published Version', type: 'number', system: true },
  { key: 'outputFormat', label: 'Output Format', type: 'select', options: CONTENT_OUTPUT_FORMATS },
  { key: 'paperSize', label: 'Paper Size', type: 'select', options: CONTENT_PAPER_SIZES },
  { key: 'orientation', label: 'Orientation', type: 'select', options: CONTENT_ORIENTATIONS },
  { key: 'defaultThemeId', label: 'Default Theme', type: 'lookup', lookupModule: 'content_themes' },
  { key: 'assignedTo', label: 'Assigned To', type: 'lookup', lookupModule: 'users' },
  { key: 'tags', label: 'Tags', type: 'multi-select' },
  { key: 'isDefault', label: 'Default Template', type: 'checkbox', system: true }
];

const INITIAL_TEMPLATE_QUICK_CREATE = [
  'name',
  'purpose',
  'category',
  'moduleScope',
  'outputFormat'
];

function applyTemplateModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => ({
    visible: true,
    editable: !field.system,
    ...field
  }));
}

function createBlankTemplateDefinition() {
  return {
    id: 'root',
    type: 'Page',
    name: 'Page 1',
    layout: { x: 0, y: 0, width: '100%', height: 'auto' },
    style: {},
    bindings: {},
    visibility: {},
    children: []
  };
}

module.exports = {
  CONTENT_TEMPLATE_STATUSES,
  CONTENT_OUTPUT_FORMATS,
  CONTENT_PAPER_SIZES,
  CONTENT_ORIENTATIONS,
  INITIAL_TEMPLATE_MODULE_FIELDS,
  INITIAL_TEMPLATE_QUICK_CREATE,
  applyTemplateModuleFieldDefaults,
  createBlankTemplateDefinition
};
