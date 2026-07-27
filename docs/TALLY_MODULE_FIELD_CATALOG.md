# Tally Module & Field Catalog + Arivu Mapping

**Status:** Implementation reference for Integration Center Sync settings.  
**Related:** `docs/TALLY_INTEGRATION_ARCHITECTURE.md`, `server/constants/tallyModuleMappingDefaults.js`

## Caveat

Tally does not publish one exhaustive public schema. Field availability depends on F11/F12 features and release. This catalog combines TallyHelp Sample XML, TDL Appendix, GST Rel 3 schema, e-Invoice schema, and Arivu TDL packs.

**Verified per-module Tally fields (label · XML tag · Real?):** [TALLY_VERIFIED_FIELD_SCHEMA.md](./TALLY_VERIFIED_FIELD_SCHEMA.md)

## Module mapping table (defaults)

| Tally module | Arivu module | Sync way | Filter | Sync approach |
|---|---|---|---|---|
| Ledger (Debtors/Creditors) | Organizations | Bidirectional | Parent ∈ Debtors/Creditors | Batch 100–500; before vouchers |
| Stock Item | Items | Bidirectional | Require UOM | After units/groups/godowns |
| Stock Group | Catalog categories | Bidirectional | — | Before items |
| Stock Category | Catalog categories | Bidirectional | — | Before items |
| Godown | Inventory locations | Bidirectional | — | Before stock/vouchers |
| Unit / Currency / Cost* / Group / Voucher Type / Tax Unit / GST Classification / Batch | Reference cache | Tally → Arivu | — | Discover / rare refresh |
| Sales | Invoices | Arivu → Tally | Posted; date window | Single-flight XML; batch limit |
| Purchase | Purchase bills | Arivu → Tally | Posted; date window | Same |
| Receipt | Payments | Arivu → Tally | Posted; date window | After parties |
| Payment | Vendor payments | Arivu → Tally | Posted; date window | After parties |
| Credit / Debit Note | Invoices (CN/DN) | Arivu → Tally | Posted; date window | After sales/purchase |
| Journal / Contra | Journal entries | Arivu → Tally | Date window | Low concurrency |
| Stock Journal | Transfers / adjustments | Bidirectional | Date window | After items + godowns |
| Delivery / Receipt Note | Delivery / Receipt notes | Arivu → Tally | Date window | After items |
| Sales / Purchase Order | Sales / Purchase orders | Arivu → Tally | Open/Approved; date | Batched |
| Employee / Pay Head / Attendance / Budget / Price List | — | Disabled | — | Discover-only |

**Sync ways:** `disabled` | `tally_to_arivu` | `arivu_to_tally` | `bidirectional`

## Low-pressure sync

- `recordsPerSyncCycle` default **200** (50–500)
- `companyWriteConcurrency: 1`
- Masters before vouchers (`syncOrder`)
- Migration mode + **Sync From**; else rolling date window + watermarks
- Skip-with-reason; continue next cycle

## Field map seeds

Approved defaults live in `server/services/connectors/tally/tallyDefaultFieldMapRules.js` for:

party, item, godown, stock_group, stock_category, invoice, purchase, payment, receipt, credit_note, debit_note, stock_journal, journal, contra, delivery_note, receipt_note, purchase_order, sales_order, unit, currency, cost_centre

## Sync settings & logs (product)

Primary UX tabs:

1. **Sync settings** — migration mode, record limit, prevent product tax update, module mapping table, tax mapping, reset
2. **Sync logs** — Date, Time, Module, Company, Arivu/Tally Created|Updated|Skipped with click-through + CSV
3. **Advanced** — field maps, conflicts, dry-run

## Code map

| Concern | Path |
|---|---|
| Module defaults | `server/constants/tallyModuleMappingDefaults.js` |
| Addon settings | `server/constants/tallyAddonConstants.js` |
| Models | `TallyModuleMapping`, `TallySyncRunLog`, `TallyTaxMapping` |
| Services | `tallyModuleMappingService`, `tallySyncLogService`, `tallySyncOrchestrator`, `tallyInboundApplyService` |
| UI | `client/src/views/integrations/TallyIntegrationCenter.vue` |
| APIs | `server/routes/tallyConnectorRoutes.js` (`/module-mappings`, `/sync-logs`, `/tax-mappings`, `/reset/*`, `/settings`) |
