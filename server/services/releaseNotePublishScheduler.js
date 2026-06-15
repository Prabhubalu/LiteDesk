'use strict';

const { publishDueScheduledReleases } = require('./releaseNoteService');

/**
 * Publish release notes that reached scheduledPublishAt.
 * @returns {Promise<{ published: number }>}
 */
async function tickReleaseNotePublish() {
  return publishDueScheduledReleases();
}

module.exports = {
  tickReleaseNotePublish
};
