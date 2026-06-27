'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolvePageDimensions,
  resolvePageConfig,
  normalizeTemplatePageSettings,
  clampCustomDimension
} = require('../contentPaperSizes');

describe('contentPaperSizes', () => {
  it('resolvePageDimensions swaps dimensions for landscape', () => {
    assert.deepEqual(resolvePageDimensions('A4', 'portrait'), { width: 210, height: 297 });
    assert.deepEqual(resolvePageDimensions('A4', 'landscape'), { width: 297, height: 210 });
  });

  it('resolvePageDimensions uses custom template dimensions', () => {
    assert.deepEqual(resolvePageDimensions('Custom', 'portrait', {
      customPageWidth: 100,
      customPageHeight: 200
    }), { width: 100, height: 200 });
  });

  it('resolvePageConfig includes custom dimensions when paper size is Custom', () => {
    const config = resolvePageConfig({
      paperSize: 'Custom',
      orientation: 'portrait',
      customPageWidth: 300,
      customPageHeight: 400
    });

    assert.equal(config.paperSize, 'Custom');
    assert.equal(config.customPageWidth, 300);
    assert.equal(config.customPageHeight, 400);
    assert.deepEqual(config.dimensions, { width: 300, height: 400 });
  });

  it('normalizeTemplatePageSettings clamps custom dimensions', () => {
    assert.deepEqual(normalizeTemplatePageSettings({
      paperSize: 'Custom',
      orientation: 'portrait',
      customPageWidth: 10,
      customPageHeight: 5000
    }), {
      paperSize: 'Custom',
      orientation: 'portrait',
      customPageWidth: clampCustomDimension(10, 210),
      customPageHeight: clampCustomDimension(5000, 297)
    });
  });
});
