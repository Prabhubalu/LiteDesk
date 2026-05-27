const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { shouldRouteParserInboundToHelpdesk } = require('../../services/inboundParserMessageService');

describe('parser inbound helpdesk routing', () => {
  const originalEnv = process.env.PARSER_INBOUND_WORKSPACE_ONLY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PARSER_INBOUND_WORKSPACE_ONLY;
    } else {
      process.env.PARSER_INBOUND_WORKSPACE_ONLY = originalEnv;
    }
  });

  it('routes parser inbound to helpdesk by default', () => {
    assert.equal(shouldRouteParserInboundToHelpdesk({ kind: 'group' }), true);
    assert.equal(shouldRouteParserInboundToHelpdesk({ kind: 'personal' }), true);
  });

  it('keeps personal mailboxes workspace-only when PARSER_INBOUND_WORKSPACE_ONLY=true', () => {
    process.env.PARSER_INBOUND_WORKSPACE_ONLY = 'true';
    assert.equal(shouldRouteParserInboundToHelpdesk({ kind: 'personal' }), false);
    assert.equal(shouldRouteParserInboundToHelpdesk({ kind: 'group' }), true);
  });
});
