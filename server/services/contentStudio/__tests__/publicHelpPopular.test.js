'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('public help popular articles', () => {
  it('exports listPublicPopularHelpArticles', () => {
    const service = require('../publicContentService');
    assert.equal(typeof service.listPublicPopularHelpArticles, 'function');
  });
});
