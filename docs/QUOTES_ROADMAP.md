# Quotes Module — Implementation Roadmap

**Source PRD:** Arivu Platform — World-Class Quotes Module (user-provided, 2026-05-28)

**Strategic direction:** Ship a **platform-native, snapshot-based** transactional Quotes module as the first consumer of the catalog platform (`ItemVariant`, price books, bundles, lifecycle). Quotes must **not** be tightly coupled to the Sales app; Sales may consume Quotes via relationships and conversion links.

**Prerequisite:** Catalog phases **C0–C5** complete — see `docs/CATALOG_ROADMAP.md`.

**Inventory / GL / payments / fulfillment:** Explicitly **out of scope** for Quotes MVP (conversion stubs only).

**Last updated:** 2026-05-28 (progress tracker synced to codebase)

---

## Progress tracker

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **Q0** — Domain contract + models | ✅ Done | `Quote`, `QuoteLine`, `QuoteApproval`, lifecycle constants, platform `quotes` module + migration |
| **Q1** — Pricing resolution + snapshots | 🟡 MVP | Line add/bundle via `catalogPriceResolver`; snapshots on `QuoteLine` |
| **Q2** — Totals engine | 🟡 MVP | `quoteTotalsService`, recalculate API, line + global discount UI |
| **Q3** — Quote CRUD API + workspace UI | 🟡 MVP | `/api/quotes`, list, record page, lines section, quick create defaults |
| **Q4** — Bundles on lines | 🟡 MVP | Fixed/rollup display; add bundle API; drag reorder; optional-component picker |
| **Q5** — Revisions | 🟡 MVP | `POST /revise`, `GET /revisions` timeline section, navigation |
| **Q6** — Approvals | 🟡 MVP | Submit/approve/reject + `QuoteApproval`; Process Designer + `ApprovalInstance` for quotes |
| **Q7** — Documents + sharing | ✅ MVP | Branded PDF/email + logo; public link; send by email |
| **Q8** — Conversion contracts | 🟡 Stub | Eligibility, partial type, external ref, conversion UI (no SO/invoice) |
| **Q9** — Customer portal interactions | ✅ MVP | Accept/reject, partial, agreement, typed signature, messages, expiry |

---

## 1. Vision (from PRD)

The Quotes module is a **reusable transactional commerce platform module** for any Arivu app:

- Platform-native quote system
- Service estimation / field operations quotation
- Proposal management / project estimation
- Foundation for **Sales Orders → Invoices → Payments → Fulfillment** (and inventory reservations later)

**First transactional consumer of:**

| Platform capability | Catalog / platform dependency |
|---------------------|-------------------------------|
| Sellable SKUs | `ItemVariant` |
| List pricing | `CatalogPriceBook` + `catalogPriceResolver` |
| Bundles | `ItemBundleComponent` + bundle pricing modes (`fixed` / `rollup`) |
| Sellability | `lifecycle_state` + `isCatalogItemSellable()` |
| Category attributes | `attributes_snapshot` on lines |
| Workflow | Process Designer (future triggers on quote fields) |
| Approvals | `ApprovalInstance` pattern + domain `QuoteApproval` history |
| Audit | Immutable event trail (platform Events / module audit pattern) |

**Non-negotiable:** After quote save, **never** depend on live catalog pricing or mutable variant fields for commercial truth.

---

## 2. Architectural principles (locked)

| Principle | Implementation rule |
|-----------|---------------------|
| API-first | All writes through `/api/quotes/*`; UI is a client |
| Workflow-driven | Status transitions validated server-side; automation hooks on status/amount |
| Metadata-driven | `ModuleDefinition` + custom fields on `Quote`; not Sales-only hardcoding |
| Snapshot-based | Every `QuoteLine` stores SKU, name, price, tax, bundle, attributes at write time |
| Audit-safe | Append-only approval + audit events; revisions immutable |
| Multi-currency | `currency` + `exchange_rate_snapshot` on quote and lines |
| Variant-first | `variantId` required on every line; **never** `itemId` alone |
| Bundle-aware | Parent bundle line + child lines via `parent_bundle_line_id` |
| Revision-safe | One active revision; historical revisions read-only |
| Conversion-safe | `QuoteConversionLink` records downstream targets without coupling schemas |

```text
┌─────────────────────────────────────────────────────────────┐
│  Future: Sales Orders · Invoices · Payments · Fulfillment   │
└────────────────────────────┬────────────────────────────────┘
                             │ QuoteConversionLink
┌────────────────────────────▼────────────────────────────────┐
│  Quotes: Quote · QuoteLine · QuoteRevision · QuoteApproval  │
│          quoteTotalsService · quotePricingResolutionService │
└────────────────────────────┬────────────────────────────────┘
                             │ resolve at line-add only
┌────────────────────────────▼────────────────────────────────┐
│  Catalog (C0–C5): ItemVariant · PriceBooks · Bundles        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Current state in LiteDesk

| Area | Status | Notes |
|------|--------|-------|
| Catalog platform | ✅ C0–C5 | `catalogPriceResolver`, bundles, variants — `docs/CATALOG_ROADMAP.md` |
| Quotes models / API | ✅ MVP | `Quote`, `QuoteLine`, controllers, routes, activity + tests |
| Quotes UI (record) | 🟡 MVP | Lines section (toolbar, totals, expand), conversion, status banner, in-place line patches |
| Platform module | ✅ | `moduleKey: quotes` (core); `migrateQuotesToCoreModule.js`, default relationships |
| Deals “Proposal” stage | 🟡 | CRM stage label only; not transactional quotes |
| Process approvals | 🟡 MVP | `ApprovalInstance` + domain events; inbox approve/reject syncs quote status |
| Customer portal | 🟡 MVP | Public view, partial accept, rate-limited routes, portal events in Activity tab |

### UI polish completed (2026-05-28)

- Single **Lines** header row with status badges, quick actions, always-visible expand
- **Conversion** section: expand + header Convert action
- Scroll preserved on line add/delete/update/recalculate/reorder and soft quote header refresh
- **Line reorder** via drag handle (bundle parent moves with children on fixed bundles)
- **Discount editing** — per-line % / fixed discount column; global discount in totals panel (`PATCH /discounts`, in-place record patch)
- **Bundle optional picker** — on add (catalog components) + configure on parent line (`PATCH /bundles/:parentLineId/optionals`)
- **Revision timeline** — Revisions section on quote record (`GET /quotes/:id/revisions`)
- **Send quote email** — formal send (`Sent`) vs **draft for review** (watermarked PDF/portal, stays Draft, no accept)
- **Process approvals** — `quote.updated` / `quote.submitted_for_approval` triggers; approval inbox; quote record shows pending gates
- **Org quote policy** — Settings → Automation → Quotes: require approval before customer send; share link gated to match formal send
- **Portal partial accept** — Customer selects lines; `Partially Accepted` + `customerResponse` snapshot on quote
- **Portal hardening** — Public route rate limits; customer portal events persist to Activity (actor: Customer)
- **Lite customer agreement** — Org policy + portal checkbox; `agreedToTerms` on `customerResponse`
- **Typed signature** — Org `requireTypedSignature`; `signatureText` + `signatureSignedAt` on accept
- **Portal messages** — Customer ↔ team thread on public link; syncs to quote Activity tab (`details.portalThread`)
- **Quote expiry automation** — `validUntil` transitions Sent/Viewed → Expired (scheduler + on-read); portal/accept blocked
- **Q8 conversion stub polish** — Eligibility (accepted, not expired), partial type, external reference, stub UX copy
- **Q7 branding** — Org PDF footer, email signature, brand color, document title; tenant logo on PDF + email
- Quote strings synced to all `records.json` locales (fallback English copy)

**Catalog integration points (existing):**

- `server/services/catalogPriceResolver.js` — `{ variantId, priceBookId, quantity, asOfDate }`
- `server/services/catalogBundleService.js` — component graph, expand preview, fixed/rollup pricing
- `server/constants/catalogLifecycle.js` — sellability for line-add validation
- `GET /api/catalog/variants/:id` — canonical sellable read for pickers

---

## 4. Domain model

### 4.1 Quote (header)

Maps to PRD §5.1. Stored as MongoDB document with platform system fields (`organizationId`, `createdBy`, `modifiedBy`, soft delete via `deletionService` when trashable).

| Group | Key fields | Notes |
|-------|------------|-------|
| System | `quoteNumber` (auto), `revisionNumber`, `activeRevision`, `sourceQuoteId` | Human id: `QT-0001`; revision in UI |
| Lifecycle | `status`, `lifecycleState` (optional mirror) | See §5 state machine |
| Commercial | `currency`, `exchangeRateSnapshot`, totals (*subtotal*, discounts, tax, *grandTotal*) | Totals **computed** by `quoteTotalsService`, persisted on save |
| Customer | `customerId` (dynamic lookup), `organizationId`, `contactId`, `dealId`, `caseId`, `customRecordId`, addresses | Dynamic lookup = module-agnostic party reference |
| Source metadata | `sourceContext`, `sourceRef` (optional) | Analytics + automations. `sourceContext` examples: `deal`, `helpdesk_case`, `field_visit`, `manual`, `automation`, `api`. `sourceRef` optionally stores `{ moduleKey, recordId }` when applicable. |
| Terms | `paymentTerms`, `incoterms`, `termsConditions`, notes | Rich text where specified |
| Approval | `approvalRequired`, `approvalStatus`, `currentApprovalLevel`, `approvalLocked` | Domain flags + `QuoteApproval` rows |
| Sharing | `sentToCustomer`, `publicShareToken`, `portalAccessEnabled`, response timestamps | Token rotation on revoke |

**Quote is NOT:** an invoice, GL entry, or inventory transaction.

### 4.2 QuoteLine (first-class entity)

**Do not** store lines as anonymous arrays on `Quote`. Each line: stable `quoteLineId` (UUID), `quoteId`, `variantId`.

| Snapshot field | Source at line create |
|----------------|----------------------|
| `skuSnapshot`, `itemNameSnapshot`, `descriptionSnapshot` | Variant + parent Item |
| `unitPriceSnapshot`, `listPriceSnapshot` | `quotePricingResolutionService` |
| `attributesSnapshot` | Variant + category template values |
| `bundleSnapshot` | Bundle expand result (components, optional flags, pricing mode) |
| `taxSnapshot` | Tax rules engine (MVP: JSON placeholder + manual overrides) |
| `currencySnapshot`, `exchangeRateSnapshot` | From quote header at line time |

| Line control | Purpose |
|--------------|---------|
| `parentBundleLineId` | Child component lines |
| `lineType` | `standard`, `bundle_parent`, `bundle_component`, `adjustment`, … |
| `optionalLine`, `hiddenLine` | Bundle UX |
| `lockedSnapshot` | True after Sent/Accepted/Converted — block price overwrite |
| `lineGroupKey` (placeholder) | Future grouping for phases/sections/milestones (e.g. `Implementation Services`, `Hardware`, `Support`, `Optional Add-ons`). Totals ignore grouping; it is ordering/presentation + export structure. |

### 4.3 QuoteApproval

Immutable append-only history per quote (and per revision when Q5 ships). Fields per PRD §5.3. **Never hard-delete** approval rows.

### 4.4 QuoteDocument

Versioned PDFs: `revisionNumber`, `documentUrl`, `templateId`, `checksum`, `generatedAt`.

### 4.5 QuoteConversionLink

Traceability to downstream modules without embedding Invoice/SO schema:

| Field | Purpose |
|-------|---------|
| `sourceQuoteId`, `sourceRevision` | Origin |
| `targetModule`, `targetRecordId` | e.g. `sales_order`, `invoice` |
| `conversionType` | `full`, `partial` (later) |
| `convertedAt`, `convertedBy` | Audit |

### 4.6 QuoteRevision (Q5)

Either:

- **Option A (recommended):** Separate `QuoteRevision` collection with `quoteId` + `revisionNumber`, lines copied by reference or embedded snapshot copy; header `activeRevision` flag on canonical quote id, **or**
- **Option B:** Quote documents share `quoteNumber` with `revisionNumber` + `sourceQuoteId` lineage (PRD example: QT-0001 Rev 1/2).

**Rules:** one active revision; past revisions immutable; approval history scoped per revision.

---

## 5. Status state machine

**Allowed statuses:** `Draft`, `Pending Approval`, `Approved`, `Sent`, `Viewed`, `Accepted`, `Partially Accepted`, `Rejected`, `Expired`, `Cancelled`, `Converted`.

**Server enforcement:** `server/constants/quoteLifecycle.js` (mirror on client).

```text
Draft ──────────► Pending Approval ──► Approved ──► Sent ──► Viewed
  │                    │                  │          │         │
  │                    ▼                  │          ├──► Accepted ──► Converted
  │               Rejected                │          ├──► Rejected
  ▼                                       ▼          └──► Expired ──► (revise → new revision)
Cancelled ◄───────────────────────────────┘
```

| Rule | Enforcement |
|------|-------------|
| Invalid transitions | 400 from `quoteStatusService.transition()` |
| Approval required | Cannot jump Draft → Approved without approval path |
| Expired | Cannot convert unless `override_expired_quotes` permission |
| **Snapshot lock (>= Sent)** | After status is **Sent or later**, quote lines become commercially locked: block variant swaps, price re-resolution, and unit price overrides. Allowed only via **new revision** or `override_pricing` permission. |
| Accepted | Commercial lock: `lockedSnapshot` on lines; limited edits |
| Converted | Terminal for active revision; new work via revision or new quote |

---

## 6. Services (server)

### 6.1 `quotePricingResolutionService`

Wraps catalog resolver; **only** called when adding/updating lines (or explicit “re-resolve pricing” on revision).

```javascript
// Inputs
{ variantId, priceBookId, quantity, asOfDate, currency }

// Outputs (persisted to line snapshots)
{ unitPrice, listPrice, currency, priceBookId, entryId, source, effectiveMetadata }
```

Uses `catalogPriceResolver.resolve()` + variant/parent enrichment for names/SKU/attributes. Rejects non-sellable variants (`lifecycle_state !== 'Active'`) unless admin override.

### 6.2 `quoteTotalsService` (source of truth)

Responsibilities:

- Per-line: quantity × unit price, line discounts, line tax
- Bundle rollups (fixed bundle price vs rollup sum of components)
- Header: `line_discount_total`, `global_discount_total`, `tax_total`, `adjustment_total`, `grand_total`
- Currency rounding policy (document half-up per currency decimal places)
- Deterministic, unit-tested, **no client-side totals authority**

### 6.3 `quoteBundleLineService`

- Expand bundle via `catalogBundleService`
- Create parent + child `QuoteLine` rows
- Respect `fixed` vs `rollup` from `server/constants/catalogBundle.js`
- Support hidden/optional components per bundle definition

### 6.4 `quoteStatusService` / `quoteRevisionService`

- Transition validation, commercial lock side effects
- Revision clone, optional re-resolve flag, lineage

### 6.5 `quoteConversionService` (Q8 stub)

- Create `QuoteConversionLink`
- Emit events for future SO/Invoice modules
- **No** direct Invoice model writes in Quotes module

---

## 7. API surface (target)

**Namespace:** `/api/quotes` (platform-scoped, not under `/api/sales/`).

| Method | Route | Phase | Purpose |
|--------|-------|-------|---------|
| GET | `/` | Q3 | List/filter (status, owner, customer, date range) |
| POST | `/` | Q3 | Create draft quote |
| GET | `/:id` | Q3 | Header + active lines + totals |
| PATCH | `/:id` | Q3 | Header fields (blocked when approval locked) |
| DELETE | `/:id` | Q3 | Soft delete via `deletionService` |
| POST | `/:id/lines` | Q1 | Add line — **`{ variantId, priceBookId, quantity }`** never `itemId` |
| PATCH | `/:id/lines/:lineId` | Q1 | Qty/discount; re-resolve only if not locked |
| DELETE | `/:id/lines/:lineId` | Q1 | Remove line (+ bundle children) |
| POST | `/:id/recalculate` | Q2 | Force totals recompute |
| POST | `/:id/submit-for-approval` | Q6 | Status → Pending Approval |
| POST | `/:id/approve` / `reject` | Q6 | Approver actions → `QuoteApproval` |
| POST | `/:id/send` | Q7 | Mark sent, trigger share |
| POST | `/:id/revise` | Q5 | New revision |
| POST | `/:id/convert` | Q8 | Stub + conversion link |
| GET | `/:id/revisions` | Q5 | Timeline |
| GET | `/:id/documents` | Q7 | PDF versions |
| POST | `/public/:token/view` | Q7 | Customer view tracking (unauthenticated, rate-limited) |

**Picker support:** reuse `GET /api/catalog/variants` with `lifecycle_state=Active`.

---

## 8. Platform module registration

| Decision | Recommendation |
|----------|----------------|
| `appKey` | `platform` (or dedicated `commerce` app) — **not** Sales-only |
| `moduleKey` | `quotes` |
| `entityType` | `TRANSACTION` |
| Relationships | Optional links to `deals`, `cases`, `organizations`, `people` — no required Deal |
| Permissions | PRD §16: `create_quote`, `edit_quote`, `revise_quote`, `approve_quote`, `send_quote`, `convert_quote`, `override_expired_quotes`, `override_pricing`, … + scopes (own/team/org) |

**Files to add (representative):**

- `server/models/Quote.js`, `QuoteLine.js`, `QuoteApproval.js`, `QuoteDocument.js`, `QuoteConversionLink.js`
- `server/constants/quoteLifecycle.js`, `quotePermissions.js`
- `server/controllers/quoteController.js`, `quoteLineController.js`
- `server/routes/quoteRoutes.js` → mount in `server/server.js`
- `client/src/platform/fields/quoteFieldModel.ts`
- `client/src/views/Quotes.vue`, `QuoteDetail.vue` or `QuoteRecordPage.vue`
- `client/src/components/quotes/*` — line editor, totals panel, revision timeline

Extend `ApprovalInstance.entityType` enum to include `quote` (or generic `moduleKey` + `recordId`).

---

## 9. UI (MVP)

| Surface | Behavior |
|---------|----------|
| Quotes list | `ModuleList` registry entry; filters by status, owner, customer |
| Quote record | Header form + line grid; totals read-only from API response |
| Variant picker | Search active variants; show SKU, price book selector |
| Bundle add | Preview expand; choose optional components |
| Revision panel | Timeline of revisions; view-only historical |
| Approval banner | Pending approvers; actions if permitted |
| Send / share | Email + copy public link; PDF download |

**Forbidden:** computing `grandTotal` in Vue for save payloads — always send line inputs, receive totals from server.

---

## 10. Approvals (Q6)

| Trigger (Process Designer) | Example |
|----------------------------|---------|
| Amount threshold | `grandTotal > 50000` |
| Discount threshold | `global_discount_total / subtotal > 0.15` |
| Category / product | Line category or variant in rule |
| Department | Owner department |
| Custom condition | Workflow expression |

**Integration path:**

1. Domain `QuoteApproval` rows = immutable business history (PRD §5.3).
2. Process `approval_gate` nodes pause execution; reuse `ApprovalInstance` with `entityType: 'quote'`.
3. On final approval → `quoteStatusService` → `Approved`.

Parallel approvers / SLA timers: **later** (note in Phase Q6+).

---

## 11. Audit requirements (PRD §17 — completed)

Mandatory immutable audit events (platform `Event` or module audit stream):

| Event category | Examples |
|----------------|----------|
| Line changes | Add/remove line, qty change, discount change |
| Pricing | Re-resolve pricing, override unit price |
| Status | Every transition with actor + timestamp |
| Approval | Submit, approve, reject per level |
| Revision | Create revision, activate revision |
| Sharing | Sent, link generated/revoked, customer viewed |
| Conversion | Conversion link created |
| Totals | Adjustment applied, recalculate |

**Rules:** user-attributed, timestamped, non-destructive; no deletion of approval or audit history; exportable later (Helpdesk audit-export pattern).

---

## 12. Multi-currency (Q2+)

- Quote `currency` + `exchangeRateSnapshot` at quote create (from org base currency service when available).
- Each line stores `currencySnapshot` + rate at snapshot time.
- Historical quotes unchanged when FX tables update.
- Future: FX provider integration — snapshot only at transactional moments.

---

## 13. Sharing & customer access (Q7–Q9)

| Channel | MVP | Later |
|---------|-----|-------|
| Email | Send with link/PDF attachment | Branded HTML + logo; full template designer **later** |
| PDF | Versioned `QuoteDocument` | Branded header (logo, color, footer); multi-layout templates **later** |
| Public link | Token + expiry + revoke | — |
| Portal | View tracking | Accept/reject, comments, e-sign, partial accept |

Public routes: rate-limited, no auth; token hashed at rest.

---

## 14. Conversion contracts (Q8)

```text
Quote (revision N) ──QuoteConversionLink──► Sales Order (future)
                                          └──► Invoice (future)
```

| Requirement | Quotes responsibility |
|---------------|-------------------------|
| Traceability | `QuoteConversionLink` + `sourceRevision` |
| Snapshot integrity | Copy quote lines to target module snapshots — target module owns its lines |
| Partial / split conversion | Schema-ready `conversionType`; logic later |
| No tight coupling | Quotes API does not import Invoice models |

---

## 15. Permissions & RBAC (PRD §16)

| Permission | Scope notes |
|------------|-------------|
| `create_quote` | — |
| `edit_quote` | Blocked when `approvalLocked` or Accepted |
| `delete_quote` | Draft only; else trash rules |
| `revise_quote` | Expired/Rejected/Accepted (policy) |
| `approve_quote` | Level-aware |
| `send_quote` | Approved+ |
| `convert_quote` | Accepted + not expired |
| `override_expired_quotes` | Admin |
| `override_pricing` | Bypass locked snapshot |
| `manage_templates` | PDF templates |
| `export_quote` | CSV/PDF export |

**Commercial lock clarification:** After status is **Sent or later**, commercial changes (variant swaps, re-resolve pricing, unit price overrides) are forbidden. The only supported ways to change commercial terms are (a) **create a new revision**, or (b) perform an explicit override guarded by `override_pricing` (audited).
Implement via `Role` module permissions + `fieldAccessControl` patterns used by Deals/Cases.

---

## 16. Phase specifications

### Q0 — Domain contract + models (1 week)

- Constants: statuses, transitions, line types, pricing modes
- Mongoose models + indexes (`organizationId`, `quoteNumber`, `status`)
- Auto-number `QT-{seq}` per org
- Seed `moduleKey: quotes` in platform definitions
- `npm run test:quotes` scaffold (lifecycle transitions only)

### Q1 — Pricing resolution + line snapshots (1–2 weeks)

- `quotePricingResolutionService` wrapping `catalogPriceResolver`
- `POST /quotes/:id/lines` with full snapshot write
- Sellability validation + `override_pricing` escape hatch
- Tests: snapshot isolation (change variant price after quote → line unchanged)

### Q2 — Totals engine (1 week)

- `quoteTotalsService` with bundle + discount + tax hooks
- `POST /quotes/:id/recalculate`
- Golden-fixture tests for rounding and bundle rollup

### Q3 — CRUD API + agent UI (2 weeks)

- List + record page; line grid; customer lookups
- Integrate `ModuleList`, `CreateRecordDrawer`, permissions
- Deal/case linking optional on header

### Q4 — Bundle lines (1 week)

- Parent/child lines, fixed vs rollup, expand preview in UI
- Hidden/optional component support

### Q5 — Revisions (1–2 weeks)

- Revise flow (manual, post-rejection, post-expiration)
- Clone lines; optional `reResolvePricing`
- Revision timeline UI

### Q6 — Approvals (1–2 weeks)

- `QuoteApproval` history
- Extend `ApprovalInstance` for quotes
- Process Designer triggers (amount/discount thresholds minimum)

### Q7 — Documents + sharing (1–2 weeks)

- PDF generation + `QuoteDocument` versioning
- Email send + public token link + view tracking

### Q8 — Conversion stubs (1 week)

- `QuoteConversionLink` API
- Status `Converted`; events for future SO module
- No Invoice/SO implementation

### Q9 — Customer interactions (later)

- Portal accept/reject, partial acceptance, e-signatures

---

## 17. Testing & verification

| Phase | Verification |
|-------|----------------|
| Q0 | Status transition matrix tests |
| Q1 | Snapshot immutability vs catalog change |
| Q2 | Totals fixtures (bundles, discounts, tax JSON) |
| Q3 | `npm run smoke:quotes` (see below) |
| Q4 | Fixed vs rollup bundle totals |
| Q5 | Revision immutability + single active revision |
| Q6 | Approval cannot bypass required path |
| Q7 | Public token expiry + revoke |

### Commands (server package)

```bash
cd server
npm run test:quotes          # unit tests (lifecycle, totals, portal, expiry, conversion, …)
npm run smoke:quotes         # live API smoke (requires running server)
```

**Smoke env:**

| Variable | Required | Purpose |
|----------|----------|---------|
| `QUOTES_AUTH_TOKEN` | Yes* | JWT for `/api/quotes`, `/api/settings/quotes` |
| `QUOTES_PUBLIC_TOKEN` | No | Public portal `view` + `comments` |
| `QUOTES_BASE_URL` | No | Default `http://localhost:5000` |

\*At least one of `QUOTES_AUTH_TOKEN` or `QUOTES_PUBLIC_TOKEN` must be set.

### Hardening (2026-05-28)

- **Record edit lock** — `Expired`, `Rejected`, `Cancelled`, `Converted` cannot receive header/line edits (`QUOTE_RECORD_LOCKED`); use **Revise**.
- **On-read expiry** — `GET /quotes/:id` and `PUT` refresh `validUntil` → `Expired` when due.
- **52+ unit tests** under `server/utils/__tests__/quote*.test.js`.
- **CI** — `.github/workflows/test.yml` runs `npm run test:quotes` on PRs.
- **Expired conversion override** — owner/admin (or `permissions.quotes.overrideExpired`) may convert accepted quotes past `validUntil`, or `Expired` status when customer acceptance is on record; audited via `usedExpiredOverride` on conversion activity.

---

## 18. Dependencies & sequencing

```text
C0–C5 Catalog ✅  →  Q0–Q2 Core quotes  →  Q3 UI
                              ↓
                         Q4 Bundles
                              ↓
                    Q5 Revisions → Q6 Approvals
                              ↓
                    Q7 Sharing → Q8 Conversion stub
                              ↓
              Future: Sales Orders (consumes conversion links)
```

**Parallel safe:** Q7 PDF templates can start after Q3; Q6 can overlap Q5 if approval is revision-scoped early.

---

## 19. Out of scope (explicit)

- Inventory reservations / stock deduction
- GL / accounting postings
- Payment capture
- Sales Order / Invoice **implementation** (Quotes only stubs links)
- Procurement
- Parallel approval workflows / SLA timers (post-MVP)
- WhatsApp share (integration later; schema-ready `sharedVia`)

---

## 20. Open decisions (resolve in Q0)

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | `appKey` for quotes | `platform` — reusable across Sales, FSM, custom apps |
| 2 | Revision storage model | Separate `QuoteRevision` docs keyed by `quoteNumber` lineage |
| 3 | Tax engine MVP | `tax_snapshot` JSON + manual rates; full tax service later |
| 4 | FX source | Org setting snapshot at quote create; no live FX on old quotes |
| 5 | Deal required? | No — optional `dealId`; Quotes usable without Sales |
| 6 | Auto-number format | Tenant Module Numbering (`QT-{SEQ}` default; Settings → Automation → Module Numbering) |

---

## 21. Files reference (planned)

| Area | Path |
|------|------|
| Lifecycle | `server/constants/quoteLifecycle.js`, `client/src/constants/quoteLifecycle.js` |
| Models | `server/models/Quote.js`, `QuoteLine.js`, … |
| Services | `server/services/quoteTotalsService.js`, `quotePricingResolutionService.js`, `quoteBundleLineService.js`, `quoteStatusService.js` |
| API | `server/controllers/quoteController.js`, `server/routes/quoteRoutes.js` |
| Client | `client/src/views/Quotes.vue`, `client/src/components/quotes/*`, `client/src/utils/quotesApi.js` |
| Tests | `server/utils/__tests__/quoteTotals.test.js`, `quoteLifecycle.test.js` |

---

## 22. PRD traceability

| PRD section | Roadmap section |
|-------------|-----------------|
| §1 Vision | §1 |
| §2 Principles | §2 |
| §3 Architecture | §2 diagram |
| §4 Domain concepts | §4 |
| §5 Models | §4.1–4.5 |
| §6 Status machine | §5 |
| §7 Snapshots | §4.2, §6.1, Q1 |
| §8 Totals engine | §6.2, Q2 |
| §9 Revisioning | §4.6, Q5 |
| §10 Approvals | §10, Q6 |
| §11 Bundles | §6.3, Q4 |
| §12 Pricing resolution | §6.1, Q1 |
| §13 Multi-currency | §12 |
| §14 Sharing | §13, Q7–Q9 |
| §15 Conversion | §14, Q8 |
| §16 Permissions | §15 |
| §17 Audit | §11 |
