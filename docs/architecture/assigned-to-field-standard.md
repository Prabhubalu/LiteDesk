# Assigned To Field Standard

**Version:** 1.0  
**Last Updated:** 2026-06-28  
**Status:** Authoritative

---

## 1. Purpose

LiteDesk uses a single platform field — **`assignedTo`** — to represent **who owns or is responsible for a record today**.

Previously, modules used inconsistent keys and labels:

| Legacy key | Modules |
|------------|---------|
| `assignedTo` | people, organizations, tasks, forms |
| `ownerId` | deals, quotes, sales_orders, invoices, documents, targets |
| `caseOwnerId` | cases |
| `eventOwnerId` | events |

This document defines the canonical key, label, enforcement rules, migration path, and what `assignedTo` is **not** used for.

---

## 2. Canonical Contract

### Field key

- **Key:** `assignedTo`
- **Type:** `ObjectId` → `User`
- **Required:** Yes on all CRM record models that support ownership (schema + create defaults)
- **Label (UI):** `Assigned To` (i18n: `common.assignedTo`)

### Modules using `assignedTo`

| Module key | Model / collection |
|------------|-------------------|
| `people` | `People` |
| `organizations` | `Organization` (CRM orgs, `isTenant: false`) |
| `tasks` | `Task` |
| `deals` | `Deal` |
| `cases` | `Case` |
| `events` | `Event` |
| `quotes` | `Quote` |
| `sales_orders` | `SalesOrder` |
| `invoices` | `Invoice` |
| `documents` | `Document` |
| `targets` | `Target` |
| `forms` | `Form` |
| `templates` | `ContentTemplate` |
| Appointment booking config | `AppointmentBookingConfig` |
| Document folders | `DocumentFolder` |

Central registry: `server/utils/recordCreateOwnerDefaults.js` (`MODULE_CREATE_OWNER_FIELDS`).

Client mirror: `client/src/utils/recordCreateOwnerDefaults.ts`.

Assignment adapters: `server/services/assignment/assignmentModuleRegistry.js` (`KNOWN_OWNER_PATHS`).

---

## 3. What `assignedTo` Is Not

| Concern | Use instead |
|---------|-------------|
| Who **created** the record | `createdBy` |
| Who **performed an action** (edit, approve, audit step) | `RecordActivity.author`, `activityLogs[].userId`, `AuditTimeline.actorId`, `SecurityEvent.actorUserId` |
| Audit **executor** on audit events | `auditorId` (source of truth); `assignedTo` may mirror it for ownership scoping |
| Audit **reviewer** | `reviewerId` |
| Corrective action owner | `correctiveOwnerId` |
| Appointment page type (personal vs team) | `ownerType` on `AppointmentBookingConfig` (unchanged) |
| RBAC role name “Owner” | `Role.name` — unrelated to record field |

Do **not** use `assignedTo` as the audit log actor. Log `authorId` / `actorId` on the activity or security event.

---

## 4. Enforcement Layers

### 4.1 Mongoose schema (hard floor)

`assignedTo` is `required: true` on ownership-bearing models. Saves fail if missing.

Bootstrap scripts (e.g. `createDefaultAdmin.js`) must set `assignedTo` before the first `organization.save()` when no user exists yet (pre-generate admin `_id`).

### 4.2 Create defaults (runtime)

`applyCreateOwnerDefaults(body, moduleKey, userId)` fills `assignedTo` with the current user when empty on create.

Used in API controllers, create drawers, imports, and related flows.

### 4.3 Settings / module definitions (soft UI)

`applyOwnerFieldRequiredToModuleFields` forces `required: true` on `assignedTo` when module definitions are returned to Settings. Tenants cannot mark the field optional in Modules & Fields.

Saving **Settings configuration** does not prompt for `assignedTo` — only **record create/edit** does.

### 4.4 Labels

| Layer | Behavior |
|-------|----------|
| Server base fields | `moduleController.js` sets default label `Assigned To` for `assignedTo` |
| Stored overrides | Legacy labels (`Deal Owner`, `Event Owner`, `Owner`, etc.) normalized on module load and via migration |
| Client i18n | `common.assignedTo` → `"Assigned To"`; `fieldLabelResolver.js` resolves `assignedTo` for all modules |
| Client display | `getFieldDisplayLabel(field, moduleKey)` prefers i18n over stale API labels |

Legacy label aliases rewritten to `Assigned To`:

- `Owner`
- `Deal Owner`
- `Event Owner`
- `Case owner` / `Case owner ID`
- `Assigned to (owner)`

---

## 5. Audit Events (Special Case)

For audit event types (`Internal Audit`, `External Audit — Single Org`, `External Audit Beat`):

- **`auditorId`** is the execution authority and UX label **Auditor**.
- **`assignedTo`** may mirror `auditorId` for ownership/list scoping but is hidden in audit create UX where it would duplicate Auditor.
- Non-audit events use **`assignedTo`** with label **Assigned To**.

See `server/controllers/eventController.js` for mirror logic.

---

## 6. Migration

### Script

```bash
cd server
node scripts/migrateOwnerFieldsToAssignedTo.js        # apply
node scripts/migrateOwnerFieldsToAssignedTo.js --dry-run  # preview
```

**File:** `server/scripts/migrateOwnerFieldsToAssignedTo.js`

### Data renames (MongoDB)

| Collection | From | To |
|------------|------|-----|
| `deals` | `ownerId` | `assignedTo` |
| `quotes` | `ownerId` | `assignedTo` |
| `salesorders` | `ownerId` | `assignedTo` |
| `invoices` | `ownerId` | `assignedTo` |
| `documents` | `ownerId` | `assignedTo` |
| `targets` | `ownerId` | `assignedTo` |
| `cases` | `caseOwnerId` | `assignedTo` |
| `events` | `eventOwnerId` | `assignedTo` |
| `appointmentbookingconfigs` | `ownerId` | `assignedTo` |
| `documentfolders` | `ownerId` | `assignedTo` |
| `content_templates` | `ownerId` | `assignedTo` |

### Module definitions

- Rewrites field keys: `ownerId`, `caseOwnerId`, `eventOwnerId` → `assignedTo`
- Normalizes `assignedTo` field **label** to `Assigned To`
- Updates `quickCreate` entries that referenced legacy keys

Run once per environment after deploying the code change.

---

## 7. Key Source Files

### Server

| File | Role |
|------|------|
| `server/utils/recordCreateOwnerDefaults.js` | Owner field registry, create defaults, Settings required flag |
| `server/controllers/moduleController.js` | Base field labels, legacy label normalization |
| `server/services/assignment/assignmentModuleRegistry.js` | Assignment engine owner path |
| `server/constants/assignmentConditionFields.js` | Assignment rule condition labels |
| `server/scripts/migrateOwnerFieldsToAssignedTo.js` | One-time data + ModuleDefinition migration |

### Client

| File | Role |
|------|------|
| `client/src/utils/recordCreateOwnerDefaults.ts` | Create-form owner defaults |
| `client/src/utils/fieldLabelResolver.js` | i18n catalog; `common.assignedTo` for all modules |
| `client/src/utils/fieldDisplay.js` | Display labels; legacy owner label override |
| `client/src/components/common/DynamicFormField.vue` | Passes `moduleKey` into label resolution |
| `client/src/locales/en/common.json` | `assignedTo` message |

---

## 8. Deploy Checklist

1. Deploy server + client with `assignedTo` schema and code changes.
2. Run `node server/scripts/migrateOwnerFieldsToAssignedTo.js` on each MongoDB environment.
3. Hard-refresh client (module definitions may be cached).
4. Smoke-test create flows: deals, cases, events, quotes, documents.
5. Verify Settings → Modules & Fields shows **Assigned To** (not Deal Owner / Owner).

---

## 9. Adding a New Module

When adding a trashable/assignable CRM module:

1. Add `assignedTo: { type: ObjectId, ref: 'User', required: true, index: true }` to the model.
2. Register the module in `MODULE_CREATE_OWNER_FIELDS` (server + client).
3. Register `assignedTo` in `KNOWN_OWNER_PATHS` if assignment rules apply.
4. Use label **Assigned To** in `moduleController` base fields and module defaults.
5. Add `assignedTo` to assignment condition metadata if rule-eligible.
6. Do not introduce `ownerId`, `caseOwnerId`, or module-specific owner key names.

---

## 10. Related Docs

- `docs/architecture/field-metadata-and-policies.md` — field metadata layers
- `docs/architecture/organization-settings.md` — org participation fields including `assignedTo`
- `Architecture_Document.md` — CRM core field groups (People, Deal, Task)
