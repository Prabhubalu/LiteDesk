---
name: Ledger Field Mapping
overview: Per-module Tally→Arivu field matrices plus a master Tally module → Arivu module summary table.
todos:
  - id: confirm-ledger
    content: Approve Ledger Yes/Partial/People maps (Organizations + primaryContact)
    status: pending
  - id: confirm-group
    content: Approve Group as reference-cache only (ConnectorExternalObject + remotePayload; no CRM Group module)
    status: pending
  - id: confirm-stock-item
    content: Approve refreshed Stock Item matrix (Manufacturer, Opening Quantity, Alter/Remote IDs, sync meta); fix COSTINGMETHOD seed bug
    status: pending
  - id: confirm-unit
    content: Approve Unit as reference-cache only; resolve Item.unit_of_measure from unit name/symbol
    status: pending
  - id: confirm-stock-group
    content: Approve Stock Group → CatalogCategory (name, parentId, isActive); GST/HSN stay on Item not category
    status: pending
  - id: confirm-stock-category
    content: Approve Stock Category → CatalogCategory coexistence strategy with Stock Group (namespace/roots)
    status: pending
  - id: confirm-godown
    content: Approve Godown → InventoryLocation (addressSnapshot/contactSnapshot; isDefault; syncStatus)
    status: pending
  - id: confirm-price-list
    content: Approve Price List future map to CatalogPriceBook + Entry (currently discoverOnly/disabled)
    status: pending
  - id: confirm-gst-tax-ledger
    content: Approve GST/Tax Ledger → TallyTaxMapping + Tax (+ ref cache); never Organizations
    status: pending
  - id: confirm-payment-terms
    content: Approve Payment Terms as string-on-party/docs only (no PaymentTerms master module)
    status: pending
  - id: confirm-cost-centre
    content: Approve Cost Centre → CostCentre model upsert (today still referenceOnly in Tally defaults)
    status: pending
  - id: confirm-sales-order
    content: Approve Sales Order arivu_to_tally map (SalesOrder + lines); expand beyond thin REFERENCE/DATE/PARTY/GUID seed
    status: pending
  - id: confirm-sales-invoice
    content: Approve Sales Invoice arivu_to_tally map (Invoice + lines + GST/e-invoice fields)
    status: pending
  - id: confirm-receipt
    content: Approve Receipt → Payments (customer receipts) arivu_to_tally; allocations via PaymentAllocation
    status: pending
  - id: confirm-credit-note
    content: Approve Credit Note as Invoice invoiceType=credit_note; fix seed keys to invoiceNumber/invoiceDate
    status: pending
  - id: confirm-debit-note
    content: Approve Debit Note as Invoice invoiceType=debit_note (supplier party); fix debitNoteNumber/date seeds
    status: pending
  - id: next-modules
    content: User supplies next module field lists (Payment voucher, Purchase, Journal, etc.) as separate titled tables
    status: pending
isProject: false
---

# Tally ↔ Arivu Field Mapping (per module)

## Shared rules

- Sync ways / defaults: [tallyModuleMappingDefaults.js](server/constants/tallyModuleMappingDefaults.js), [TALLY_MODULE_FIELD_CATALOG.md](docs/TALLY_MODULE_FIELD_CATALOG.md)
- **Verified Tally tags (all modules):** [TALLY_VERIFIED_FIELD_SCHEMA.md](docs/TALLY_VERIFIED_FIELD_SCHEMA.md) — use this over plan labels when coding Fetch/XML
- Party field seeds: [tallyDefaultFieldMapRules.js](server/services/connectors/tally/tallyDefaultFieldMapRules.js)
- Reference masters land in [ConnectorExternalObject](server/models/ConnectorExternalObject.js) (`referenceOnly`, `metadata.remotePayload`)

### Legend — Arivu has field?

| Value | Meaning |
|---|---|
| Yes | First-class CRM / connector typed field |
| Partial | Exists but different shape, Mixed blob, or wrong semantics |
| Via People | Organization has no field; use People + `primaryContact` |
| Yes (ref) | Typed field on `ConnectorExternalObject` only (not a CRM module) |
| Payload only | Untyped inside `metadata.remotePayload` if inbound XML included it |
| No | Not in Arivu |

Format for every field module below: **Title → table** (Tally field | Arivu has field? | Arivu field | Map to).

---

## Tally module → Arivu module (summary)

Source of truth for sync defaults: [tallyModuleMappingDefaults.js](server/constants/tallyModuleMappingDefaults.js). Rows marked * are analyzed in this plan but not a separate keyed row there (or differ from product default).

| # | Tally module | Arivu module | Sync way | Notes |
|---|---|---|---|---|
| 1 | Ledger (Debtors/Creditors) | Organizations | bidirectional | Party only; exclude system ledgers |
| 2 | Group | — (reference) | tally_to_arivu | `ConnectorExternalObject` only |
| 3 | Stock Item | Items | bidirectional | + ItemVariant / inventory |
| 4 | Unit | — (reference) | tally_to_arivu | Resolve into item UOM |
| 5 | Stock Group | Catalog categories | bidirectional | Primary category tree |
| 6 | Stock Category | Catalog categories | bidirectional | Same tree — coexistence required |
| 7 | Godown | Inventory locations | bidirectional | Best sync triad fit |
| 8 | Price List / Price Level | CatalogPriceBook (+ Entry)* | disabled / discover-only | Models exist; not wired |
| 9 | GST / Tax Ledger* | TallyTaxMapping (+ Tax) | via tax map / ref | Not Organizations |
| 10 | Payment Terms* | Organization.`paymentTerms` (string) | via party ledger | No Terms master |
| 11 | Cost Centre | CostCentre model* / journal cache | tally_to_arivu | Defaults `referenceOnly`; model exists |
| 12 | Sales Order | Sales orders | arivu_to_tally | Open/Approved + date window |
| 13 | Sales (Invoice) | Invoices | arivu_to_tally | Posted + date window |
| 14 | Receipt | Payments | arivu_to_tally | Customer receipts |
| 15 | Credit Note | Invoices (`credit_note`) | arivu_to_tally | Same Invoice model |
| 16 | Debit Note | Invoices (`debit_note`) | arivu_to_tally | Supplier party; not purchase_bills |

### Other defaults (not yet field-mapped in this plan)

| Tally module | Arivu module | Sync way |
|---|---|---|
| Currency | — (reference) | tally_to_arivu |
| Cost Category | — (reference) | tally_to_arivu |
| Voucher Type | — (reference) | tally_to_arivu |
| Tax Unit | — (reference) | tally_to_arivu |
| GST Classification | — (reference) | tally_to_arivu |
| Batch | — (reference) | tally_to_arivu |
| Purchase | Purchase bills | arivu_to_tally |
| Payment | Vendor payments | arivu_to_tally |
| Journal | Journal entries | arivu_to_tally |
| Contra | Journal entries (contra) | arivu_to_tally |
| Stock Journal | Inventory transfers / adjustments | bidirectional |
| Delivery Note | Delivery notes | arivu_to_tally |
| Receipt Note | Receipt notes | arivu_to_tally |
| Purchase Order | Purchase orders | arivu_to_tally |
| Employee / Pay Head / Attendance / Budget | — | disabled / discover-only |

---

## Module 1 — Ledger (Debtors/Creditors) → Organizations

**Arivu target:** Organizations (`entityType: party`) · bidirectional · filter Parent ∈ Sundry Debtors/Creditors  
**Contact fields:** People via `Organization.primaryContact`  
**Seeded today:** name, types←PARENT, gstin, gstRegistrationType, stateCode←LEDGERSTATENAME, address, phone, website, taxId, externalReferenceId←GUID

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Ledger Name | Yes | `Organization.name` | Direct (`NAME`) — seeded |
| Alias | No | — | customFields or skip |
| Parent Group | Partial | `Organization.types[]` | Debtors→customer / Creditors→vendor (`PARENT`) |
| Opening Balance | No | — | Tally meta only |
| Opening Balance Type (Dr/Cr) | No | — | Tally meta only |
| Mailing Name | No | — | customFields or skip |
| Address Line 1 | Partial | `address` / `billingAddressStructured.line1` | Prefer structured |
| Address Line 2 | Partial | `billingAddressStructured.line2` | Mixed only |
| Address Line 3 | Partial | `billingAddressStructured.line3` | Mixed only |
| City | Partial | `billingAddressStructured.city` | Mixed only |
| State | Partial | `billingAddressStructured.state` + `stateCode` | Split name vs GST code |
| Country | Partial | `billingAddressStructured.country` | Mixed only |
| Pincode | Partial | `billingAddressStructured.postalCode` | Mixed only |
| Phone | Yes | `Organization.phone` | Seeded (`LEDGERPHONE`) |
| Mobile | Via People | `People.mobile` | People + `primaryContact` |
| Email | Via People | `People.email` | People + `primaryContact` |
| Website | Yes | `Organization.website` | Seeded |
| Contact Person | Via People | `People.first_name` (+ `last_name`) | People + `primaryContact` |
| PAN Number | Yes | `Organization.taxId` | Seeded (`INCOMETAXNUMBER`) |
| GSTIN/UIN | Yes | `Organization.gstin` | Seeded |
| GST Registration Type | Yes | `Organization.gstRegistrationType` | Enum normalize — seeded |
| Place of Supply | No | — | Voucher default / customFields |
| State Code | Yes | `Organization.stateCode` | Prefer `STATECODE` |
| Is GST Applicable | No | — | customFields / skip |
| Nature of Transaction | No | — | customFields / skip |
| Taxability | No | — | customFields / skip |
| Reverse Charge Applicable | No | — | customFields / skip |
| Credit Period | Yes | `Organization.paymentTerms` | Rule missing |
| Credit Limit | Yes | `Organization.creditLimit` | Rule missing |
| Bill-wise Tracking | No | — | Tally meta |
| Cost Centre Applicable | No | — | Tally meta |
| Maintain Balances Bill-by-Bill | No | — | Tally meta |
| Interest Calculation | No | — | Tally meta |
| Interest Rate | No | — | Tally meta |
| Currency | No | — | Currency master cache (not party field) |
| Bank Name | No | — | Bank ledger — out of party scope |
| Account Number | No | — | Bank ledger — out of scope |
| IFSC Code | No | — | Bank ledger — out of scope |
| Branch Name | No | — | Bank ledger — out of scope |
| Account Holder Name | No | — | Bank ledger — out of scope |
| SWIFT Code | No | — | Bank ledger — out of scope |
| TDS Applicable | No | — | customFields / skip |
| TDS Nature | No | — | customFields / skip |
| Deductee Type | No | — | customFields / skip |
| TCS Applicable | No | — | customFields / skip |
| TCS Nature | No | — | customFields / skip |
| Default Tax Ledger | No | — | `TallyTaxMapping` |
| Inventory Values Affected | No | — | Skip |
| Is Cost Centre Applicable | No | — | Tally meta |
| Is Revenue Ledger | No | — | Skip |
| Is Deemed Positive | No | — | Skip |
| Is Active | Yes | `Organization.isActive` | Sync filter or direct |
| Notes | No | — | tags / customFields |
| Created Date | Partial | `createdAt` | Do not overwrite from Tally |
| Modified Date | Partial | `updatedAt` | Conflict only |
| GUID | Yes | `Organization.externalReferenceId` | Seeded |
| Master ID | No | — | Tally identity meta |
| Remote ID | No | — | Tally identity meta |

**Ledger counts:** Yes ~15 · Partial ~10 · Via People 3 · No ~30+

---

## Module 2 — Group → Reference cache (no CRM module)

**Arivu target:** none (`arivuModuleKey: null`) · `entityType: group` · sync `tally_to_arivu` · `referenceOnly: true`  
**Storage:** `ConnectorExternalObject` + `metadata.remotePayload`  
**No** default field-map rules for `group` (unlike `stock_group` → Catalog categories).  
**Role:** Resolve ledger PARENT / voucher group names; not a user-facing CRM record.

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Group Name | Yes (ref) / Payload | `externalId` + `remotePayload.NAME` | Identity key for cache |
| Alias | Payload only | `remotePayload` | No typed field |
| Parent Group | Payload only | `remotePayload.PARENT` | Needed for hierarchy resolve |
| Primary Group | Payload only | `remotePayload` | No typed field |
| Nature of Group | Payload only | `remotePayload` | Assets/Liab/Income/Expense — cache if present |
| Group Type | Payload only | `remotePayload` | No typed field |
| Is Revenue | Payload only | `remotePayload` | Accounting flag — no CRM field |
| Is Deemed Positive | Payload only | `remotePayload` | Accounting flag |
| Net Debit/Credit Balances | Payload only | `remotePayload` | Accounting flag |
| Use for Calculation | Payload only | `remotePayload` | Accounting flag |
| Addable to Gross Profit | Payload only | `remotePayload` | Accounting flag |
| Appropriate for Sub-Ledgers | Payload only | `remotePayload` | Accounting flag |
| Is Cost Centre Applicable | Payload only | `remotePayload` | Accounting flag |
| Inventory Values Affected | Payload only | `remotePayload` | Accounting flag |
| GST Applicable | Payload only | `remotePayload` | No party GST link |
| GST Classification | Payload only | `remotePayload` | Separate `gst_classification` ref entity exists |
| TDS Applicable | Payload only | `remotePayload` | No CRM field |
| TCS Applicable | Payload only | `remotePayload` | No CRM field |
| Tax Ledger Behaviour | Payload only | `remotePayload` | No CRM field |
| Display in Balance Sheet | Payload only | `remotePayload` | Report UI — skip CRM |
| Display in Profit & Loss | Payload only | `remotePayload` | Report UI — skip CRM |
| Display in Trial Balance | Payload only | `remotePayload` | Report UI — skip CRM |
| Display Order | Payload only | `remotePayload` | Report UI — skip CRM |
| Report Grouping | Payload only | `remotePayload` | Report UI — skip CRM |
| Cost Category | Payload only | `remotePayload` | Link conceptually to `cost_category` ref entity |
| Budget Applicable | Payload only | `remotePayload` | Skip |
| Scenario Applicable | Payload only | `remotePayload` | Skip |
| Currency Applicable | Payload only | `remotePayload` | Skip |
| Exchange Rate Applicable | Payload only | `remotePayload` | Skip |
| Is Reserved Group | Payload only | `remotePayload` | System group guard |
| Is Active | Payload only | `remotePayload` | Filter inactive in resolve |
| GUID | Yes (ref) | `externalId` / payload `GUID` | Primary external key |
| Master ID | Payload only | `remotePayload.MASTERID` | Secondary key |
| Remote ID | Payload only | `remotePayload.ALTERID` | Remote alter id |
| Created Date | Yes (ref) | `createdAt` | Connector timestamps — not Tally Created By date |
| Modified Date | Yes (ref) | `updatedAt` / `lastSyncedAt` | Connector timestamps |
| Created By | No | — | Not on `ConnectorExternalObject` |
| Modified By | No | — | Not on `ConnectorExternalObject` |
| Sync Status | Partial | `lastSyncedAt` + `lastDirection` | No dedicated `syncStatus` enum on this model |

**Group counts:** Yes (ref) ~4 · Partial 1 · Payload only ~30 · No 2 (Created/Modified By)

**Group recommendation:** Keep reference-only. Do **not** create an Arivu Groups CRM module. Optionally promote typed cache keys for resolve: `NAME`, `PARENT`, `GUID`, `ISREVENUE`, `ISDEEMEDPOSITIVE`, `ISRESERVED` inside metadata (still not CRM fields).

---

## Module 3 — Stock Item → Items (+ ItemVariant / inventory)

**Arivu target:** Items (`entityType: item`) · bidirectional · filter require UOM  
**Models:** [Item.js](server/models/Item.js), [ItemVariant.js](server/models/ItemVariant.js), [ItemInventory.js](server/models/ItemInventory.js), [InventoryLot.js](server/models/InventoryLot.js), [InventoryLocation.js](server/models/InventoryLocation.js), [ItemBundleComponent.js](server/models/ItemBundleComponent.js)  
**Seeded today** ([tallyDefaultFieldMapRules.js](server/services/connectors/tally/tallyDefaultFieldMapRules.js)):

```
variant_code ← NAME | unit_of_measure ← BASEUNITS | hsnSac ← HSNCODE
gstRatePercent ← GSTRATE | gstTaxability ← GSTAPPLICABLE
selling_price ← RATE | cost_price ← COSTINGMETHOD  ← semantic bug (method ≠ price)
barcode ← BARCODE | category ← PARENT | externalReferenceId ← GUID
```

**Note:** `externalReferenceId` is in the seed/mapper but **not** a typed field on Item/ItemVariant — identity today is `ConnectorExternalObject` ↔ Item/Variant `_id`. Also map `NAME` → `Item.item_name`.

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Yes | `Item.item_name` | Primary name; also set `ItemVariant.variant_code` from NAME |
| Alias | No | — | customFields / skip |
| Part Number | Yes | `Item.item_code` | Direct (`PARTNO`) — rule missing |
| Description | Yes | `Item.description` | Direct — rule missing |
| Parent Stock Group | Yes | `Item.categoryId` (+ deprecated `category`) | Resolve `stock_group` → CatalogCategory |
| Stock Category | Partial | tags / attribute / reserved-root category | Separate Tally hierarchy — see Module 6 coexistence |
| Unit of Measure | Yes | `Item.unit_of_measure` / `ItemVariant.unit_of_measure` | Seeded (`BASEUNITS`); Item parent enum limited → Partial if outside enum |
| Alternate Unit | No | — | `ADDITIONALUNITS` — no typed field |
| Conversion Factor | No | — | `CONVERSION` — no typed field |
| Brand Name | Partial | `Item.attributeValues` / variant attrs | No first-class `brand` |
| Model | Partial | `attributeValues` | Attribute only |
| Style | Partial | `attributeValues` | Attribute only |
| Colour | Partial | `attributeValues` | Attribute only |
| Size | Partial | `attributeValues` | Attribute only |
| Manufacturer | Partial | `Item.vendor` (Organization) or `attributeValues` | Vendor FK if party matched; else attribute |
| Barcode | Yes | `ItemVariant.barcode` | Seeded |
| HSN/SAC Code | Yes | `Item.hsnSac` / variant | Seeded (`HSNCODE`) |
| GST Classification | No | — | `gst_classification` ref cache — not on Item |
| GST Rate | Yes | `Item.gstRatePercent` / variant | Seeded (`GSTRATE`) |
| Taxability | Yes | `Item.gstTaxability` / variant | Seeded — normalize to enum |
| Opening Quantity | Partial | `Item.stock_quantity` (legacy) or `ItemInventory.onHand` | Prefer inventory ledger |
| Opening Rate | No | — | Tally meta / customFields |
| Opening Value | No | — | Derived or Tally meta |
| Standard Cost | Yes | `Item.cost_price` / `ItemVariant.cost_price` | Std/cost rate — **not** `COSTINGMETHOD` |
| Standard Selling Price | Yes | `Item.selling_price` / `ItemVariant.selling_price` | Seeded (`RATE`) |
| Costing Method | No | — | customFields; seed currently wrong |
| Valuation Method | No | — | customFields / skip |
| Reorder Level | Yes | `Item.reorder_level` (+ `ItemInventory.safetyStock`) | Rule missing |
| Minimum Order Quantity | No | — | customFields / skip |
| Maximum Order Quantity | No | — | customFields / skip |
| Reorder Quantity | No | — | customFields / skip |
| Godown | Yes | `InventoryLocation` + `ItemInventory.inventoryLocationId` | Sync godowns first |
| Batch-wise Details | Partial | `ItemVariant.inventoryTrackingMode` | Enable lot/batch mode |
| Batch Name | Yes | `InventoryLot.lotNumber` | Lot-level — not Item master |
| Manufacturing Date | Yes | `InventoryLot.manufacturedAt` | Lot-level |
| Expiry Date | Yes | `InventoryLot.expiresAt` | Lot-level |
| Maintain Batch-wise Details | Partial | `inventoryTrackingMode` | Yes → lot/batch mode |
| Track Date of Manufacturing | Partial | lot `manufacturedAt` usage | Flag enables field use |
| Track Expiry Date | Partial | lot `expiresAt` usage | Flag enables field use |
| Bill of Materials (BOM) | Partial | `ItemBundleComponent` (`item_type=Bundle`) | Not 1:1 with Tally BOM |
| Manufacturing Applicable | No | — | Tally flag / skip |
| Maintain Multiple Godowns | Partial | multi-row `ItemInventory` | Implicit with multiple locations |
| Remarks | Partial | `description` / `tags` / customFields | No dedicated remarks |
| Is Active | Yes | `Item.lifecycle_state` / `status` | Active↔Inactive map |
| GUID | Partial | connector (+ mapper `externalReferenceId`) | No typed field on Item |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `Item.createdBy` | Arivu User — do not map Tally user |
| Created Date | Partial | `Item.createdAt` | Do not overwrite from Tally |
| Modified By | Yes | `Item.modifiedBy` | Arivu User — do not map Tally user |
| Modified Date | Partial | `Item.updatedAt` | Conflict only |
| Last Sync Date | Partial | connector `lastSyncedAt` | Not on Item schema |
| Last Sync Status | Partial | connector `lastDirection` | No Item.`syncStatus` (unlike Organization) |
| Is Deleted | Partial | `Item.deletedAt` (trash) | Soft-delete / skip sync |
| Is Optional | No | — | Tally flag — skip |
| Is System | No | — | Tally flag — skip |
| Is Modified | Partial | connector `payloadHash` | Change detect |
| Object Type | Partial | connector `entityType` = `item` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding company |

**Stock Item counts:** Yes ~18 · Partial ~22 · No ~18+

**Stock Item recommendations:**

1. Fix seed: `cost_price` ← std/cost rate; drop/relocate `COSTINGMETHOD`.
2. Add rules: `item_name`←NAME, `item_code`←PARTNO, `description`, `reorder_level`, `categoryId`←PARENT (resolved).
3. Opening qty / Godown / Batch* → inventory + lot models, not Item scalars only.
4. Brand/Model/Style/Colour/Size/Manufacturer → catalog attributes (Manufacturer may resolve to `vendor`).
5. Decide: typed `externalReferenceId` on Item vs connector-only GUID.
6. Sync metadata (Last Sync*, Object Type, Company ID) stays on `ConnectorExternalObject`.

---

## Module 4 — Unit of Measure → Reference cache (no CRM UOM module)

**Arivu target:** none (`arivuModuleKey: null`) · `entityType: unit` · sync `tally_to_arivu` · `referenceOnly: true` · syncOrder 1 (before stock items)  
**Storage:** `ConnectorExternalObject` + `metadata.remotePayload`  
**Consumer:** Item/ItemVariant `unit_of_measure` (string; Item parent enum is limited: `pcs|liters|hours|boxes|kg|meters|units`)  
**Seeded field-map labels** (cache-oriented, not CRM columns):

```
name ← NAME | formalName ← ORIGINALNAME | isSimpleUnit ← ISSIMPLEUNIT | decimalPlaces ← DECIMALPLACES
```

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Yes (ref) / Partial | `remotePayload.NAME` + match to `Item.unit_of_measure` | Cache identity; map to item UOM string when in enum / free-text on variant |
| Symbol | Payload only | `remotePayload` (e.g. SYMBOL) | No typed CRM field |
| Formal Name | Payload only | seed key `formalName` ← `ORIGINALNAME` | Cache only |
| Unit Type | Payload only | `isSimpleUnit` ← `ISSIMPLEUNIT` | Simple vs compound — cache only |
| Number of Decimal Places | Payload only | seed key `decimalPlaces` ← `DECIMALPLACES` | Cache only |
| Base Unit | Payload only | `remotePayload` | Compound unit base — cache |
| Additional Unit | Payload only | `remotePayload` | Compound pair — cache |
| Conversion Factor | Payload only | `remotePayload` | Compound conversion — cache; Item has no conversion field |
| GUID | Yes (ref) | `externalId` / payload `GUID` | Primary external key |
| Master ID | Payload only | `remotePayload.MASTERID` | Secondary key |
| Alter ID | Payload only | `remotePayload.ALTERID` | Tally alter id |
| Remote Alter ID | Payload only | `remotePayload` | Multi-company remote |
| Remote ID | Payload only | `remotePayload` | Multi-company remote |
| Created By | No | — | Not on connector object |
| Created Date | Yes (ref) | `createdAt` | Connector timestamp ≠ Tally Created Date |
| Modified By | No | — | Not on connector object |
| Modified Date | Yes (ref) | `updatedAt` | Connector timestamp |
| Last Sync Date | Yes (ref) | `lastSyncedAt` | Direct |
| Last Sync Status | Partial | `lastDirection` (+ job outcome) | No dedicated status enum on `ConnectorExternalObject` |
| Is Deleted | Partial | soft via missing refresh / trash N/A | No `deletedAt` on connector object; drop or flag in metadata |
| Is Optional | Payload only | `remotePayload` | Tally flag |
| Is System | Payload only | `remotePayload` | Tally reserved unit guard |
| Is Modified | Payload only | `remotePayload` / hash | Use `payloadHash` for change detect |
| Object Type | Yes (ref) | `entityType` = `unit` | Connector discriminator |
| Company ID | Yes (ref) | `companyGuid` | Binding company |

**Unit counts:** Yes (ref) ~6 · Partial ~3 · Payload only ~14 · No 2 (Created/Modified By)

**Unit recommendations:**

1. Keep reference-only — do **not** build a CRM Units module.
2. On item sync: resolve Tally `BASEUNITS` name/symbol → `ItemVariant.unit_of_measure`; widen or bypass Item parent enum if Tally UOMs fall outside `pcs|…|units`.
3. Compound units (Base/Additional/Conversion): cache for XML round-trip only; no Arivu inventory conversion engine yet.
4. Prefer GUID + Name in cache for stable resolve before Stock Item sync.

---

## Module 5 — Stock Group → Catalog categories

**Arivu target:** Catalog categories (`arivuModuleKey: catalog_categories`) · `entityType: stock_group` · bidirectional · syncOrder 9 (before items)  
**Model:** [CatalogCategory.js](server/models/CatalogCategory.js) — `name`, `slug`, `parentId`, `path`, `sortOrder`, `isActive`, `createdBy`, `modifiedBy`, timestamps  
**Mapper:** [stockGroupMapper.js](server/services/connectors/tally/mappers/stockGroupMapper.js)  
**Seeded:** `name`←NAME · `parentId`←PARENT · `externalReferenceId`←GUID (mapper emits it; **not** a typed CatalogCategory field — use connector identity)  
**Catalog note:** Stock Category also targets the same `CatalogCategory` tree (`entityType: stock_category`) — avoid colliding parents/names without a namespace strategy.

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Yes | `CatalogCategory.name` | Direct — seeded |
| Alias | No | — | customFields N/A on category; skip or slug only |
| Parent Stock Group | Yes | `CatalogCategory.parentId` | Resolve parent by name/GUID — seeded |
| Description | No | — | No description on CatalogCategory |
| GST Classification | No | — | Ref cache `gst_classification`; GST lives on Item, not category |
| HSN/SAC Code | No | — | On Item (`hsnSac`), not CatalogCategory (catalog has `HSNCODE` tag for stock_group fetch only) |
| GST Rate | No | — | On Item (`gstRatePercent`) |
| Taxability | No | — | On Item (`gstTaxability`) |
| Costing Method | No | — | Item/Tally meta — not on category |
| Valuation Method | No | — | Item/Tally meta — not on category |
| Addable to Gross Profit | No | — | Tally `ISADDABLE` — payload/connector only |
| Is Active | Yes | `CatalogCategory.isActive` | Direct — mapper already round-trips |
| GUID | Partial | `ConnectorExternalObject` (+ mapper `externalReferenceId`) | No typed field on CatalogCategory |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `CatalogCategory.createdBy` | Arivu User — do not map Tally user string |
| Created Date | Partial | `createdAt` | Do not overwrite from Tally |
| Modified By | Yes | `CatalogCategory.modifiedBy` | Arivu User — do not map Tally user |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Partial | connector `lastSyncedAt` | Not on CatalogCategory |
| Last Sync Status | Partial | connector `lastDirection` | No status enum on category |
| Is Deleted | Partial | trash N/A / `isActive=false` | No `deletedAt` on CatalogCategory — deactivate or unlink |
| Is Optional | No | — | Tally flag — skip |
| Is System | No | — | Tally flag — skip |
| Is Modified | Partial | connector `payloadHash` | Change detect |
| Object Type | Partial | connector `entityType` = `stock_group` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding company |

**Stock Group counts:** Yes ~5 · Partial ~8 · No ~15+

**Stock Group recommendations:**

1. Sync core only: Name, Parent, Is Active (+ GUID via connector).
2. Do **not** put HSN/GST/costing on CatalogCategory — keep on Stock Item (and gst_classification ref).
3. `ISADDABLE` / system flags: optional `remotePayload` on connector row if needed for outbound XML fidelity.
4. Clarify Stock Group vs Stock Category both → same tree (namespace, tag, or separate roots) before enabling both bidirectional.

---

## Module 6 — Stock Category → Catalog categories

**Arivu target:** Catalog categories (`arivuModuleKey: catalog_categories`) · `entityType: stock_category` · bidirectional · syncOrder 10  
**Model:** same [CatalogCategory.js](server/models/CatalogCategory.js) as Stock Group  
**Seeded:** `name`←NAME · `parentId`←PARENT · `externalReferenceId`←GUID (connector identity; not typed on category)  
**Coexistence with Module 5:** Tally Stock Group and Stock Category are two hierarchies; Arivu has **one** category tree. Without a strategy, names/parents collide.

**Chosen default for this plan:** Stock Group = primary `Item.categoryId` tree; Stock Category = secondary tag/attribute or separate root under a reserved parent (e.g. `__tally_stock_category__`) — decide before dual bidirectional enable.

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Yes | `CatalogCategory.name` | Direct — seeded |
| Alias | No | — | Skip |
| Parent Stock Category | Yes | `CatalogCategory.parentId` | Resolve within stock_category lineage only — seeded |
| Description | No | — | No description on CatalogCategory |
| Is Active | Yes | `CatalogCategory.isActive` | Direct |
| GUID | Partial | `ConnectorExternalObject` (+ mapper `externalReferenceId`) | No typed field on CatalogCategory |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `CatalogCategory.createdBy` | Arivu User — do not map Tally user |
| Created Date | Partial | `createdAt` | Do not overwrite from Tally |
| Modified By | Yes | `CatalogCategory.modifiedBy` | Arivu User — do not map Tally user |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Partial | connector `lastSyncedAt` | Not on CatalogCategory |
| Last Sync Status | Partial | connector `lastDirection` | No status enum on category |
| Is Deleted | Partial | `isActive=false` | No `deletedAt` on CatalogCategory |
| Is Optional | No | — | Tally flag — skip |
| Is System | No | — | Tally flag — skip |
| Is Modified | Partial | connector `payloadHash` | Change detect |
| Object Type | Partial | connector `entityType` = `stock_category` | Must distinguish from `stock_group` in connector rows |
| Company ID | Partial | connector `companyGuid` | Binding company |

**Stock Category counts:** Yes ~5 · Partial ~8 · No ~8

**Stock Category recommendations:**

1. Same thin map as Stock Group: Name, Parent, Is Active + GUID via connector.
2. Store `entityType: stock_category` on connector row so GUID identity never collides with `stock_group`.
3. Pick coexistence: (a) reserved root for categories, (b) map Stock Category → Item tags/attributes instead of CatalogCategory, or (c) disable one side’s bidirectional. Default in plan: reserved root if both enabled.
4. Item link: prefer Stock Group → `categoryId`; Stock Category → optional secondary (`tags` / attribute) unless product defines dual category FKs.

---

## Module 7 — Godown (Warehouse) → Inventory locations

**Arivu target:** Inventory locations (`arivuModuleKey: inventory_locations`) · `entityType: godown` · bidirectional · syncOrder 11  
**Model:** [InventoryLocation.js](server/models/InventoryLocation.js) — strongest typed sync surface among masters (`externalReferenceId`, `syncStatus`, `lastSyncAt`, `addressSnapshot`, `contactSnapshot`)  
**Mapper:** [godownMapper.js](server/services/connectors/tally/mappers/godownMapper.js)  
**Seeded:** `name`←NAME · `locationCode`←NAME · `description`←ADDRESS · `parentLocationId`←PARENT · `externalReferenceId`←GUID

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Yes | `InventoryLocation.name` | Direct — seeded; also drives `locationCode` today |
| Alias | No | — | Skip / customFields N/A |
| Parent Godown | Yes | `InventoryLocation.parentLocationId` | Resolve parent by name/GUID — seeded (string id, not ObjectId) |
| Address Line 1 | Partial | `addressSnapshot.line1` | Mixed snapshot — mapper currently flattens ADDRESS → `description` |
| Address Line 2 | Partial | `addressSnapshot.line2` | Prefer structured over description blob |
| Address Line 3 | Partial | `addressSnapshot.line3` | Structured |
| City | Partial | `addressSnapshot.city` | Structured |
| State | Partial | `addressSnapshot.state` | Structured |
| Country | Partial | `addressSnapshot.country` | Structured |
| Pincode | Partial | `addressSnapshot.postalCode` | Structured |
| Contact Person | Partial | `contactSnapshot.name` | Mixed — no first-class contact person |
| Phone | Partial | `contactSnapshot.phone` | Mixed |
| Mobile | Partial | `contactSnapshot.mobile` | Mixed |
| Email | Partial | `contactSnapshot.email` | Mixed |
| Description | Yes | `InventoryLocation.description` | Direct; today often holds address string from Tally |
| Is Primary Godown | Yes | `InventoryLocation.isDefault` | Unique default per org — seeded via mapper `isDefault` |
| Is Active | Yes | `InventoryLocation.status` | Map active↔status enum (e.g. active/inactive) |
| GUID | Yes | `InventoryLocation.externalReferenceId` | Typed on location — seeded |
| Master ID | Partial | `externalRef` or connector payload | Secondary; prefer GUID as identity |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `InventoryLocation.createdBy` | Arivu User — do not map Tally user |
| Created Date | Partial | `createdAt` | Do not overwrite from Tally |
| Modified By | Yes | `InventoryLocation.modifiedBy` | Arivu User — do not map Tally user |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Yes | `InventoryLocation.lastSyncAt` | Direct |
| Last Sync Status | Yes | `InventoryLocation.syncStatus` | Direct |
| Is Deleted | Partial | `status` inactive / unlink | No `deletedAt` on location |
| Is Optional | No | — | Tally flag — skip |
| Is System | Partial | `InventoryLocation.systemGenerated` | Close semantic match |
| Is Modified | Partial | connector `payloadHash` | Change detect |
| Object Type | Partial | connector `entityType` = `godown` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding company |

**Godown counts:** Yes ~12 · Partial ~16 · No ~6

**Godown recommendations:**

1. Prefer `addressSnapshot` / `contactSnapshot` structured maps over stuffing ADDRESS into `description`.
2. Keep `locationCode` stable (NAME or explicit code); avoid renaming code on every alias change.
3. `parentLocationId` resolve to Arivu `inventoryLocationId` (or `_id` string) after parent godown upsert — not raw Tally parent name long-term.
4. Use typed `externalReferenceId` + `syncStatus`/`lastSyncAt` (already on model) — best practice for other masters.

---

## Module 8 — Price List / Price Level → CatalogPriceBook (+ Entry) [disabled today]

**Tally module status:** `price_list` · `syncWay: disabled` · `discoverOnly: true` · `arivuModuleKey: null` ([tallyModuleMappingDefaults.js](server/constants/tallyModuleMappingDefaults.js))  
**Arivu models exist (not wired to Tally yet):**
- Header: [CatalogPriceBook.js](server/models/CatalogPriceBook.js) — `name`, `description`, `currency`, `isDefault`, `isActive`, `createdBy`, `modifiedBy`
- Line: [CatalogPriceBookEntry.js](server/models/CatalogPriceBookEntry.js) — `priceBookId`, `variantId`, `unitPrice`, `currency`, `effectiveFrom`/`To`, `minQty`, `createdBy`, `modifiedBy`  
**Fallback today:** Stock Item `selling_price` / `RATE` only (single list price on variant).

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Yes | `CatalogPriceBook.name` | Price book header |
| Price Level | Partial | `CatalogPriceBook.name` or `isDefault` | Tally Price Level ≈ book name; no separate level entity |
| Applicable From | Yes | `CatalogPriceBookEntry.effectiveFrom` | Entry-level dates (not on book header) |
| Applicable To | Yes | `CatalogPriceBookEntry.effectiveTo` | Entry-level |
| Stock Item | Yes | `CatalogPriceBookEntry.variantId` | Resolve item/variant — **required** on entry |
| Stock Group | No | — | No group-scoped price entry; expand to items or skip |
| Stock Category | No | — | No category-scoped price entry; expand or skip |
| Unit of Measure | Partial | `ItemVariant.unit_of_measure` | No UOM on price entry — inherit from variant |
| Quantity From | Yes | `CatalogPriceBookEntry.minQty` | Qty break start |
| Quantity To | No | — | No `maxQty` on entry |
| Rate | Yes | `CatalogPriceBookEntry.unitPrice` | Direct |
| Discount Percentage | No | — | Not on price book models |
| Discount Amount | No | — | Not on price book models |
| Inclusive of Tax | No | — | Not modeled |
| Currency | Yes | `CatalogPriceBook.currency` / entry `currency` | Direct |
| Remarks | Yes | `CatalogPriceBook.description` | Header remarks only |
| Is Active | Yes | `CatalogPriceBook.isActive` | Direct |
| GUID | No | — | No `externalReferenceId` on price book/entry — connector if enabled |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | book/entry `createdBy` | Arivu User — do not map Tally user |
| Created Date | Partial | `createdAt` | Do not overwrite from Tally |
| Modified By | Yes | book/entry `modifiedBy` | Arivu User |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | No | — | No `lastSyncAt` on price book (unlike Godown) |
| Last Sync Status | No | — | No `syncStatus` on price book |
| Is Deleted | Partial | `isActive=false` | No trash field on price book |
| Is Optional | No | — | Tally flag — skip |
| Is System | No | — | Tally flag — skip |
| Is Modified | Partial | connector `payloadHash` | If/when wired |
| Object Type | Partial | connector `entityType` = `price_list` | When enabled |
| Company ID | Partial | connector `companyGuid` | When enabled |

**Price List counts:** Yes ~12 · Partial ~8 · No ~14+

**Price List recommendations:**

1. Keep **disabled/discover-only** until Price Book sync is a product priority (matches current defaults).
2. When enabling: map Tally Price Level → `CatalogPriceBook`; each item rate row → `CatalogPriceBookEntry` (`variantId` + `unitPrice` + dates + `minQty`).
3. Stock Group/Category–level Tally prices: expand to member items at sync time, or skip with reason.
4. Gaps to add only if needed: `maxQty`, discount fields, tax-inclusive flag, `externalReferenceId`/`syncStatus` on book.
5. Until then, Rate on Stock Item continues via `selling_price`←`RATE`.

---

## Module 9 — GST Ledger / Tax Ledger → Tax map (+ Tax definition), not Organizations

**Critical:** These are Duties & Taxes ledgers — **not** Module 1 party Organizations. Party sync filter excludes them.

**Arivu surfaces:**
- Bridge: [TallyTaxMapping.js](server/models/TallyTaxMapping.js) — `tallyLedgerName`, `tallyDutyHead`, `arivuTaxCode`, `arivuTaxRatePercent`, `arivuTaxId`, `active`, `metadata`, `companyGuid`
- Tax definition: [Tax.js](server/models/Tax.js) — `name`, `code`, `description`, `taxType` (percentage/fixed), `taxValue`, `scope`, `applicableOn`, `isInclusive`, `effectiveFrom`/`To`, `status`, `createdBy`, `modifiedBy`
- Ref caches: `tax_unit`, `gst_classification` (`referenceOnly`, tally→arivu)
- UI/API: tax mapping in Integration Center (`/tax-mappings`)

**Chosen approach:** Ledger Name + GST Type/Rate → `TallyTaxMapping` (+ optional link to `Tax` via `arivuTaxId`). Full Tally tax-ledger master stays in connector `remotePayload` / tax_unit cache. Do **not** create CRM Organizations for tax ledgers.

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Yes | `TallyTaxMapping.tallyLedgerName` (+ `Tax.name` if linked) | Primary match key for voucher tax lines |
| Alias | No | — | metadata / skip |
| Parent Group | Partial | payload / Duties & Taxes filter | Must stay under tax parents — not party |
| Tax Type | Partial | `Tax.taxType` | Arivu enum is percentage/fixed — **not** GST duty head; use `tallyDutyHead` / metadata for GST duty |
| GST Type (CGST/SGST/IGST/UTGST/CESS) | Yes | `TallyTaxMapping.tallyDutyHead` | Store duty head; normalize casing |
| GST Classification | Partial | `gst_classification` ref cache | Not on Tax / TaxMapping typed fields |
| GST Rate | Yes | `TallyTaxMapping.arivuTaxRatePercent` (+ `Tax.taxValue`) | Direct |
| HSN/SAC Applicability | No | — | HSN on Item; not on tax ledger |
| Nature of Transaction | No | — | metadata / skip |
| Taxability | No | — | Item `gstTaxability`; not tax ledger |
| Reverse Charge Applicable | No | — | metadata / voucher behaviour |
| Registration Type | No | — | Party `gstRegistrationType`; not tax ledger |
| Applicable From | Yes | `Tax.effectiveFrom` | If Tax record linked |
| Applicable To | Yes | `Tax.effectiveTo` | If Tax record linked |
| Rounding Method | No | — | metadata / skip |
| Rounding Limit | No | — | metadata / skip |
| Calculation Method | Partial | `Tax.isInclusive` / `compoundPriority` | Weak match only |
| Is Input Tax Credit Eligible | No | — | metadata / skip |
| Is GST Applicable | No | — | Redundant for GST ledgers; skip |
| Description | Yes | `Tax.description` | If Tax linked |
| Is Active | Yes | `TallyTaxMapping.active` / `Tax.status` | Direct |
| GUID | Partial | connector `externalId` / mapping `metadata` | No GUID on TallyTaxMapping schema |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `Tax.createdBy` | Only if Tax upserted — Arivu User |
| Created Date | Partial | mapping/Tax `createdAt` | Do not overwrite from Tally |
| Modified By | Yes | `Tax.modifiedBy` | Arivu User |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Partial | connector `lastSyncedAt` | Not on TallyTaxMapping |
| Last Sync Status | Partial | connector `lastDirection` | Not on TallyTaxMapping |
| Is Deleted | Partial | `active=false` / Tax inactive | Soft disable mapping |
| Is Optional | No | — | Skip |
| Is System | No | — | Skip |
| Is Modified | Partial | connector `payloadHash` | Change detect |
| Object Type | Partial | connector entity / `tax_unit` | Discriminator |
| Company ID | Yes | `TallyTaxMapping.companyGuid` | Binding company |

**GST/Tax Ledger counts:** Yes ~10 · Partial ~10 · No ~16+

**GST/Tax Ledger recommendations:**

1. Never map to Organizations — use `TallyTaxMapping` for voucher tax ledger resolve.
2. Seed/UI: Name + GST Type (`tallyDutyHead`) + Rate → Arivu Tax code/rate/`arivuTaxId`.
3. Keep GST Classification / tax_unit as reference caches for XML fidelity.
4. HSN, Taxability, Registration Type, Reverse Charge belong on **Item** or **party/voucher**, not tax ledger rows.
5. Optional: auto-create `Tax` records from Tally GST ledgers when mapping is empty.

---

## Module 10 — Payment Terms → string on party / documents (no master module)

**Tally module status:** Not in [tallyModuleMappingDefaults.js](server/constants/tallyModuleMappingDefaults.js) as a syncable master. In Tally, credit period often lives on the **party ledger** (see Module 1 Credit Period), not a first-class Arivu sync entity.

**Arivu today (no PaymentTerms model):**
- `Organization.paymentTerms` — free-text string
- Document snapshots: `Invoice.paymentTermsSnapshot`, `SalesOrder.paymentTermsSnapshot`, `PurchaseOrder.paymentTerms` — strings
- No due-date basis, grace, discount ladder, effective dates, GUID, or sync triad for terms

**Chosen approach:** Do **not** invent a Payment Terms CRM module for Tally sync. Map Tally credit period / terms name → `Organization.paymentTerms` (and copy into voucher snapshots on create). Structured Tally term masters stay discover/skip unless product later adds a Terms catalog.

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Partial | `Organization.paymentTerms` | Store terms label as text (e.g. `"Net 30"`) |
| Credit Period | Partial | `Organization.paymentTerms` | Encode days in same string (e.g. `"30 days"`) — no numeric field |
| Due Date Basis | No | — | No invoice-date vs delivery-date terms engine |
| Grace Period | No | — | No field |
| Discount Percentage | No | — | No early-pay discount on terms |
| Discount Amount | No | — | No field |
| Discount Validity | No | — | No field |
| Applicable From | No | — | No terms effective dating |
| Applicable To | No | — | No terms effective dating |
| Description | Partial | `Organization.paymentTerms` / notes | Flatten into text if needed |
| Is Default | No | — | No org-default terms catalog |
| Is Active | No | — | N/A without master |
| GUID | No | — | No terms identity |
| Master ID | No | — | Skip |
| Alter ID | No | — | Skip |
| Remote Alter ID | No | — | Skip |
| Remote ID | No | — | Skip |
| Created By | No | — | N/A for terms master |
| Created Date | No | — | N/A |
| Modified By | No | — | N/A |
| Modified Date | No | — | N/A |
| Last Sync Date | No | — | N/A |
| Last Sync Status | No | — | N/A |
| Is Deleted | No | — | N/A |
| Is Optional | No | — | Skip |
| Is System | No | — | Skip |
| Is Modified | No | — | Skip |
| Object Type | No | — | Not a mapped entity |
| Company ID | Partial | party `companyGuid` via connector | Only via parent party sync |

**Payment Terms counts:** Partial ~4 · No ~25+

**Payment Terms recommendations:**

1. Keep Module 1: Tally ledger Credit Period → `Organization.paymentTerms` string.
2. On invoice/SO/PO create from party: copy into `paymentTermsSnapshot` / `paymentTerms`.
3. Do not enable a standalone Tally Payment Terms master sync unless Arivu ships a Terms catalog (Name, days, discounts, effective dates).
4. If discount/grace/due-basis are required later, that is a **new Arivu feature**, not a connector-only map.

---

## Module 11 — Cost Centre → CostCentre model (defaults still reference-only)

**Tally module status today:** `cost_centre` · `syncWay: tally_to_arivu` · `referenceOnly: true` · `arivuModuleKey: null` (“journal cache”)  
**Inbound today:** `ConnectorExternalObject` with `referenceOnly` ([tallyInboundApplyService.js](server/services/connectors/tally/tallyInboundApplyService.js))  
**Arivu model exists:** [CostCentre.js](server/models/CostCentre.js) — `code`, `name`, `isActive`, `externalReferenceId`, `syncStatus`, `lastSyncAt`, `createdBy`, `modifiedBy`, `deletedAt`, timestamps  
**Seeded cache labels:** `name`←NAME · `parent`←PARENT · `category`←CATEGORY ([tallyDefaultFieldMapRules.js](server/services/connectors/tally/tallyDefaultFieldMapRules.js))  
**Consumers:** Journal/Contra lines store `costCentre` as **string name** (not FK to CostCentre)

**Chosen approach:** Prefer upserting into `CostCentre` (model already has sync triad) and stop treating as payload-only cache. Parent / Cost Category / allocate flags stay payload or schema extensions. Cost Category remains separate ref entity (`cost_category`) — no CostCategory model file.

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Name | Yes | `CostCentre.name` | Direct; also use for `code` if no separate code |
| Alias | No | — | Skip |
| Parent Cost Centre | No | — | No `parentId` on CostCentre — hierarchy only in payload today |
| Cost Category | No | — | No category FK on CostCentre; `cost_category` ref cache + seed `category` |
| Description | No | — | No description on CostCentre |
| Allocate Revenue Items | No | — | Tally `REVENUELEDGER` flag — payload only |
| Allocate Non-Revenue Items | No | — | Tally `NONREVENUELEDGER` — payload only |
| Is Active | Yes | `CostCentre.isActive` | Direct |
| GUID | Yes | `CostCentre.externalReferenceId` | Typed — wire on upsert |
| Master ID | Partial | `code` or payload | Prefer GUID; code ← name/MASTERID |
| Alter ID | No | — | Payload / connector |
| Remote Alter ID | No | — | Payload / connector |
| Remote ID | No | — | Payload / connector |
| Created By | Yes | `CostCentre.createdBy` | Arivu User — do not map Tally user |
| Created Date | Partial | `createdAt` | Do not overwrite from Tally |
| Modified By | Yes | `CostCentre.modifiedBy` | Arivu User |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Yes | `CostCentre.lastSyncAt` | Direct |
| Last Sync Status | Yes | `CostCentre.syncStatus` | Direct |
| Is Deleted | Yes | `CostCentre.deletedAt` | Soft delete |
| Is Optional | No | — | Skip |
| Is System | No | — | Skip |
| Is Modified | Partial | connector `payloadHash` | Change detect |
| Object Type | Partial | connector `entityType` = `cost_centre` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding company |

**Cost Centre counts:** Yes ~8 · Partial ~6 · No ~11

**Cost Centre recommendations:**

1. Flip inbound from `referenceOnly` → upsert `CostCentre` (name/code/GUID/active/sync triad).
2. Journals: resolve string `costCentre` → `CostCentre.code`/`name` (keep string for XML if needed).
3. Defer parent hierarchy + Cost Category FK + allocate flags unless journals need them.
4. Cost Category master stays reference cache until a CostCategory model exists.

---

## Module 12 — Sales Order → Sales orders

**Arivu target:** Sales orders · `entityType: sales_order` · **syncWay: `arivu_to_tally`** (Open/Approved + date window) · syncOrder 15  
**Models:** [SalesOrder.js](server/models/SalesOrder.js), [SalesOrderLine.js](server/models/SalesOrderLine.js)  
**Seeded today:** `orderNumber`←REFERENCE · `orderDate`←DATE · `partyLedgerName`←PARTYLEDGERNAME · `externalReferenceId`←GUID  
(Note: model key is `salesOrderNumber`, not `orderNumber` — seed key mismatch to fix.)

### Basic Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Voucher Number | Partial | `salesOrderNumber` | Often same as order number outbound |
| Voucher Type | Partial | connector / voucher_type cache | Default Sales Order type name |
| Order Number | Yes | `SalesOrder.salesOrderNumber` | Seed uses `orderNumber` — align keys |
| Order Date | Yes | `SalesOrder.orderDate` | Seeded |
| Reference Number | Partial | `sourceQuoteNumber` / customFields | Weak; no dedicated Tally ref field |
| Reference Date | No | — | Skip / customFields |
| Order Type | Partial | `sourceType` / `fulfillmentMode` | Not 1:1 with Tally order type |
| Order Status | Yes | `SalesOrder.status` | Map Arivu lifecycle ↔ Tally; filter postedOnly |

### Party Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Party Ledger | Partial | resolve from `organizationRefId` | Outbound ledger name from party sync |
| Party Name | Yes | Organization via `organizationRefId` | Display name |
| Buyer Name | Partial | party name / bill-to | Often = party |
| Buyer GSTIN | Partial | party `gstin` snapshot | No SO-level partyGstin — use org |
| Consignee Name | Partial | `shipToAddressSnapshot` / party | No dedicated consignee |
| Consignee GSTIN | No | — | Skip / customFields |
| Contact Person | Yes | `contactId` → People | Name from People |

### Billing & Shipping

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Billing Address | Yes | `billToAddressSnapshot` | Mixed snapshot |
| Shipping Address | Yes | `shipToAddressSnapshot` | Mixed snapshot |
| Place of Supply | No | — | Not on SalesOrder (invoice-oriented) |
| State | Partial | address snapshot `state` | Inside Mixed |
| Country | Partial | address snapshot `country` | Inside Mixed |
| Pincode | Partial | address snapshot `postalCode` | Inside Mixed |

### Item Details (SalesOrderLine)

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Stock Item | Yes | `variantId` (+ `itemNameSnapshot`/`skuSnapshot`) | Resolve Tally item name |
| Item Description | Yes | `descriptionSnapshot` | Direct |
| Quantity | Yes | `quantity` | Direct |
| Unit of Measure | Yes | `unitOfMeasure` | Direct |
| Rate | Yes | `unitPriceSnapshot` | Direct |
| Discount Percentage | Yes | `discountType`/`discountValue` | When type=percent |
| Discount Amount | Yes | `discountAmount` | Direct |
| Amount | Yes | `lineTotal` / `lineSubtotal` | Direct |

### Tax Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Tax Ledger | Partial | `taxSnapshot` / `TallyTaxMapping` | Resolve via tax map on outbound |
| GST Rate | Partial | line `taxSnapshot` | Mixed — not first-class rate column |
| CGST/SGST/IGST/CESS Amount | Partial | `transactionTaxSnapshot` / line tax | Split in Mixed if present |
| Taxable Value | Partial | `lineSubtotal` / tax snap | Derived |
| Total Tax | Yes | `taxTotal` / `lineTaxTotal` | Header + line |

### Totals

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Sub Total | Yes | `subtotal` | Direct |
| Round Off | Partial | `adjustmentTotal` | Closest; no dedicated roundOff |
| Total Amount | Yes | `grandTotal` | Direct |

### Delivery Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Delivery Date | Yes | `requestedDeliveryDate` / `promisedDeliveryDate` | Pick one for Tally |
| Dispatch From | No | — | customFields / skip |
| Delivery Terms | Partial | `incotermsSnapshot` | Closest |
| Transporter Name | No | — | customFields / skip |
| Vehicle Number | No | — | customFields / skip |
| LR/RR Number | No | — | customFields / skip |
| E-Way Bill Number | No | — | Typically invoice/DN — skip on SO |

### Payment Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Payment Terms | Yes | `paymentTermsSnapshot` | String |
| Credit Period | Partial | inside `paymentTermsSnapshot` | No numeric days field |
| Due Date | No | — | Not on SalesOrder header |

### Additional Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Narration | Partial | `customerNotes` / `internalNotes` | Pick customer-facing for Tally |
| Cost Centre | No | — | No SO costCentre (journal has string) |
| Project | No | — | Skip / customFields |
| Sales Person | Yes | `assignedTo` | User — map to Tally only if name string accepted |
| Branch | No | — | Skip / customFields |

### System Fields

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| GUID | Yes | `externalReferenceId` | Seeded |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `createdBy` | Arivu User |
| Created Date | Partial | `createdAt` | Do not overwrite from Tally |
| Modified By | Yes | `modifiedBy` | Arivu User |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Yes | `lastSyncAt` | Direct |
| Last Sync Status | Yes | `syncStatus` | Direct |
| Is Cancelled | Partial | `status` cancelled / line `quantityCancelled` | Status map |
| Is Deleted | Yes | `deletedAt` | Trash |
| Is Optional | Partial | line `optionalLine` | Line-level only |
| Is System | No | — | Skip |
| Is Modified | Partial | connector hash | Change detect |
| Object Type | Partial | `entityType` = `sales_order` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding |

**Sales Order counts:** Yes ~25 · Partial ~25 · No ~15+

**Sales Order recommendations:**

1. Direction stays **Arivu → Tally** (current default); expand XML beyond thin seed (party, addresses, lines, totals).
2. Fix seed key `orderNumber` → `salesOrderNumber`.
3. Tax splits + tax ledgers via `TallyTaxMapping` + Mixed snapshots — don’t invent SO CGST columns.
4. Logistics (transporter/vehicle/LR/E-way) defer to Delivery Note / Invoice unless customFields required.
5. Party ledger name from synced Organization; Contact from `contactId`.

---

## Module 13 — Sales Invoice → Invoices

**Arivu target:** Invoices · `entityType: invoice` · Tally module `sales` · **syncWay: `arivu_to_tally`** · filter posted + date window · syncOrder 17  
**Models:** [Invoice.js](server/models/Invoice.js), [InvoiceLine.js](server/models/InvoiceLine.js)  
**Seeded today:** `invoiceNumber`←REFERENCE · `invoiceDate`←DATE · `partyGstin`←PARTYGSTIN · `placeOfSupply`←PLACEOFSUPPLY · `grandTotal`/`subtotal`←AMOUNT · `irn`←IRN · `partyLedgerName`←PARTYLEDGERNAME · `externalReferenceId`←GUID  
**Stronger than SO:** typed `placeOfSupply`, `partyGstin`, `irn`, `ackNo`, `ackDate`, `ewayBillNo`.

### Basic Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Voucher Number | Partial | `invoiceNumber` | Often = invoice number outbound |
| Voucher Type | Partial | voucher_type cache | Default Sales |
| Invoice Number | Yes | `Invoice.invoiceNumber` | Seeded |
| Invoice Date | Yes | `Invoice.invoiceDate` | Seeded |
| Reference Number | Partial | `sourceSalesOrderIds` / `sourceRef` | SO number via source — no single ref string |
| Reference Date | No | — | customFields / skip |
| Invoice Type | Yes | `Invoice.invoiceType` | sales vs credit_note etc. — Sales voucher = standard invoice |
| Invoice Status | Yes | `Invoice.status` (+ `postedAt`/`voidedAt`) | postedOnly filter |

### Party Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Party Ledger | Partial | resolve `organizationRefId` | Outbound ledger name |
| Party Name | Yes | Organization via `organizationRefId` | Display name |
| Buyer Name | Partial | party / bill-to | Often = party |
| Buyer GSTIN | Yes | `Invoice.partyGstin` | Seeded |
| Consignee Name | Partial | `shipToAddressSnapshot` | No dedicated consignee |
| Consignee GSTIN | No | — | customFields / skip |
| Contact Person | Yes | `contactId` → People | Name from People |

### Billing & Shipping

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Billing Address | Yes | `billToAddressSnapshot` | Mixed |
| Shipping Address | Yes | `shipToAddressSnapshot` | Mixed |
| Place of Supply | Yes | `placeOfSupply` | Seeded |
| State | Partial | address snapshot | Mixed |
| Country | Partial | address snapshot | Mixed |
| Pincode | Partial | address snapshot | Mixed |

### Item Details (InvoiceLine)

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Stock Item | Yes | `variantId` (+ name/sku snapshots) | Resolve Tally item |
| Item Description | Yes | `descriptionSnapshot` | Direct |
| Quantity | Yes | `quantity` | Direct |
| Unit of Measure | Yes | `unitOfMeasure` | Direct |
| Rate | Yes | `unitPriceSnapshot` | Direct |
| Discount Percentage | Yes | `discountType`/`discountValue` | When percent |
| Discount Amount | Yes | `discountAmount` | Direct |
| Amount | Yes | `lineTotal` / `lineSubtotal` | Direct |

### Tax Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Tax Ledger | Partial | `TallyTaxMapping` + tax snapshots | Resolve on outbound |
| GST Rate | Partial | line `taxSnapshot` | Mixed |
| CGST/SGST/IGST/UTGST/CESS Amount | Partial | `transactionTaxSnapshot` / `taxDocumentSnapshot` | Split in Mixed |
| Taxable Value | Partial | `lineSubtotal` / snap | Derived |
| Total Tax | Yes | `taxTotal` / `lineTaxTotal` | Direct |

### Totals

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Sub Total | Yes | `subtotal` | Seeded (AMOUNT also used for grand) |
| Round Off | Partial | `adjustmentTotal` | Closest |
| Total Amount | Yes | `grandTotal` | Seeded |

### Payment Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Payment Terms | Yes | `paymentTermsSnapshot` | String |
| Credit Period | Partial | inside terms string | No numeric field |
| Due Date | Yes | `dueDate` | Direct — better than SO |
| Payment Mode | No | — | Lives on Payments module, not Invoice |
| Bank Ledger | No | — | Payments / bank ledger — not Invoice |

### Delivery Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Delivery Note Number | Partial | `sourceRef` / linked DN | No first-class DN# on Invoice |
| Delivery Date | No | — | No deliveryDate on Invoice |
| Dispatch From | No | — | customFields / skip |
| Transporter Name | No | — | customFields / skip |
| Vehicle Number | No | — | customFields / skip |
| LR/RR Number | No | — | customFields / skip |
| E-Way Bill Number | Yes | `ewayBillNo` | Direct (+ `ewayBillDate`) |
| E-Invoice Number | Partial | `irn` | IRN is the e-invoice id |
| IRN | Yes | `irn` | Seeded |
| Ack Number | Yes | `ackNo` | Direct |
| Ack Date | Yes | `ackDate` | Direct |

### Additional Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Narration | Partial | `termsConditionsSnapshot` / customFields | No dedicated narration |
| Cost Centre | No | — | Not on Invoice |
| Project | No | — | Skip |
| Sales Person | Yes | `assignedTo` | User |
| Branch | No | — | Skip |

### System Fields

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| GUID | Yes | `externalReferenceId` | Seeded |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `createdBy` | Arivu User |
| Created Date | Partial | `createdAt` | Do not overwrite |
| Modified By | Yes | `modifiedBy` | Arivu User |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Yes | `lastSyncAt` | Direct |
| Last Sync Status | Yes | `syncStatus` | Direct |
| Is Cancelled | Partial | `voidedAt` / status | Void map |
| Is Deleted | Yes | `deletedAt` | Trash |
| Is Optional | No | — | Skip |
| Is System | No | — | Skip |
| Is Modified | Partial | connector hash | Change detect |
| Object Type | Partial | `entityType` = `invoice` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding |

**Sales Invoice counts:** Yes ~30 · Partial ~20 · No ~15+

**Sales Invoice recommendations:**

1. Keep **Arivu → Tally**; expand line + tax XML; use seeded GST/e-invoice fields.
2. Payment Mode / Bank Ledger → Payment voucher sync, not Sales Invoice.
3. Logistics (transporter/vehicle/LR) → Delivery Note or customFields; E-way/IRN/Ack already on Invoice.
4. Tax ledger names via `TallyTaxMapping`; CGST/SGST/IGST/CESS from Mixed snapshots when building voucher.

---

## Module 14 — Receipt Voucher → Payments (customer receipts)

**Arivu target:** Payments · `entityType: receipt` · Tally module `receipt` · **syncWay: `arivu_to_tally`** · posted + date window · syncOrder 21  
**Models:** [Payment.js](server/models/Payment.js), [PaymentAllocation.js](server/models/PaymentAllocation.js)  
**Note:** Tally **Payment** voucher maps separately to Vendor payments (`entityType: payment`). Receipt = money **in** from customer.  
**Seeded today:** `paymentNumber`←REFERENCE · `amount`←AMOUNT · `paymentDate`←DATE · `partyLedgerName`←PARTYLEDGERNAME · `externalReferenceId`←GUID

### Basic Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Voucher Number | Partial | `paymentNumber` | Often = receipt number |
| Voucher Type | Partial | voucher_type cache | Default Receipt |
| Receipt Number | Yes | `Payment.paymentNumber` | Seeded |
| Receipt Date | Yes | `Payment.paymentDate` | Seeded |
| Reference Number | Partial | `externalReference` / `sourceRef` | Gateway/UTR — not Tally voucher ref |
| Reference Date | Partial | `valueDate` | Closest (value/clearing date) |

### Party Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Party Ledger | Partial | resolve `organizationRefId` | Outbound ledger name |
| Party Name | Yes | Organization via `organizationRefId` | Required FK |
| Bill Reference | Partial | allocation → Invoice | Via `PaymentAllocation.invoiceId` |
| Bill Type | Partial | Invoice `invoiceType` | From linked invoice |
| Against Voucher | Partial | allocation / `sourceRef` | Invoice link = against sales invoice |

### Payment Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Receipt Amount | Yes | `Payment.amount` | Seeded |
| Currency | Yes | `paymentCurrency` | Direct |
| Exchange Rate | Yes | `exchangeRateSnapshot` | Direct |
| Bank Ledger | No | — | No bank ledger FK — resolve via instrument method + Tally bank ledger config |
| Cash Ledger | No | — | Same — method=`cash` implies cash ledger mapping |
| Payment Mode | Yes | `paymentInstrumentSnapshot.method` | cash/check/bank_transfer/card/other |
| Instrument Type | Partial | `method` | Overlaps payment mode |
| Instrument Number | Yes | `paymentInstrumentSnapshot.referenceNumber` | Cheque/UTR |
| Instrument Date | No | — | Not in instrument snapshot |
| Bank Name | Yes | `paymentInstrumentSnapshot.bankName` | Direct |
| Branch Name | No | — | Not in snapshot |
| Deposit Date | Partial | `valueDate` | Closest |

### Allocation Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Invoice Number | Yes | via `PaymentAllocation` → Invoice | Resolve invoice |
| Invoice Date | Yes | Invoice.`invoiceDate` | From linked invoice |
| Outstanding Amount | Partial | Invoice.`amountDue` | At allocation time |
| Allocated Amount | Yes | `PaymentAllocation.amountApplied` | Direct |
| Balance Amount | Partial | payment `amountUnallocated` / invoice due | Derived |

### Additional Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Narration | Yes | `Payment.notes` | Direct |
| Cost Centre | No | — | Not on Payment |
| Project | No | — | Skip |
| Sales Person | Partial | `recordedBy` / `createdBy` | Weak — not sales owner |
| Branch | No | — | Skip |

### Status

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Is Cancelled | Partial | `status` = `reversed` | Reversal path |
| Is Optional | No | — | Skip |
| Is Post Dated | Partial | `valueDate` > `paymentDate` | Infer if needed |

### System Fields

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| GUID | Yes | `externalReferenceId` | Seeded (distinct from gateway `externalReference`) |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `createdBy` | Arivu User |
| Created Date | Partial | `createdAt` | Do not overwrite |
| Modified By | Yes | `modifiedBy` | Arivu User |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Yes | `lastSyncAt` | Direct |
| Last Sync Status | Yes | `syncStatus` | Direct |
| Is Deleted | Yes | `deletedAt` | Soft delete |
| Is System | No | — | Skip |
| Is Modified | Partial | connector hash | Change detect |
| Object Type | Partial | `entityType` = `receipt` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding |

**Receipt counts:** Yes ~18 · Partial ~16 · No ~10+

**Receipt recommendations:**

1. Keep **Arivu → Tally** Receipt; do not confuse with Payment voucher (vendor).
2. Expand XML: party + amount + instrument + bill-wise allocations from `PaymentAllocation`.
3. Bank/Cash ledger names: connector setting / method→ledger map (not on Payment schema).
4. Add instrument date / branch to snapshot only if Tally round-trip requires them.

---

## Module 15 — Credit Note → Invoices (`invoiceType: credit_note`)

**Arivu target:** Invoices (credit note) · `entityType: credit_note` · **syncWay: `arivu_to_tally`** · posted + date window · syncOrder 19  
**Same models as Sales Invoice:** [Invoice.js](server/models/Invoice.js) + [InvoiceLine.js](server/models/InvoiceLine.js) filtered by `invoiceType === 'credit_note'`  
**CN-specific fields:** `sourceInvoiceId`, `creditReason`, `creditReasonNote`  
**Seeded today:** `creditNoteNumber`←REFERENCE · `date`←DATE · `partyGstin` · `grandTotal` · `partyLedgerName` · `GUID`  
(**Mismatch:** model uses `invoiceNumber` / `invoiceDate` — align seeds like Module 13.)

### Basic Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Voucher Number | Partial | `invoiceNumber` | Often = CN number |
| Voucher Type | Partial | voucher_type cache | Credit Note type |
| Credit Note Number | Yes | `Invoice.invoiceNumber` | Fix seed key from `creditNoteNumber` |
| Credit Note Date | Yes | `Invoice.invoiceDate` | Fix seed key from `date` |
| Reference Number | Partial | `sourceRef` / customFields | Weak |
| Reference Date | No | — | Skip |
| Original Invoice Number | Yes | via `sourceInvoiceId` → Invoice | Resolve original INV# |
| Original Invoice Date | Yes | original Invoice.`invoiceDate` | From linked invoice |

### Party Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Party Ledger | Partial | resolve `organizationRefId` | Outbound ledger name |
| Party Name | Yes | Organization via `organizationRefId` | Direct |
| Buyer Name | Partial | party / bill-to | Often = party |
| Buyer GSTIN | Yes | `partyGstin` | Seeded |
| Consignee Name | Partial | `shipToAddressSnapshot` | No dedicated consignee |
| Consignee GSTIN | No | — | Skip |

### Item Details (InvoiceLine)

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Stock Item | Yes | `variantId` + snapshots | Same as invoice |
| Item Description | Yes | `descriptionSnapshot` | Direct |
| Quantity | Yes | `quantity` (+ `quantityReturned`) | Direct |
| Unit of Measure | Yes | `unitOfMeasure` | Direct |
| Rate | Yes | `unitPriceSnapshot` | Direct |
| Discount Percentage | Yes | `discountType`/`discountValue` | When percent |
| Discount Amount | Yes | `discountAmount` | Direct |
| Amount | Yes | `lineTotal` / `lineSubtotal` | Direct |

### Tax Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Tax Ledger | Partial | `TallyTaxMapping` + tax snaps | Outbound resolve |
| GST Rate | Partial | line `taxSnapshot` | Mixed |
| CGST/SGST/IGST/UTGST/CESS Amount | Partial | `transactionTaxSnapshot` | Mixed |
| Taxable Value | Partial | `lineSubtotal` | Derived |
| Total Tax | Yes | `taxTotal` / `lineTaxTotal` | Direct |

### Totals

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Sub Total | Yes | `subtotal` | Direct |
| Round Off | Partial | `adjustmentTotal` | Closest |
| Total Amount | Yes | `grandTotal` | Seeded |

### Reason Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Reason for Credit Note | Yes | `creditReason` / `creditReasonNote` | Direct |
| Return Type | Partial | `creditReason` enum/string | No dedicated returnType |
| Adjustment Type | Partial | `creditReason` / `sourceContext` | No dedicated adjustmentType |

### Additional Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Narration | Partial | `termsConditionsSnapshot` / `creditReasonNote` | Prefer reason note |
| Cost Centre | No | — | Not on Invoice |
| Project | No | — | Skip |
| Sales Person | Yes | `assignedTo` | User |
| Branch | No | — | Skip |

### E-Invoice Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| IRN | Yes | `irn` | Direct (not in CN seed — add if needed) |
| Ack Number | Yes | `ackNo` | Direct |
| Ack Date | Yes | `ackDate` | Direct |
| E-Way Bill Number | Yes | `ewayBillNo` | Direct |

### Status

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Is Cancelled | Partial | `voidedAt` / status | Void map |
| Is Optional | No | — | Skip |
| Is Post Dated | No | — | No valueDate on Invoice |

### System Fields

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| GUID | Yes | `externalReferenceId` | Seeded |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `createdBy` | Arivu User |
| Created Date | Partial | `createdAt` | Do not overwrite |
| Modified By | Yes | `modifiedBy` | Arivu User |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Yes | `lastSyncAt` | Direct |
| Last Sync Status | Yes | `syncStatus` | Direct |
| Is Deleted | Yes | `deletedAt` | Trash |
| Is System | No | — | Skip |
| Is Modified | Partial | connector hash | Change detect |
| Object Type | Partial | `entityType` = `credit_note` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding |

**Credit Note counts:** Yes ~28 · Partial ~18 · No ~10+

**Credit Note recommendations:**

1. Reuse Invoice outbound path with `invoiceType=credit_note` + original invoice link (`sourceInvoiceId`).
2. Fix seeds: `invoiceNumber`/`invoiceDate` (not `creditNoteNumber`/`date`); add `placeOfSupply`/`irn` like sales invoice.
3. Reason → `creditReason` + `creditReasonNote` for Tally narration/reason tags.
4. Debit Note (next) mirrors this with `invoiceType=debit_note`.

---

## Module 16 — Debit Note → Invoices (`invoiceType: debit_note`)

**Arivu target:** Invoices (debit note) · `entityType: debit_note` · **syncWay: `arivu_to_tally`** · posted + date window · syncOrder 20  
**Same models as CN/Sales Invoice:** [Invoice.js](server/models/Invoice.js) + lines · filter `invoiceType === 'debit_note'`  
**Note:** Module defaults point at `invoices`, not `purchase_bills`. Supplier is still `organizationRefId` (vendor-type org).  
**Seeded today:** `debitNoteNumber`←REFERENCE · `date`←DATE · `partyGstin` · `grandTotal` · `partyLedgerName` · `GUID`  
(**Mismatch:** use `invoiceNumber` / `invoiceDate`.)

### Basic Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Voucher Number | Partial | `invoiceNumber` | Often = DN number |
| Voucher Type | Partial | voucher_type cache | Debit Note type |
| Debit Note Number | Yes | `Invoice.invoiceNumber` | Fix seed from `debitNoteNumber` |
| Debit Note Date | Yes | `Invoice.invoiceDate` | Fix seed from `date` |
| Reference Number | Partial | `sourceRef` / customFields | Weak |
| Reference Date | No | — | Skip |
| Original Invoice Number | Yes | via `sourceInvoiceId` → Invoice | Or purchase bill link if product later splits |
| Original Invoice Date | Yes | original doc date | From linked document |

### Party Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Party Ledger | Partial | resolve `organizationRefId` | Vendor ledger name |
| Party Name | Yes | Organization via `organizationRefId` | Direct |
| Supplier Name | Yes | same Organization | Alias of party for purchase-side DN |
| Supplier GSTIN | Yes | `partyGstin` | Seeded |
| Contact Person | Yes | `contactId` → People | Name from People |

### Item Details (InvoiceLine)

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Stock Item | Yes | `variantId` + snapshots | Same as invoice |
| Item Description | Yes | `descriptionSnapshot` | Direct |
| Quantity | Yes | `quantity` | Direct |
| Unit of Measure | Yes | `unitOfMeasure` | Direct |
| Rate | Yes | `unitPriceSnapshot` | Direct |
| Discount Percentage | Yes | `discountType`/`discountValue` | When percent |
| Discount Amount | Yes | `discountAmount` | Direct |
| Amount | Yes | `lineTotal` / `lineSubtotal` | Direct |

### Tax Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Tax Ledger | Partial | `TallyTaxMapping` + tax snaps | Outbound resolve |
| GST Rate | Partial | line `taxSnapshot` | Mixed |
| CGST/SGST/IGST/UTGST/CESS Amount | Partial | `transactionTaxSnapshot` | Mixed |
| Taxable Value | Partial | `lineSubtotal` | Derived |
| Total Tax | Yes | `taxTotal` / `lineTaxTotal` | Direct |

### Totals

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Sub Total | Yes | `subtotal` | Direct |
| Round Off | Partial | `adjustmentTotal` | Closest |
| Total Amount | Yes | `grandTotal` | Seeded |

### Reason Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Reason for Debit Note | Yes | `creditReason` / `creditReasonNote` | Reused reason fields on Invoice (name is CN-oriented) |
| Return Type | Partial | reason string | No dedicated returnType |
| Adjustment Type | Partial | `creditReason` / `sourceContext` | No dedicated adjustmentType |

### Additional Information

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Narration | Partial | `termsConditionsSnapshot` / reason note | Prefer reason note |
| Cost Centre | No | — | Not on Invoice |
| Project | No | — | Skip |
| Purchase Person | Yes | `assignedTo` | User (same as sales person on CN) |
| Branch | No | — | Skip |

### E-Invoice Details

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| IRN | Yes | `irn` | Direct — add to DN seed if needed |
| Ack Number | Yes | `ackNo` | Direct |
| Ack Date | Yes | `ackDate` | Direct |
| E-Way Bill Number | Yes | `ewayBillNo` | Direct |

### Status

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| Is Cancelled | Partial | `voidedAt` / status | Void map |
| Is Optional | No | — | Skip |
| Is Post Dated | No | — | No valueDate on Invoice |

### System Fields

| Tally field | Arivu has field? | Arivu field | Map to |
|---|---|---|---|
| GUID | Yes | `externalReferenceId` | Seeded |
| Master ID | No | — | Connector / payload |
| Alter ID | No | — | Connector / payload |
| Remote Alter ID | No | — | Connector / payload |
| Remote ID | No | — | Connector / payload |
| Created By | Yes | `createdBy` | Arivu User |
| Created Date | Partial | `createdAt` | Do not overwrite |
| Modified By | Yes | `modifiedBy` | Arivu User |
| Modified Date | Partial | `updatedAt` | Conflict only |
| Last Sync Date | Yes | `lastSyncAt` | Direct |
| Last Sync Status | Yes | `syncStatus` | Direct |
| Is Deleted | Yes | `deletedAt` | Trash |
| Is System | No | — | Skip |
| Is Modified | Partial | connector hash | Change detect |
| Object Type | Partial | `entityType` = `debit_note` | Discriminator |
| Company ID | Partial | connector `companyGuid` | Binding |

**Debit Note counts:** Yes ~28 · Partial ~16 · No ~10+

**Debit Note recommendations:**

1. Same Invoice outbound path as CN with `invoiceType=debit_note`; party = supplier org.
2. Fix seeds to `invoiceNumber`/`invoiceDate`; optionally rename/generalize `creditReason*` → shared `adjustmentReason` later (not required for sync).
3. If purchase-side DN should target Purchase bills instead of Invoices, that is a **product decision** — current defaults use Invoices.

---

## Next modules

Send the next field list (Payment voucher, Purchase, Journal, …). Same titled-table format.

---

## Implementation touchpoints (when build is approved)

1. **Ledger:** extend party default rules + People upsert + structured address.
2. **Group:** Group master → `ConnectorExternalObject` payload keys; no CRM upsert.
3. **Stock Item:** fix costing seed; expand item rules; inventory/lot/location apply path; optional `externalReferenceId` on Item.
4. **Unit:** ensure Unit fetch populates NAME/SYMBOL/DECIMALPLACES/ISSIMPLEUNIT/GUID in `remotePayload`; item UOM resolve uses cache.
5. **Stock Group:** keep thin CatalogCategory map; optional `externalReferenceId` on category or connector-only GUID; document Stock Category coexistence.
6. **Stock Category:** enforce connector `entityType` separation + reserved-root (or tags) coexistence with Stock Group.
7. **Godown:** structured `addressSnapshot`/`contactSnapshot`; parent resolve by location id; keep sync triad.
8. **Price List:** leave disabled; optional Phase-2 wire to CatalogPriceBook + Entry.
9. **GST/Tax Ledger:** harden `TallyTaxMapping` (duty head + rate); never party upsert; optional Tax auto-link.
10. **Payment Terms:** string-only via party `paymentTerms` + document snapshots; no master sync.
11. **Cost Centre:** upsert into `CostCentre` model; drop pure referenceOnly for this entity.
12. **Sales Order:** expand arivu→Tally XML (header+lines+tax map); fix `salesOrderNumber` seed key.
13. **Sales Invoice:** expand arivu→Tally XML using GST/e-invoice typed fields + lines + tax map.
14. **Receipt:** expand arivu→Tally with instrument + PaymentAllocation bill-wise; bank/cash ledger map by method.
15. **Credit Note:** reuse Invoice path (`credit_note`); fix seed keys; link `sourceInvoiceId`; reason fields.
16. **Debit Note:** reuse Invoice path (`debit_note`); supplier party; fix seed keys.
17. Document all module tables in [TALLY_MODULE_FIELD_CATALOG.md](docs/TALLY_MODULE_FIELD_CATALOG.md).
