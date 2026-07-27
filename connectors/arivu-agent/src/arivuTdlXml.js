'use strict';

/**
 * XML envelopes targeting Arivu TDL collections (ArivuConnector.tdl pack v1.0.0).
 * Collection IDs must match TDL exactly. Inline TDLMESSAGE is a fallback if file TDL
 * is not loaded; prefer loading the file pack for Fetch-rich definitions.
 */

const ARIVU_TDL_PACK_VERSION = '1.0.1';

const ARIVU_COLLECTIONS = Object.freeze({
  META: 'Arivu Connector Meta',
  COMPANIES: 'Arivu List of Companies',
  GROUPS: 'Arivu List of Groups',
  LEDGERS: 'Arivu List of Ledgers',
  CURRENCIES: 'Arivu List of Currencies',
  VOUCHER_TYPES: 'Arivu List of Voucher Types',
  COST_CATEGORIES: 'Arivu List of Cost Categories',
  COST_CENTRES: 'Arivu List of Cost Centres',
  UNITS: 'Arivu List of Units',
  STOCK_GROUPS: 'Arivu List of Stock Groups',
  STOCK_CATEGORIES: 'Arivu List of Stock Categories',
  STOCK_ITEMS: 'Arivu List of Stock Items',
  GODOWNS: 'Arivu List of Godowns',
  BATCHES: 'Arivu List of Batches',
  STOCK_SUMMARY: 'Arivu Stock Summary',
  VOUCHERS: 'Arivu List of Vouchers',
  VOUCHERS_SALES: 'Arivu Sales Vouchers',
  VOUCHERS_PURCHASE: 'Arivu Purchase Vouchers',
  VOUCHERS_PAYMENT: 'Arivu Payment Vouchers',
  VOUCHERS_RECEIPT: 'Arivu Receipt Vouchers',
  VOUCHERS_JOURNAL: 'Arivu Journal Vouchers',
  VOUCHERS_CONTRA: 'Arivu Contra Vouchers',
  VOUCHERS_CREDIT_NOTE: 'Arivu Credit Note Vouchers',
  VOUCHERS_DEBIT_NOTE: 'Arivu Debit Note Vouchers',
  VOUCHERS_STOCK_JOURNAL: 'Arivu Stock Journal Vouchers',
  VOUCHERS_DELIVERY_NOTE: 'Arivu Delivery Note Vouchers',
  VOUCHERS_RECEIPT_NOTE: 'Arivu Receipt Note Vouchers',
  GST_CLASSIFICATIONS: 'Arivu List of GST Classifications',
  TAX_UNITS: 'Arivu List of Tax Units',
  GST_DUTY_LEDGERS: 'Arivu List of GST Duty Ledgers',
  ATTENDANCE_TYPES: 'Arivu List of Attendance Types',
});

const COLLECTION_TYPE = Object.freeze({
  [ARIVU_COLLECTIONS.META]: 'Company',
  [ARIVU_COLLECTIONS.COMPANIES]: 'Company',
  [ARIVU_COLLECTIONS.GROUPS]: 'Group',
  [ARIVU_COLLECTIONS.LEDGERS]: 'Ledger',
  [ARIVU_COLLECTIONS.CURRENCIES]: 'Currency',
  [ARIVU_COLLECTIONS.VOUCHER_TYPES]: 'Voucher Type',
  [ARIVU_COLLECTIONS.COST_CATEGORIES]: 'Cost Category',
  [ARIVU_COLLECTIONS.COST_CENTRES]: 'Cost Centre',
  [ARIVU_COLLECTIONS.UNITS]: 'Unit',
  [ARIVU_COLLECTIONS.STOCK_GROUPS]: 'Stock Group',
  [ARIVU_COLLECTIONS.STOCK_CATEGORIES]: 'Stock Category',
  [ARIVU_COLLECTIONS.STOCK_ITEMS]: 'Stock Item',
  [ARIVU_COLLECTIONS.GODOWNS]: 'Godown',
  [ARIVU_COLLECTIONS.BATCHES]: 'Batch',
  [ARIVU_COLLECTIONS.STOCK_SUMMARY]: 'Stock Item',
  [ARIVU_COLLECTIONS.VOUCHERS]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_SALES]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_PURCHASE]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_PAYMENT]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_RECEIPT]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_JOURNAL]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_CONTRA]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_CREDIT_NOTE]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_DEBIT_NOTE]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_STOCK_JOURNAL]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_DELIVERY_NOTE]: 'Voucher',
  [ARIVU_COLLECTIONS.VOUCHERS_RECEIPT_NOTE]: 'Voucher',
  [ARIVU_COLLECTIONS.GST_CLASSIFICATIONS]: 'GST Classification',
  [ARIVU_COLLECTIONS.TAX_UNITS]: 'Tax Unit',
  [ARIVU_COLLECTIONS.GST_DUTY_LEDGERS]: 'Ledger',
  [ARIVU_COLLECTIONS.ATTENDANCE_TYPES]: 'Attendance Type',
});

/** Native methods used when file TDL is missing (inline fallback). */
const FALLBACK_NATIVES = Object.freeze({
  [ARIVU_COLLECTIONS.COMPANIES]: [
    'Name',
    'GUID',
    'StartingFrom',
    'BooksFrom',
    'CompanyNumber',
    'FormalName',
  ],
  [ARIVU_COLLECTIONS.LEDGERS]: [
    'Name',
    'Parent',
    'GUID',
    'MasterID',
    'AlterID',
    'PartyGSTIN',
    'ClosingBalance',
    'GSTApplicable',
    'GSTRegistrationType',
  ],
  [ARIVU_COLLECTIONS.STOCK_ITEMS]: [
    'Name',
    'Parent',
    'GUID',
    'BaseUnits',
    'ClosingBalance',
    'GSTDetails',
    'HSNDetails',
  ],
  [ARIVU_COLLECTIONS.GODOWNS]: ['Name', 'Parent', 'GUID', 'Address'],
  [ARIVU_COLLECTIONS.VOUCHERS]: [
    'Date',
    'VoucherTypeName',
    'VoucherNumber',
    'Reference',
    'GUID',
    'MasterID',
    'AlterID',
    'PartyLedgerName',
    'PartyGSTIN',
    'PlaceOfSupply',
    'IRN',
    'LedgerEntries.*',
    'AllLedgerEntries.*',
    'InventoryEntries.*',
    'AllInventoryEntries.*',
  ],
});

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
  if (/^\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}$/.test(String(value))) return String(value);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

/**
 * @param {string} collectionId
 * @param {{ company?: string|null, fromDate?: string|Date|null, toDate?: string|Date|null, extraNative?: string[], explode?: boolean, sinceAlterId?: string|number|null }} [opts]
 */
function collectionExport(collectionId, opts = {}) {
  const company = opts.company || null;
  const fromDate = opts.fromDate ? formatTallyDate(opts.fromDate) : null;
  const toDate = opts.toDate ? formatTallyDate(opts.toDate) : null;
  const sinceAlterId =
    opts.sinceAlterId != null && String(opts.sinceAlterId).trim() !== ''
      ? String(opts.sinceAlterId).trim()
      : null;
  const type = COLLECTION_TYPE[collectionId] || 'Company';
  const natives = (
    opts.extraNative && opts.extraNative.length
      ? opts.extraNative
      : FALLBACK_NATIVES[collectionId] || ['Name', 'GUID']
  ).filter((v, i, a) => a.indexOf(v) === i);

  // Ensure AlterID is fetched for incremental sync
  if (!natives.some((n) => String(n).toLowerCase() === 'alterid')) {
    natives.push('AlterID');
  }

  const staticVars = [
    company ? `        <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>` : null,
    fromDate ? `        <SVFROMDATE>${escapeXml(fromDate)}</SVFROMDATE>` : null,
    toDate ? `        <SVTODATE>${escapeXml(toDate)}</SVTODATE>` : null,
    opts.explode === false ? null : '        <EXPLODEFLAG>Yes</EXPLODEFLAG>',
    '        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>',
  ]
    .filter(Boolean)
    .join('\n');

  const nativeXml = natives
    .map((m) => `            <NATIVEMETHOD>${escapeXml(m)}</NATIVEMETHOD>`)
    .join('\n');

  // Filter: only objects with AlterID greater than watermark (Tally Collection FILTER)
  const filterXml = sinceAlterId
    ? [
        '            <FILTERS>ArivuAlterIdFilter</FILTERS>',
        '          </COLLECTION>',
        `          <SYSTEM TYPE="Formulae" NAME="ArivuAlterIdFilter">$AlterID &gt; ${escapeXml(sinceAlterId)}</SYSTEM>`,
      ].join('\n')
    : '          </COLLECTION>';

  const collectionOpen = `          <COLLECTION NAME="${escapeXml(collectionId)}" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No">`;

  return [
    '<ENVELOPE>',
    '  <HEADER>',
    '    <VERSION>1</VERSION>',
    '    <TALLYREQUEST>Export</TALLYREQUEST>',
    '    <TYPE>Collection</TYPE>',
    `    <ID>${escapeXml(collectionId)}</ID>`,
    '  </HEADER>',
    '  <BODY>',
    '    <DESC>',
    '      <STATICVARIABLES>',
    staticVars,
    '      </STATICVARIABLES>',
    '      <TDL>',
    '        <TDLMESSAGE>',
    collectionOpen,
    `            <TYPE>${escapeXml(type)}</TYPE>`,
    nativeXml,
    sinceAlterId
      ? filterXml
      : '          </COLLECTION>',
    '        </TDLMESSAGE>',
    '      </TDL>',
    '    </DESC>',
    '  </BODY>',
    '</ENVELOPE>',
  ].join('\n');
}

function companiesListEnvelope(opts = {}) {
  return collectionExport(ARIVU_COLLECTIONS.COMPANIES, opts);
}

function ledgersListEnvelope(opts = {}) {
  return collectionExport(ARIVU_COLLECTIONS.LEDGERS, opts);
}

function stockItemsListEnvelope(opts = {}) {
  return collectionExport(ARIVU_COLLECTIONS.STOCK_ITEMS, opts);
}

function godownsListEnvelope(opts = {}) {
  return collectionExport(ARIVU_COLLECTIONS.GODOWNS, opts);
}

function vouchersListEnvelope(opts = {}) {
  return collectionExport(ARIVU_COLLECTIONS.VOUCHERS, {
    ...opts,
    extraNative: FALLBACK_NATIVES[ARIVU_COLLECTIONS.VOUCHERS],
  });
}

function metaEnvelope(opts = {}) {
  return collectionExport(ARIVU_COLLECTIONS.META, {
    ...opts,
    extraNative: ['Name', 'GUID'],
  });
}

/** Resolve collection id from agent masterType / exportId aliases. */
function resolveCollectionId(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  if (Object.values(ARIVU_COLLECTIONS).includes(n)) return n;
  const aliases = {
    Ledger: ARIVU_COLLECTIONS.LEDGERS,
    StockItem: ARIVU_COLLECTIONS.STOCK_ITEMS,
    Godown: ARIVU_COLLECTIONS.GODOWNS,
    Company: ARIVU_COLLECTIONS.COMPANIES,
    Group: ARIVU_COLLECTIONS.GROUPS,
    Voucher: ARIVU_COLLECTIONS.VOUCHERS,
    VoucherType: ARIVU_COLLECTIONS.VOUCHER_TYPES,
    Unit: ARIVU_COLLECTIONS.UNITS,
    CostCentre: ARIVU_COLLECTIONS.COST_CENTRES,
    CostCategory: ARIVU_COLLECTIONS.COST_CATEGORIES,
    Currency: ARIVU_COLLECTIONS.CURRENCIES,
    StockGroup: ARIVU_COLLECTIONS.STOCK_GROUPS,
    StockCategory: ARIVU_COLLECTIONS.STOCK_CATEGORIES,
    Batch: ARIVU_COLLECTIONS.BATCHES,
    GSTClassification: ARIVU_COLLECTIONS.GST_CLASSIFICATIONS,
    TaxUnit: ARIVU_COLLECTIONS.TAX_UNITS,
    AttendanceType: ARIVU_COLLECTIONS.ATTENDANCE_TYPES,
  };
  return aliases[n] || null;
}

module.exports = {
  ARIVU_TDL_PACK_VERSION,
  ARIVU_COLLECTIONS,
  COLLECTION_TYPE,
  collectionExport,
  companiesListEnvelope,
  ledgersListEnvelope,
  stockItemsListEnvelope,
  godownsListEnvelope,
  vouchersListEnvelope,
  metaEnvelope,
  resolveCollectionId,
  escapeXml,
  formatTallyDate,
};
