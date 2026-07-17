'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shouldShowByCadence } = require('../announcementCadenceService');
const { matchesAudience } = require('../announcementTargetingService');

describe('announcementCadenceService', () => {
  it('hides once_per_user after a view', () => {
    const doc = { trigger: { type: 'once_per_user' }, userBehaviour: { dismissible: true } };
    assert.equal(shouldShowByCadence(doc, { viewCount: 1 }, new Date()), false);
    assert.equal(shouldShowByCadence(doc, null, new Date()), true);
  });

  it('hides daily announcements already shown today', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    const doc = { trigger: { type: 'daily' }, userBehaviour: {} };
    assert.equal(
      shouldShowByCadence(doc, { lastShownAt: '2026-07-15T08:00:00.000Z' }, now),
      false,
    );
    assert.equal(
      shouldShowByCadence(doc, { lastShownAt: '2026-07-14T08:00:00.000Z' }, now),
      true,
    );
  });

  it('reshows every_login after a newer lastLogin', () => {
    const doc = { trigger: { type: 'every_login' }, userBehaviour: { dismissible: true } };
    const lastLogin = new Date('2026-07-15T10:00:00.000Z');
    assert.equal(
      shouldShowByCadence(doc, { lastShownAt: '2026-07-15T09:00:00.000Z' }, new Date(), { lastLogin }),
      true,
    );
    assert.equal(
      shouldShowByCadence(doc, { lastShownAt: '2026-07-15T11:00:00.000Z' }, new Date(), { lastLogin }),
      false,
    );
  });

  it('keeps immediate announcements hidden after dismiss or acknowledge', () => {
    const doc = { trigger: { type: 'immediate' }, userBehaviour: { dismissible: true } };
    const now = new Date('2026-07-15T12:00:00.000Z');
    assert.equal(
      shouldShowByCadence(doc, { dismissedAt: '2026-07-15T11:00:00.000Z' }, now),
      false,
    );
    assert.equal(
      shouldShowByCadence(doc, { acknowledgedAt: '2026-07-15T11:00:00.000Z' }, now),
      false,
    );
  });

  it('keeps every_login dismissed within the same login session', () => {
    const doc = { trigger: { type: 'every_login' }, userBehaviour: { dismissible: true } };
    const lastLogin = new Date('2026-07-15T10:00:00.000Z');
    const now = new Date('2026-07-15T12:00:00.000Z');
    assert.equal(
      shouldShowByCadence(
        doc,
        {
          dismissedAt: '2026-07-15T11:00:00.000Z',
          lastShownAt: '2026-07-15T10:30:00.000Z',
        },
        now,
        { lastLogin },
      ),
      false,
    );
  });

  it('hides daily announcements for the rest of the day after dismiss', () => {
    const now = new Date('2026-07-15T18:00:00.000Z');
    const doc = { trigger: { type: 'daily' }, userBehaviour: { dismissible: true } };
    assert.equal(
      shouldShowByCadence(doc, { dismissedAt: '2026-07-15T09:00:00.000Z' }, now),
      false,
    );
    assert.equal(
      shouldShowByCadence(doc, { dismissedAt: '2026-07-14T09:00:00.000Z' }, now),
      true,
    );
  });
});

describe('announcementTargetingService', () => {
  it('matches everyone and role segments', () => {
    const ctx = {
      userId: 'u1',
      userType: 'INTERNAL',
      legacyRole: 'admin',
      roleIds: ['role-1'],
      teamIds: ['team-1'],
      isPortal: false,
      isMobile: false,
    };
    assert.equal(matchesAudience({ audience: { mode: 'everyone' } }, ctx), true);
    assert.equal(
      matchesAudience({
        audience: {
          mode: 'segment',
          segments: [{ type: 'role', values: ['role-1'] }],
        },
      }, ctx),
      true,
    );
    assert.equal(
      matchesAudience({
        audience: {
          mode: 'segment',
          segments: [{ type: 'role', values: ['role-2'] }],
        },
      }, ctx),
      false,
    );
  });
});
