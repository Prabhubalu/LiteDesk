# Catalog Platform — Implementation Roadmap

**Strategic direction:** Evolve the Items module into an **extensible catalog platform** before building transactional ERP modules (Quotes, Sales Orders, Invoices).

**Inventory / accounting / procurement:** Explicitly **out of scope** until transactional modules exist.

**Last updated:** 2026-05-27 (C0–C5 complete)

---

## 1. Executive summary

| Layer | Owns |
|--------|------|
| **Catalog platform (Items)** | Product identity, lifecycle, categories, attributes, variants, media, barcodes, price books, bundles |
| **Quotes / Orders / Invoices (future)** | Line items referencing **variants**, price resolution, fulfillment, inventory movements |
| **Warehouse / ledger (future)** | Stock ledger, reservations, batch tracking, procurement |

**Core architectural bet:** A flat `Item` record is not sufficient. The sellable unit is **`ItemVariant`**. Parent **`Item`** holds shared catalog data. Transactional modules must never depend on parent items directly.

### Progress tracker

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **C0** — Lifecycle + stock UX freeze | ✅ Done | `lifecycle_state`, deprecate stock-centric list/stats/views |
| **C1** — Media, barcode, variant scaffold | ✅ Done | Gallery, GTIN/QR, `ItemVariant` model + APIs |
| **C2** — Category tree + attribute templates | ✅ Done | `CatalogCategory`, templates, validation |
| **C3** — Parent/variant split + migration | ✅ Done | Flat items → parent + default variant |
| **C4** — Price books | ✅ Done | `CatalogPriceBook`, effective dating, resolver |
| **C5** — Bundles / composites | ✅ Done | `ItemBundleComponent`, bundle pricing modes, expand preview |

---

## 2. Current baseline (pre-catalog)

### 2.1 What exists today

| Area | Location | Notes |
|------|----------|--------|
| Flat Item model | `server/models/Item.js` | Single record = one sellable SKU; embedded pricing |
| CRUD API | `server/controllers/itemController.js`, `server/routes/itemRoutes.js` | Filters, stats, deal linking, stock PATCH |
| List + detail UI | `client/src/views/Items.vue`, `ItemDetail.vue` | ModuleList registry; stock warnings in list |
| Field metadata | `client/src/platform/fields/itemFieldModel.ts` | Core/participation/system classification |
| Settings | `ModulesAndFields.vue` | Item types + legacy status picklist (local-only save) |
| Permissions / trash | `Role.js`, `deletionService.js` | Full RBAC; soft delete |

### 2.2 Legacy fields (frozen — do not extend)

These remain in schema for backward compatibility but are **not catalog concerns**:

| Field | Treatment |
|-------|-----------|
| `stock_quantity` | Placeholder until Orders; hidden from default list UX (C0) |
| `reorder_level` | Same |
| `serial_numbers` | Deferred to post-Orders serialization |
| `status` (`Active` / `Inactive`) | Legacy alias; synced from `lifecycle_state` (C0) |
| `selling_price` | Fallback list price until price books (C4) |
| `linked_invoices` | Placeholder until Invoices module |

---

## 3. Target architecture

```text
┌─────────────────────────────────────────────────────────────┐
│           Future: Quotes · Sales Orders · Invoices          │
│         (line items reference variantId + priceBookId)      │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  C4 Price Books          C5 Bundles                         │
│  C3 ItemVariant (sellable SKU)                              │
│  C2 CatalogCategory + AttributeTemplates                      │
│  C1 ItemMedia · Barcode/QR                                  │
│  C0 lifecycle_state                                         │
│  Item (catalog parent)                                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Entity model (target)

| Entity | Role |
|--------|------|
| `Item` | Catalog parent — name, description, category, lifecycle, shared media |
| `ItemVariant` | Sellable SKU — code, barcode, options, UOM, tax class, default list price |
| `ItemMedia` | Ordered gallery — url, kind, isPrimary, altText, sortOrder |
| `CatalogCategory` | Tree node — parentId, path, sortOrder |
| `CatalogAttributeTemplate` | Per-category attribute definitions |
| `CatalogPriceBook` | Named price list — Standard, Wholesale, Partner, … |
| `CatalogPriceBookEntry` | `{ variantId, unitPrice, currency, effectiveFrom, effectiveTo, minQty }` |
| `ItemBundleComponent` | `{ bundleVariantId, componentVariantId, quantity, isOptional }` |

### 3.2 Lifecycle contract (C0)

Canonical field: **`lifecycle_state`**

| State | Sellable on quotes | Visible in pickers | Meaning |
|-------|-------------------|-------------------|---------|
| `Draft` | No | No | Work in progress |
| `Active` | Yes | Yes | Published catalog entry |
| `Discontinued` | Existing docs only | No | No new lines |
| `Archived` | No | No | Retained for history |

Legacy `status` sync (backward compatibility):

- `lifecycle_state === 'Active'` → `status = 'Active'`
- All other lifecycle states → `status = 'Inactive'`

Constants: `server/constants/catalogLifecycle.js` (server source of truth), `client/src/constants/catalogLifecycle.js` (mirror).

**Sellability helper:** `isCatalogItemSellable(state) => state === 'Active'` — used by future Quotes API.

---

## 4. Phase specifications

### C0 — Lifecycle states + stock UX freeze

**Goal:** Establish catalog semantics; stop presenting inventory operations as primary UX.

**Schema (additive):**

```javascript
lifecycle_state: {
  type: String,
  enum: ['Draft', 'Active', 'Discontinued', 'Archived'],
  default: 'Active',
  index: true
}
```

**Migration:** `server/scripts/migrateItemLifecycleState.js`

- `status === 'Active'` → `lifecycle_state = 'Active'`
- `status === 'Inactive'` → `lifecycle_state = 'Discontinued'`
- Missing both → `Active`

**API changes:**

- `GET /api/items?lifecycle_state=Active` — new filter
- `POST /api/items` — accepts `lifecycle_state`; defaults to `Active`
- Statistics: lifecycle counts replace low-stock / out-of-stock in response defaults
- `low_stock`, `out_of_stock`, `PATCH /:id/stock` — **retained** for API compat; not promoted in UI

**UI changes:**

- Default list columns: `lifecycle_state` replaces `stock_quantity`
- Remove low-stock / out-of-stock stat cards and system views
- Lifecycle badge in list; stock cell template removed
- Settings → Items → Status & Types: lifecycle states section (system contract, read-only)
- Stock fields hidden from default field visibility in module definition generation

**Compatibility:**

- Existing integrations using `status` continue to work via sync hook
- Stock API endpoints unchanged

---

### C1 — Media gallery, barcode/QR, variant scaffolding

**Goal:** Rich catalog identity; introduce variant model without full split yet.

**New collections / subdocs:**

- `ItemMedia[]` on Item (ordered gallery; deprecates single `product_image`)
- `ItemVariant` collection (minimal): `{ itemId, variantCode, barcode, barcodeType, qrPayload, isDefault, lifecycle_state }`

**API:**

- `GET/POST/DELETE /api/items/:id/media`
- `GET/POST /api/items/:id/variants` (scaffold; one default variant auto-created in C3 migration)

**UI:**

- Gallery component on item detail
- Barcode field on variant scaffold (detail sub-panel or inline on flat item until C3)

**Compatibility:**

- `product_image` → first gallery entry or primary media migration
- `item_code` remains on Item until C3 moves to variant

---

### C2 — Category tree + attribute templates

**Goal:** Metadata-driven extensibility without custom-field sprawl.

**New collections:**

- `CatalogCategory` — `{ organizationId, name, parentId, path, sortOrder, isActive }`
- `CatalogAttributeTemplate` — `{ categoryId, key, label, dataType, required, options, unit, sortOrder }`

**Item changes:**

- `categoryId` ref replaces flat `category` string (keep string as denormalized fallback during migration)
- `attributeValues: Mixed` validated against category template

**API:**

- `/api/catalog/categories` CRUD + tree
- `/api/catalog/categories/:id/attributes` CRUD
- Item create/update validates `attributeValues` against template

**UI:**

- Category tree picker in item form
- Dynamic attribute fields driven by template
- Settings → Catalog → Categories & attributes admin

**Compatibility:**

- Flat `category` / `subcategory` strings preserved; migration script maps to tree nodes

---

### C3 — Parent Item + ItemVariant split

**Goal:** Every sellable SKU is a variant; existing flat items become parent + default variant.

**Migration (critical):**

For each existing `Item`:

1. Keep row as **parent Item** (strip sellable fields gradually)
2. Create **default `ItemVariant`** carrying: `item_code`, `selling_price`, `cost_price`, tax fields, `barcode`, UOM
3. Set `Item.hasVariants = false` (single default variant) or `true` if multi-variant later

**API:**

- List endpoints return parent summary + `defaultVariant` embed
- `GET /api/catalog/variants/:id` — canonical sellable read for future Quotes
- Item update splits parent vs variant fields

**UI:**

- Detail page: generic record layout (`ModuleRecordPage`) + Catalog section (media, category, SKU)
- List shows parent name + default variant code/price

**Compatibility:**

- Flat item API responses include `defaultVariant` object mirroring old flat shape for 1 release
- Deprecation header: `X-Catalog-Api-Version: 2`

---

### C4 — Price books + effective pricing

**Goal:** Named list prices with effective dating; Quotes resolve price by `{ variantId, priceBookId, asOfDate }`.

**New collections:**

- `CatalogPriceBook` — `{ name, currency, isDefault, isActive }`
- `CatalogPriceBookEntry` — `{ priceBookId, variantId, unitPrice, effectiveFrom, effectiveTo, minQty }`

**Resolution service:** `catalogPriceResolver.resolve({ variantId, priceBookId, quantity, asOfDate })`

**Item/variant:**

- `selling_price` on variant = fallback when no book entry matches

**UI:**

- Settings → Catalog → Price books
- Variant detail: price book entries grid

**Compatibility:**

- Existing `selling_price` seeds default book entry on migration

---

### C5 — Bundle / composite items

**Goal:** Kit/bundle sellable structure without inventory deduction.

**Schema:**

- `item_type` adds `Bundle` (deprecate `Serialized Product` as type — move to post-Orders)
- `ItemBundleComponent` — component lines referencing **variant IDs**
- Bundle variant: `pricingMode: 'fixed' | 'rollup'`

**API:**

- `GET/PUT /api/catalog/variants/:id/bundle-components`
- Bundle expand preview (for Quotes line expansion later)

**UI:**

- Bundle builder on variant detail
- Component picker (variant search)

**Compatibility:**

- Non-bundle items unchanged

---

## 5. API surface (evolution)

### 5.1 Current (`/api/items`)

| Method | Route | C0 | C1+ |
|--------|-------|----|-----|
| GET | `/` | + `lifecycle_state` filter | + embed `defaultVariant` |
| POST | `/` | + `lifecycle_state` | split parent/variant fields |
| GET | `/:id` | + `lifecycle_state` | + variants[], media[] |
| PUT | `/:id` | lifecycle transitions validated | parent-only fields |
| DELETE | `/:id` | unchanged | unchanged |
| PATCH | `/:id/stock` | **deprecated** (hidden) | remove in major version |
| GET | `/statistics` | lifecycle stats | catalog stats |

### 5.2 New namespaces (additive)

| Prefix | Phase | Purpose |
|--------|-------|---------|
| `/api/catalog/variants` | C1/C3 | Read/search, bundle, price entries (writes via `/api/items/:id/variants`) |
| `/api/catalog/categories` | C2 | Category tree |
| `/api/catalog/price-books` | C4 | Price book admin |
| `/api/items/:id/media` | C1 | Gallery management |

Future Quotes API (not in scope):

```javascript
POST /api/quotes/:id/lines
{ variantId, priceBookId, quantity }  // never itemId
```

---

## 6. Migration strategy

| Step | Script | When |
|------|--------|------|
| C0 lifecycle backfill | `migrateItemLifecycleState.js` | Deploy C0 |
| C1 media backfill | `migrateItemProductImageToGallery.js` | Deploy C1 |
| C2 category mapping | `migrateItemFlatCategories.js` | Deploy C2 |
| C3 variant split | `migrateFlatItemsToVariants.js` | Deploy C3 (most critical) |
| C4 price book seed | `migrateVariantPricesToDefaultBook.js` | Deploy C4 |
| Verify (read-only) | `npm run verify:catalog` | After migrations |

**Tenant DBs:** catalog migration scripts target the master URI by default. If items live in per-tenant databases, run the same migrations (or `verify:catalog --org <id>`) against each tenant connection.

**Principles:**

- Scripts connect to **`arivu_master`** (or `MASTER_DB_NAME` from `.env`), not the default DB in `MONGO_URI_LOCAL` (e.g. `/arivu`) — same resolution as `server/lib/mongoConnect.js`
- Additive schema first; never drop columns in the same release as migration
- Dual-write during transition (`status` + `lifecycle_state`, `product_image` + gallery)
- Idempotent migration scripts with `--dry-run`
- Tenant-scoped batch processing

---

## 7. UI implications

| Surface | C0 | C3+ |
|---------|----|-----|
| Items list | Lifecycle column; no stock warnings | Parent name + variant SKU |
| Item detail | Lifecycle state control | Variants tab, media gallery, attributes |
| Quick create | lifecycle default Active | Parent-only + default variant price |
| Settings | Lifecycle contract (read-only) | Categories, price books, attribute templates |
| ModuleList stats | Draft / Active / Discontinued | By lifecycle + type |
| Pickers (future Quotes) | Filter `lifecycle_state=Active` | Search variants |

---

## 8. Compatibility considerations

1. **`status` field** — Kept indefinitely as legacy alias; synced from `lifecycle_state`. New UI uses `lifecycle_state`.
2. **Stock fields** — Schema retained; UI and default stats removed. API endpoints deprecated, not deleted.
3. **`item_code` on Item** — Moves to variant in C3; API shim returns `defaultVariant.item_code` at top level during deprecation window.
4. **`selling_price` on Item** — Same as item_code; shim until C4 price books.
5. **Deal linking** — Stays on Item parent until Quotes module replaces ad-hoc linking.
6. **Custom fields** — Remain on Item parent; variant-specific custom fields deferred to C3.
7. **CSV import/export** — Update in C3 when variant model stabilizes.
8. **No vertical hardcoding** — Categories, attributes, price books, lifecycle labels are tenant-configurable metadata (system defaults in constants).

---

## 9. Future transactional dependencies

When Quotes / Orders / Invoices are built, they **must**:

| Requirement | Catalog dependency |
|-------------|-------------------|
| Line item SKU | `variantId` (required) |
| Unit price resolution | `catalogPriceResolver` + price book |
| Product description on PDF | Parent Item + variant options |
| Tax class | Variant-level tax fields |
| Bundle expansion | `ItemBundleComponent` → child variant lines |
| Sellability check | `isCatalogItemSellable(variant.lifecycle_state)` |
| Inventory allocation | **Not catalog** — Orders module + future ledger |

```text
Quote Line ──► ItemVariant ──► Item (parent)
              └──► PriceBookEntry (as-of quote date)
```

---

## 10. Testing & verification

| Phase | Verification |
|-------|--------------|
| C0 | `npm run test:catalog` (lifecycle sync, migration idempotency, sellability helper) |
| C1 | Media upload + barcode uniqueness per org |
| C2 | Attribute validation against template |
| C3 | Migration dry-run; flat API compat shim |
| C4 | Price resolution effective dating |
| C5 | Bundle component graph (no cycles) |

---

## 11. Files reference

### C0

| File | Change |
|------|--------|
| `server/constants/catalogLifecycle.js` | Lifecycle contract |
| `client/src/constants/catalogLifecycle.js` | Client mirror |
| `server/models/Item.js` | `lifecycle_state` + status sync |
| `server/scripts/migrateItemLifecycleState.js` | Backfill migration |

### C1

| File | Change |
|------|--------|
| `server/constants/catalogBarcode.js` | Barcode/media kind types |
| `server/models/ItemVariant.js` | Sellable variant scaffold |
| `server/models/Item.js` | `media[]` gallery subdocs |
| `server/services/itemMediaService.js` | Gallery CRUD + `product_image` sync |
| `server/services/itemVariantService.js` | Default variant + barcode uniqueness |
| `server/controllers/itemCatalogController.js` | Media + variant API handlers |
| `server/routes/itemRoutes.js` | Nested catalog routes |
| `server/scripts/migrateItemProductImageToGallery.js` | Gallery + default variant backfill |
| `client/src/components/catalog/*` | Gallery + variant UI |
| `client/src/views/ItemDetail.vue` | Catalog sections in details tab |

### C2

| File | Change |
|------|--------|
| `server/models/CatalogCategory.js` | Category tree model |
| `server/models/CatalogAttributeTemplate.js` | Attribute template model |
| `server/services/catalogCategoryService.js` | Tree CRUD + denorm sync |
| `server/services/catalogAttributeValidator.js` | `attributeValues` validation |
| `server/controllers/catalogController.js` | `/api/catalog/*` |
| `server/scripts/migrateItemFlatCategories.js` | Flat category migration |
| `client/src/components/settings/CatalogCategoriesSettings.vue` | Settings admin |
| `client/src/components/catalog/ItemCategoryAttributes.vue` | Item category UI |

---

## 12. Out of scope (explicit)

- Warehouse / multi-location inventory
- Stock ledger / movement history
- Procurement / purchase orders
- Reservations / allocations
- Batch / lot tracking
- Accounting / GL postings
- Cost accounting beyond list/cost price fields

These ship **after** Quotes, Sales Orders, and Invoices.
