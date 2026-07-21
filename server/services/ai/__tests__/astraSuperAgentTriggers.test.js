'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAgentMentions,
} = require('../astraSuperAgentTriggers');

describe('astraSuperAgentTriggers', () => {
  const prev = process.env.ASTRA_SUPER_AGENTS_V1;

  after(() => {
    if (prev === undefined) delete process.env.ASTRA_SUPER_AGENTS_V1;
    else process.env.ASTRA_SUPER_AGENTS_V1 = prev;
  });

  it('parses @[Name](agent:id) chips from comments', () => {
    const hits = parseAgentMentions(
      'Hey @[Pipeline Coach](agent:507f1f77bcf86cd799439011) please review',
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, 'Pipeline Coach');
    assert.equal(hits[0].agentId, '507f1f77bcf86cd799439011');
    assert.deepEqual(parseAgentMentions('no agents here @[Bob](user:507f1f77bcf86cd799439011)'), []);
  });
});
