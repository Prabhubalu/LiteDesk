# Tally Verified Field Schema

Reference of real Tally fields for Arivu connector development.

## How to read the tables

Every module uses the **same columns**:

| Column | Meaning |
| --- | --- |
| Field name | Name you see in Tally / business language |
| XML tag | Tag to use in Fetch / import-export XML |
| Available? | **Yes** = always a real field · **Sometimes** = needs F11/F12 or nested list · **No** = not a real Tally field |
| Notes | Short usage note |

Code source for fetch lists: `server/services/connectors/tally/tallyFieldCatalog.js`

---

## Contents

| # | Module | Arivu target |
| --- | --- | --- |
| 1 | [Shared identity](#1-shared-identity) | All masters & vouchers |
| 2 | [Ledger](#2-ledger-party) | Organizations |
| 3 | [Group](#3-group) | Reference cache |
| 4 | [Stock Item](#4-stock-item) | Items |
| 5 | [Unit](#5-unit) | Reference cache |
| 6 | [Stock Group](#6-stock-group) | Catalog categories |
| 7 | [Stock Category](#7-stock-category) | Catalog categories |
| 8 | [Godown](#8-godown) | Inventory locations |
| 9 | [Price Level](#9-price-level) | Catalog price books (disabled) |
| 10 | [GST / Tax Ledger](#10-gst--tax-ledger) | TallyTaxMapping |
| 11 | [Payment Terms](#11-payment-terms) | Organization.paymentTerms string |
| 12 | [Cost Centre](#12-cost-centre) | CostCentre / reference |
| 13 | [Other reference masters](#13-other-reference-masters) | Reference cache |
| 14 | [Sales Order](#14-sales-order) | Sales orders |
| 15 | [Sales Invoice](#15-sales-invoice) | Invoices |
| 16 | [Receipt](#16-receipt) | Payments |
| 17 | [Credit Note / Debit Note](#17-credit-note--debit-note) | Invoices (CN/DN) |
| 18 | [Other vouchers](#18-other-vouchers) | Purchase, Payment, Journal, etc. |
| 19 | [Do not use](#19-do-not-use) | Invented / CRM-only fields |

---

## 1. Shared identity

These tags appear on almost every master and voucher.

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| GUID | `GUID` | Yes | Best external key for sync |
| Master ID | `MASTERID` | Yes | Numeric id inside Tally |
| Alter ID | `ALTERID` | Yes | Local change counter |
| Remote Alter ID | `REMOTEALTERID` | Yes | Multi-company sync only |
| Remote Company ID | `REMOTECMPGUID` | Sometimes | Not the same as Alter ID |

---

## 2. Ledger (party)

**Arivu:** Organizations  
**Filter:** Parent = Sundry Debtors or Sundry Creditors

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Ledger name | `NAME` | Yes | Primary name |
| Alias | `NAME.LIST` | Yes | Extra names in the same list |
| Parent group | `PARENT` | Yes | Debtors → customer, Creditors → vendor |
| Opening balance | `OPENINGBALANCE` | Yes | Dr/Cr is the **sign** of the amount |
| Opening balance type (Dr/Cr) | — | No | Not a separate field |
| Mailing name | `MAILINGNAME` | Yes | |
| Address | `ADDRESS` | Sometimes | Inside `ADDRESS.LIST` as repeated lines |
| Address line 1 / 2 / 3 | — | No | Tally does not store structured lines |
| City | — | No | Usually just another address line |
| Pincode | `PINCODE` | Yes | |
| State name | `LEDGERSTATENAME` | Yes | |
| State code | `STATECODE` | Yes | Prefer this for GST |
| Country | `COUNTRYNAME` | Yes | |
| Phone | `LEDGERPHONE` | Yes | |
| Mobile | `LEDGERMOBILE` | Yes | |
| Email | `EMAIL` | Yes | |
| Website | `WEBSITE` | Yes | |
| Contact person | `LEDGERCONTACT` | Yes | |
| PAN | `INCOMETAXNUMBER` | Yes | |
| GSTIN / UIN | `PARTYGSTIN` | Yes | Also `GSTIN` |
| GST registration type | `GSTREGISTRATIONTYPE` | Yes | Regular / Composition / etc. |
| Place of supply | `PLACEOFSUPPLY` | Sometimes | Inside GST registration details (Rel 3+) |
| GST applicable | `GSTAPPLICABLE` | Yes | |
| GST type of supply | `GSTTYPEOFSUPPLY` | Yes | |
| Taxability | `GSTDETAILS` | Sometimes | Nested GST details list |
| Reverse charge | — | Sometimes | Inside GST details when enabled |
| Credit period | `BILLCREDITPERIOD` | Yes | Days / period string |
| Credit limit | `CREDITLIMIT` | Yes | |
| Bill-wise tracking | `ISBILLWISEON` | Yes | |
| Cost centre applicable | `ISCOSTCENTRESON` | Yes | |
| Currency | `CURRENCYNAME` | Yes | |
| Bank name | `BANKNAME` | Sometimes | Party e-payment details |
| Account number | `ACCOUNTNUMBER` | Sometimes | |
| IFSC | `IFSCODE` | Sometimes | |
| TDS / TCS | — | Sometimes | Only if those features are on |
| Narration / notes | `NARRATION` | Yes | |
| Closing balance | `CLOSINGBALANCE` | Yes | Exported / computed |
| Is revenue ledger | — | No | This is a **Group** field |
| Inventory values affected | — | No | This is a **Group** field |
| Is deemed positive | — | No | This is a **Group** field |
| Default tax ledger | — | No | Not a party ledger field |
| Is active | — | No | No reliable universal ledger flag |

---

## 3. Group

**Arivu:** Reference cache only (no CRM Groups module)

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Group name | `NAME` | Yes | |
| Alias | `NAME.LIST` | Yes | |
| Parent group | `PARENT` | Yes | |
| Is revenue | `ISREVENUE` | Yes | |
| Is deemed positive | `ISDEEMEDPOSITIVE` | Yes | |
| Is addable | `ISADDABLE` | Yes | |
| Cost centre applicable | `ISCOSTCENTRESON` | Yes | |
| Inventory values affected | `ISINVENTORYAFFECTED` | Yes | |
| GST applicable | `GSTAPPLICABLE` | Sometimes | GST setups |
| Display in Balance Sheet | — | No | Report UI only |
| Display in Profit & Loss | — | No | Report UI only |
| Display in Trial Balance | — | No | Report UI only |
| Display order | — | No | Report UI only |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 4. Stock Item

**Arivu:** Items (+ variants / inventory)

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Name | `NAME` | Yes | |
| Alias | `NAME.LIST` | Yes | |
| Part number | `PARTNO` | Yes | Enable “Use Part No” in F12 |
| Description | `DESCRIPTION` | Yes | |
| Notes | `NARRATION` | Yes | |
| Parent stock group | `PARENT` | Yes | |
| Stock category | `CATEGORY` | Yes | |
| Base unit | `BASEUNITS` | Yes | |
| Additional unit | `ADDITIONALUNITS` | Yes | |
| Conversion | `CONVERSION` | Yes | |
| Barcode | `BARCODE` | Yes | |
| HSN / SAC | `HSNCODE` | Yes | Also `HSN` |
| GST applicable | `GSTAPPLICABLE` | Yes | |
| GST rate | `GSTRATE` | Yes | |
| GST type of supply | `GSTTYPEOFSUPPLY` | Yes | |
| Opening quantity | `OPENINGBALANCE` | Yes | Quantity context |
| Opening rate | `OPENINGRATE` | Yes | |
| Opening value | `OPENINGVALUE` | Yes | |
| Closing quantity | `CLOSINGBALANCE` | Yes | |
| Closing rate | `CLOSINGRATE` | Yes | |
| Closing value | `CLOSINGVALUE` | Yes | |
| Standard selling price | `STANDARDPRICELIST` | Yes | Use this for selling price |
| Standard cost | `STANDARDCOSTLIST` | Yes | Use this for cost price |
| Rate | `RATE` | Sometimes | Export helper; prefer standard lists |
| MRP | `MRP` | Yes | |
| Costing method | `COSTINGMETHOD` | Yes | FIFO / Average / etc. **Not a price** |
| Valuation method | `VALUATIONMETHOD` | Yes | |
| Reorder level | — | Sometimes | Feature-gated |
| Godown (opening) | `GODOWNNAME` | Sometimes | Often via allocations |
| Batch-wise details | `ISBATCHWISEON` | Yes | Also `HASBATCHNUMBERS` |
| Track expiry | `HASEXPIRYDATE` | Yes | |
| Perishable | `ISPERISHABLE` | Yes | |
| Batch name | — | Sometimes | On batch / lot, not item scalar |
| Manufacturing date | — | Sometimes | On batch / lot |
| Expiry date | — | Sometimes | On batch / lot |
| Bill of materials | — | Sometimes | Component collections |
| Ignore physical difference | `IGNOREPHYSICALDIFFERENCE` | Yes | |
| Ignore negative stock | `IGNORENEGATIVESTOCK` | Yes | |
| Brand | — | No | Use Group / Category / UDF |
| Model | — | No | Use Group / Category / UDF |
| Style | — | No | Use Group / Category / UDF |
| Colour | — | No | Use Group / Category / UDF |
| Size | — | No | Use Group / Category / UDF |
| Manufacturer | — | No | Use Group / Category / UDF |
| Min order quantity | — | No | Not standard |
| Max order quantity | — | No | Not standard |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

**Important:** Do **not** map `COSTINGMETHOD` → Arivu `cost_price`.

---

## 5. Unit

**Arivu:** Reference cache (resolve into item UOM)

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Name | `NAME` | Yes | Also used as symbol |
| Formal name | `ORIGINALNAME` | Yes | |
| Is simple unit | `ISSIMPLEUNIT` | Yes | Simple vs compound |
| Decimal places | `DECIMALPLACES` | Yes | |
| Base unit | `BASEUNITS` | Yes | Compound units |
| Additional unit | `ADDITIONALUNITS` | Yes | Compound units |
| Conversion | `CONVERSION` | Yes | Compound units |
| GST reporting UOM | `GSTREPUOM` | Yes | |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 6. Stock Group

**Arivu:** Catalog categories (primary tree)

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Name | `NAME` | Yes | |
| Parent | `PARENT` | Yes | |
| Is addable | `ISADDABLE` | Yes | |
| GST applicable | `GSTAPPLICABLE` | Sometimes | Prefer GST on Item |
| HSN / SAC | `HSNCODE` | Sometimes | Prefer HSN on Item |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 7. Stock Category

**Arivu:** Catalog categories (second hierarchy — keep separate from Stock Group)

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Name | `NAME` | Yes | |
| Parent | `PARENT` | Yes | |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 8. Godown

**Arivu:** Inventory locations

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Name | `NAME` | Yes | |
| Parent godown | `PARENT` | Yes | |
| Address | `ADDRESS` | Sometimes | Inside `ADDRESS.LIST` |
| Godown type | `GODOWNTYPE` | Sometimes | |
| Has stock | `HASSTOCK` | Yes | |
| Jobber stock | `JOBBERSTOCK` | Sometimes | |
| Is primary / default | — | Sometimes | Map by convention to Arivu `isDefault` |
| Contact person | — | Sometimes | Often missing / UDF only |
| Phone | — | Sometimes | Often missing / UDF only |
| Email | — | Sometimes | Often missing / UDF only |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 9. Price Level

**Arivu:** Catalog price books (currently disabled / discover-only)

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Price level name | `NAME` | Yes | Price Level master |
| Item rate under level | — | Sometimes | Nested under item × price level |
| Applicable from | — | Sometimes | On price rows; release-dependent |
| Applicable to | — | Sometimes | On price rows; release-dependent |
| Quantity from | — | Sometimes | Weak support vs CRM price books |
| Quantity to | — | No | No clean max-qty model |
| Discount % | — | No | Not a full CRM price-book field |
| Inclusive of tax | — | No | Not modeled cleanly |

Until Price Level sync is enabled, use Stock Item standard selling price.

---

## 10. GST / Tax Ledger

**Arivu:** `TallyTaxMapping` (+ Tax)  
**Important:** Never create Organizations for these ledgers.

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Name | `NAME` | Yes | Match key for voucher tax lines |
| Parent | `PARENT` | Yes | Must be under Duties & Taxes |
| Tax type | `TAXTYPE` | Yes | |
| GST duty head | `GSTDUTYHEAD` | Yes | CGST / SGST / IGST / CESS |
| Behave as duty | `ISBEHAVEASDUTY` | Yes | |
| GST applicable | `GSTAPPLICABLE` | Yes | |
| GST rate | `GSTRATE` | Sometimes | Often from tax unit / details |
| HSN / SAC | — | No | Belongs on Stock Item |
| Registration type | — | No | Belongs on party Ledger |
| Taxability | — | No | Belongs on Stock Item |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 11. Payment Terms

**Arivu:** `Organization.paymentTerms` (text only)  
There is **no** standard Tally Payment Terms master.

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Credit period on party | `BILLCREDITPERIOD` | Yes | Only common real source |
| Terms name (master) | — | No | Not a Tally sync master |
| Due date basis | — | No | Invented |
| Grace period | — | No | Invented |
| Discount % | — | No | Invented |
| Discount validity | — | No | Invented |
| Applicable from / to | — | No | Invented |

---

## 12. Cost Centre

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Name | `NAME` | Yes | |
| Parent | `PARENT` | Yes | |
| Cost category | `CATEGORY` | Yes | |
| Allocate revenue | `REVENUELEDGER` | Yes | |
| Allocate non-revenue | `NONREVENUELEDGER` | Yes | |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 13. Other reference masters

| Module | Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- | --- |
| Cost Category | Name | `NAME` | Yes | |
| Cost Category | Parent | `PARENT` | Yes | |
| Cost Category | GUID | `GUID` | Yes | |
| Voucher Type | Name | `NAME` | Yes | |
| Voucher Type | Parent | `PARENT` | Yes | |
| Voucher Type | GUID | `GUID` | Yes | |
| Currency | Name | `NAME` | Yes | |
| Currency | Formal name | `ORIGINALNAME` | Yes | Also `FORMALNAME` |
| Currency | ISO code | `ISOCURRENCYCODE` | Yes | |
| Currency | Decimal places | `DECIMALPLACES` | Yes | |
| Currency | Symbol | `SYMBOL` | Yes | |
| Currency | GUID | `GUID` | Yes | |
| Tax Unit | Name / GUID | — | Sometimes | GST feature |
| GST Classification | Name / GUID | — | Sometimes | GST feature |
| Batch | Batch fields | — | Sometimes | Under item / voucher collections |

---

## 14. Sales Order

**Arivu:** Sales orders · Direction: Arivu → Tally

### Header fields

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Date | `DATE` | Yes | |
| Voucher type | `VOUCHERTYPENAME` | Yes | e.g. Sales Order |
| Voucher number | `VOUCHERNUMBER` | Yes | |
| Reference / order number | `REFERENCE` | Yes | Often used as order no. |
| Narration | `NARRATION` | Yes | |
| Party ledger | `PARTYLEDGERNAME` | Yes | |
| Buyer name | `BASICBUYERNAME` | Sometimes | |
| Party GSTIN | `PARTYGSTIN` | Yes | |
| Place of supply | `PLACEOFSUPPLY` | Yes | |
| Is optional | `ISOPTIONAL` | Yes | |
| Is cancelled | `ISCANCELLED` | Yes | |
| Entered by | `ENTEREDBY` | Sometimes | |
| Order status | — | No | Map from Arivu status |
| Order type | — | No | Not a native Tally enum |
| E-way bill | — | No | Use Invoice / Delivery Note |
| IRN | — | No | Use Invoice |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

### Line fields

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Stock item | `STOCKITEMNAME` | Yes | |
| Quantity | `BILLEDQTY` | Yes | Also `ACTUALQTY` |
| Rate | `RATE` | Yes | |
| Amount | `AMOUNT` | Yes | |
| Ledger name | `LEDGERNAME` | Yes | Accounting / tax lines |
| Godown | `GODOWNNAME` | Sometimes | |
| Batch | `BATCHNAME` | Sometimes | |

---

## 15. Sales Invoice

**Arivu:** Invoices · Direction: Arivu → Tally

### Header fields

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Date | `DATE` | Yes | |
| Effective date | `EFFECTIVEDATE` | Yes | |
| Voucher type | `VOUCHERTYPENAME` | Yes | Sales |
| Voucher number | `VOUCHERNUMBER` | Yes | |
| Reference | `REFERENCE` | Yes | |
| Narration | `NARRATION` | Yes | |
| Party ledger | `PARTYLEDGERNAME` | Yes | |
| Buyer name | `BASICBUYERNAME` | Sometimes | |
| Party GSTIN | `PARTYGSTIN` | Yes | |
| Place of supply | `PLACEOFSUPPLY` | Yes | |
| Bill to place | `BILLTOPLACE` | Sometimes | |
| Ship to place | `SHIPTOPLACE` | Sometimes | |
| Consignee GSTIN | `CONSIGNEEGSTIN` | Sometimes | |
| Consignee state | `CONSIGNEESTATENAME` | Sometimes | |
| Is invoice | `ISINVOICE` | Yes | |
| IRN | `IRN` | Yes | This **is** the e-invoice id |
| E-invoice number | — | No | Do not invent a second field; use IRN |
| Ack number | `IRNACKNO` | Yes | |
| Ack date | `IRNACKDATE` | Yes | |
| IRN QR | `IRNQRCODE` | Yes | |
| E-way bill number | — | Sometimes | Tag name varies by release |
| Payment mode | — | No | Belongs on Receipt |
| Bank ledger | — | No | Belongs on Receipt |
| Is cancelled | `ISCANCELLED` | Yes | |
| Is optional | `ISOPTIONAL` | Yes | |
| Entered by | `ENTEREDBY` | Sometimes | |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

### Line fields

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Stock item | `STOCKITEMNAME` | Yes | |
| Quantity | `BILLEDQTY` | Yes | Also `ACTUALQTY` |
| Rate | `RATE` | Yes | |
| Amount | `AMOUNT` | Yes | |
| Tax / other ledger | `LEDGERNAME` | Yes | Resolve via tax mapping |
| Godown | `GODOWNNAME` | Sometimes | |
| Batch | `BATCHNAME` | Sometimes | |

---

## 16. Receipt

**Arivu:** Payments (customer receipts) · Direction: Arivu → Tally

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Date | `DATE` | Yes | |
| Voucher type | `VOUCHERTYPENAME` | Yes | Receipt |
| Voucher number | `VOUCHERNUMBER` | Yes | |
| Reference | `REFERENCE` | Yes | |
| Narration | `NARRATION` | Yes | |
| Party ledger | `PARTYLEDGERNAME` | Yes | |
| Amount | `AMOUNT` | Yes | |
| Bank / cash ledger | `LEDGERNAME` | Yes | In voucher entries (not one header field) |
| Bill allocation | `BILLALLOCATIONS` | Yes | Against invoices |
| Instrument / cheque | — | Sometimes | Bank allocation collection |
| Is cancelled | `ISCANCELLED` | Yes | |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 17. Credit Note / Debit Note

**Arivu:** Invoices with `invoiceType` = credit_note / debit_note

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Date | `DATE` | Yes | |
| Voucher type | `VOUCHERTYPENAME` | Yes | |
| Voucher number | `VOUCHERNUMBER` | Yes | |
| Reference | `REFERENCE` | Yes | |
| Narration | `NARRATION` | Yes | |
| Party ledger | `PARTYLEDGERNAME` | Yes | |
| Party GSTIN | `PARTYGSTIN` | Yes | |
| Place of supply | `PLACEOFSUPPLY` | Yes | |
| Stock item | `STOCKITEMNAME` | Yes | Line |
| Quantity | `BILLEDQTY` | Yes | Line |
| Rate | `RATE` | Yes | Line |
| Amount | `AMOUNT` | Yes | |
| Ledger name | `LEDGERNAME` | Yes | |
| IRN | `IRN` | Sometimes | Credit Note when e-invoice applies |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

---

## 18. Other vouchers

### Tags used by all vouchers

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Date | `DATE` | Yes | |
| Voucher type | `VOUCHERTYPENAME` | Yes | |
| Voucher number | `VOUCHERNUMBER` | Yes | |
| Reference | `REFERENCE` | Yes | |
| Narration | `NARRATION` | Yes | |
| Is cancelled | `ISCANCELLED` | Yes | |
| GUID | `GUID` | Yes | |
| Master ID | `MASTERID` | Yes | |
| Alter ID | `ALTERID` | Yes | |

### Extra tags by voucher type

| Tally voucher | Arivu module | Extra XML tags |
| --- | --- | --- |
| Payment | Vendor payments | `PARTYLEDGERNAME`, `AMOUNT`, `LEDGERNAME` |
| Purchase | Purchase bills | `PARTYLEDGERNAME`, `PARTYGSTIN`, `PLACEOFSUPPLY`, item + ledger lines |
| Journal | Journal entries | `LEDGERNAME`, `AMOUNT`, `COSTCENTRE` |
| Contra | Journal entries | `LEDGERNAME`, `AMOUNT` |
| Stock Journal | Inventory transfers | `STOCKITEMNAME`, `ACTUALQTY`, `RATE`, `GODOWNNAME`, `BATCHNAME` |
| Delivery Note | Delivery notes | `PARTYLEDGERNAME`, `STOCKITEMNAME`, `ACTUALQTY`, `GODOWNNAME` |
| Receipt Note | Receipt notes | `PARTYLEDGERNAME`, `STOCKITEMNAME`, `ACTUALQTY`, `GODOWNNAME` |
| Purchase Order | Purchase orders | `PARTYLEDGERNAME`, `STOCKITEMNAME`, `BILLEDQTY`, `RATE`, `AMOUNT` |

### Inventory line tags (shared)

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Stock item | `STOCKITEMNAME` | Yes | |
| Billed qty | `BILLEDQTY` | Yes | |
| Actual qty | `ACTUALQTY` | Yes | |
| Rate | `RATE` | Yes | |
| Amount | `AMOUNT` | Yes | |
| Godown | `GODOWNNAME` | Sometimes | |
| Batch | `BATCHNAME` | Sometimes | |

### Accounting line tags (shared)

| Field name | XML tag | Available? | Notes |
| --- | --- | --- | --- |
| Ledger name | `LEDGERNAME` | Yes | |
| Amount | `AMOUNT` | Yes | |
| Cost centre | `COSTCENTRE` | Sometimes | Common on Journal |

---

## 19. Do not use

These are **not** Tally fields. Do not put them in Fetch lists.

| Fake field name | Why |
| --- | --- |
| Last sync date | Arivu connector only |
| Last sync status | Arivu connector only |
| Object type | Arivu `entityType` |
| Company ID | Binding context, not an object field |
| Is modified | Connector hash |
| Is system (masters) | Not a standard export field |
| Created date / by (masters) | Not reliable master storage |
| Modified date / by (masters) | Not reliable master storage |
| Address line 1 / 2 / 3 + City | Only `ADDRESS.LIST` lines exist |
| Brand / Model / Style / Colour / Size / Manufacturer | Not default Stock Item methods |
| Payment Terms master fields | Use party `BILLCREDITPERIOD` |
| Group display-in-report flags | Report UI only |

---

## 20. Quick rules

| Rule | Detail |
| --- | --- |
| 1 | Prefer `GUID` as the external key |
| 2 | Party GST: prefer `STATECODE` over state name |
| 3 | Item selling price → `STANDARDPRICELIST` |
| 4 | Item cost price → `STANDARDCOSTLIST` |
| 5 | Never map `COSTINGMETHOD` to a price |
| 6 | Tax ledgers → `TallyTaxMapping`, never Organizations |
| 7 | Payment terms → party `BILLCREDITPERIOD` only |
| 8 | Address is a list of lines, not structured city fields |
| 9 | Fetch lists live in `tallyFieldCatalog.js` |
