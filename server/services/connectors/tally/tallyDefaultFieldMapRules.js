'use strict';

/** Approved default ConnectorFieldMapping rules per entityType. */

function rules(pairs) {
  return pairs.map(([arivuFieldKey, externalFieldKey]) => ({
    arivuFieldKey,
    externalFieldKey,
    transform: null,
    confidence: 1,
    approved: true,
  }));
}

const DEFAULT_FIELD_MAP_RULES = Object.freeze({
  party: rules([
    ['name', 'NAME'],
    ['types', 'PARENT'],
    ['gstin', 'PARTYGSTIN'],
    ['gstRegistrationType', 'GSTREGISTRATIONTYPE'],
    ['stateCode', 'LEDGERSTATENAME'],
    ['address', 'ADDRESS'],
    ['phone', 'LEDGERPHONE'],
    ['website', 'WEBSITE'],
    ['taxId', 'INCOMETAXNUMBER'],
    ['externalReferenceId', 'GUID'],
  ]),
  item: rules([
    ['variant_code', 'NAME'],
    ['unit_of_measure', 'BASEUNITS'],
    ['hsnSac', 'HSNCODE'],
    ['gstRatePercent', 'GSTRATE'],
    ['gstTaxability', 'GSTAPPLICABLE'],
    ['selling_price', 'RATE'],
    ['cost_price', 'COSTINGMETHOD'],
    ['barcode', 'BARCODE'],
    ['category', 'PARENT'],
    ['externalReferenceId', 'GUID'],
  ]),
  godown: rules([
    ['name', 'NAME'],
    ['locationCode', 'NAME'],
    ['description', 'ADDRESS'],
    ['parentLocationId', 'PARENT'],
    ['externalReferenceId', 'GUID'],
  ]),
  stock_group: rules([
    ['name', 'NAME'],
    ['parentId', 'PARENT'],
    ['externalReferenceId', 'GUID'],
  ]),
  stock_category: rules([
    ['name', 'NAME'],
    ['parentId', 'PARENT'],
    ['externalReferenceId', 'GUID'],
  ]),
  invoice: rules([
    ['invoiceNumber', 'REFERENCE'],
    ['invoiceDate', 'DATE'],
    ['partyGstin', 'PARTYGSTIN'],
    ['placeOfSupply', 'PLACEOFSUPPLY'],
    ['grandTotal', 'AMOUNT'],
    ['irn', 'IRN'],
    ['subtotal', 'AMOUNT'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  purchase: rules([
    ['billNumber', 'REFERENCE'],
    ['billDate', 'DATE'],
    ['partyGstin', 'PARTYGSTIN'],
    ['grandTotal', 'AMOUNT'],
    ['placeOfSupply', 'PLACEOFSUPPLY'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  payment: rules([
    ['paymentNumber', 'REFERENCE'],
    ['amount', 'AMOUNT'],
    ['paymentDate', 'DATE'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  receipt: rules([
    ['paymentNumber', 'REFERENCE'],
    ['amount', 'AMOUNT'],
    ['paymentDate', 'DATE'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  credit_note: rules([
    ['creditNoteNumber', 'REFERENCE'],
    ['date', 'DATE'],
    ['partyGstin', 'PARTYGSTIN'],
    ['grandTotal', 'AMOUNT'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  debit_note: rules([
    ['debitNoteNumber', 'REFERENCE'],
    ['date', 'DATE'],
    ['partyGstin', 'PARTYGSTIN'],
    ['grandTotal', 'AMOUNT'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  stock_journal: rules([
    ['transactionNumber', 'REFERENCE'],
    ['date', 'DATE'],
    ['narration', 'NARRATION'],
    ['externalReferenceId', 'GUID'],
  ]),
  journal: rules([
    ['journalNumber', 'REFERENCE'],
    ['journalDate', 'DATE'],
    ['narration', 'NARRATION'],
    ['externalReferenceId', 'GUID'],
  ]),
  contra: rules([
    ['contraNumber', 'REFERENCE'],
    ['contraDate', 'DATE'],
    ['narration', 'NARRATION'],
    ['externalReferenceId', 'GUID'],
  ]),
  delivery_note: rules([
    ['deliveryNoteNumber', 'REFERENCE'],
    ['date', 'DATE'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  receipt_note: rules([
    ['receiptNoteNumber', 'REFERENCE'],
    ['date', 'DATE'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  purchase_order: rules([
    ['poNumber', 'REFERENCE'],
    ['poDate', 'DATE'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  sales_order: rules([
    ['orderNumber', 'REFERENCE'],
    ['orderDate', 'DATE'],
    ['partyLedgerName', 'PARTYLEDGERNAME'],
    ['externalReferenceId', 'GUID'],
  ]),
  unit: rules([
    ['name', 'NAME'],
    ['formalName', 'ORIGINALNAME'],
    ['isSimpleUnit', 'ISSIMPLEUNIT'],
    ['decimalPlaces', 'DECIMALPLACES'],
  ]),
  currency: rules([
    ['name', 'NAME'],
    ['isoCode', 'ISOCURRENCYCODE'],
    ['symbol', 'SYMBOL'],
  ]),
  cost_centre: rules([
    ['name', 'NAME'],
    ['parent', 'PARENT'],
    ['category', 'CATEGORY'],
  ]),
});

module.exports = {
  DEFAULT_FIELD_MAP_RULES,
};
