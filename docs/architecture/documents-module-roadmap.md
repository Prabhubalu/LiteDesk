# Documents Module — Implementation Roadmap

> **Status:** Planning  
> **Scope:** Platform Core entity (`documents`) — standalone repository + contextual attachment engine across all apps  
> **Source:** Arivu Documents Module — Final Specification (Internal)  
> **Architecture reference:** `Architecture_Document.md`

---

## 1. Purpose

The Documents Module is the centralized content layer of Arivu. It enables users to:

- Upload and manage files
- Create native rich documents
- Track versions and audit history
- Organize content (folders, tags)
- Link documents to any record
- Share securely with role/team visibility
- Publish knowledge articles
- Reference external documents (metadata only)
- Automate document generation and routing via Process Designer
- Participate in optional approval flows (owned by Process Engine)

The module acts as:

1. **Standalone document repository** — full list/grid/folder/editor UI
2. **Contextual attachment engine** — attach/link from any record page

---

## 2. Strategic Positioning

| Role | Design |
|------|--------|
| Platform Core entity | `documents` — same tier as People, Tasks, Forms (`appKey: platform`, `navigationEntity: true`) |
| Standalone surface | Full repository UI (list, grid, folder, timeline, editor) |
| Contextual engine | Attach/link to records via `RelationshipInstance` + record-page widget |
| Not owned by Documents | Approvals → Process Engine `approval_gate`; trash → `deletionService`; cross-record comments → `RecordActivity` pattern |

### 2.1 Current State (Gap)

Documents is **not implemented** as a Core module. File handling is fragmented:

| Location | What exists |
|----------|-------------|
| `server/controllers/filesController.js` | Person-only file attachments |
| `server/models/PersonFileAttachment.js` | Separate person file store |
| Task/deal comment attachments | Per-module upload endpoints |
| `server/models/QuoteDocument.js` | Quote PDF generation + versioning |
| `server/middleware/uploadMiddleware.js` | Multer + `fileStorageService` (local/S3) |

**Post-MVP consolidation:** migrate siloed attachments into Documents without breaking existing flows.

### 2.2 Platform Reuse Map

| Capability | Reuse |
|------------|-------|
| File storage | `fileStorageService` + `uploadMiddleware` |
| Rich editor | TipTap stack (`TaskDescriptionEditor.vue`) |
| Cross-module links | `RelationshipInstance` + `RelationshipDefinition` |
| Generated PDFs | `QuoteDocument` versioning/checksum pattern |
| Lifecycle approvals | Process Designer + `approval_gate` (optional, config-driven) |
| Permissions | `Role.appPermissions` + `checkPermission` |
| Soft delete | `deletionService` |
| Module UI shell | `GenericModule.vue` + `ModuleDefinition` registry |
| Audit | New immutable `DocumentAuditEvent` collection |

---

## 3. Document Types

| Type | Description | Phase |
|------|-------------|-------|
| File | Uploaded files (PDF, DOCX, XLSX, images, video, ZIP) | 1 |
| Rich Document | Native Arivu documents | 3 |
| Generated Document | Workflow-generated files | 5 |
| External Link | Google Drive / OneDrive / Dropbox references (metadata only) | 5 |
| Template | Reusable document structures | 3 |
| SOP | Standard operating procedures | 3 |
| Knowledge Article | Internal or portal articles | 3 |
| Playbook | Team procedures | 3 |
| Meeting Notes | MOM documents | 3 |
| Checklist | Process checklists | 3 |

### 3.1 Document Sources

**Internal** — stored by Arivu (`fileStorageService`).

**External** — Arivu stores metadata, relationships, and URL references only. Arivu does **not** store external files, sync contents, or manage external permissions. Users are redirected to the provider.

---

## 4. Data Model

### 4.1 `documents` (current-version pointer + metadata)

| Group | Fields |
|-------|--------|
| Identity | `documentNumber` (DOC-000001), `title`, `description` |
| Classification | `documentType`, `category`, `folderId`, `tags[]` |
| Source | `sourceType` (internal \| external), `sourceProvider`, `externalUrl` |
| Content | `richContent` (JSON/HTML), `fileType`, `fileSizeBytes`, `checksum`, `mimeType` |
| Storage | `storageProvider`, `filePath` |
| Versioning | `versionNumber`, `currentVersionId` |
| Ownership | `ownerId`, `createdBy`, `modifiedBy` |
| Lifecycle | `status`, `effectiveDate`, `expiryDate`, `renewalDate`, `retentionPolicy` |
| Visibility | `private`, `teamIds[]`, `roleIds[]`, `portalVisible`, `knowledgeBase` |
| Lock | `reservationStatus`, `reservedBy`, `reservedAt`, `reservationExpiresAt`, `reservationReason` |
| Presence | `presence_sessions` collection (`documentId`, `userId`, `activityType`, `lastSeenAt`) |
| Version conflicts | `version_conflicts` collection (`baseVersion`, `currentVersion`, `uploadedBy`, `resolvedBy`) |
| System | `organizationId`, `deletedAt`, `deletedBy`, timestamps |

### 4.2 `documentversions` (immutable version chain)

| Fields |
|--------|
| `organizationId`, `documentId`, `versionNumber`, `parentVersionId` |
| `checksum`, `filePath`, `richContent` snapshot, `fileSizeBytes` |
| `createdBy`, `createdAt`, `changeSummary` |

### 4.3 `documentfolders` (hierarchical)

| Fields |
|--------|
| `organizationId`, `name`, `parentFolderId`, `path`, `ownerId`, `sortOrder` |

### 4.4 `documentauditevents` (immutable — spec §23)

| Fields |
|--------|
| `organizationId`, `documentId`, `action`, `actorId`, `metadata`, `timestamp` |

Actions: upload, preview, download, share, delete, restore, version change, ownership change.

### 4.5 Per-user UX state

| Collection | Purpose |
|------------|---------|
| `documentfavorites` | Starred documents per user |
| `documentrecents` | Recently viewed / edited / shared per user |

### 4.6 Relationships (no FKs in target modules)

| Link | Mechanism |
|------|-----------|
| Document ↔ Record | `RelationshipInstance` (`relationshipKey: document_attached_to`) |
| Document ↔ Document | `RelationshipInstance` (`relationshipKey: document_related_to`) |

Allowed record modules: people, organizations, deals, cases, tasks, events, forms, quotes, reports, transactions (when available).

A document may have **multiple parent records**. Document-to-document trees supported (e.g. Master Agreement → NDA → PO → Invoice).

---

## 5. Lifecycle

```
Draft → Pending Review → Approved → Published → Archived → Deleted (soft)
```

| Status | Meaning |
|--------|---------|
| Draft | Under preparation |
| Pending Review | Waiting for approval |
| Approved | Validated |
| Published | Available for consumption |
| Archived | Historical record |
| Deleted | Soft deleted (trash) |

**Default:** Most document types go Draft → Published without approval.

### 5.1 Approvals (spec §19)

- Documents do **not** own approvals — Process Engine `approval_gate` does.
- Approval is **optional** and configured in Process Designer by document type, action, role, and state.
- Example: Contract + Publish → approval required; Meeting Notes → auto-publish.
- Actions that may trigger approval: Publish, Delete, Archive, Share Externally.

---

## 6. Core Capabilities Matrix

| Capability | Phase | Notes |
|------------|-------|-------|
| Single / bulk / drag-drop upload | 1 | Reuse `uploadMiddleware` |
| Mobile upload | 6 | Responsive UX |
| Preview (images, PDF) | 1 | External opens new tab |
| Download (permission-gated) | 1 | Signed URLs |
| Version control (restore, history) | 1 | Compare in Phase 6 |
| Folder management | 1 (flat), 4 (nested) | |
| Tags | 1 | Multi-select picklist |
| Rich document editor | 3 | TipTap-based |
| Template library | 3 | Seeded templates |
| Search | 4 | Title, content, tags, folder, owner, linked record |
| Visibility (private, team, role) | 4 | Dynamic recalc on role change |
| Comments & discussions | 4 | Reuse `RecordActivity` pattern |
| Favorites | 4 | Per-user |
| Recent documents | 4 | Per-user |
| Editing coordination | 5 | Presence (native docs), reservations (editable files), version conflicts |
| Expiry management | 5 | Notify owner; renewal process hook |
| Duplicate detection | 4 | Checksum: version / allow / reject |
| Google Drive (Phase 1 external) | 5 | Metadata + URL only |
| Generated documents | 5 | Process Designer / quote-style output |
| Document relationships | 5 | Parent/child tree |
| Portal / Knowledge Base flags | 5 | Portal surfacing in later portal work |
| Audit logs | 1 | Immutable events |
| Timeline view | 6 | Activity + version timeline |

---

## 7. Edge Cases (spec §24)

| Case | Behavior |
|------|----------|
| Parent record deleted | Document remains; relationship becomes historical |
| External file deleted | Metadata remains; status `external_unavailable` |
| Broken link | User warning on access |
| Duplicate upload | Configurable: create version / allow / reject |
| Soft delete | Restore via trash |
| Storage failure | Retry-safe upload |
| Portal access revoked | Shared links invalidated |
| Approval flow changed | New rules apply to future actions only |
| Owner deactivated | Ownership reassignment (configurable) |
| Role changes | Visibility recalculated dynamically |

---

## 8. API Surface (Target)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/documents` | List with filters |
| `POST /api/documents` | Create (metadata or rich doc) |
| `GET /api/documents/:id` | Get document |
| `PATCH /api/documents/:id` | Update metadata / rich content |
| `DELETE /api/documents/:id` | Soft delete (trash) |
| `POST /api/documents/:id/upload` | Upload new file version |
| `GET /api/documents/:id/versions` | Version history |
| `POST /api/documents/:id/versions/:v/restore` | Restore version |
| `GET /api/documents/:id/preview` | Preview URL |
| `GET /api/documents/:id/download` | Download (permission-gated) |
| `POST /api/documents/:id/link` | Link to record |
| `DELETE /api/documents/:id/link/:relationshipId` | Unlink |
| `GET /api/modules/:moduleKey/records/:recordId/documents` | Record attachments |
| `POST /api/documents/:id/reserve` | Reserve for editing (editable files) |
| `DELETE /api/documents/:id/reserve` | Release reservation |
| `POST /api/documents/:id/reserve/takeover` | Take over reservation |
| `POST /api/documents/:id/reserve/notify` | Notify current reserver |
| `GET /api/documents/:id/presence` | List active presence (native docs) |
| `POST /api/documents/:id/presence/heartbeat` | Update presence heartbeat |
| `GET /api/documents/:id/conflicts` | List version conflicts |
| `POST /api/documents/:id/conflicts/:conflictId/resolve` | Resolve version conflict |
| `GET /api/document-folders` | List folders |
| `POST /api/document-folders` | Create folder |
| `PATCH /api/document-folders/:id` | Update folder |
| `GET /api/documents/search` | Full search |
| `POST /api/documents/:id/favorite` | Toggle favorite |

Permissions: `documents.{view,create,edit,delete,download,share}`.

---

## 9. UI Views (spec §25)

| View | Phase |
|------|-------|
| List View | 1 |
| Grid View | 3 |
| Folder View | 1 (flat), 4 (tree) |
| Timeline View | 6 |
| Editor View | 3 |

Filters: file type, folder, tags, owner, linked module, status.

---

## 10. Phased Implementation

### Phase 0 — Foundation & Platform Registration

**Duration:** 1–1.5 weeks  
**Goal:** Core entity exists; APIs work; registered in platform registry.

| Work item | Details |
|-----------|---------|
| Models | `Document`, `DocumentVersion`, `DocumentFolder`, `DocumentAuditEvent` |
| Service | `documentService` — CRUD, numbering (`DOC-000001`), version create, checksum |
| Routes / controller | `/api/documents` |
| Upload | Internal file upload; wire `persistMulterUpload` |
| Permissions | Add to `Role.appPermissions`; `checkPermission` middleware |
| Registry | `ModuleDefinition` — `platform.documents`, `navigationEntity: true` |
| CORE_ENTITIES | Add `documents` to `server/routes/moduleRoutes.js` |
| Field model | `client/src/platform/fields/documentsFieldModel.ts` |
| System fields | Register in `globalSystemFields.ts`, `moduleController.js` excluded set |
| i18n | `client/src/locales/{lang}/documents.json` |
| Trash | Register in `deletionService` |

**Exit criteria:** Create/upload document via API; tenant-isolated; permission-gated; appears in sidebar registry.

---

### Phase 1 — File Repository MVP

**Duration:** 2 weeks  
**Goal:** Standalone document management for uploaded files.

| Work item | Details |
|-----------|---------|
| Document type | `File` (internal only) |
| List view | Registry-driven or dedicated `DocumentsListPage` |
| Upload UX | Single, bulk, drag-and-drop |
| Preview | Images + PDF inline |
| Download | Permission-controlled signed URLs |
| Versioning | New upload → new version; history; restore |
| Folders | Flat folders |
| Tags | Multi-select |
| Filters | File type, folder, owner, status |
| Audit | upload, preview, download, delete, version change |

**Exit criteria:** Upload, organize, preview, version, and download files from Documents module.

---

### Phase 2 — Contextual Attachment Engine

**Duration:** 1.5 weeks  
**Goal:** Documents usable from any record page.

| Work item | Details |
|-----------|---------|
| RelationshipDefinition | `document_attached_to` for all supported module pairs |
| API | Link/unlink; list documents for record |
| Record widget | `RecordDocumentsPanel.vue` on record pages |
| Edge case | Parent deleted → historical relationship |
| Search | Linked module/record filter |

**Exit criteria:** Attach document to Deal; visible on Deal record and Documents list.

---

### Phase 3 — Rich Documents & Templates

**Duration:** 2–2.5 weeks  
**Goal:** Native authoring inside Arivu.

| Work item | Details |
|-----------|---------|
| Document types | Rich Document, SOP, Meeting Notes, Checklist, Knowledge Article, Playbook, Template |
| Editor | `DocumentEditor.vue` — TipTap: headings, lists, checklists, tables, images, links, code blocks, mentions, embedded files |
| Templates | Seed: Meeting Notes, RCA, Installation Checklist |
| Lifecycle | Draft → Published default |
| Grid view | Thumbnail cards |
| Editor view | Full-page Google Docs–style experience |

**Exit criteria:** Create SOP from template; edit rich content; publish; searchable by title.

---

### Phase 4 — Organization, Search & Collaboration

**Duration:** 2 weeks  
**Goal:** Discovery and team workflows.

| Work item | Details |
|-----------|---------|
| Folder tree | Nested hierarchy |
| Search | Title, content, tags, folder, owner, linked record, related documents |
| Visibility | Private, team, role-based |
| Comments | Document-scoped via `RecordActivity` pattern |
| Favorites | Per-user star |
| Recent | Viewed / edited / shared |
| Ownership | owner vs createdBy vs modifiedBy; deactivation reassignment |
| Duplicate detection | Checksum match → version / allow / reject |

**Exit criteria:** Find document by tag + linked deal; team visibility; comments on document page.

---

### Phase 5 — Governance, External & Automation

**Duration:** 2–2.5 weeks  
**Goal:** Enterprise controls and platform integration.

| Work item | Details |
|-----------|---------|
| Editing coordination | Presence for native docs; temporary reservations for DOCX/XLSX/PPTX; upload conflict detection |
| Expiry | effective/expiry/renewal; scheduler notifications |
| External Link | Google Drive Phase 1 (metadata + URL) |
| Broken link | `external_unavailable` status |
| Generated Document | Process Designer hook; quote-style output registration |
| Approvals | Process templates per document type + action |
| Document relationships | Parent/child document tree |
| Retention policy | Archival rules |
| Portal / KB flags | `portalVisible`, `knowledgeBase` |

**Exit criteria:** Contract publish triggers approval; Google Drive link works; expiry notification fires.

---

### Phase 6 — Advanced UI & Hardening

**Duration:** 1.5 weeks  
**Goal:** Spec-complete UI and production readiness.

| Work item | Status | Details |
|-----------|--------|---------|
| Timeline view | Done | Org-wide audit timeline tab + pagination |
| Compare versions | Done | Metadata compare modal on file documents |
| Mobile upload | Done | Touch-friendly targets, accept filters, responsive layout |
| Storage failure | Done | Client retry + `X-Idempotency-Key` replay safety |
| Portal link invalidation | Done | `portalAccessRevokedAt` + audit on visibility revoke |
| Performance | Done | Org timeline index; lazy folder tree load |
| Onboarding | Done | FIRST_TIME empty state, PostHog, module visit tracking |
| Migration | Done | `migratePersonAttachmentsToDocuments.js` + `migrateCommentAttachmentsToDocuments.js`; new uploads register as Documents |

**Exit criteria:** All UI views shipped; edge cases handled; new-module merge checklist complete.

---

### Phase 7 — Advanced Capabilities (Wave 1)

**Duration:** 2–3 weeks (incremental)  
**Goal:** External provider parity, knowledge portal surfaces, OCR search foundation.

| Work item | Status | Details |
|-----------|--------|---------|
| OneDrive / Dropbox | Done | URL auto-detect + provider validation (`documentExternalProviders.js`); drawer auto-selects provider |
| Wiki / advanced KB | Done | `GET /documents/knowledge-base`; Knowledge Base tab in Documents; `GET /portal/knowledge-base` + article reader |
| OCR search | Done | `ocrText` field + text index; upload/version pipeline; hourly scheduler (`documentOcrIndexService`) |
| E-Signatures | Done (Wave 2) | Internal typed signatures — third-party deferred |
| AI / semantic search | Done (Wave 2) | In-app hash embeddings — external vector store deferred |
| Collaborative editing | Done (Wave 2, draft-based) | Per-user drafts — CRDT merge deferred |
| Inline comments / suggestions | Done (Wave 2) | Sidecar model + editor selection anchor |

**Exit criteria:** OneDrive/Dropbox links validate; KB articles list in CRM + Portal; PDF/TXT/CSV OCR indexed and searchable.

**Hardening (post Wave 1):**

| Work item | Status | Details |
|-----------|--------|---------|
| OCR backfill script | Done | `backfillDocumentsOcrIndex.js` (`--dry-run`, `--organizationId=`, `--limit=`) |
| Platform Home integration | Done | Pending review / expiring soon in Up Next; recent documents in Resume |
| Route deep-links | Done | `/documents?status=pending_review` and `?expiringOnly=1` |

---

### Phase 7 — Advanced Capabilities (Wave 2)

**Duration:** 2–3 weeks (incremental)  
**Goal:** Collaboration, signatures, and meaning-based search without external vector infra.

| Work item | Status | Details |
|-----------|--------|---------|
| Inline comments / suggestions | Done | `DocumentInlineComment` sidecar; anchor from TipTap selection; resolve/reopen; record section + editor bubble action |
| E-signatures | Done | Internal typed signatures (`DocumentSignatureRequest`); multi-signer; request/sign/cancel APIs + record section |
| AI / semantic search | Done | 128-dim hash embeddings on `Document.searchEmbedding`; `GET /documents/search/semantic`; keyword/semantic toggle in Documents list |
| Collaborative editing | Done (draft-based) | Per-user `DocumentEditDraft` autosave (4s debounce); other-editors presence banner; publish merges to document — not CRDT/Yjs |

**Exit criteria:** Comment anchored from editor appears in Comments section; signature request can be sent and signed by assigned user; semantic search returns ranked results for natural-language queries; concurrent editors see each other's draft timestamps.

**Ops:**

| Work item | Status | Details |
|-----------|--------|---------|
| Semantic backfill script | Done | `backfillDocumentsSemanticIndex.js` (`--dry-run`, `--organizationId=`, `--limit=`) |

**Deferred (future waves):** DocuSign/Adobe Sign integration; Atlas Vector Search or external embedding provider; real-time CRDT merge (Yjs).

---

## 11. Dependency Graph

```
Phase 0 (Foundation)
    ├── Phase 1 (File MVP)
    │       ├── Phase 3 (Rich Docs)
    │       └── Phase 4 (Search & Collab)
    └── Phase 2 (Record Attachments)
            └── Phase 4 (Search & Collab)
                    └── Phase 5 (Governance)
                            └── Phase 6 (Advanced UI)

External dependencies:
  Phase 1 → fileStorageService / S3
  Phase 2 → RelationshipInstance
  Phase 3 → TipTap Editor
  Phase 5 → Process Engine approval_gate
```

---

## 12. Effort Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0 — Foundation | 1–1.5 wk | 1.5 wk |
| 1 — File MVP | 2 wk | 3.5 wk |
| 2 — Record attachments | 1.5 wk | 5 wk |
| 3 — Rich docs & templates | 2–2.5 wk | 7.5 wk |
| 4 — Search & collaboration | 2 wk | 9.5 wk |
| 5 — Governance & automation | 2–2.5 wk | 12 wk |
| 6 — Advanced UI & hardening | 1.5 wk | **13–14 wk** |

| Milestone | Scope | ETA |
|-----------|-------|-----|
| **MVP** | Phases 0–2 | ~5 weeks |
| **Full spec** | Phases 0–6 | ~13–14 weeks |
| **Phase 7 (Wave 1)** | External providers, KB, OCR | Shipped |
| **Phase 7 (Wave 2)** | Comments, signatures, semantic search, draft collab | Shipped |
| **Future** | DocuSign, vector DB, CRDT | TBD (data-driven) |

---

## 13. Recommended Execution Order

1. **Phase 0** — unblock all downstream work
2. **Phase 1 + 2** — can run in parallel after Phase 0
3. **Phase 3** — rich docs (high user value)
4. **Phase 4** — search/visibility before governance volume grows
5. **Phase 5** — approvals/expiry once core flows are stable
6. **Phase 6** — polish, performance, migration

---

## 14. Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Version storage | Separate `documentversions` collection; `documents` holds current pointer (mirrors `QuoteDocument`) |
| Rich content format | TipTap JSON + rendered HTML cache for search |
| Search engine | MongoDB text index in Phase 4; defer OCR/AI to Phase 7 |
| Upload size limit | Raise per-tenant config for Documents category (current default 10MB) |
| External providers | Metadata-only; no sync; no permission management |
| Approvals | Process Engine only — never embed in Document model |
| Generated docs | Keep app-specific generators; register output as `Generated Document` |

---

## 15. New Module Merge Checklist

Required before PR merge (per onboarding architecture):

- [x] i18n complete
- [x] FIRST_TIME empty state
- [x] Module visit tracking
- [x] PostHog analytics
- [x] Platform Home card (if applicable — deferred; Documents surfaced via app nav)
- [x] Permissions validated
- [x] Empty-state classification reviewed (`FIRST_TIME` / `NO_DATA` / `NO_ACCESS` / `NOT_CONFIGURED` / `DISABLED`)

---

## 16. Related Documents

- `Architecture_Document.md` — platform architecture source of truth
- `docs/architecture/module-settings-doctrine.md` — module settings patterns
- `server/models/RelationshipInstance.js` — cross-module linking
- `server/models/QuoteDocument.js` — generated document versioning precedent
- `server/services/PROCESS_ENGINE_PHASE_3.md` — approval gate integration
- `docs/TRASH_IMPLEMENTATION_SPEC.md` — soft delete pattern
