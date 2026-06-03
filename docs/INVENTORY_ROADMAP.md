# Inventory Module — Implementation Roadmap

**Source architecture:** `docs/INVENTORY_ARCHITECTURE.md` (approved v1.0)

**Strategic direction:** Platform-native **stock authority layer** — ledger-driven balances, variant-only tracking, SO integration in INV1+.

**Prerequisite:** Catalog C0–C5 · SO SO0–SO4 complete.

**Last updated:** 2026-06-02

---

## Progress tracker

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **Architecture** | ✅ Approved | Locked decisions §18 |
| **INV0** | ✅ Done | Locations, ledger, transactions, rollups, opening balances, rebuild, activity |
| **INV1** | ✅ Done | Reservations, SO Confirm/Cancel hooks, fulfillment deduct/restore, ATP API |
| **INV2** | ✅ Done | Transfers, cycle counts, variance posting, rebuild hardening |
| **INV3** | ✅ Done | Line-add ATP guards (warn/block) + portal quote accept |
| **INV4** | ✅ Done | Lot/serial modes, valuation hooks, incoming qty stub |

---

## Locked decisions (INV2 — approved 2026-06-02)

| # | Decision |
|---|----------|
| 1 | **`InventoryTransaction.transactionType`**: `opening_balance` · `reservation` · `reservation_release` · `shipment` · `return` · `adjustment` · `transfer` · `count_variance` |
| 2 | **`InventoryTransaction.sourceRef`**: `{ moduleKey, recordId, lineId }` |
| 3 | **Rebuild policy**: ledger never modified; rollups only recomputed |
| 4 | **As-of-date inventory**: architecture-ready; no implementation in INV2 |

---

## Locked decisions (INV1 — approved 2026-06-02)

| # | Decision |
|---|----------|
| 1 | Reservation lifecycle: **`active` · `partially_consumed` · `consumed` · `released` · `cancelled`** |
| 2 | **ATP = onHand − reserved** |
| 3 | Reservation granularity: **`variantId` + `inventoryLocationId` + `salesOrderLineId`** |
| 4 | Fulfillment idempotency: **`sourceRef` keyed to `SalesOrderFulfillment` event** — no double deduct |
| 5 | Negative inventory **blocked** unless org `allowNegativeInventory` (or location override) |
| 6 | **`InventoryReservation.sourceRef`**: `{ moduleKey, recordId, lineId }` |

---

## Locked decisions (from architecture §18)

| # | Decision |
|---|----------|
| 1 | Inventory tracks **`ItemVariant` only** |
| 2 | **Bundles never hold stock** — components reserve/deduct (INV1+) |
| 3 | Every org receives **`Main Warehouse`** (`MAIN`) |
| 4 | **Partial reservation + backorder** supported (INV1+) |
| 5 | **Negative stock disallowed** by default; org override |
| 6 | **`InventoryLedgerEntry` append-only** — corrections via adjustments |

---

## INV0 — Ledger foundation (done)

### Models

| Model | File |
|-------|------|
| InventoryLocation | `server/models/InventoryLocation.js` |
| InventoryLedgerEntry | `server/models/InventoryLedgerEntry.js` |
| InventoryTransaction | `server/models/InventoryTransaction.js` |
| ItemInventory | `server/models/ItemInventory.js` |
| InventoryAdjustment | `server/models/InventoryAdjustment.js` |
| OrganizationInventorySettings | `server/models/OrganizationInventorySettings.js` |

### Constants

| File | Contents |
|------|----------|
| `inventoryLifecycle.js` | Statuses, entry types, transaction types, qty helpers |
| `inventoryPermissions.js` | RBAC keys |
| `inventoryModuleDefaults.js` | Platform module field defaults |

### Services

| Service | Responsibility |
|---------|----------------|
| `inventoryLocationService.js` | CRUD + `ensureMainWarehouse` |
| `inventoryRollupService.js` | Recompute `ItemInventory` from ledger |
| `inventoryTransactionService.js` | Post transaction + ledger atomically |
| `inventoryAdjustmentService.js` | Opening balance + manual adjustments |
| `inventoryBalanceRebuildService.js` | Admin rebuild all balances |
| `inventoryActivityService.js` | Append-only activity |

### API

| Method | Route |
|--------|-------|
| GET | `/api/inventory/locations` |
| POST | `/api/inventory/locations` |
| GET | `/api/inventory/balances` |
| GET | `/api/inventory/ledger` |
| POST | `/api/inventory/adjustments` |
| POST | `/api/inventory/adjustments/:id/post` |
| GET | `/api/inventory/adjustments/:id` |
| POST | `/api/inventory/rebuild-balances` |

### Migration

```bash
node server/scripts/migrateInventoryToCoreModule.js
```

### Tests

```bash
cd server && npm run test:inventory
```

**Explicitly NOT in INV0:** `InventoryReservation`, SO fulfillment hook, ATP guards.

---

## INV1 — Reservations + SO integration (done)

### Models

| Model | File |
|-------|------|
| InventoryReservation | `server/models/InventoryReservation.js` |

### Services

| Service | Responsibility |
|---------|----------------|
| `inventoryReservationService.js` | Reserve / release / consume / restore |
| `inventoryAtpService.js` | Read-only ATP (`onHand − reserved`) |
| `inventoryFulfillmentService.js` | Fulfillment → transaction → ledger + consume |
| `inventoryLineEligibilityService.js` | Bundle explosion + service-line exclusion |

### SO hooks

| Event | Hook |
|-------|------|
| SO Confirm | `reserveForSalesOrder` |
| SO Cancel | `releaseForSalesOrder` (status `cancelled`) |
| SO merge source cancel | `releaseForSalesOrder` |
| Fulfillment ship/deliver/complete | `applyFulfillment` (deduct + consume) |
| Fulfillment reversal | `applyFulfillment` (`isReversal`) |
| Fulfillment cancel | `releaseReservationQty` |

### API

| Method | Route |
|--------|-------|
| GET | `/api/inventory/atp?variantId=&inventoryLocationId=&quantity=` |
| GET | `/api/inventory/reservations?salesOrderId=` |
| POST | `/api/sales-orders/:id/cancel` |

### Tests

```bash
cd server && npm run test:inventory   # 13 tests — ledger + reservation + fulfillment
```

**Explicitly NOT in INV1:** transfers, cycle counts, lot/serial.

---

## INV2 — Transfers + counts (done)

### Models

| Model | File |
|-------|------|
| InventoryTransfer | `server/models/InventoryTransfer.js` |
| InventoryCount | `server/models/InventoryCount.js` |

### Services

| Service | Responsibility |
|---------|----------------|
| `inventoryTransferService.js` | Draft transfer + post paired legs |
| `inventoryCountService.js` | Count session (draft → counting → posted) + variance |
| `inventoryBalanceRebuildService.js` | Drift detection + rebuild (ledger untouched) |

### API

| Method | Route |
|--------|-------|
| GET/POST | `/api/inventory/transfers` |
| POST | `/api/inventory/transfers/:id/post` |
| GET/POST | `/api/inventory/counts` |
| POST | `/api/inventory/counts/:id/start` |
| PATCH | `/api/inventory/counts/:id/lines` |
| POST | `/api/inventory/counts/:id/post` |
| GET | `/api/inventory/drift` |
| POST | `/api/inventory/rebuild-balances` |

### Adjustment reasons (expanded)

`opening_balance` · `damaged` · `found` · `shrinkage` · `correction` · `physical_count` · `write_off` · `reclass` · `other`

### Tests

```bash
cd server && npm run test:inventory   # 16 tests
```

**Explicitly NOT in INV2:** lot/serial, valuation hooks, as-of-date queries.

---

## Locked decisions (INV3 — approved 2026-06-02)

| # | Decision |
|---|----------|
| 1 | **ATP formula unchanged**: `onHand − reserved` |
| 2 | **Guard policies**: `off` · `warn` · `block` (org settings) |
| 3 | **`atpLineAddPolicy`**: quote + SO line add and qty patch |
| 4 | **`atpQuoteAcceptPolicy`**: portal quote accept (warn proceeds with response flag) |
| 5 | **`forceAtpProceed: true`**: bypasses warn on internal line mutations only |
| 6 | **Bundle parents** excluded; components checked individually |

---

## INV3 — Line-add ATP guards (done)

### Settings (`OrganizationInventorySettings`)

| Field | Default | Values |
|-------|---------|--------|
| `atpLineAddPolicy` | `off` | `off` · `warn` · `block` |
| `atpQuoteAcceptPolicy` | `off` | `off` · `warn` · `block` |

### Guard points

| Event | Service |
|-------|---------|
| Quote line add / qty patch | `guardQuoteLineQuantity` |
| SO line add / qty patch | `guardSalesOrderLineQuantity` |
| Portal quote accept | `guardQuoteAcceptance` |

### Response contract

| Policy | HTTP | `canProceed` |
|--------|------|--------------|
| `off` | proceed | n/a |
| `warn` | 409 unless `forceAtpProceed` | `true` |
| `block` | 409 | `false` |

Portal accept **warn** proceeds; response includes `inventoryAtp` warnings.

### Tests

```bash
cd server && npm run test:inventory   # 20 tests
```

---

## Locked decisions (INV4 — approved 2026-06-02)

| # | Decision |
|---|----------|
| 1 | **Tracking modes**: `none` · `lot` · `serial` — org `defaultTrackingMode`; variant `inventoryTrackingMode` override |
| 2 | **Lot deduct** | `lotId` required on negative qty when mode is `lot` |
| 3 | **Serial deduct** | `serialNumbers.length === abs(quantityDelta)`; registry enforces `available → consumed` |
| 4 | **Serial receipt** | Positive qty with serial mode registers `InventorySerial` rows |
| 5 | **Valuation** | Ledger carries `valuationMethod` + `costSource`; **`inventory.cost_of_goods_calculated`** activity on deduct (no GL) |
| 6 | **Incoming stub** | `InventoryIncomingStub` drives `ItemInventory.incoming`; receive posts `receipt` with `sourceContext: purchase_receipt` |
| 7 | **ATP extension** | Default unchanged (`onHand − reserved`); optional **`includeIncomingInAtp`** adds stub rollup |

---

## INV4 — Lot/serial, valuation hooks, incoming stub (done)

### Models

| Model | File |
|-------|------|
| InventoryLot | `server/models/InventoryLot.js` |
| InventorySerial | `server/models/InventorySerial.js` |
| InventoryIncomingStub | `server/models/InventoryIncomingStub.js` |

### Settings / catalog

| Field | Location | Default |
|-------|----------|---------|
| `defaultTrackingMode` | `OrganizationInventorySettings` | `none` |
| `defaultValuationMethod` | `OrganizationInventorySettings` | `standard` |
| `includeIncomingInAtp` | `OrganizationInventorySettings` | `false` |
| `inventoryTrackingMode` | `ItemVariant` | null (inherit org) |

### Services

| Service | Role |
|---------|------|
| `inventoryTrackingService` | Mode resolution, lot CRUD, serial register/consume |
| `inventoryValuationService` | Cost context + COGS activity hook |
| `inventoryIncomingService` | Stub CRUD, receive → receipt, incoming rollup |

### API

| Method | Route |
|--------|-------|
| GET/POST | `/api/inventory/lots` |
| GET | `/api/inventory/serials` |
| GET/POST | `/api/inventory/incoming` |
| POST | `/api/inventory/incoming/:id/cancel` |
| POST | `/api/inventory/incoming/:id/receive` |

### Tests

```bash
cd server && npm run test:inventory   # 28 tests
```

**Explicitly NOT in INV4:** PO module, GL posting, FEFO lot picking UI.

---

## Relationship to frozen commercial layer

| Artifact | Inventory action |
|----------|------------------|
| `SalesOrderLine.quantityFulfilled` | **Never** stock truth |
| Commercial snapshots | **Never mutate** |
| `ItemVariant` | **Required** reference on all stock rows |
| Bundle parent variant | **Never** ledger target |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-02 | Initial roadmap — INV0 started |
| 1.1 | 2026-06-02 | INV0 complete — 8/8 tests, ledger authority live |
| 1.2 | 2026-06-02 | INV1 complete — reservations, SO hooks, ATP API, 13/13 tests |
| 1.3 | 2026-06-02 | INV2 complete — transfers, counts, rebuild hardening, 16/16 tests |
| 1.4 | 2026-06-02 | INV3 complete — ATP line-add guards + quote accept, 20/20 tests |
| 1.5 | 2026-06-02 | INV4 complete — lot/serial modes, valuation hooks, incoming stub, 28/28 tests |
