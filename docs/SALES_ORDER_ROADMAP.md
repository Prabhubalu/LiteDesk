# Sales Orders Module — Implementation Roadmap

**Source architecture:** `docs/SALES_ORDER_ARCHITECTURE.md` (approved — authoritative)

**Strategic direction:** Ship a **platform-native, snapshot-based** Sales Order module as the first operational execution consumer of Quotes. SO inherits commercial snapshots and structural patterns from Quotes; it owns fulfillment, lineage, and invoice allocation contracts.

**Prerequisite:** Quotes Q0–Q9 + Quote Sections complete — see `docs/QUOTES_ROADMAP.md`.

**Invoice / GL / inventory ledger:** Explicitly **out of scope** until post-SO2.

**Last updated:** 2026-06-02

---

## Progress tracker

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **SO0** — Domain contract + models | ✅ Done | `SalesOrder`, `SalesOrderSection`, `SalesOrderLine`, lifecycle + fulfillment constants, totals service, coverage service, module registration, quote `Partially Converted` lifecycle |
| **SO1** — Quote conversion | ✅ Done | Convert service, real SO in `Confirmed`, links, coverage, activity, API, list + read-only record UI |
| **SO2** — Fulfillment + manual create | ✅ Done | Draft line edit/delete, fulfillment + reversals, list statistics, fulfillment UI |
| **SO3** — Split / merge / invoice stub | ✅ Done | Split/merge services + API, lineage UI, `SalesOrderInvoiceAllocation` schema + readiness |
| **SO4** — Manual sections + merge UI | ✅ Done | Section CRUD API + Draft UI, list bulk merge modal, settings core module parity |

---

## Locked decisions (from architecture)

| # | Decision | Value |
|---|----------|-------|
| 1 | SO status on quote convert | **`Confirmed`** (never Draft) |
| 2 | Quote conversion coverage | **`Partially Converted`** → **`Converted`** when all accepted lines mapped |
| 3 | Cross-module IDs | **`salesOrderId` / `salesOrderLineId` / `salesOrderSectionId` UUIDs**; `targetRecordId` = `salesOrderId` |
| 4 | Fulfillment model | **`fulfillmentMode`:** `product` \| `service` \| `hybrid` |
| 5 | Multiple SOs per quote revision | **Yes** — disjoint line sets |
| 6 | Partial section discount | **No section discount** on partial sections |
| 7 | SO revisions | **No** in SO0/SO1 |

---

## SO0 — Done

### Models

- `server/models/SalesOrder.js`
- `server/models/SalesOrderSection.js`
- `server/models/SalesOrderLine.js` — idempotency index `{ organizationId, sourceQuoteId, sourceQuoteLineId }`

### Constants & services

- `server/constants/salesOrderLifecycle.js` — `SALES_ORDER_STATUS_ON_QUOTE_CONVERT = 'Confirmed'`
- `server/constants/salesOrderFulfillment.js`
- `server/constants/salesOrderSection.js`, `salesOrderLineTypes.js`, `salesOrderPermissions.js`
- `server/services/salesOrderTotalsService.js`
- `server/services/salesOrderSectionService.js`
- `server/services/quoteConversionCoverageService.js`

### Quote lifecycle

- `Partially Converted` status in server + client lifecycle constants
- Convert-eligible while partially converted; block only when fully `Converted`

### Module registration

- `server/scripts/migrateSalesOrdersToCoreModule.js` — platform `sales_orders` core module

### Tests

- `npm run test:sales-orders` — lifecycle, totals, coverage

---

## SO1 — Quote → Sales Order conversion (done)

### Server deliverables

| Item | File / route | Notes |
|------|--------------|-------|
| Conversion orchestration | `server/services/salesOrderConversionService.js` | Atomic convert flow per architecture §7.2 |
| Activity | `server/services/salesOrderActivityService.js` | `sales_order_created`, `sales_order_converted_from_quote` |
| Quote activities | `quoteActivityService` | `quote_partially_converted`, `quote_converted` |
| Primary API | `POST /api/sales-orders/from-quote/:quoteId` | Permission: `sales_orders.convertFromQuote` |
| Quote delegate | `POST /api/quotes/:id/convert` | Thin wrapper → conversion service |
| Link model | `QuoteConversionLink` | Drop unique `{ org, quoteId, revisionNumber }`; allow multiple links per revision |
| Index migration | `server/scripts/migrateQuoteConversionLinkIndex.js` | Drop legacy unique index in existing deployments |

### Conversion flow (§7.2)

1. Validate quote eligibility (`Accepted` \| `Partially Accepted` \| `Partially Converted`)
2. Resolve unmapped accepted lines (+ bundle child expansion)
3. Create `SalesOrder` in **`Confirmed`**
4. Create `SalesOrderSection` rows (partial section rules §8.3)
5. Create `SalesOrderLine` snapshots (§8.2) with bundle ID remap
6. `recomputeSalesOrderAndSectionTotals()`
7. Create `QuoteConversionLink` with `targetRecordId` = `salesOrderId` UUID
8. Recompute quote coverage → `Partially Converted` or `Converted`
9. Write activity events

### Agent UI

| Item | File | Notes |
|------|------|-------|
| Remove stub copy | `QuoteConversionRecordSection.vue` | Show real SO link + conversion list |
| Convert action | `QuoteConversionHeaderActions.vue` | Handle partial status response |
| Activity labels | `quoteActivityUiAdapter.js` | `quote_partially_converted` |
| i18n | `client/src/locales/en/records.json` | Updated conversion strings |

### Tests

- `server/utils/__tests__/salesOrderConversion.test.js` — line/section resolution, coverage integration helpers
- Extend `npm run test:sales-orders` script

### Out of scope (SO1)

- Invoice, GL, inventory
- Fulfillment events collection (SO2)
- Split/merge execution (SO3)
- Full SO record page / list (SO2)

---

## SO2 — Fulfillment + manual create (done)

### Server
- `SalesOrderFulfillment` model + `salesOrderFulfillmentService`
- `POST /api/sales-orders/:id/fulfillments` — qty deltas, header status sync
- `POST /api/sales-orders/:id/fulfillments/:fulfillmentId/reverse` — compensating reversal + rollbacks
- `GET /api/sales-orders/:id/fulfillments` — event history
- `POST /api/sales-orders/` — manual Draft create
- `POST /api/sales-orders/:id/confirm` — Draft → Confirmed
- `POST /api/sales-orders/:id/lines` — catalog line-add (Draft only)
- `PATCH /api/sales-orders/:id/lines/:lineId` — qty edit, section move (bundle-safe)
- `DELETE /api/sales-orders/:id/lines/:lineId` — remove line (bundle cascade)
- `GET /api/sales-orders/` — `listStatistics` status buckets

### UI
- `SalesOrderLinesRecordSection.vue` — Draft qty edit, remove, section move
- `SalesOrderFulfillmentRecordSection.vue` — post ship/cancel/backorder, reverse, history
- Activity labels for fulfillment, reversal, line mutations
- List statistics: Draft, Confirmed, In Fulfillment, Partially Fulfilled, Completed, Cancelled

### Tests
- `server/utils/__tests__/salesOrderFulfillment.test.js`
- `server/utils/__tests__/salesOrderLineOps.test.js`

---

## SO3 — Split / merge / invoice stub (done)

### Server
- `salesOrderSplitService` — `POST /api/sales-orders/:id/split`
- `salesOrderMergeService` — `POST /api/sales-orders/merge`
- `SalesOrderInvoiceAllocation` model + `salesOrderInvoiceAllocationService`
- `GET /api/sales-orders/:id/invoice-allocations`
- `GET /api/sales-orders/:id/invoice-readiness`
- Index migration: `server/scripts/migrateSalesOrderLineSourceIndex.js` (per-SO `sourceQuoteLineId` uniqueness)

### UI
- `SalesOrderLineageRecordSection.vue` — lineage links + split form
- `SalesOrderInvoiceReadinessRecordSection.vue` — bill-on-fulfill readiness table

### Tests
- `server/utils/__tests__/salesOrderSplitMerge.test.js`

---

## SO4 — Manual sections + merge UI (done)

### Server
- `salesOrderSectionController.js` — `GET/POST/PATCH/DELETE /api/sales-orders/:id/sections`
- Draft-only section writes; quote-sourced `lockedSnapshot` sections protected
- `getNextSectionOrder`, `countLinesInSection` on section service

### UI
- `SalesOrderLinesRecordSection.vue` — add/edit/delete sections (Draft), empty section blocks
- `SalesOrderMergeModal.vue` + list bulk **Merge orders** action (`sales_orders.merge` permission)
- Settings → Core Modules registration (`/modules` API + `ModulesAndFields`)

### Tests
- Extend `npm run test:sales-orders` with section CRUD coverage

---

## API surface (target)

| Method | Route | Phase |
|--------|-------|-------|
| POST | `/api/sales-orders/from-quote/:quoteId` | SO1 |
| GET | `/api/sales-orders/:id` | SO1 (minimal) |
| GET | `/api/sales-orders/` | SO2 |
| POST | `/api/sales-orders/` | SO2 |
| POST | `/api/sales-orders/:id/fulfillments` | SO2 |
| POST | `/api/sales-orders/:id/split` | SO3 |
| POST | `/api/sales-orders/merge` | SO3 |

Quote module `POST /quotes/:id/convert` delegates to SO convert service (SO1).

---

## Reference files

| Layer | Path |
|-------|------|
| Architecture | `docs/SALES_ORDER_ARCHITECTURE.md` |
| Conversion metadata | `server/services/quoteConversionService.js` |
| Coverage | `server/services/quoteConversionCoverageService.js` |
| Acceptance / bundles | `server/services/quotePublicAcceptanceService.js` |
| Quote convert (delegate) | `server/controllers/quoteController.js` |
| Conversion UI | `client/src/components/record-page/sections/QuoteConversionRecordSection.vue` |
