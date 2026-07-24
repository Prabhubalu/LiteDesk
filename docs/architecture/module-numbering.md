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

## Seed / migrate

- New tenants: `seedTenantDatabase` calls `seedDefaultsForOrg`.
- Existing tenants: `node server/scripts/migrateModuleNumberingDefaults.js`
