const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeQuoteOrgSettings,
  getPortalCustomerAgreementText,
  assertCustomerAgreementAccepted,
  DEFAULT_CUSTOMER_AGREEMENT_TEXT
} = require('../../services/quoteOrgSettingsService');

test('normalizeQuoteOrgSettings defaults', () => {
  const s = normalizeQuoteOrgSettings({});
  assert.equal(s.requireApprovalBeforeSend, false);
  assert.equal(s.requireCustomerAgreement, false);
  assert.equal(s.customerAgreementText, '');
});

test('getPortalCustomerAgreementText returns null when disabled', () => {
  assert.equal(getPortalCustomerAgreementText({ requireCustomerAgreement: false }), null);
});

test('getPortalCustomerAgreementText uses default when text empty', () => {
  const text = getPortalCustomerAgreementText({ requireCustomerAgreement: true, customerAgreementText: '' });
  assert.equal(text, DEFAULT_CUSTOMER_AGREEMENT_TEXT);
});

test('getPortalCustomerAgreementText uses custom text', () => {
  const text = getPortalCustomerAgreementText({
    requireCustomerAgreement: true,
    customerAgreementText: 'Custom terms'
  });
  assert.equal(text, 'Custom terms');
});

test('assertCustomerAgreementAccepted throws when required and missing', () => {
  assert.throws(
    () => assertCustomerAgreementAccepted({ requireCustomerAgreement: true }, {}),
    (e) => e.code === 'TERMS_REQUIRED'
  );
});

test('assertCustomerAgreementAccepted passes when agreed', () => {
  assert.doesNotThrow(() =>
    assertCustomerAgreementAccepted({ requireCustomerAgreement: true }, { agreedToTerms: true })
  );
});

test('assertTypedSignatureProvided throws when required and missing', () => {
  const { assertTypedSignatureProvided } = require('../../services/quoteOrgSettingsService');
  assert.throws(
    () => assertTypedSignatureProvided({ requireTypedSignature: true }, {}),
    (e) => e.code === 'SIGNATURE_REQUIRED'
  );
});

test('assertTypedSignatureProvided returns text when valid', () => {
  const { assertTypedSignatureProvided } = require('../../services/quoteOrgSettingsService');
  const sig = assertTypedSignatureProvided(
    { requireTypedSignature: true },
    { signatureText: 'Jane Doe' }
  );
  assert.equal(sig, 'Jane Doe');
});
