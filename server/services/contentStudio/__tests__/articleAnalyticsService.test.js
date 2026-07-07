'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildVisitorHash,
  shapeArticleAnalytics,
} = require('../articleAnalyticsService');

describe('articleAnalyticsService', () => {
  it('buildVisitorHash is stable for the same visitor context', () => {
    const input = {
      organizationId: '507f1f77bcf86cd799439011',
      contentDocumentId: '507f1f77bcf86cd799439012',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };
    assert.equal(buildVisitorHash(input), buildVisitorHash(input));
  });

  it('shapeArticleAnalytics computes helpful rate and share totals', () => {
    const shaped = shapeArticleAnalytics({
      helpfulYes: 8,
      helpfulNo: 2,
      sharesFacebook: 3,
      sharesX: 1,
      sharesLinkedin: 2,
      lastFeedbackAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    assert.equal(shaped.helpfulTotal, 10);
    assert.equal(shaped.helpfulRate, 80);
    assert.equal(shaped.sharesTotal, 6);
  });

  it('shapeArticleAnalytics returns zeros for missing row', () => {
    const shaped = shapeArticleAnalytics(null);
    assert.equal(shaped.helpfulTotal, 0);
    assert.equal(shaped.helpfulRate, 0);
    assert.equal(shaped.sharesTotal, 0);
  });
});
