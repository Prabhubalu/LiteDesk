const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  extractEmailAuthentication,
  evaluateEmailAuthentication,
  applyInboundEmailSecurity
} = require('../../platform/mailroom/security/emailAuthValidator');

describe('mailroom email auth validator', () => {
  it('parses Authentication-Results from raw MIME', () => {
    const raw = Buffer.from([
      'Authentication-Results: mx.example.com;',
      ' spf=pass smtp.mailfrom=customer@example.com;',
      ' dkim=pass header.d=example.com;',
      ' dmarc=pass action=none',
      '',
      'Subject: Test',
      '',
      'Body'
    ].join('\r\n'));

    const auth = extractEmailAuthentication(raw);
    assert.equal(auth.spf, 'pass');
    assert.equal(auth.dkim, 'pass');
    assert.equal(auth.dmarc, 'pass');
    assert.equal(auth.composite, 'pass');
  });

  it('quarantines when policy requires and auth fails', () => {
    const raw = Buffer.from([
      'Authentication-Results: mx.example.com; spf=fail dkim=fail dmarc=fail',
      '',
      'Hi',
      ''
    ].join('\r\n'));

    const secured = applyInboundEmailSecurity({
      rawMime: raw,
      normalizedMessage: { channel: 'email', metadata: {} },
      securityConfig: {
        email: { enabled: true, onFailure: 'quarantine' }
      }
    });

    assert.equal(secured.forceIngestAction, 'manual_review');
    assert.ok(secured.decision.reasons.length > 0);
  });

  it('rejects when policy is reject', () => {
    const raw = Buffer.from('Authentication-Results: mx; spf=fail\r\n\r\nx\r\n');
    assert.throws(() => {
      applyInboundEmailSecurity({
        rawMime: raw,
        normalizedMessage: { metadata: {} },
        securityConfig: {
          email: { enabled: true, requireSpf: true, onFailure: 'reject' }
        }
      });
    }, (err) => err.code === 'MAILROOM_EMAIL_AUTH_FAILED');
  });

  it('monitor mode allows failed auth', () => {
    const decision = evaluateEmailAuthentication(
      { spf: 'fail', dkim: 'unknown', dmarc: 'unknown', composite: 'fail' },
      { enabled: true, onFailure: 'monitor' }
    );
    assert.equal(decision.ok, true);
    assert.equal(decision.action, 'monitor');
  });
});
