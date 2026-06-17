'use strict';

const {
  WEBFORM_FIELD_TYPES,
  normalizeWebformFieldType,
  isWebformPicklistFieldType,
  listWebformBuilderFieldTypes
} = require('./moduleFieldTypes');

const WEBFORM_STATUSES = ['Draft', 'Active', 'Archived'];

const WEBFORM_TARGET_MODULES = [
  { moduleKey: 'people', appKey: 'SALES', label: 'People' },
  { moduleKey: 'organizations', appKey: 'SALES', label: 'Organizations' },
  { moduleKey: 'cases', appKey: 'HELPDESK', label: 'Cases' },
  { moduleKey: 'deals', appKey: 'SALES', label: 'Deals' }
];

const WEBFORM_RECORD_ACTIONS = ['create', 'update', 'create_or_update'];

const WEBFORM_DEDUP_ACTIONS = ['reject', 'update', 'create_anyway'];

const WEBFORM_FIELD_WIDTHS = ['full', 'half'];

module.exports = {
  WEBFORM_STATUSES,
  WEBFORM_FIELD_TYPES,
  WEBFORM_TARGET_MODULES,
  WEBFORM_RECORD_ACTIONS,
  WEBFORM_DEDUP_ACTIONS,
  WEBFORM_FIELD_WIDTHS,
  normalizeWebformFieldType,
  isWebformPicklistFieldType,
  listWebformBuilderFieldTypes
};
