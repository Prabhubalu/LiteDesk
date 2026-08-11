# Module Numbering

Tenant-configurable Record ID generation for all modules.

## Location

**Settings → Automation → Module Numbering**

## Core pieces

| Piece | Path |
|---|---|
| Registry | `server/constants/moduleNumberingRegistry.js` |
| Config model | `server/models/ModuleNumberingConfig.js` |
| Atomic sequence | `server/models/ModuleSequence.js` |
| Service | `server/services/moduleNumberingService.js` |
| API | `GET/PUT /api/settings/module-numbering/...` |
| UI | `client/src/components/settings/ModuleNumberingSettings.vue` |

## Rules

- Format must contain exactly one `{SEQ}`; supported tokens: `{PREFIX}`, `{SUFFIX}`, `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, `{SEQ}`.
- Allocation uses MongoDB `$inc` on `ModuleSequence` (never reuse deleted IDs).
- Config changes affect **new records only**.
- Trash restore keeps the original Record ID (no re-allocate).
- Quote/SO copy paths clear the number field so a new ID is allocated.
- Custom modules seed a default config + `recordNumber` system field on create.
- Invoice credit notes use module key `invoices:credit_note` (separate sequence from `INV-`).
- Inventory workbench document modules (`purchase_orders`, `receipt_notes`, `purchase_returns`, `delivery_notes`, `delivery_returns`, `sales_returns`) are registered with `requireAppKey: INVENTORY` and only seed/list when the Inventory app is enabled. Allocation goes through `allocateDocumentNumber` (same sequence store as legacy `nextDocNumber`).
- **No Manual Record ID:** `allowManualEdit` is always forced off; IDs are never user-entered.
- **Items / Item Code:** `items.item_code` is system-owned (Module Numbering only). Stripped from create/update APIs, hidden on create/edit forms, immutable after assignment, and never dual-written from `variant_code` (SKU stays on the default variant).

## Seed / migrate

- New tenants: `seedTenantDatabase` calls `seedDefaultsForOrg`.
- Existing tenants: `node server/scripts/migrateModuleNumberingDefaults.js`
