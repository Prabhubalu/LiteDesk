'use strict';

/**
 * Build Tally XML envelopes from mapper payloads (cloud → agent executeXml).
 */

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTallyDate(value) {
  if (!value) return null;
  if (/^\d{8}$/.test(String(value))) return String(value);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function wrapImport(messagesXml, company = null) {
  const companyTag = company
    ? `    <STATICVARIABLES>\n      <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>\n    </STATICVARIABLES>\n`
    : '';
  return [
    '<ENVELOPE>',
    '  <HEADER>',
    '    <VERSION>1</VERSION>',
    '    <TALLYREQUEST>Import</TALLYREQUEST>',
    '    <TYPE>Data</TYPE>',
    '    <ID>All Masters</ID>',
    '  </HEADER>',
    '  <BODY>',
    '    <DESC>',
    companyTag,
    '    </DESC>',
    '    <DATA>',
    messagesXml,
    '    </DATA>',
    '  </BODY>',
    '</ENVELOPE>',
  ].join('\n');
}

function wrapVoucherImport(voucherXml, company = null) {
  const companyTag = company
    ? `    <STATICVARIABLES>\n      <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>\n    </STATICVARIABLES>\n`
    : '';
  return [
    '<ENVELOPE>',
    '  <HEADER>',
    '    <VERSION>1</VERSION>',
    '    <TALLYREQUEST>Import</TALLYREQUEST>',
    '    <TYPE>Data</TYPE>',
    '    <ID>Vouchers</ID>',
    '  </HEADER>',
    '  <BODY>',
    '    <DESC>',
    companyTag,
    '    </DESC>',
    '    <DATA>',
    voucherXml,
    '    </DATA>',
    '  </BODY>',
    '</ENVELOPE>',
  ].join('\n');
}

function buildLedgerMasterXml(party = {}, { action = 'Create' } = {}) {
  const name = party.name || party.ledgerName;
  if (!name) return null;
  const msg = [
    '      <TALLYMESSAGE>',
    `        <LEDGER NAME="${escapeXml(name)}" ACTION="${escapeXml(action)}">`,
    `          <NAME.LIST><NAME>${escapeXml(name)}</NAME></NAME.LIST>`,
    `          <PARENT>${escapeXml(party.parent || 'Sundry Debtors')}</PARENT>`,
    party.gstin ? `          <PARTYGSTIN>${escapeXml(party.gstin)}</PARTYGSTIN>` : '',
    party.stateCode ? `          <LEDGERSTATENAME>${escapeXml(party.stateCode)}</LEDGERSTATENAME>` : '',
    party.address ? `          <ADDRESS.LIST><ADDRESS>${escapeXml(party.address)}</ADDRESS></ADDRESS.LIST>` : '',
    '        </LEDGER>',
    '      </TALLYMESSAGE>',
  ]
    .filter(Boolean)
    .join('\n');
  return wrapImport(msg, party.companyName || null);
}

function buildStockItemXml(item = {}, { action = 'Create' } = {}) {
  const name = item.name || item.stockItemName;
  if (!name) return null;
  const msg = [
    '      <TALLYMESSAGE>',
    `        <STOCKITEM NAME="${escapeXml(name)}" ACTION="${escapeXml(action)}">`,
    `          <NAME.LIST><NAME>${escapeXml(name)}</NAME></NAME.LIST>`,
    `          <PARENT>${escapeXml(item.parent || 'Primary')}</PARENT>`,
    `          <BASEUNITS>${escapeXml(item.baseUnits || item.unit || 'Nos')}</BASEUNITS>`,
    item.hsnSac || item.hsnCode
      ? `          <GSTDETAILS.LIST><HSNCODE>${escapeXml(item.hsnSac || item.hsnCode)}</HSNCODE></GSTDETAILS.LIST>`
      : '',
    '        </STOCKITEM>',
    '      </TALLYMESSAGE>',
  ]
    .filter(Boolean)
    .join('\n');
  return wrapImport(msg, item.companyName || null);
}

function buildGodownXml(godown = {}, { action = 'Create' } = {}) {
  const name = godown.name || godown.godownName;
  if (!name) return null;
  const msg = [
    '      <TALLYMESSAGE>',
    `        <GODOWN NAME="${escapeXml(name)}" ACTION="${escapeXml(action)}">`,
    `          <NAME.LIST><NAME>${escapeXml(name)}</NAME></NAME.LIST>`,
    `          <PARENT>${escapeXml(godown.parent || 'Primary')}</PARENT>`,
    '        </GODOWN>',
    '      </TALLYMESSAGE>',
  ].join('\n');
  return wrapImport(msg, godown.companyName || null);
}

function buildVoucherXml(voucher = {}, { action = 'Create' } = {}) {
  const voucherType = voucher.voucherType || 'Sales';
  const date = formatTallyDate(voucher.date) || formatTallyDate(new Date());
  const reference = voucher.reference || voucher.voucherNumber || '';
  const inventory = Array.isArray(voucher.inventoryEntries) ? voucher.inventoryEntries : [];
  const ledgers = Array.isArray(voucher.ledgerEntries) ? voucher.ledgerEntries : [];

  const invXml = inventory
    .map((e) => {
      const qty = Number(e.quantity) || 0;
      const amount = Number(e.amount) || 0;
      return [
        '          <ALLINVENTORYENTRIES.LIST>',
        `            <STOCKITEMNAME>${escapeXml(e.stockItemName || e.sku || '')}</STOCKITEMNAME>`,
        `            <ISDEEMEDPOSITIVE>${amount < 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`,
        `            <RATE>${Number(e.rate) || 0}</RATE>`,
        `            <AMOUNT>${amount}</AMOUNT>`,
        `            <ACTUALQTY>${qty} ${escapeXml(e.unit || 'Nos')}</ACTUALQTY>`,
        `            <BILLEDQTY>${qty} ${escapeXml(e.unit || 'Nos')}</BILLEDQTY>`,
        e.godownName ? `            <GODOWNNAME>${escapeXml(e.godownName)}</GODOWNNAME>` : '',
        '          </ALLINVENTORYENTRIES.LIST>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const ledgerXml = ledgers
    .map((e) => {
      const amount = Number(e.amount) || 0;
      return [
        '          <ALLLEDGERENTRIES.LIST>',
        `            <LEDGERNAME>${escapeXml(e.ledgerName || '')}</LEDGERNAME>`,
        `            <ISDEEMEDPOSITIVE>${amount < 0 || e.isPartyLedger ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`,
        `            <AMOUNT>${amount}</AMOUNT>`,
        '          </ALLLEDGERENTRIES.LIST>',
      ].join('\n');
    })
    .join('\n');

  const voucherInner = [
    '      <TALLYMESSAGE>',
    `        <VOUCHER VCHTYPE="${escapeXml(voucherType)}" ACTION="${escapeXml(action)}">`,
    `          <DATE>${escapeXml(date)}</DATE>`,
    `          <VOUCHERTYPENAME>${escapeXml(voucherType)}</VOUCHERTYPENAME>`,
    reference ? `          <REFERENCE>${escapeXml(reference)}</REFERENCE>` : '',
    voucher.partyLedgerName
      ? `          <PARTYLEDGERNAME>${escapeXml(voucher.partyLedgerName)}</PARTYLEDGERNAME>`
      : '',
    voucher.partyGstin ? `          <PARTYGSTIN>${escapeXml(voucher.partyGstin)}</PARTYGSTIN>` : '',
    voucher.placeOfSupply
      ? `          <PLACEOFSUPPLY>${escapeXml(voucher.placeOfSupply)}</PLACEOFSUPPLY>`
      : '',
    voucher.irn ? `          <IRN>${escapeXml(voucher.irn)}</IRN>` : '',
    voucher.narration ? `          <NARRATION>${escapeXml(voucher.narration)}</NARRATION>` : '',
    invXml,
    ledgerXml,
    '        </VOUCHER>',
    '      </TALLYMESSAGE>',
  ]
    .filter(Boolean)
    .join('\n');

  return wrapVoucherImport(voucherInner, voucher.companyName || null);
}

/**
 * Resolve entityType + payload → XML string for agent.
 */
function buildXmlForOutbox({ entityType, payload = {}, operation = 'push' } = {}) {
  const action = operation === 'alter' || operation === 'update' ? 'Alter' : 'Create';
  const type = String(entityType || '').toLowerCase();

  if (payload.xml) return payload.xml;

  if (type === 'party' || type === 'ledger') {
    return buildLedgerMasterXml(payload, { action });
  }
  if (type === 'item' || type === 'stock' || type === 'stock_item') {
    return buildStockItemXml(payload, { action });
  }
  if (type === 'godown') {
    return buildGodownXml(payload, { action });
  }
  if (
    type === 'invoice' ||
    type === 'voucher' ||
    type === 'payment' ||
    type === 'purchase_order' ||
    type === 'receipt_note' ||
    type === 'delivery_note' ||
    type === 'purchase_bill' ||
    type === 'vendor_payment' ||
    type === 'journal' ||
    type === 'contra'
  ) {
    return buildVoucherXml(payload, { action: operation === 'cancel' ? 'Cancel' : action });
  }

  // Generic: if payload looks like a voucher mapper result
  if (payload.voucherType) return buildVoucherXml(payload, { action });
  if (payload.masterType === 'LEDGER' || payload.parent) {
    return buildLedgerMasterXml(payload, { action });
  }

  return null;
}

module.exports = {
  escapeXml,
  formatTallyDate,
  buildLedgerMasterXml,
  buildStockItemXml,
  buildGodownXml,
  buildVoucherXml,
  buildXmlForOutbox,
};
