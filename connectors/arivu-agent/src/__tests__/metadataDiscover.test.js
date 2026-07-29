'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseCollectionFieldsFromXml } = require('../metadataDiscover');

describe('parseCollectionFieldsFromXml', () => {
  it('extracts field tags from live sample XML', () => {
    const xml = `<?xml version="1.0"?>
<ENVELOPE><BODY><DATA><COLLECTION>
  <LEDGER>
    <NAME>Acme</NAME>
    <PARENT>Sundry Debtors</PARENT>
    <GUID>g1</GUID>
    <GSTIN>27AABCU9603R1ZM</GSTIN>
    <EMAIL>a@b.com</EMAIL>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales</LEDGERNAME>
      <AMOUNT>100</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </LEDGER>
</COLLECTION></DATA></BODY></ENVELOPE>`;
    const fields = parseCollectionFieldsFromXml(xml);
    assert.ok(fields.includes('NAME'));
    assert.ok(fields.includes('GUID'));
    assert.ok(fields.includes('GSTIN'));
    assert.ok(fields.includes('PARENT'));
    assert.ok(fields.includes('EMAIL'));
    assert.ok(fields.includes('ALLLEDGERENTRIES.*'));
    assert.ok(fields.includes('ALLLEDGERENTRIES.*.LEDGERNAME'));
    assert.ok(fields.includes('ALLLEDGERENTRIES.*.AMOUNT'));
    assert.ok(!fields.includes('ENVELOPE'));
    assert.ok(!fields.includes('LEDGER'));
  });

  it('extracts nested ADDRESS.* children', () => {
    const xml = `<LEDGER>
  <NAME>Acme</NAME>
  <ADDRESS.LIST TYPE="String">
    <ADDRESS>Line 1</ADDRESS>
    <ADDRESS>Line 2</ADDRESS>
  </ADDRESS.LIST>
</LEDGER>`;
    const fields = parseCollectionFieldsFromXml(xml);
    assert.ok(fields.includes('NAME'));
    assert.ok(fields.includes('ADDRESS.*'));
    assert.ok(fields.includes('ADDRESS.*.ADDRESS'));

    const { parseCollectionFieldsDetailed } = require('../metadataDiscover');
    const detailed = parseCollectionFieldsDetailed(xml);
    const addr = detailed.find((f) => f.name === 'ADDRESS.*.ADDRESS');
    assert.ok(addr);
    assert.deepEqual(addr.sampleValues.sort(), ['Line 1', 'Line 2']);
  });

  it('returns empty for empty body', () => {
    assert.deepEqual(parseCollectionFieldsFromXml(''), []);
    assert.deepEqual(parseCollectionFieldsFromXml(null), []);
  });

  it('extractMasterNamesFromXml returns all group names', () => {
    const { extractMasterNamesFromXml } = require('../metadataDiscover');
    const xml = `<COLLECTION>
      <GROUP><NAME>Sundry Debtors</NAME></GROUP>
      <GROUP><NAME>Sundry Creditors</NAME><PARENT>Current Liabilities</PARENT></GROUP>
    </COLLECTION>`;
    assert.deepEqual(extractMasterNamesFromXml(xml, 'GROUP'), [
      'Sundry Creditors',
      'Sundry Debtors',
    ]);
  });

  it('extracts User Space UDF namespaced tags on ledger', () => {
    const { parseCollectionFieldsDetailed, extractMasterNamesFromXml } = require('../metadataDiscover');
    const xml = `<?xml version="1.0"?>
<ENVELOPE><BODY><DATA><COLLECTION>
  <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER>
      <NAME>Acme</NAME>
      <PARENT>Sundry Debtors</PARENT>
      <UDF:CUSTOMERCODE>C-100</UDF:CUSTOMERCODE>
      <UDF:NOTES.LIST TYPE="String">
        <UDF:NOTES>Priority</UDF:NOTES>
      </UDF:NOTES.LIST>
    </LEDGER>
  </TALLYMESSAGE>
</COLLECTION></DATA></BODY></ENVELOPE>`;
    const fields = parseCollectionFieldsFromXml(xml);
    assert.ok(fields.includes('UDF:CUSTOMERCODE'));
    assert.ok(fields.includes('UDF:NOTES.*'));
    assert.ok(fields.includes('UDF:NOTES.*.UDF:NOTES'));
    const detailed = parseCollectionFieldsDetailed(xml);
    const code = detailed.find((f) => f.name === 'UDF:CUSTOMERCODE');
    assert.ok(code);
    assert.deepEqual(code.sampleValues, ['C-100']);
    assert.deepEqual(extractMasterNamesFromXml(xml, 'LEDGER'), ['Acme']);
  });

  it('parseMasterRecordsFromXml returns all ledger values incl UDF', () => {
    const { parseMasterRecordsFromXml } = require('../metadataDiscover');
    const xml = `<COLLECTION>
  <LEDGER NAME="Acme">
    <NAME>Acme</NAME>
    <PARENT>Sundry Debtors</PARENT>
    <CLOSINGBALANCE>-1000.00</CLOSINGBALANCE>
    <ADDRESS.LIST TYPE="String">
      <ADDRESS>Line 1</ADDRESS>
      <ADDRESS>Line 2</ADDRESS>
    </ADDRESS.LIST>
    <UDF:CUSTOMERCODE>C-100</UDF:CUSTOMERCODE>
  </LEDGER>
</COLLECTION>`;
    const rows = parseMasterRecordsFromXml(xml, 'LEDGER');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].NAME, 'Acme');
    assert.equal(rows[0].PARENT, 'Sundry Debtors');
    assert.equal(rows[0].CLOSINGBALANCE, '-1000.00');
    assert.deepEqual(rows[0].ADDRESS, ['Line 1', 'Line 2']);
    assert.equal(rows[0]['UDF:CUSTOMERCODE'], 'C-100');
  });

  it('enrichLedgerRecord promotes LedStateName and nested GSTIN', () => {
    const { enrichLedgerRecord } = require('../metadataDiscover');
    const enriched = enrichLedgerRecord({
      NAME: 'User Space',
      LEDSTATENAME: 'Karnataka',
      GSTDETAILS: [{ GSTIN: '29AABCU9603R1ZM', PINCODE: '560001' }],
    });
    assert.equal(enriched.LEDGERSTATENAME, 'Karnataka');
    assert.equal(enriched.PARTYGSTIN, '29AABCU9603R1ZM');
    assert.equal(enriched.PINCODE, '560001');
  });
});
