# Inventory — Platform Architecture

**Status:** Approved — authoritative for INV0+ implementation  
**Scope:** Platform-native stock authority layer — reservations, ledger, locations, ATP  
**Last updated:** 2026-06-02  
**Audience:** Engineering, product, commerce platform design  

**Strategic decision:** Option **B — Inventory** confirmed in `docs/PLATFORM_STATE_2026.md` (2026-06-02).

**Prerequisites (upstream, frozen):**

| Document | Role |
|----------|------|
| `docs/CATALOG_ROADMAP.md` | `ItemVariant` as sellable unit; lifecycle sellability |
| `docs/SALES_ORDER_ARCHITECTURE.md` | Fulfillment events (`SalesOrderFulfillment`); operational qty — **not stock authority** |
| `docs/COMMERCIAL_PLATFORM_RETROSPECTIVE.md` | Commercial snapshot immutability; TD-04 reservation gap |
| `docs/PAYMENTS_ARCHITECTURE.md` | Authority-layer pattern reference (ledger vs rollup) |

**Explicitly out of scope for Inventory MVP (INV0–INV2):** GL/COGS posting, procurement PO receipt, manufacturing BOM explosion, WMS carrier integrations, multi-entity inter-org transfers.

---

## 1. Executive summary

The **Inventory** module is LiteDesk's **stock authority layer**: it records physical quantity by variant and location, reserves stock for execution commitments, and deducts on fulfillment — **without deriving balances from Sales Orders or fulfillment qty fields**.

```text
┌─────────────────────────────────────────────────────────────────┐
│  Commercial layer (FROZEN)                                      │
│  Catalog · Quote · Sales Order · Invoice · Payments             │
│  Billing: SalesOrderInvoiceAllocation · Cash: PaymentAllocation │
└────────────────────────────┬────────────────────────────────────┘
                             │ variantId + qty intent only
┌────────────────────────────▼────────────────────────────────────┐
│  Inventory layer (THIS DOCUMENT)                                │
│  InventoryLedgerEntry = STOCK AUTHORITY                         │
│  ItemInventory = materialized balance (rollup from ledger)      │
│  InventoryReservation = commitment authority (ATP)              │
└────────────────────────────┬────────────────────────────────────┘
                             │ valuation events (future)
┌────────────────────────────▼────────────────────────────────────┐
│  GL / COGS / Procurement / Manufacturing (later)                │
└─────────────────────────────────────────────────────────────────┘
```

**Core flow (locked):**

```text
Sales Order Confirmed (product/hybrid lines)
  → InventoryReservation (soft commit)
    → SalesOrderFulfillment posted (ship/deliver/complete)
      → InventoryTransaction (operational header)
        → InventoryLedgerEntry (± qty — stock authority)
          → ItemInventory rollup (onHand, reserved, available)
```

**Hard constraints (non-negotiable):**

1. **`InventoryLedgerEntry` is the sole writer of stock quantity truth** — append-only ledger.
2. **`ItemInventory.onHand` is never edited directly** — only updated by `inventoryRollupService` from active ledger rows.
3. **Never derive on-hand from `SalesOrderLine.quantityFulfilled` or fulfillment event totals** — SO remains operational authority only.
4. **Fulfillment posts inventory transactions** — inventory transactions create ledger entries — ledger entries drive balances.
5. **Commercial snapshots are never mutated** by inventory services (SO/Invoice line prices, qty billed, etc.).
6. **Cross-module references use stable public UUIDs** (`inventoryLedgerEntryId`, `inventoryReservationId`, …) — not Mongo `_id` in contracts.

---

## 2. Position in the commerce chain

```text
Catalog.ItemVariant (variantId)
  → QuoteLine / SalesOrderLine (commercial snapshot + ordered qty)
    → InventoryReservation (execution commit — optional policy on Confirm)
      → SalesOrderFulfillment (operational event — existing collection)
        → InventoryTransaction (inventory module header)
          → InventoryLedgerEntry (stock movement)
            → ItemInventory (location balance rollup)
```

### 2.1 Authority separation

| Concern | Authority | Inventory may write? |
|---------|-----------|----------------------|
| Commercial price / tax / discount | Quote/SO/Invoice snapshots | **No** |
| Ordered qty on SO | `SalesOrderLine.quantity` | **No** |
| Fulfilled qty on SO (operational) | `SalesOrderLine.quantityFulfilled` + `SalesOrderFulfillment` | **No** (SO service owns; inventory reacts via hook) |
| Billed qty | `SalesOrderInvoiceAllocation` | **No** |
| On-hand qty | **`InventoryLedgerEntry` → rollup** | **Yes** (via ledger only) |
| Reserved qty | **`InventoryReservation`** | **Yes** |
| Available-to-promise | **Derived** (§8) | **No direct writes** |

### 2.2 Parallel to Payments authority model

| Payments | Inventory |
|----------|-----------|
| `PaymentAllocation` = cash authority | `InventoryLedgerEntry` = stock authority |
| `Invoice.amountPaid` = rollup | `ItemInventory.onHand` = rollup |
| Gateway must not mutate invoice lines | Inventory must not mutate SO/Invoice commercial lines |
| Webhook → `recordPayment` | Fulfillment → `postInventoryTransaction` |

---

## 3. Architectural principles (locked)

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Inventory ledger authority** | Every unit of stock change is an `InventoryLedgerEntry`; no header-only qty mutation |
| 2 | **Stock reservation authority** | `InventoryReservation` is the sole source of committed qty; ATP subtracts active reservations |
| 3 | **Warehouse / location model** | All ledger rows are scoped to `inventoryLocationId`; default location per org |
| 4 | **Available-to-promise (ATP)** | Computed read model: `onHand - reserved - safetyStock (+ incoming)` — never stored as authority |
| 5 | **Sales Order fulfillment integration** | `SalesOrderFulfillment` triggers inventory transaction; SO service does not write ledger |
| 6 | **Inventory transaction audit trail** | Append-only ledger + reservation history; reversals via compensating entries |
| 7 | **Lot / serial readiness** | Schema supports optional `lotId` / `serialNumbers[]` on ledger rows — MVP may leave null |
| 8 | **Inventory valuation readiness** | Ledger carries `unitCostSnapshot` + `valuationMethod` hook — no GL posting in MVP |
| 9 | **Future procurement readiness** | `sourceContext: purchase_receipt` + `incomingQty` in ATP extension — no PO module in MVP |
| 10 | **Future manufacturing readiness** | `sourceContext: production_*` + BOM refs as extension fields — no MRP in MVP |

---

## 4. What Inventory IS and IS NOT

### 4.1 Inventory IS

- The **stock authority** for variant qty by location
- The **reservation authority** for SO (and future quote hold) commitments
- The **ATP calculation** source for line-add guards (INV3+)
- A **platform module** (`moduleKey: inventory`) — not Sales-app-only
- An **append-only ledger** with materialized balances for query performance

### 4.2 Inventory IS NOT

- A fulfillment record (that remains `SalesOrderFulfillment`)
- A substitute for SO operational qty fields
- A billing or cash layer (Invoice/Payments unchanged)
- A GL or COGS journal (valuation fields are readiness only)
- A WMS (pick/pack/ship UI may consume inventory APIs later)

---

## 5. Domain model

All collections are tenant-scoped (`organizationId` required, indexed). Public UUID fields are unique per org.

### 5.1 `InventoryLocation`

Physical or logical place stock is stored.

```javascript
// server/models/InventoryLocation.js (planned)
{
  organizationId,
  inventoryLocationId,         // String UUID — public contract

  locationCode,                  // unique per org — e.g. WH-MAIN
  name,
  locationType,                  // warehouse | store | virtual | transit | quarantine
  status,                        // active | inactive

  // Hierarchy (optional INV1+)
  parentLocationId,              // inventoryLocationId UUID — null for root

  // Defaults
  isDefault,                     // one default receiving/shipping per org
  allowNegative,                 // org policy override — default false

  addressSnapshot,               // optional ship-from display
  externalRef,                   // WMS / 3PL id

  createdAt, updatedAt
}
```

**Indexes:** `{ organizationId, inventoryLocationId }` unique; `{ organizationId, locationCode }` unique.

**Rules:**

1. At least one **active default** location per org before first ledger row.
2. Inactive locations reject new ledger entries; historical rows retained.
3. `warehouseId` on `SalesOrderFulfillment` maps to `inventoryLocationId` at integration boundary (string UUID, not Mongo `_id`).

---

### 5.2 `ItemInventory`

**Materialized balance** — rollup target, not authority.

```javascript
// server/models/ItemInventory.js (planned)
{
  organizationId,
  itemInventoryId,               // String UUID

  variantId,                     // ItemVariant reference — REQUIRED
  itemId,                        // parent Item — denorm for list queries
  inventoryLocationId,

  // ── Rollup fields (written ONLY by inventoryRollupService) ──
  onHand,                        // sum of posted ledger qty deltas
  reserved,                      // sum of active InventoryReservation.qty
  incoming,                      // procurement extension — 0 in MVP
  safetyStock,                   // planning buffer — reduces ATP

  // ── Derived (may be stored for index/sort or computed at read) ──
  available,                     // onHand - reserved - safetyStock (+ incoming)

  unitOfMeasure,                 // copy from variant at first touch
  lastLedgerEntryAt,
  lastCountedAt,                 // from InventoryCount

  updatedAt
}
```

**Indexes:** `{ organizationId, variantId, inventoryLocationId }` **unique**.

**Rules:**

1. **Never** `updateOne` on `onHand` from SO, fulfillment, or UI — **rollup only**.
2. Created lazily on first ledger row or reservation for `(variantId, location)`.
3. Service lines (`fulfillmentMode: service`) do not require `ItemInventory` rows.

---

### 5.3 `InventoryLedgerEntry`

**Stock authority** — append-only quantity truth.

```javascript
// server/models/InventoryLedgerEntry.js (planned)
{
  organizationId,
  inventoryLedgerEntryId,      // String UUID — idempotency + audit

  variantId,
  inventoryLocationId,

  quantityDelta,                 // signed decimal — +in, -out
  unitOfMeasure,

  // ── Transaction linkage ──
  inventoryTransactionId,        // header grouping
  entryType,                     // see §5.3.1

  // ── Cost / valuation readiness (§10) ──
  unitCostSnapshot,              // frozen at post time
  extendedCost,                  // quantityDelta * unitCost (sign-aware)
  valuationMethod,               // standard | average | fifo_layer (future)
  costSource,                    // catalog_cost | manual | po_receipt | mfg_order

  // ── Lot / serial readiness (§9) ──
  lotId,                         // optional — null in MVP
  serialNumbers,                 // optional string[] — null in MVP

  // ── Source traceability ──
  sourceContext,                 // fulfillment | adjustment | transfer | count | reservation_release | ...
  sourceRef: {
    moduleKey,                   // sales_order_fulfillments | inventory_adjustments | ...
    recordId                     // public UUID of source document
  },

  status,                        // posted | reversed
  reversesEntryId,               // inventoryLedgerEntryId — compensating link
  reversedByEntryId,

  postedAt,
  postedBy,
  notes,

  createdAt                      // immutable after post
}
```

#### 5.3.1 `entryType` catalog (initial)

| entryType | quantityDelta | Typical source |
|-----------|---------------|----------------|
| `receipt` | + | Adjustment+, future PO |
| `fulfillment_deduct` | − | SO fulfillment hook |
| `fulfillment_restore` | + | Fulfillment reversal |
| `reservation_consume` | 0* | *Reservation lifecycle only — no qty change |
| `adjustment_in` | + | InventoryAdjustment |
| `adjustment_out` | − | InventoryAdjustment |
| `transfer_out` | − | InventoryTransfer leg A |
| `transfer_in` | + | InventoryTransfer leg B |
| `count_variance` | ± | InventoryCount post |

**Indexes:**

```javascript
{ organizationId, inventoryLedgerEntryId }                           // unique
{ organizationId, variantId, inventoryLocationId, postedAt: -1 }   // balance rebuild
{ organizationId, inventoryTransactionId }                       // transaction detail
{ organizationId, sourceRef.moduleKey, sourceRef.recordId }        // idempotency lookup
```

**Idempotency:** One active ledger row per `(organizationId, sourceRef.moduleKey, sourceRef.recordId, entryType, variantId, inventoryLocationId)` for automated sources (fulfillment, transfer).

---

### 5.4 `InventoryTransaction`

Operational **header** grouping one or more ledger entries (single business action).

```javascript
// server/models/InventoryTransaction.js (planned)
{
  organizationId,
  inventoryTransactionId,        // String UUID

  transactionType,               // fulfillment_deduct | fulfillment_restore | adjustment | transfer | count_post
  status,                        // posted | reversed | failed

  inventoryLocationId,           // primary location (transfers: from location on header)
  inventoryLocationIdTo,         // transfer target only

  lines: [{
    variantId,
    quantity,                    // absolute qty moved (sign in ledger)
    inventoryLedgerEntryId,        // linked posted entry
    unitCostSnapshot
  }],

  sourceContext,
  sourceRef,                     // e.g. salesOrderFulfillmentId

  postedAt,
  postedBy,
  failureCode,                   // INSUFFICIENT_STOCK | LOCATION_INACTIVE | ...
  failureMessage,

  createdAt
}
```

**Rules:**

1. Posting is **atomic**: transaction + all ledger entries + rollup + reservation updates in one Mongo session.
2. Failed transactions **do not** write ledger rows (SO fulfillment may still post operationally — see §7.4 policy flags).

---

### 5.5 `InventoryReservation`

**Reservation authority** — soft commit against ATP.

```javascript
// server/models/InventoryReservation.js (planned)
{
  organizationId,
  inventoryReservationId,        // String UUID

  variantId,
  inventoryLocationId,

  quantity,
  unitOfMeasure,

  status,                        // active | consumed | released | expired

  // ── SO linkage ──
  salesOrderId,
  salesOrderLineId,
  reservedAt,
  expiresAt,                     // optional TTL

  consumedByLedgerEntryId,       // set when fulfillment deduct consumes reservation
  releasedAt,
  releasedBy,
  releaseReason,                 // cancel | split | manual | expiry

  sourceContext,                 // so_confirm | manual_hold | quote_hold (future)
  sourceRef,

  createdAt, updatedAt
}
```

**Indexes:**

```javascript
{ organizationId, inventoryReservationId }                              // unique
{ organizationId, salesOrderId, salesOrderLineId, status }            // SO detail
{ organizationId, variantId, inventoryLocationId, status: 'active' }  // ATP reserved sum
```

**Rules:**

1. **Active reservations reduce ATP** — they do not reduce `onHand` until fulfillment deduct ledger entry.
2. SO **Cancelled** / line **Cancelled** → release reservations (`status: released`).
3. Fulfillment deduct **consumes** reservation qty up to `quantityDelta` (partial fulfill supported).
4. One active reservation per `(salesOrderLineId, variantId, inventoryLocationId)` unless split-SO policy creates multiples.

---

### 5.6 `InventoryAdjustment`

Manual stock correction — creates ledger entries via transaction.

```javascript
// server/models/InventoryAdjustment.js (planned)
{
  organizationId,
  inventoryAdjustmentId,

  inventoryLocationId,
  reasonCode,                    // damaged | found | shrinkage | opening_balance | other
  status,                        // draft | posted | void

  lines: [{
    variantId,
    quantityDelta,               // signed
    unitCostSnapshot,
    notes
  }],

  inventoryTransactionId,        // set on post
  postedAt,
  postedBy,
  notes,

  createdAt
}
```

**Rules:** Post → `InventoryTransaction(adjustment)` → ledger `adjustment_in` / `adjustment_out` → rollup.

---

### 5.7 `InventoryTransfer`

Inter-location move — paired ledger entries.

```javascript
// server/models/InventoryTransfer.js (planned)
{
  organizationId,
  inventoryTransferId,

  fromLocationId,
  toLocationId,
  status,                        // draft | in_transit | posted | cancelled

  lines: [{
    variantId,
    quantity,
    unitCostSnapshot
  }],

  inventoryTransactionId,
  shippedAt,
  receivedAt,
  postedAt,
  postedBy,

  createdAt
}
```

**Rules:** Post creates **two** ledger rows per line: `transfer_out` (from), `transfer_in` (to). Optional `in_transit` virtual location in INV2+.

---

### 5.8 `InventoryCount`

Cycle / physical count session.

```javascript
// server/models/InventoryCount.js (planned)
{
  organizationId,
  inventoryCountId,

  inventoryLocationId,
  status,                        // draft | counting | posted | cancelled

  lines: [{
    variantId,
    systemQty,                   // snapshot at count start
    countedQty,
    varianceQty,                 // counted - system
    unitCostSnapshot
  }],

  inventoryTransactionId,        // variance post
  countedAt,
  postedAt,
  postedBy,

  createdAt
}
```

**Rules:** Post variance only (`count_variance` ledger entries) — not full re-state of on-hand.

---

## 6. Catalog integration

| Catalog field | Inventory use |
|---------------|---------------|
| `ItemVariant.variantId` (via `_id` or public id contract TBD) | **Required** on every inventory row |
| `ItemVariant.unit_of_measure` | Copied to ledger/reservation at post |
| `ItemVariant.cost_price` | Default `unitCostSnapshot` when no PO/MFG source |
| `ItemVariant.lifecycle_state` | Sellability gate remains catalog — inventory does not override |
| `Item.track_inventory` (planned catalog flag) | If false, skip reservation/deduct for variant |

**Planned catalog extension (pre-INV0):**

```javascript
// ItemVariant or Item — planning flag
trackInventory: { type: Boolean, default: true },
inventoryPolicy: { type: String, enum: ['none', 'reserve_on_confirm', 'deduct_on_fulfill'], default: 'reserve_on_confirm' }
```

Service-only SO lines (`fulfillmentMode: service`) bypass inventory regardless of flag.

---

## 7. Sales Order fulfillment integration (locked contract)

This section is the **implementation gate** — no inventory code ships without this contract approved.

### 7.1 Responsibility split

| Layer | Owns | Must NOT do |
|-------|------|-------------|
| **Sales Order service** | `SalesOrderFulfillment` create, line qty rollups, header `fulfillmentStatus` | Write `InventoryLedgerEntry`, mutate `ItemInventory.onHand` |
| **Inventory service** | Reservations, transactions, ledger, balance rollup | Mutate SO commercial fields, change `quantityFulfilled` |
| **Integration hook** | Orchestrates call order | Derive stock from SO qty fields |

### 7.2 Event contract

```text
SO Service: postFulfillment(salesOrderFulfillmentId)
  1. Validate SO + lines (existing)
  2. Update SalesOrderLine qty fields + header status (existing)
  3. Persist SalesOrderFulfillment status: posted (existing)
  4. IF line.variantId trackInventory AND fulfillmentType in DEDUCT_TYPES:
       CALL inventoryFulfillmentService.applyFulfillment({
         organizationId,
         salesOrderFulfillmentId,    // idempotency key
         salesOrderId,
         inventoryLocationId,        // from fulfillment.warehouseId or org default
         lines: [{ salesOrderLineId, variantId, quantityDelta }]
       })
  5. IF inventory returns INSUFFICIENT_STOCK:
       Policy A (default): fail entire fulfillment — rollback SO qty update
       Policy B (org flag): post SO fulfillment, mark inventoryTransaction failed — ops reconcile
  6. Emit activity: sales_order_fulfillment_posted (+ inventory_transaction_posted)
```

**DEDUCT_TYPES:** `ship`, `deliver`, `complete` (not `cancel`, `backorder`).

**RESTORE_TYPES (reversal):** compensating fulfillment → `fulfillment_restore` ledger entries.

### 7.3 Idempotency

```javascript
// Lookup before write
InventoryLedgerEntry.findOne({
  organizationId,
  'sourceRef.moduleKey': 'sales_order_fulfillments',
  'sourceRef.recordId': salesOrderFulfillmentId,
  entryType: 'fulfillment_deduct',
  variantId,
  inventoryLocationId,
  status: 'posted'
})
// exists → return { duplicate: true } — do not double-deduct
```

Fulfillment **reversal** uses new `salesOrderFulfillmentId` on compensating event with `reversesFulfillmentId` link.

### 7.4 Reservation lifecycle (SO Confirm)

```text
SO: Draft → Confirmed
  → FOR each product line with trackInventory:
       inventoryReservationService.reserve({
         salesOrderId,
         salesOrderLineId,
         variantId,
         quantity: line.quantity - line.quantityCancelled,
         inventoryLocationId: org.defaultLocation
       })
  → IF insufficient ATP AND org.blockConfirmOnInsufficientStock:
       reject Confirm
```

```text
SO Cancelled / line Cancelled / SO split (line moved):
  → releaseReservation(salesOrderLineId)
```

```text
Fulfillment deduct posted:
  → consumeReservation(salesOrderLineId, qtyConsumed)
```

### 7.5 Sequence diagram

```text
Agent posts fulfillment (qty 3)
─────────────────────────────────────────────────────────────
SO Service          Inventory Service           Ledger/Rollup
    │                       │                         │
    │── validate SO ────────│                         │
    │── update qtyFulfilled │                         │
    │── save Fulfillment ───│                         │
    │── applyFulfillment ──►│                         │
    │                       │── idempotency check ───►│
    │                       │── consume reservation ─►│
    │                       │── create Transaction ──►│
    │                       │── create LedgerEntry ──►│ (qty -3)
    │                       │── rollup ItemInventory►│ onHand -= 3
    │◄── success ───────────│                         │
    │── activity ───────────│                         │
```

### 7.6 What SO fulfillment fields mean after inventory

| SO field | Still operational? | Stock truth? |
|----------|-------------------|--------------|
| `quantityFulfilled` | Yes — customer/shipping UX | **No** |
| `SalesOrderFulfillment.lines[].quantityDelta` | Yes — audit of operational event | **No** |
| `ItemInventory.onHand` | N/A | **Yes** |
| `InventoryLedgerEntry` sum | N/A | **Yes** |

---

## 8. Available-to-promise (ATP)

### 8.1 Formula (MVP)

```text
ATP(variantId, locationId) =
  ItemInventory.onHand
  - ItemInventory.reserved
  - ItemInventory.safetyStock
  + ItemInventory.incoming        // 0 until procurement (§11)
```

Org-level ATP (no location): sum across **active** locations or default location only — org setting.

### 8.2 ATP guard points (phased)

| Phase | Guard | Behavior |
|-------|-------|----------|
| INV0 | None | Ledger + balances only |
| INV1 | SO Confirm | Optional block if ATP < ordered qty |
| INV2 | Fulfillment post | Block deduct if onHand < qty (hard) |
| INV3 | Quote/SO line-add | `GET /api/inventory/atp?variantId=&qty=` warn/block |
| INV4 | Portal quote accept | Same ATP API |

### 8.3 ATP API (planned)

```http
GET /api/inventory/atp?variantId=&inventoryLocationId=&quantity=
```

Response: `{ onHand, reserved, safetyStock, incoming, available, sufficient }`

**Rule:** ATP endpoints are **read-only** — never write balances.

---

## 9. Lot / serial readiness

MVP ships **nullable** lot/serial dimensions on ledger rows. No lot master table in INV0.

### 9.1 Future `InventoryLot` (schema-ready)

```javascript
// Planned — not INV0
{
  inventoryLotId,
  variantId,
  lotNumber,
  manufacturedAt,
  expiresAt,
  status
}
```

### 9.2 Serial tracking mode

| Mode | MVP | Future |
|------|-----|--------|
| None | ✅ default | — |
| Lot only | Fields on ledger | Lot master + FEFO |
| Serial each | `serialNumbers[]` on deduct entry | Serial registry + uniqueness constraint |

**Fulfillment contract extension:** when serial mode active, `applyFulfillment` requires `serialNumbers.length === quantityDelta`.

---

## 10. Inventory valuation readiness

No GL posting in inventory MVP. Ledger captures cost snapshots for future COGS.

| Field | Purpose |
|-------|---------|
| `unitCostSnapshot` | Frozen at transaction post from catalog cost or manual override |
| `extendedCost` | Signed extended amount on ledger row |
| `valuationMethod` | `standard` MVP; `average`, `fifo_layer` later |
| `costSource` | Trace cost origin |

**Future GL hook (document only):**

```text
InventoryLedgerEntry (fulfillment_deduct)
  → emit inventory.cost_of_goods_calculated
    → GL module consumes (post-Inventory)
```

Invoice revenue recognition remains in Invoice/Payments — COGS pairs via inventory events.

---

## 11. Future procurement readiness

Not implemented in MVP. Schema and ATP extension points only.

| Concept | MVP | Procurement phase |
|---------|-----|-------------------|
| `ItemInventory.incoming` | Field exists, default 0 | PO approved qty |
| `sourceContext: purchase_receipt` | Enum reserved | PO receipt → `receipt` ledger |
| `sourceRef.moduleKey: purchase_orders` | Reserved | PO line UUID linkage |
| Vendor / lead time | — | Separate module |

**ATP extension:**

```text
ATP += incoming (approved PO not yet received)
```

---

## 12. Future manufacturing readiness

Not implemented in MVP.

| Concept | Readiness |
|---------|-----------|
| `sourceContext: production_issue` | Enum on ledger |
| `sourceContext: production_receipt` | Finished goods receipt |
| BOM explosion | Consumes component variants — separate MFG module |
| Work order `mfgOrderId` in `sourceRef` | Reserved field shape |

**Rule:** Manufacturing never writes SO or Invoice — only inventory ledger (same as fulfillment).

---

## 13. Inventory transaction audit trail

### 13.1 Append-only rules

| Entity | Delete | Reverse |
|--------|--------|---------|
| `InventoryLedgerEntry` | **Never** | Compensating entry + `status: reversed` |
| `InventoryReservation` | **Never** | `status: released` or `consumed` |
| `InventoryTransaction` | **Never** | `status: reversed` + linked compensating transaction |
| `SalesOrderFulfillment` | **Never** (existing) | Existing reversal pattern |

### 13.2 Activity events (planned)

| Action | Module activity |
|--------|-----------------|
| `inventory_ledger_posted` | Inventory |
| `inventory_reservation_created` | Inventory |
| `inventory_reservation_released` | Inventory |
| `inventory_transaction_failed` | Inventory + mirror on SO optional |
| `inventory_adjustment_posted` | Inventory |
| `inventory_transfer_posted` | Inventory |
| `inventory_count_posted` | Inventory |

### 13.3 Balance rebuild

Admin-only tool (INV2+): recompute `ItemInventory` from sum of posted `InventoryLedgerEntry` rows — detects rollup drift; does not replace ledger authority.

---

## 14. Permissions (planned)

| Permission key | Capability |
|----------------|------------|
| `inventory.view` | Balances, ledger read, ATP |
| `inventory.adjust` | InventoryAdjustment post |
| `inventory.transfer` | InventoryTransfer post |
| `inventory.count` | InventoryCount post |
| `inventory.manage_locations` | Location CRUD |
| `inventory.override_atp` | Confirm SO / fulfill despite insufficient (audited) |
| `inventory.rebuild_balances` | Admin rollup rebuild |

Fulfillment-triggered transactions inherit **`sales_orders.fulfill`** plus inventory post permission check on service account path.

---

## 15. API surface (target — phased)

| Method | Route | Phase |
|--------|-------|-------|
| GET | `/api/inventory/locations` | INV0 |
| POST | `/api/inventory/locations` | INV0 |
| GET | `/api/inventory/balances` | INV0 |
| GET | `/api/inventory/ledger` | INV0 |
| GET | `/api/inventory/atp` | INV3 |
| POST | `/api/inventory/adjustments` | INV1 |
| POST | `/api/inventory/adjustments/:id/post` | INV1 |
| POST | `/api/inventory/transfers` | INV2 |
| POST | `/api/inventory/transfers/:id/post` | INV2 |
| POST | `/api/inventory/counts` | INV2 |
| POST | `/api/inventory/counts/:id/post` | INV2 |
| GET | `/api/inventory/reservations?salesOrderId=` | INV1 |
| GET/POST | `/api/inventory/lots` | INV4 |
| GET | `/api/inventory/serials` | INV4 |
| GET/POST | `/api/inventory/incoming` | INV4 |
| POST | `/api/inventory/incoming/:id/receive` | INV4 |

**Internal only (not public REST):**

- `inventoryFulfillmentService.applyFulfillment()` — called from SO service
- `inventoryReservationService.reserve()` — called from SO confirm

---

## 16. Implementation phases (proposed)

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| **INV0** | Locations, ledger, transaction, `ItemInventory` rollup, opening balance adjustment | Architecture approval |
| **INV1** | Reservations on SO Confirm, fulfillment hook (deduct + restore), idempotency tests | INV0 + SO hook contract |
| **INV2** | Transfers, counts, insufficient-stock policies, balance rebuild tool | INV1 |
| **INV3** | ATP API + quote/SO line-add guard | INV1 |
| **INV4** | Lot/serial enforcement modes, valuation method hooks, incoming field stub | INV2 |

**Tests (target):**

```bash
npm run test:inventory   # ledger authority, rollup, fulfillment idempotency, reservation ATP
```

---

## 17. Out of scope (explicit)

- GL / journal entries
- COGS auto-post to finance
- Purchase orders / vendor management
- Manufacturing BOM / work orders
- WMS pick/pack/bin management
- Carrier / shipping label integration
- Multi-org intercompany stock
- Landed cost allocation
- Consignment / vendor-owned inventory

---

## 18. Locked decisions (approved 2026-06-02)

| # | Decision | Value |
|---|----------|-------|
| 1 | Stock authority | **`InventoryLedgerEntry` only** — append-only; corrections via adjustment entries |
| 2 | Balance materialization | **`ItemInventory` rollup only** — never direct edit |
| 3 | SO stock derivation | **Forbidden** — never compute on-hand from fulfillment qty |
| 4 | Integration direction | **Fulfillment → InventoryTransaction → LedgerEntry** (INV1+) |
| 5 | Tracked unit | **`ItemVariant` only** — parent `Item` never holds stock |
| 6 | Bundles | **Components only** — bundle parent SKUs never hold/reserve/deduct stock |
| 7 | Default location | **Every org receives `Main Warehouse`** (`MAIN`) on first inventory touch |
| 8 | Reservations | **Partial reservation + backorder supported** (INV1+) |
| 9 | Negative stock | **Disallowed by default**; org-level `allowNegativeInventory` override |
| 10 | Reservation trigger | **SO Confirmed** (INV1) |
| 11 | Deduct trigger | **`SalesOrderFulfillment` posted** (INV1) |
| 12 | Insufficient stock on fulfill | **Fail fulfillment atomically** (default) |
| 13 | Location scope | **Every ledger row** scoped to `inventoryLocationId` |
| 14 | Public IDs | UUID fields on inventory entities for cross-module contracts |
| 15 | Idempotency | **sourceRef + entryType** per automated transaction |
| 16 | Service lines | **Excluded** (`fulfillmentMode: service`) |

---

## 19. Resolved review items (2026-06-02)

| # | Question | Decision |
|---|----------|----------|
| OQ-1 | Variant reference | **`ItemVariant` Mongo `_id`** as `variantId` — aligns with SO/Quote lines |
| OQ-2 | Bundle fulfill | **Component explosion** — parent bundle never holds stock |
| OQ-3 | Default location | **Org `Main Warehouse`** auto-created; multi-warehouse picker INV2 UI |
| OQ-4 | Backorder | **Supported** — partial reservation + backorder qty (INV1) |
| OQ-5 | Negative inventory | **Default no**; org `allowNegativeInventory` override |

---

## 21. Locked decisions (INV1 — approved 2026-06-02)

| # | Decision | Value |
|---|----------|-------|
| 1 | Reservation lifecycle | **`active` · `partially_consumed` · `consumed` · `released` · `cancelled`** |
| 2 | ATP formula | **`ATP = onHand − reserved`** |
| 3 | Reservation granularity | **`variantId` + `inventoryLocationId` + `salesOrderLineId`** |
| 4 | Fulfillment idempotency | One ledger row per **`SalesOrderFulfillment` event** + line (`sourceRef.lineId`) |
| 5 | Negative inventory | **Enforced on deduct** unless org `allowNegativeInventory` or location `allowNegative` |
| 6 | Reservation `sourceRef` | **`{ moduleKey, recordId, lineId }`** |

---

## 22. Locked decisions (INV2 — approved 2026-06-02)

| # | Decision | Value |
|---|----------|-------|
| 1 | **`InventoryTransaction.transactionType`** | `opening_balance` · `reservation` · `reservation_release` · `shipment` · `return` · `adjustment` · `transfer` · `count_variance` |
| 2 | **`InventoryTransaction.sourceRef`** | **`{ moduleKey, recordId, lineId }`** on all automated posts |
| 3 | **Rebuild policy** | Ledger **never modified**; rebuild recomputes **`ItemInventory` rollups only** |
| 4 | **As-of-date inventory** | Architecture-ready (`postedAt` on ledger + reservation timestamps); **no query implementation in INV2** |

**Transaction type mapping (INV1 → INV2):**

| Legacy | Locked type |
|--------|-------------|
| `fulfillment_deduct` | `shipment` |
| `fulfillment_restore` | `return` |
| `count_post` | `count_variance` |

**Reservation ledger types (`reservation`, `reservation_release`):** reserved for future as-of-date / hard-commit modes — INV1 reservations remain **`InventoryReservation`-only** (no ledger rows).

---

## 23. Locked decisions (INV3 — approved 2026-06-02)

| # | Decision | Value |
|---|----------|-------|
| 1 | ATP formula | **`ATP = onHand − reserved`** (unchanged) |
| 2 | Guard policies | **`off` · `warn` · `block`** per org setting |
| 3 | Line-add setting | **`atpLineAddPolicy`** on quote + SO add/patch |
| 4 | Accept setting | **`atpQuoteAcceptPolicy`** on portal accept |
| 5 | Warn bypass | **`forceAtpProceed: true`** on authenticated line mutations |
| 6 | Scope | Standard + bundle **component** lines only |

---

## 24. Locked decisions (INV4 — approved 2026-06-02)

| # | Decision | Value |
|---|----------|-------|
| 1 | Tracking modes | **`none` · `lot` · `serial`** — org default; variant override nullable |
| 2 | Lot enforcement | **`lotId` required** on deduct when mode is `lot` |
| 3 | Serial enforcement | **`serialNumbers.length === abs(quantityDelta)`** on all serial-mode qty moves |
| 4 | Serial registry | **`InventorySerial`** — `available → consumed` on deduct; registered on positive receipt |
| 5 | Lot master | **`InventoryLot`** — optional master; ledger `lotId` references `inventoryLotId` |
| 6 | Valuation hook | Emit **`inventory.cost_of_goods_calculated`** activity on deduct entries — **no GL** |
| 7 | Valuation fields | Ledger **`valuationMethod`** + **`costSource`** frozen at post |
| 8 | Incoming stub | **`InventoryIncomingStub`** — procurement placeholder; drives **`ItemInventory.incoming`** |
| 9 | Stub receive | Posts **`receipt`** ledger with **`sourceContext: purchase_receipt`**; stub → `received` |
| 10 | ATP extension | **`includeIncomingInAtp`** org flag — when false, **`ATP = onHand − reserved`** (INV1 unchanged) |

**Fulfillment extension:** `applyFulfillment` accepts `lotId` / `serialNumbers` on fulfillment line input when tracking mode active.

---

## 20. Summary

| Question | Answer |
|----------|--------|
| What is stock authority? | **`InventoryLedgerEntry`** — append-only |
| Where is on-hand stored? | **`ItemInventory.onHand`** — rollup only |
| What drives deductions? | **`SalesOrderFulfillment` → InventoryTransaction → Ledger** |
| Can SO qty fields represent stock? | **No** |
| What reduces sellable qty before ship? | **`InventoryReservation`** (ATP) |
| Relation to Payments? | Parallel authority layer — commercial docs untouched |
| First implementation phase? | **INV0** after this document is approved |

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-06-02 | Initial draft for review — Option B confirmed, no code |
| 1.0 | 2026-06-02 | Approved — locked decisions §18; INV0 implementation begins |
| 1.1 | 2026-06-02 | INV1 locked decisions §21; reservations + SO integration |
| 1.2 | 2026-06-02 | INV2 locked decisions §22; transfers, counts, rebuild hardening |
| 1.3 | 2026-06-02 | INV3 locked decisions §23; ATP line-add guards |
| 1.4 | 2026-06-02 | INV4 locked decisions §24; lot/serial modes, valuation hooks, incoming stub |

**Approval gate:** ✅ Approved 2026-06-02 · INV1 approved 2026-06-02 · INV4 approved 2026-06-02

**Related next documents (after approval):**

- `docs/INVENTORY_ROADMAP.md` — phase tracker + file list
- Update `docs/PLATFORM_STATE_2026.md` — mark architecture draft complete
