'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPipelineSettings,
  mergePresetFields,
  resolveEnabledModulesFromTemplate,
  resolveEnabledAppsForTemplate,
  buildVerticalProvisionPreview,
  PRIMARY_MODULE_TO_LEGACY,
} = require('../verticalPresetService');

test('PRIMARY_MODULE_TO_LEGACY maps people to contacts', () => {
  assert.equal(PRIMARY_MODULE_TO_LEGACY.people, 'contacts');
});

test('resolveEnabledModulesFromTemplate includes primary modules', () => {
  const modules = resolveEnabledModulesFromTemplate('retail');
  assert.ok(modules.includes('contacts'));
  assert.ok(modules.includes('items'));
});

test('resolveEnabledAppsForTemplate includes optional apps when requested', () => {
  const base = resolveEnabledAppsForTemplate('retail');
  const withOptional = resolveEnabledAppsForTemplate('retail', { includeOptional: true });
  assert.deepEqual(base, ['SALES']);
  assert.ok(withOptional.includes('INVENTORY'));
});

test('resolveEnabledAppsForTemplate enables AUDIT for audit vertical', () => {
  const apps = resolveEnabledAppsForTemplate('audit');
  assert.ok(apps.includes('AUDIT'));
  assert.ok(apps.includes('SALES'));
});

test('buildVerticalProvisionPreview returns template metadata', () => {
  const preview = buildVerticalProvisionPreview('Healthcare Clinics');
  assert.equal(preview.templateKey, 'healthcare');
  assert.equal(preview.primaryAppKey, 'SALES');
  assert.ok(preview.moduleLabels.people);
  assert.ok(preview.enabledModules.includes('contacts'));
});

test('buildPipelineSettings creates won and lost stages', () => {
  const pipelines = buildPipelineSettings('Test Pipeline', [
    { name: 'Open', probability: 20 },
    { name: 'Won', status: 'won', probability: 100 },
    { name: 'Lost', status: 'lost', probability: 0 },
  ]);
  assert.equal(pipelines.length, 1);
  assert.equal(pipelines[0].stages.length, 3);
  assert.equal(pipelines[0].stages[1].status, 'won');
  assert.equal(pipelines[0].stages[2].status, 'lost');
});

test('mergePresetFields is idempotent for duplicate keys', () => {
  const existing = [{ key: 'email', label: 'Email', dataType: 'Email' }];
  const merged = mergePresetFields(existing, [
    { key: 'email', label: 'Duplicate', dataType: 'Email' },
    { key: 'patientId', label: 'Patient ID', dataType: 'Text' },
  ]);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((field) => field.key === 'patientId'));
});
