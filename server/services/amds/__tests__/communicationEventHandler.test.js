'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveCommunicationId,
  statusFromEventType
} = require('../handlers/communicationEventHandler');
const { isMarketingModule } = require('../handlers/campaignStatsHandler');
const { metadataKey } = require('../../../utils/legacyBrandSlug');

describe('communicationEventHandler helpers', () => {
  it('resolveCommunicationId prefers arivu_communication_id', () => {
    assert.equal(
      resolveCommunicationId({
        metadata: {
          arivu_communication_id: 'comm-1',
          arivu_entity_id: 'comm-2'
        }
      }),
      'comm-1'
    );
    assert.equal(
      resolveCommunicationId({ metadata: { arivu_entity_id: 'comm-2' } }),
      'comm-2'
    );
    assert.equal(
      resolveCommunicationId({
        metadata: {
          arivu_module: 'marketing',
          arivu_entity_id: 'campaign-1'
        }
      }),
      null
    );
  });

  it('resolveCommunicationId accepts pre-rebrand communication_id metadata', () => {
    assert.equal(
      resolveCommunicationId({
        metadata: {
          [metadataKey('communication_id')]: 'legacy-comm-1'
        }
      }),
      'legacy-comm-1'
    );
  });

  it('statusFromEventType maps AMDS webhook types', () => {
    assert.equal(statusFromEventType('message.delivered'), 'delivered');
    assert.equal(statusFromEventType('message.failed'), 'failed');
    assert.equal(statusFromEventType('message.bounced'), 'bounced');
    assert.equal(statusFromEventType('message.complained'), 'complained');
    assert.equal(statusFromEventType('message.opened'), null);
    assert.equal(statusFromEventType('message.clicked'), null);
  });

  it('isMarketingModule identifies marketing module key', () => {
    assert.equal(isMarketingModule('marketing'), true);
    assert.equal(isMarketingModule('MARKETING'), true);
    assert.equal(isMarketingModule('helpdesk'), false);
  });
});
