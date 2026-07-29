'use strict';

/**
 * Live Tally metadata discovery — probe Arivu TDL collections and extract field tags from XML.
 * Fields come only from live samples (no invented field lists).
 * Probe natives = what we *ask* Tally to Fetch (from TDL Fetch lists), not a hardcoded SoT.
 */

const { postXml } = require('./xmlClient');
const {
  ARIVU_COLLECTIONS,
  COLLECTION_TYPE,
  collectionExport,
  FALLBACK_NATIVES,
} = require('./arivuTdlXml');

/** Fetch lists aligned with ArivuConnector.*.tdl (request surface for live samples). */
const PROBE_NATIVES = Object.freeze({
  [ARIVU_COLLECTIONS.GROUPS]: [
    'Name', 'Parent', 'GUID', 'MasterID', 'AlterID', 'IsSubLedger', 'IsRevenue',
    'IsDeemedPositive', 'IsBillWiseOn', 'IsCostCentresOn', 'GSTDetails', 'HSNDetails',
    'GSTDetails.*', 'HSNDetails.*',
  ],
  [ARIVU_COLLECTIONS.LEDGERS]: [
    'Name', 'Parent', 'GUID', 'MasterID', 'AlterID', 'ClosingBalance', 'OpeningBalance',
    'PartyGSTIN', 'LedStateName', 'IncomeTaxNumber', 'LedgerPhone', 'Address', 'Email',
    'CreditLimit', 'IsBillWiseOn', 'IsCostCentresOn', 'GSTApplicable', 'GSTRegistrationType',
    'GSTTypeofSupply', 'GSTDutyHead', 'GSTDetails', 'HSNDetails', 'TaxType', 'CurrencyName',
    // Nested GST / HSN collection explode (children of GSTDETAILS.* / HSNDETAILS.*)
    'GSTDetails.*', 'HSNDetails.*',
    'ApplicableFrom', 'Taxability', 'HSNCode', 'HSN', 'SrcOfGSTDetails', 'SrcOfHSNDetails',
    'CalculationType', 'GstTypeOfSupply', 'StateName', 'RateDetails.*', 'StateWiseDetails.*',
  ],
  [ARIVU_COLLECTIONS.STOCK_ITEMS]: [
    'Name', 'Parent', 'GUID', 'MasterID', 'AlterID', 'BaseUnits', 'AdditionalUnits', 'Conversion',
    'ClosingBalance', 'OpeningBalance', 'ClosingRate', 'OpeningRate', 'ClosingValue', 'OpeningValue',
    'HasBatchNumbers', 'IsBatchWiseOn', 'HasExpiryDate', 'IsPerishable', 'GSTApplicable', 'GSTDetails',
    'HSNDetails', 'GSTTypeofSupply', 'Description', 'PartNo', 'Narration', 'CostingMethod',
    'ValuationMethod', 'Category', 'GodownName',
    'GSTDetails.*', 'HSNDetails.*',
    'ApplicableFrom', 'Taxability', 'HSNCode', 'HSN', 'SrcOfGSTDetails', 'SrcOfHSNDetails',
    'RateDetails.*', 'StateWiseDetails.*',
  ],
  [ARIVU_COLLECTIONS.STOCK_GROUPS]: [
    'Name', 'Parent', 'GUID', 'MasterID', 'AlterID', 'IsAddable', 'GSTDetails', 'HSNDetails', 'GSTApplicable',
    'GSTDetails.*', 'HSNDetails.*',
  ],
  [ARIVU_COLLECTIONS.CURRENCIES]: [
    'Name', 'GUID', 'OriginalName', 'FormalName', 'ISOCurrencyCode', 'DecimalPlaces', 'InMillions', 'Symbol',
  ],
  [ARIVU_COLLECTIONS.VOUCHER_TYPES]: [
    'Name', 'Parent', 'GUID', 'MasterID', 'AlterID', 'NumberingMethod', 'IsDeemedPositive',
    'AffectsStock', 'IsInvoice', 'IsOptional', 'IsCommonParty', 'PreventDuplicates',
    'PrefillZero', 'BeginningNumber', 'EndingNumber',
  ],
  [ARIVU_COLLECTIONS.COST_CATEGORIES]: [
    'Name', 'GUID', 'MasterID', 'AlterID', 'AllocateRevenue', 'AllocateNonRevenue',
  ],
  [ARIVU_COLLECTIONS.COST_CENTRES]: [
    'Name', 'Parent', 'GUID', 'MasterID', 'AlterID', 'Category', 'RevenueLedger', 'NonRevenueLedger',
  ],
  [ARIVU_COLLECTIONS.UNITS]: [
    'Name', 'GUID', 'DecimalPlaces', 'IsSimpleUnit', 'OriginalName', 'AdditionalUnits', 'Conversion', 'GSTRepUoM',
  ],
  [ARIVU_COLLECTIONS.STOCK_CATEGORIES]: [
    'Name', 'Parent', 'GUID', 'MasterID', 'AlterID',
  ],
  [ARIVU_COLLECTIONS.GODOWNS]: [
    'Name', 'Parent', 'GUID', 'MasterID', 'AlterID', 'Address', 'GodownType', 'HasStock',
  ],
  [ARIVU_COLLECTIONS.BATCHES]: [
    'Name', 'GUID', 'Parent', 'ClosingBalance', 'ClosingRate', 'ClosingValue', 'ManufacturedOn', 'ExpiryDate', 'GodownName',
  ],
  [ARIVU_COLLECTIONS.GST_CLASSIFICATIONS]: [
    'Name', 'GUID', 'MasterID', 'AlterID', 'HSN', 'HSNCode', 'SupplyType', 'ReportingUOM', 'Taxability',
  ],
  [ARIVU_COLLECTIONS.TAX_UNITS]: [
    'Name', 'GUID', 'MasterID', 'AlterID', 'StateName',
  ],
  [ARIVU_COLLECTIONS.ATTENDANCE_TYPES]: [
    'Name', 'Parent', 'GUID', 'AttendanceType', 'PeriodType',
  ],
});

const VOUCHER_PROBE_NATIVES = Object.freeze([
  'Date', 'VoucherTypeName', 'VoucherNumber', 'Reference', 'Narration', 'GUID', 'MasterID', 'AlterID',
  'PartyLedgerName', 'PartyGSTIN', 'PlaceOfSupply', 'BasicBuyerName', 'IRN', 'AckNo', 'AckDate',
  'IsCancelled', 'IsOptional', 'IsInvoice', 'EffectiveDate', 'EnteredBy', 'Amount',
  '*', '*.*', '*.*.*',
  'LedgerEntries.*', 'AllLedgerEntries.*', 'InventoryEntries.*', 'AllInventoryEntries.*',
  'BillAllocations.*', 'CostCentreAllocations.*',
]);

/** Collections to probe for catalogue (pack surface — not a field catalog). */
const METADATA_PROBE_SPECS = Object.freeze([
  { collectionId: ARIVU_COLLECTIONS.GROUPS, objectKey: 'group', objectName: 'Group' },
  { collectionId: ARIVU_COLLECTIONS.LEDGERS, objectKey: 'ledger', objectName: 'Ledger' },
  { collectionId: ARIVU_COLLECTIONS.CURRENCIES, objectKey: 'currency', objectName: 'Currency' },
  { collectionId: ARIVU_COLLECTIONS.VOUCHER_TYPES, objectKey: 'voucher_type', objectName: 'Voucher Type' },
  { collectionId: ARIVU_COLLECTIONS.COST_CATEGORIES, objectKey: 'cost_category', objectName: 'Cost Category' },
  { collectionId: ARIVU_COLLECTIONS.COST_CENTRES, objectKey: 'cost_centre', objectName: 'Cost Centre' },
  { collectionId: ARIVU_COLLECTIONS.UNITS, objectKey: 'unit', objectName: 'Unit' },
  { collectionId: ARIVU_COLLECTIONS.STOCK_GROUPS, objectKey: 'stock_group', objectName: 'Stock Group' },
  { collectionId: ARIVU_COLLECTIONS.STOCK_CATEGORIES, objectKey: 'stock_category', objectName: 'Stock Category' },
  { collectionId: ARIVU_COLLECTIONS.STOCK_ITEMS, objectKey: 'stock_item', objectName: 'Stock Item' },
  { collectionId: ARIVU_COLLECTIONS.GODOWNS, objectKey: 'godown', objectName: 'Godown' },
  { collectionId: ARIVU_COLLECTIONS.BATCHES, objectKey: 'batch', objectName: 'Batch' },
  { collectionId: ARIVU_COLLECTIONS.GST_CLASSIFICATIONS, objectKey: 'gst_classification', objectName: 'GST Classification' },
  { collectionId: ARIVU_COLLECTIONS.TAX_UNITS, objectKey: 'tax_unit', objectName: 'Tax Unit' },
  { collectionId: ARIVU_COLLECTIONS.ATTENDANCE_TYPES, objectKey: 'attendance', objectName: 'Attendance Type' },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_SALES, objectKey: 'sales', objectName: 'Sales', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_PURCHASE, objectKey: 'purchase', objectName: 'Purchase', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_PAYMENT, objectKey: 'payment', objectName: 'Payment', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_RECEIPT, objectKey: 'receipt', objectName: 'Receipt', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_JOURNAL, objectKey: 'journal', objectName: 'Journal', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_CONTRA, objectKey: 'contra', objectName: 'Contra', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_CREDIT_NOTE, objectKey: 'credit_note', objectName: 'Credit Note', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_DEBIT_NOTE, objectKey: 'debit_note', objectName: 'Debit Note', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_STOCK_JOURNAL, objectKey: 'stock_journal', objectName: 'Stock Journal', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_DELIVERY_NOTE, objectKey: 'delivery_note', objectName: 'Delivery Note', voucher: true },
  { collectionId: ARIVU_COLLECTIONS.VOUCHERS_RECEIPT_NOTE, objectKey: 'receipt_note', objectName: 'Receipt Note', voucher: true },
]);

const STRUCTURAL_TAGS = new Set([
  'ENVELOPE',
  'HEADER',
  'BODY',
  'DATA',
  'DESC',
  'COLLECTION',
  'TALLYMESSAGE',
  'STATICVARIABLES',
  'TDL',
  'TDLMESSAGE',
  'VERSION',
  'STATUS',
  'TALLYREQUEST',
  'TYPE',
  'ID',
  'NATIVEMETHOD',
  'FILTERS',
  'SYSTEM',
  'SVCURRENTCOMPANY',
  'SVFROMDATE',
  'SVTODATE',
  'SVEXPORTFORMAT',
  'EXPLODEFLAG',
]);

const ENTITY_WRAPPERS = new Set(
  [
    ...Object.values(COLLECTION_TYPE).map((t) => String(t).toUpperCase().replace(/\s+/g, '')),
    'STOCKITEM',
    'COSTCENTRE',
    'COSTCATEGORY',
    'VOUCHERTYPE',
    'STOCKGROUP',
    'STOCKCATEGORY',
    'GSTCLASSIFICATION',
    'TAXUNIT',
    'ATTENDANCETYPE',
    'VOUCHER',
    'COMPANY',
    'GROUP',
    'LEDGER',
    'CURRENCY',
    'UNIT',
    'GODOWN',
    'BATCH',
  ]
);

function probeNativesFor(spec) {
  if (spec.voucher) return [...VOUCHER_PROBE_NATIVES];
  const base =
    PROBE_NATIVES[spec.collectionId] ||
    FALLBACK_NATIVES[spec.collectionId] ||
    ['Name', 'Parent', 'GUID', 'MasterID', 'AlterID'];
  // Ask Tally for deep explode so nested *.LIST children are populated when present
  return [...new Set([...base, '*', '*.*', '*.*.*', 'Address.*', 'GSTDetails.*', 'HSNDetails.*'])];
}

/** List path GSTDETAILS.* → natives to re-Fetch (XML case + common TDL Pascal forms). */
function listPathToNatives(listPath) {
  const base = String(listPath || '')
    .replace(/\.\*$/, '')
    .split('.')
    .pop();
  if (!base) return [];
  const known = {
    GSTDETAILS: 'GSTDetails',
    HSNDETAILS: 'HSNDetails',
    ADDRESS: 'Address',
    STATEWISEDETAILS: 'StateWiseDetails',
    RATEDETAILS: 'RateDetails',
    LEDGERENTRIES: 'LedgerEntries',
    ALLLEDGERENTRIES: 'AllLedgerEntries',
    INVENTORYENTRIES: 'InventoryEntries',
    ALLINVENTORYENTRIES: 'AllInventoryEntries',
    BILLALLOCATIONS: 'BillAllocations',
    COSTCENTREALLOCATIONS: 'CostCentreAllocations',
    GODOWNENTRIES: 'GodownEntries',
    BATCHENTRIES: 'BatchEntries',
  };
  const pascal = known[base] || null;
  const out = [base, `${base}.*`];
  if (pascal) out.push(pascal, `${pascal}.*`);
  return out;
}

function emptyListPaths(fieldRows) {
  const rows = Array.isArray(fieldRows) ? fieldRows : [];
  return rows.filter((f) => {
    if (!f?.isList && !String(f?.name || '').endsWith('.*')) return false;
    const prefix = `${f.name}.`;
    return !rows.some((c) => c.name && c.name.startsWith(prefix));
  });
}

function mergeFieldRows(a, b) {
  const map = new Map();
  for (const row of [...(a || []), ...(b || [])]) {
    const prev = map.get(row.name);
    if (!prev) {
      map.set(row.name, {
        ...row,
        sampleValues: [...(row.sampleValues || [])],
      });
      continue;
    }
    const samples = new Set([...(prev.sampleValues || []), ...(row.sampleValues || [])]);
    map.set(row.name, {
      ...prev,
      isList: prev.isList || row.isList,
      sampleValues: [...samples].slice(0, 5),
    });
  }
  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name));
}

function toCatalogFields(fieldRows) {
  return (fieldRows || []).map((f) => ({
    name: f.name,
    label: f.name,
    dataType: f.isList ? 'list' : 'string',
    required: f.name === 'NAME' || f.name === 'GUID',
    isKey: ['GUID', 'MASTERID', 'NAME'].includes(f.name),
    isList: f.isList,
    sampleValues: f.sampleValues || [],
  }));
}

function voucherDateWindow() {
  const to = new Date();
  const from = new Date(to.getTime());
  from.setFullYear(from.getFullYear() - 2);
  return { fromDate: from, toDate: to };
}

/**
 * Collect field descriptors from a Tally export XML body.
 * Nested *.LIST blocks yield paths like ADDRESS.* and ADDRESS.*.ADDRESS plus sampleValues.
 * @param {string} xml
 * @returns {{ name: string, sampleValues: string[], isList: boolean }[]}
 */
function parseCollectionFieldsDetailed(xml) {
  if (!xml || typeof xml !== 'string') return [];
  /** @type {Map<string, { name: string, sampleValues: Set<string>, isList: boolean }>} */
  const byName = new Map();

  function ensure(name, isList = false) {
    let row = byName.get(name);
    if (!row) {
      row = { name, sampleValues: new Set(), isList: Boolean(isList) };
      byName.set(name, row);
    } else if (isList) {
      row.isList = true;
    }
    return row;
  }

  function isStructuralOrEntity(name) {
    if (STRUCTURAL_TAGS.has(name)) return true;
    const compact = name.replace(/\./g, '').replace(/\*/g, '');
    return ENTITY_WRAPPERS.has(compact);
  }

  function addSample(name, value) {
    const v = String(value || '').replace(/\s+/g, ' ').trim();
    if (!v || v.length > 200) return;
    const row = ensure(name);
    if (row.sampleValues.size < 5) row.sampleValues.add(v);
  }

  // Tally User Space / UDF tags: <UDF:MyField>…</UDF:MyField> or <UDF:MyList.LIST>
  const TAG = '([A-Za-z][\\w]*(?::[A-Za-z][\\w]*)?)';

  /**
   * Find LIST blocks with balanced open/close (supports nested same-name lists).
   * @param {string} fragment
   * @returns {{ base: string, inner: string, start: number, end: number }[]}
   */
  function findListBlocks(fragment) {
    const blocks = [];
    const openRe = new RegExp(`<${TAG}\\.LIST\\b[^>]*>`, 'gi');
    let open;
    while ((open = openRe.exec(fragment))) {
      const base = String(open[1]);
      const openTag = open[0];
      const innerStart = open.index + openTag.length;
      const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const openPat = new RegExp(`<${esc}\\.LIST\\b`, 'gi');
      const closePat = new RegExp(`</${esc}\\.LIST>`, 'gi');
      let depth = 1;
      let pos = innerStart;
      let innerEnd = -1;
      while (depth > 0 && pos < fragment.length) {
        openPat.lastIndex = pos;
        closePat.lastIndex = pos;
        const nextOpen = openPat.exec(fragment);
        const nextClose = closePat.exec(fragment);
        if (!nextClose) break;
        if (nextOpen && nextOpen.index < nextClose.index) {
          depth += 1;
          pos = nextOpen.index + nextOpen[0].length;
        } else {
          depth -= 1;
          if (depth === 0) {
            innerEnd = nextClose.index;
            blocks.push({
              base: base.toUpperCase(),
              inner: fragment.slice(innerStart, innerEnd),
              start: open.index,
              end: nextClose.index + nextClose[0].length,
            });
            openRe.lastIndex = nextClose.index + nextClose[0].length;
          } else {
            pos = nextClose.index + nextClose[0].length;
          }
        }
      }
    }
    return blocks;
  }

  /**
   * @param {string} fragment
   * @param {string} pathPrefix
   */
  function walk(fragment, pathPrefix) {
    if (!fragment) return;

    const listBlocks = findListBlocks(fragment);
    // Only top-level lists in this fragment (not nested inside another matched list)
    const topLists = listBlocks.filter(
      (b) => !listBlocks.some((o) => o !== b && b.start > o.start && b.end < o.end)
    );
    const listSpans = topLists.map((b) => [b.start, b.end]);

    for (const block of topLists) {
      const listPath = pathPrefix ? `${pathPrefix}.${block.base}.*` : `${block.base}.*`;
      ensure(listPath, true);
      walk(block.inner, listPath);
    }

    const leafRe = new RegExp(`<${TAG}\\b[^>]*>([^<]*?)<\\/\\1>`, 'g');
    let leafMatch;
    while ((leafMatch = leafRe.exec(fragment))) {
      const idx = leafMatch.index;
      const insideList = listSpans.some(([a, b]) => idx >= a && idx < b);
      if (insideList) continue;
      const name = String(leafMatch[1]).toUpperCase();
      if (name.endsWith('LIST') || name.includes('.')) continue;
      if (isStructuralOrEntity(name)) continue;
      const fieldPath = pathPrefix ? `${pathPrefix}.${name}` : name;
      ensure(fieldPath, false);
      addSample(fieldPath, leafMatch[2]);
    }

    const tagRe = new RegExp(`<\\/?${TAG}\\b[^>]*\\/?>`, 'g');
    let tagMatch;
    while ((tagMatch = tagRe.exec(fragment))) {
      const idx = tagMatch.index;
      const insideList = listSpans.some(([a, b]) => idx >= a && idx < b);
      if (insideList) continue;
      let name = String(tagMatch[1]).toUpperCase();
      if (name.endsWith('LIST') || name.includes('.')) continue;
      if (isStructuralOrEntity(name)) continue;
      const fieldPath = pathPrefix ? `${pathPrefix}.${name}` : name;
      ensure(fieldPath, false);
    }
  }

  walk(xml, '');
  return [...byName.values()]
    .map((row) => ({
      name: row.name,
      sampleValues: [...row.sampleValues],
      isList: row.isList,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Collect unique field tag names from a Tally export XML body.
 * @param {string} xml
 * @returns {string[]}
 */
function parseCollectionFieldsFromXml(xml) {
  return parseCollectionFieldsDetailed(xml).map((f) => f.name);
}

/**
 * Extract master record names from a Tally collection export (e.g. all Group NAME values).
 * @param {string} xml
 * @param {string} [entityTag] e.g. GROUP, LEDGER — if omitted, any NAME under DATA
 * @returns {string[]}
 */
function extractMasterNamesFromXml(xml, entityTag = 'GROUP') {
  if (!xml || typeof xml !== 'string') return [];
  const names = new Set();
  const tag = String(entityTag || 'GROUP').toUpperCase().replace(/\s+/g, '');
  const blockRe = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let block;
  while ((block = blockRe.exec(xml))) {
    const inner = block[1] || '';
    const nameMatch = /<NAME\b[^>]*>([^<]*)<\/NAME>/i.exec(inner);
    if (nameMatch) {
      const n = String(nameMatch[1] || '').replace(/\s+/g, ' ').trim();
      if (n) names.add(n);
    }
  }
  // Fallback: flat NAME tags if entity wrappers missing
  if (!names.size) {
    const nameRe = /<NAME\b[^>]*>([^<]*)<\/NAME>/gi;
    let m;
    while ((m = nameRe.exec(xml))) {
      const n = String(m[1] || '').replace(/\s+/g, ' ').trim();
      if (n) names.add(n);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

const MASTER_TAG_RE = '([A-Za-z][\\w]*(?::[A-Za-z][\\w]*)?)';

/**
 * Find top-level *.LIST blocks in a fragment (balanced).
 * @param {string} fragment
 * @returns {{ base: string, inner: string, start: number, end: number }[]}
 */
function findTopListBlocks(fragment) {
  const blocks = [];
  const openRe = new RegExp(`<${MASTER_TAG_RE}\\.LIST\\b[^>]*>`, 'gi');
  let open;
  while ((open = openRe.exec(fragment))) {
    const base = String(open[1]);
    const openTag = open[0];
    const innerStart = open.index + openTag.length;
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const openPat = new RegExp(`<${esc}\\.LIST\\b`, 'gi');
    const closePat = new RegExp(`</${esc}\\.LIST>`, 'gi');
    let depth = 1;
    let pos = innerStart;
    while (depth > 0 && pos < fragment.length) {
      openPat.lastIndex = pos;
      closePat.lastIndex = pos;
      const nextOpen = openPat.exec(fragment);
      const nextClose = closePat.exec(fragment);
      if (!nextClose) break;
      if (nextOpen && nextOpen.index < nextClose.index) {
        depth += 1;
        pos = nextOpen.index + nextOpen[0].length;
      } else {
        depth -= 1;
        if (depth === 0) {
          blocks.push({
            base: base.toUpperCase(),
            inner: fragment.slice(innerStart, nextClose.index),
            start: open.index,
            end: nextClose.index + nextClose[0].length,
          });
          openRe.lastIndex = nextClose.index + nextClose[0].length;
        } else {
          pos = nextClose.index + nextClose[0].length;
        }
      }
    }
  }
  return blocks.filter((b) => !blocks.some((o) => o !== b && b.start > o.start && b.end < o.end));
}

/**
 * @param {string} inner
 * @returns {string|string[]|Record<string, unknown>}
 */
function parseListItemValue(inner) {
  const nested = findTopListBlocks(inner);
  if (nested.length) return parseFragmentToValues(inner);

  const leafRe = new RegExp(`<${MASTER_TAG_RE}\\b[^>]*>([^<]*?)<\\/\\1>`, 'g');
  /** @type {Map<string, string[]>} */
  const byTag = new Map();
  let m;
  while ((m = leafRe.exec(inner))) {
    const name = String(m[1]).toUpperCase();
    if (name.endsWith('LIST')) continue;
    const v = String(m[2] || '').replace(/\s+/g, ' ').trim();
    if (!byTag.has(name)) byTag.set(name, []);
    byTag.get(name).push(v);
  }
  if (byTag.size === 0) {
    const t = String(inner || '').replace(/\s+/g, ' ').trim();
    return t || '';
  }
  if (byTag.size === 1) {
    const vals = [...byTag.values()][0];
    return vals.length === 1 ? vals[0] : vals;
  }
  /** @type {Record<string, string|string[]>} */
  const obj = {};
  for (const [k, vals] of byTag) {
    obj[k] = vals.length === 1 ? vals[0] : vals;
  }
  return obj;
}

/**
 * Parse a master XML fragment into a plain object of all leaf / list values (incl. UDF:).
 * @param {string} fragment
 * @returns {Record<string, unknown>}
 */
function parseFragmentToValues(fragment) {
  /** @type {Record<string, unknown>} */
  const result = {};
  const topLists = findTopListBlocks(fragment);
  const listSpans = topLists.map((b) => [b.start, b.end]);

  /** @type {Map<string, unknown[]>} */
  const listGroups = new Map();
  for (const block of topLists) {
    if (!listGroups.has(block.base)) listGroups.set(block.base, []);
    listGroups.get(block.base).push(parseListItemValue(block.inner));
  }
  for (const [base, items] of listGroups) {
    result[base] = items.length === 1 ? items[0] : items;
  }

  const leafRe = new RegExp(`<${MASTER_TAG_RE}\\b[^>]*>([^<]*?)<\\/\\1>`, 'g');
  let leafMatch;
  while ((leafMatch = leafRe.exec(fragment))) {
    const idx = leafMatch.index;
    if (listSpans.some(([a, b]) => idx >= a && idx < b)) continue;
    const name = String(leafMatch[1]).toUpperCase();
    if (name.endsWith('LIST') || name.includes('.')) continue;
    const v = String(leafMatch[2] || '').replace(/\s+/g, ' ').trim();
    if (Object.prototype.hasOwnProperty.call(result, name)) {
      const cur = result[name];
      if (Array.isArray(cur)) cur.push(v);
      else result[name] = [cur, v];
    } else {
      result[name] = v;
    }
  }
  return result;
}

/**
 * Extract full master records (all field values) from a Tally collection export.
 * @param {string} xml
 * @param {string} [entityTag]
 * @returns {Record<string, unknown>[]}
 */
function parseMasterRecordsFromXml(xml, entityTag = 'LEDGER') {
  if (!xml || typeof xml !== 'string') return [];
  const tag = String(entityTag || 'LEDGER').toUpperCase().replace(/\s+/g, '');
  const blockRe = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const records = [];
  let block;
  while ((block = blockRe.exec(xml))) {
    const attrs = block[1] || '';
    const inner = block[2] || '';
    const obj = parseFragmentToValues(inner);
    const nameAttr = /\bNAME="([^"]+)"/i.exec(attrs);
    if (nameAttr && !obj.NAME) obj.NAME = String(nameAttr[1]).replace(/\s+/g, ' ').trim();
    const name = String(obj.NAME || obj.name || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    obj.NAME = name;
    obj.name = name;
    records.push(obj);
  }
  return records;
}

/**
 * Flatten scalar leaves from a nested ledger object (lists/objects) into UPPERCASE keys.
 * First non-empty value wins per key.
 * @param {Record<string, unknown>} values
 * @returns {Record<string, string>}
 */
function flattenLedgerScalars(values) {
  /** @type {Record<string, string>} */
  const out = {};
  function walk(node) {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      const key = String(k).toUpperCase();
      if (v == null || v === '') continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        const s = String(v).replace(/\s+/g, ' ').trim();
        if (s && (out[key] == null || out[key] === '')) out[key] = s;
      } else {
        walk(v);
      }
    }
  }
  walk(values);
  return out;
}

/**
 * Promote common alternate / nested Tally tags onto canonical ledger keys for dump UI.
 * @param {Record<string, unknown>} rec
 * @returns {Record<string, unknown>}
 */
function enrichLedgerRecord(rec) {
  if (!rec || typeof rec !== 'object') return rec;
  const flat = flattenLedgerScalars(rec);
  const out = { ...rec };

  function setIfEmpty(canonical, aliases) {
    const cur = out[canonical];
    if (cur != null && String(cur).trim() !== '') return;
    for (const a of aliases) {
      const v = flat[String(a).toUpperCase()];
      if (v != null && String(v).trim() !== '') {
        out[canonical] = v;
        return;
      }
    }
  }

  setIfEmpty('MAILINGNAME', ['MAILINGNAME', 'MAILING NAME', 'BASICCOMPANYNAME']);
  setIfEmpty('LEDSTATENAME', [
    'LEDSTATENAME',
    'LEDGERSTATENAME',
    'STATENAME',
    'PRIORSTATENAME',
    'PLACEOFSUPPLY',
  ]);
  setIfEmpty('LEDGERSTATENAME', ['LEDGERSTATENAME', 'LEDSTATENAME', 'STATENAME', 'PRIORSTATENAME']);
  setIfEmpty('STATECODE', ['STATECODE', 'PLACEOFSUPPLY']);
  setIfEmpty('COUNTRYNAME', ['COUNTRYNAME', 'COUNTRY', 'COUNTRYOFRESIDENCE']);
  setIfEmpty('PINCODE', ['PINCODE', 'PINCODENUMBER', 'PIN', 'PINCODE NUMBER']);
  setIfEmpty('LEDGERPHONE', ['LEDGERPHONE', 'PHONE', 'PHONENUMBER']);
  setIfEmpty('FAX', ['FAX', 'LEDGERFAX', 'FAXNUMBER']);
  setIfEmpty('LEDGERMOBILE', ['LEDGERMOBILE', 'MOBILE', 'MOBILENUMBERS', 'MOBILENUMBER']);
  setIfEmpty('PARTYGSTIN', [
    'PARTYGSTIN',
    'GSTIN',
    'GSTINNUMBER',
    'GSTREGISTRATION',
    'PARTYGSTIN/UIN',
  ]);
  setIfEmpty('GSTIN', ['GSTIN', 'PARTYGSTIN', 'GSTINNUMBER']);
  setIfEmpty('INCOMETAXNUMBER', ['INCOMETAXNUMBER', 'PAN', 'INCOMETAXNO']);
  setIfEmpty('CREDITLIMIT', ['CREDITLIMIT']);
  setIfEmpty('BILLCREDITPERIOD', ['BILLCREDITPERIOD', 'CREDITPERIOD', 'BILLWISECREDITPERIOD']);
  setIfEmpty('CLOSINGBALANCE', ['CLOSINGBALANCE', 'CLOSINGBAL', 'CLOSING AMOUNT']);
  setIfEmpty('EMAIL', ['EMAIL', 'EMAILID']);
  setIfEmpty('EMAILCC', ['EMAILCC', 'CC', 'EMAILCCID']);
  setIfEmpty('WEBSITE', ['WEBSITE', 'WEBSITEURL', 'URL']);
  setIfEmpty('NARRATION', ['NARRATION', 'DESCRIPTION', 'NOTES']);
  setIfEmpty('DESCRIPTION', ['DESCRIPTION', 'NARRATION']);

  // Keep dual state keys populated for UI aliases
  if (!out.LEDGERSTATENAME && out.LEDSTATENAME) out.LEDGERSTATENAME = out.LEDSTATENAME;
  if (!out.LEDSTATENAME && out.LEDGERSTATENAME) out.LEDSTATENAME = out.LEDGERSTATENAME;
  if (!out.PARTYGSTIN && out.GSTIN) out.PARTYGSTIN = out.GSTIN;
  if (!out.GSTIN && out.PARTYGSTIN) out.GSTIN = out.PARTYGSTIN;

  return out;
}

/**
 * Probe all METADATA_PROBE_SPECS against live Tally.
 * @param {{ host?: string, port: number, company?: string|null, timeoutMs?: number }} opts
 */
async function discoverLiveMetadataObjects(opts) {
  const host = opts.host || '127.0.0.1';
  const port = opts.port;
  const company = opts.company || null;
  const timeoutMs = opts.timeoutMs ?? 45_000;

  if (!port) {
    return {
      objects: [],
      errors: [{ message: 'Tally port not available' }],
      reachable: false,
    };
  }

  const objects = [];
  const errors = [];
  let anyOk = false;
  const dates = voucherDateWindow();

  for (const spec of METADATA_PROBE_SPECS) {
    const entry = {
      objectKey: spec.objectKey,
      objectName: spec.objectName,
      collectionName: spec.collectionId,
      fields: [],
      source: 'live_sample',
      methods: [],
      parents: [],
      children: [],
    };

    try {
      let natives = probeNativesFor(spec);
      const exportOnce = async (nativeList) => {
        const xml = collectionExport(spec.collectionId, {
          company,
          extraNative: nativeList,
          explode: true,
          ...(spec.voucher ? dates : {}),
        });
        return postXml({ host, port, xml, timeoutMs });
      };

      let res = await exportOnce(natives);
      anyOk = true;
      let fieldRows = parseCollectionFieldsDetailed(res.body || '');

      // Second pass: empty *.LIST stubs → request ListBase.* explode natives for ALL lists
      const empties = emptyListPaths(fieldRows);
      if (empties.length) {
        const extra = empties.flatMap((f) => listPathToNatives(f.name));
        const enriched = [...new Set([...natives, ...extra])];
        if (enriched.length > natives.length) {
          natives = enriched;
          const res2 = await exportOnce(natives);
          if (res2?.ok || res2?.body) {
            fieldRows = mergeFieldRows(fieldRows, parseCollectionFieldsDetailed(res2.body || ''));
            res = res2;
          }
        }
      }

      entry.fields = toCatalogFields(fieldRows);
      entry.requestedNatives = natives;
      if (spec.objectKey === 'group') {
        entry.recordNames = extractMasterNamesFromXml(res.body || '', 'GROUP');
      }
      if (spec.objectKey === 'ledger') {
        entry.recordNames = extractMasterNamesFromXml(res.body || '', 'LEDGER');
      }
      if (!res.ok) {
        entry.probeError = `HTTP ${res.statusCode}`;
      } else if (!fieldRows.length) {
        entry.probeError = 'No field tags in Tally response';
      }
    } catch (err) {
      entry.fields = [];
      entry.probeError = err.message || String(err);
      errors.push({
        objectKey: spec.objectKey,
        collectionId: spec.collectionId,
        message: entry.probeError,
      });
    }

    objects.push(entry);
  }

  return {
    objects: anyOk || objects.length ? objects : [],
    errors,
    reachable: anyOk || errors.length === 0,
  };
}

module.exports = {
  METADATA_PROBE_SPECS,
  PROBE_NATIVES,
  parseCollectionFieldsFromXml,
  parseCollectionFieldsDetailed,
  extractMasterNamesFromXml,
  parseMasterRecordsFromXml,
  parseFragmentToValues,
  flattenLedgerScalars,
  enrichLedgerRecord,
  discoverLiveMetadataObjects,
  STRUCTURAL_TAGS,
};
