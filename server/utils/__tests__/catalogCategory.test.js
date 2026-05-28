const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCategoryTree, buildCategoryPath } = require('../../services/catalogCategoryService');
const { validateAttributeValues } = require('../../services/catalogAttributeValidator');

test('buildCategoryPath joins segments', () => {
  assert.equal(buildCategoryPath(null, 'electronics'), '/electronics');
  assert.equal(buildCategoryPath('/electronics', 'phones'), '/electronics/phones');
});

test('buildCategoryTree nests children', () => {
  const tree = buildCategoryTree([
    { _id: '1', name: 'Root', parentId: null, sortOrder: 0 },
    { _id: '2', name: 'Child', parentId: '1', sortOrder: 0 }
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].name, 'Child');
});

test('validateAttributeValues enforces required select', () => {
  const result = validateAttributeValues([
    { key: 'color', label: 'Color', dataType: 'select', required: true, isActive: true, options: ['Red', 'Blue'] }
  ], {});

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].key, 'color');
});

test('validateAttributeValues sanitizes valid payload', () => {
  const result = validateAttributeValues([
    { key: 'wattage', label: 'Wattage', dataType: 'number', required: false, isActive: true }
  ], { wattage: '120' });

  assert.equal(result.ok, true);
  assert.equal(result.sanitized.wattage, 120);
});
