'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const { resolveChromeExecutablePath } = require('../renderers/puppeteerPdfRenderer');

describe('puppeteerPdfRenderer', () => {
  it('resolves a Chrome executable when Chrome is installed', () => {
    const executablePath = resolveChromeExecutablePath();
    if (!executablePath) {
      return;
    }
    assert.equal(fs.existsSync(executablePath), true);
  });
});
