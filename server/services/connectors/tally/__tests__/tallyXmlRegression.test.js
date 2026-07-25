'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const FIXTURE_PATH = path.join(__dirname, '..', '__fixtures__', 'salesVoucher.xml');

describe('tally XML regression fixtures', () => {
  it('salesVoucher.xml contains ENVELOPE and VOUCHER tags', () => {
    const xml = fs.readFileSync(FIXTURE_PATH, 'utf8');
    assert.ok(xml.includes('<ENVELOPE>'), 'fixture must include <ENVELOPE>');
    assert.ok(xml.includes('</ENVELOPE>'), 'fixture must include </ENVELOPE>');
    assert.ok(/<VOUCHER[\s>]/.test(xml), 'fixture must include <VOUCHER> tag');
    assert.ok(xml.includes('</VOUCHER>'), 'fixture must include </VOUCHER>');
    assert.ok(xml.includes('<REFERENCE>'), 'fixture should carry Arivu REFERENCE policy field');
  });
});
