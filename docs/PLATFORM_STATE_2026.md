# Platform State — June 2026

**Purpose:** Reassess platform priorities now that the **commercial + cash stack** is substantially complete (Catalog → Quotes → Sales Orders → Invoices → Payments through PAY3.2).

**Status:** Authoritative snapshot as of **2026-06-02**  
**Audience:** Engineering, product, platform architecture, leadership  
**Action:** Strategic fork — PAY3.3 vs Inventory vs Helpdesk expansion (**no PAY3.3 implementation until decision recorded**)

**Source documents:**

| Domain | Architecture | Roadmap / Retrospective |
|--------|--------------|-------------------------|
| Catalog | — | `docs/CATALOG_ROADMAP.md` |
| Quotes | `docs/QUOTE_SECTIONS_ARCHITECTURE.md` | `docs/QUOTES_ROADMAP.md` |
| Sales Orders | `docs/SALES_ORDER_ARCHITECTURE.md` | `docs/SALES_ORDER_ROADMAP.md` |
| Invoices | `docs/INVOICE_ARCHITECTURE.md` | `docs/INVOICE_ROADMAP.md` |
| Payments | `docs/PAYMENTS_ARCHITECTURE.md` | `docs/PAYMENTS_ROADMAP.md`, `docs/PAYMENTS_RETROSPECTIVE.md` |
| Commercial freeze | `docs/COMMERCIAL_PLATFORM_RETROSPECTIVE.md` | — |
| Helpdesk | — | `docs/HELPDESK_CASES_ROADMAP.md` |
| Mailroom | — | `docs/MAILROOM_ROADMAP.md` |

---

## Executive summary

LiteDesk has shipped a **full quote-to-cash path** on a shared platform module model:

```text
Catalog (C0–C5) ✅
  → Quotes (Q0–Q9) ✅ MVP
    → Sales Orders (SO0–SO4) ✅
      → Invoices (INV0–INV4) ✅
        → Payments (PAY0–PAY3.2) ✅
          → Reconciliation (PAY3.3) ⬜ NOT STARTED
```

**Parallel apps (not part of commercial stack):**

| App | Maturity | Notes |
|-----|----------|-------|
| **Helpdesk** | 🟡 MVP+ | Cases workspace, SLA, Mailroom ingestion, partial portal |
| **Audit** | ✅ App-owned | Visits, findings, portal surfaces |
| **Portal** | 🟡 Growing | Audits, cases, **invoice pay** (PAY3.1) |
| **Mailroom** | ✅ M0–M7 v1 | Settings → Automation; feeds Helpdesk |

**Largest structural gap for product ERP:** **Inventory** — SO fulfillment records qty events but does not reserve, move, or deduct stock.

**Largest structural gap for finance ERP:** **GL / ledger** — receivable rollups exist; no journal posting, COGS, or bank ledger.

**Platform fork (this review):**

| Option | Scope | Recommendation |
|--------|-------|----------------|
| **A** | PAY3.3 — gateway settlement reconciliation | Defer 1–2 sprints |
| **B** | Inventory — reservations, ledger, fulfillment hook | **Primary — recommended** |
| **C** | Helpdesk / Service Operations expansion | Secondary parallel track |

---

## 1. Catalog status

**Phase:** C0–C5 **complete** (2026-05-27)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| C0 | `lifecycle_state`, stock UX de-emphasized | ✅ |
| C1 | ItemMedia, barcodes, `ItemVariant` scaffold | ✅ |
| C2 | Category tree, attribute templates | ✅ |
| C3 | Parent/variant split, flat-item migration | ✅ |
| C4 | Price books, `catalogPriceResolver` | ✅ |
| C5 | Bundles, pricing modes, expand preview | ✅ |

**Platform contract (locked):**

- Sellable unit = **`ItemVariant`** — transactional lines never reference parent `Item` alone
- Pricing authority = **`catalogPriceResolver`** with effective dating
- Lifecycle authority = **`lifecycle_state`** — Active only is sellable

**Tests:** `npm run test:catalog`, `npm run verify:catalog`

**Explicitly not shipped:** warehouse locations, stock ledger, reservations, procurement, batch/serial at fulfillment grain.

**Readiness for downstream:** ✅ Fully consumed by Quotes, SO, Invoice line-add paths.

---

## 2. Quotes status

**Phase:** Q0–Q9 **MVP complete** (progress tracker synced 2026-05-28)

| Phase | Status | Notes |
|-------|--------|-------|
| Q0 Domain + models | ✅ | `Quote`, `QuoteLine`, platform module |
| Q1 Pricing + snapshots | 🟡 MVP | Resolver + line snapshots |
| Q2 Totals engine | 🟡 MVP | `quoteTotalsService`, discounts |
| Q3 CRUD + workspace UI | 🟡 MVP | List, record, lines |
| Q4 Bundles on lines | 🟡 MVP | Fixed/rollup, reorder |
| Q5 Revisions | 🟡 MVP | Revise API + timeline |
| Q6 Approvals | 🟡 MVP | Process Designer integration |
| Q7 Documents + sharing | ✅ | PDF, email, public link |
| Q8 Conversion contracts | 🟡 Stub | Eligibility + UI; real SO convert in SO1 |
| Q9 Portal interactions | ✅ | Accept/reject, signature, messages |

**Enterprise sections:** Architecture approved (`QUOTE_SECTIONS_ARCHITECTURE.md`); section totals/discounts are a **future enhancement** beyond flat `lineGroupKey`.

**Quote is NOT:** invoice, GL entry, inventory transaction, payment target.

**Tests:** Quote + conversion coverage via `npm run test:quotes` (where configured) and SO conversion tests.

**Gaps vs world-class CPQ:** persisted section rollups, advanced CPQ rules, multi-currency FX at quote level (snapshots exist; FX engine deferred).

---

## 3. Sales Orders status

**Phase:** SO0–SO4 **complete** (2026-06-02)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| SO0 | Models, totals, coverage, module registration | ✅ |
| SO1 | Quote → SO conversion, `Confirmed` on convert | ✅ |
| SO2 | Fulfillment events, manual create, Draft edit | ✅ |
| SO3 | Split/merge, `SalesOrderInvoiceAllocation` schema | ✅ |
| SO4 | Manual sections, bulk merge UI | ✅ |

**Locked behaviors:**

- Quote convert lands SO in **`Confirmed`** (never Draft)
- **`SalesOrderInvoiceAllocation`** is billing bridge — frozen
- Fulfillment is **append-only operational audit** — emits hooks for future inventory; **no stock movement**

**Tests:** `npm run test:sales-orders`

**Explicitly not shipped:** inventory reservation/deduction, multi-warehouse allocation, SO customer PDF, SO revisions.

**Readiness for Inventory:** Fulfillment events + `warehouseId` optional fields are **hook-ready**; reservation service is the natural first inventory consumer.

---

## 4. Invoice status

**Phase:** INV0–INV4 **complete** (2026-06-02)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| INV0 | Domain, allocation post on Post | ✅ |
| INV1 | SO conversion, Post/Void | ✅ |
| INV2 | Agent UI, approval, activity | ✅ |
| INV3 | Credit notes, PDF/email, multi-SO wizard | ✅ |
| INV4 | Payment rollup hooks, payment-summary API | ✅ |

**Receivable formula (live):**

```text
amountDue = grandTotal - amountPaid - writeOffTotal - creditAppliedTotal
```

**Frozen rules:**

- Posted commercial lock — payments/credits adjust rollups only
- **`SalesOrderInvoiceAllocation`** — billing authority; payments never write
- Credit notes are separate documents — not payment targets

**Tests:** Invoice tests via module suites; payment integration via `npm run test:payments`

**Explicitly not shipped:** `Partially Posted` logic (enum reserved), credit note void, multi-entity billing, tax engine, GL posting.

---

## 5. Payments status

**Phase:** PAY0–PAY3.2 **complete** (2026-06-02)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| INV4 hooks | Rollup service, void guard, payment-summary | ✅ |
| PAY0 | Payment, PaymentAllocation, Reversal | ✅ |
| PAY1 | Refund, RefundAllocation, UI | ✅ |
| PAY2 | Customer credit, statements (CSV/PDF) | ✅ |
| PAY3.0 | Gateway core, Stripe, webhooks, capture | ✅ |
| PAY3.1 | Portal Pay, Payment Link UI, event replay | ✅ |
| PAY3.2 | Razorpay, Manual Bank Transfer | ✅ |
| **PAY3.3** | Reconciliation import + matching UI | ⬜ **Not started** |

**Authority model (locked):**

| Layer | Authority | Gateway / agent path |
|-------|-----------|----------------------|
| Billing | `SalesOrderInvoiceAllocation` | Never touched |
| Cash | `PaymentAllocation` | Webhook → `recordPayment` only |
| Credit | `CustomerCreditApplication` | Not gateway |

**Online capture:** Stripe + Razorpay adapters; webhook = source of truth; layered idempotency (`docs/PAYMENT_GATEWAY_IDEMPOTENCY.md`).

**Offline capture:** `BankTransferInstruction` + agent `POST /api/payments` with reference match.

**Tests:**

```bash
npm run test:payments           # 27
npm run test:payment-gateways   # 11
```

**Operations:** `docs/PAYMENT_GATEWAY_OPERATIONS.md`, `docs/PAYMENTS_RETROSPECTIVE.md`

---

## 6. Deferred items

Cross-cutting work **intentionally not shipped** across the commercial + payments stack:

### 6.1 Finance & ledger

| Item | Blocked by | Priority when unblocked |
|------|------------|-------------------------|
| GL / journal posting | No ledger module | Post-Inventory or parallel finance track |
| Revenue recognition | GL | Enterprise finance |
| Gateway fee GL entries | GL + PAY3.3 data | After reconciliation |
| Bank feed ingestion (non-CSV) | Finance ops scope | PAY4+ |
| Write-off workflow UI | Collections module | Medium — schema ready |
| Dunning / collections automation | Payments + comms | Medium |
| Cross-currency gateway capture | FX policy | PAY4 |

### 6.2 Supply chain

| Item | Dependency |
|------|------------|
| Inventory reservations on SO confirm | **Inventory module** |
| Stock ledger / movements | Inventory |
| Multi-warehouse | Inventory |
| Shipment / carrier integration | Inventory + fulfillment |
| Procurement / PO | Post-inventory |
| COGS at ship/invoice | Inventory + GL |

### 6.3 Commercial polish

| Item | Notes |
|------|-------|
| Quote section rollups (enterprise CPQ) | `QUOTE_SECTIONS_ARCHITECTURE.md` |
| SO customer-facing PDF | Low — invoice PDF exists |
| Invoice `Partially Posted` | Hide from UI or implement with GL |
| Credit note void | Policy decision pending |
| Tax engine integration | High for compliance markets |
| CSV catalog import refresh | Variant model drift |

### 6.4 Payments (PAY3.3+)

| Item | Status |
|------|--------|
| PAY3.3 — settlement CSV import + match UI | Designed in `PAYMENT_GATEWAYS_ARCHITECTURE.md` §4.4 |
| Chargeback case workflow | Event capture only |
| Secret manager refs for gateway credentials | Architecture target |
| Portal bank transfer (without payment link) | Optional |
| Payout bank confirmation | Finance ops |

### 6.5 Helpdesk / service (see §8)

Phases 1E–1G, full portal smoke, Process Designer for cases, field service, CSAT.

---

## 7. Enterprise roadmap items

Capabilities expected by enterprise buyers, mapped to current state:

| Enterprise capability | Status | Next domain |
|----------------------|--------|-------------|
| Quote-to-cash | ✅ End-to-end | Maintain; harden edge cases |
| Multi-invoice / multi-SO billing | ✅ | — |
| Credit notes + customer credits | ✅ | — |
| Customer statements | ✅ PAY2 | — |
| Online payments (Stripe/Razorpay) | ✅ PAY3.2 | PAY3.3 optional |
| Portal self-service (quotes) | ✅ Q9 | — |
| Portal pay open invoices | ✅ PAY3.1 | — |
| Audit trail (commercial) | ✅ Append-only activity | — |
| Helpdesk + SLA | 🟡 MVP+ | Option C |
| Omnichannel ingestion (email/portal) | ✅ Mailroom + Cases | Option C polish |
| Inventory / ATP | ❌ | **Option B** |
| Financial close / GL | ❌ | Post-inventory or finance track |
| Tax compliance engine | ❌ Snapshots only | Dedicated tax phase |
| Multi-entity / multi-currency ERP | 🟡 Single currency per doc | FX phase |
| Process Designer (commercial) | 🟡 Quotes approval | Expand per app |
| SSO / enterprise auth | Platform-level | Infrastructure |
| Dedicated tenant / data residency | Platform-level | Infrastructure |

---

## 8. Technical debt summary

Consolidated from commercial and payments retrospectives + live codebase notes:

| ID | Area | Issue | Severity | Action |
|----|------|-------|----------|--------|
| TD-01 | Catalog | Dual-write `status` + `lifecycle_state`, gallery shim | Low | Deprecate when consumers migrated |
| TD-02 | Catalog | API shims on parent Item (`selling_price`, `item_code`) | Low | Read via `defaultVariant` |
| TD-03 | Quotes | Section totals not persisted (flat `lineGroupKey`) | Medium | Quote Sections phase or defer |
| TD-04 | SO | **No inventory reservation** | **High** | **Inventory module** |
| TD-05 | Invoice | `Partially Posted` without logic | Medium | Hide or implement |
| TD-06 | Invoice | Credit note void unsupported | Medium | Policy + service |
| TD-07 | Platform | Tax snapshot only — no engine | **High** (compliance) | Tax phase |
| TD-08 | Branding | Invoice PDF uses quote branding settings | Low | Accept or split |
| TD-09 | Platform | Gateway webhook secrets in DB plain text | Medium | Secret manager |
| TD-10 | Payments | Activity `recordId` UUID vs ObjectId warnings | Low | Non-blocking in tests |
| TD-11 | Payments | Gateway events panel global not per-payment | Low | Admin UX polish |
| TD-12 | Helpdesk | Legacy "ticket" naming in places | Low | Rename sweep |
| TD-13 | Helpdesk | Portal smoke test pending | Medium | Complete 1D |
| TD-14 | Commercial | `linked_invoices` on Item placeholder | Low | Remove when safe |
| TD-15 | Platform | Per-tenant DB migration runbook | Medium | Document per deploy |

**Non-negotiable — do not "fix" without architecture review:**

- Cross-module UUID contracts
- `SalesOrderInvoiceAllocation` billing authority
- Posted invoice commercial lock
- Cash authority via `PaymentAllocation` only

---

## 9. Migration inventory

Idempotent scripts — run on deploy (master URI; repeat per tenant DB if applicable):

### 9.1 Catalog (prerequisite for all commerce)

| Script | Phase |
|--------|-------|
| `migrateItemLifecycleState.js` | C0 |
| `migrateItemProductImageToGallery.js` | C1 |
| `migrateItemFlatCategories.js` | C2 |
| `migrateFlatItemsToVariants.js` | C3 **critical** |
| `migrateVariantPricesToDefaultBook.js` | C4 |

Verify: `npm run verify:catalog`

### 9.2 Platform modules

| Script | Module |
|--------|--------|
| `migrateQuotesToCoreModule.js` | Quotes |
| `migrateQuoteSections.js` | Quote sections |
| `migrateQuoteConversionLinkIndex.js` | Conversion links |
| `migrateSalesOrdersToCoreModule.js` | Sales Orders |
| `migrateSalesOrderLineSourceIndex.js` | SO line idempotency |
| `migrateInvoicesToCoreModule.js` | Invoices |
| `migratePaymentsToCoreModule.js` | Payments |

### 9.3 Helpdesk / Mailroom

| Script | Purpose |
|--------|---------|
| `migrateHelpdeskCasesModuleNaming.js` | Case module naming |
| `migrateHelpdeskCasesRouteBase.js` | Route base |
| `migrateHelpdeskChannelRulesToMailroom.js` | Channel rules → Mailroom |

### 9.4 Gateway / payments (config — no schema migration)

| Step | Action |
|------|--------|
| Env | `STRIPE_*`, `RAZORPAY_*`, `PUBLIC_APP_URL` |
| Webhooks | Register Stripe + Razorpay endpoints |
| Tenant settings | `OrganizationPaymentGatewaySettings` + `manualBankTransfer` |

### 9.5 Legacy / infrastructure (as needed)

| Script | Purpose |
|--------|---------|
| `migrateOrganizationsToV2.js` | Org model |
| `migrateTenantDataToTenantDatabases.js` | Tenant DB split |
| `migrateUsersToAppAccess.js` | App entitlements |

**PAY3.3 note:** Reconciliation entities are greenfield — no migration required when shipped.

---

## 10. Recommended next domains

### 10.1 Option A — PAY3.3 (Gateway reconciliation)

**Scope:** CSV settlement import, `ReconciliationEntry` matching to `Payment.externalReference`, admin match UI.

**Pros:**

- Closes online payments story for finance ops
- Schema and match semantics already designed (`PAYMENT_GATEWAYS_ARCHITECTURE.md`)
- Smaller scope than Inventory (~1 sprint vs multi-sprint)

**Cons:**

- **No GL** — matched settlements still don't close books
- Low urgency while webhook capture + manual bank transfer cover cash recording
- Does not unlock new customer segments
- COGS/inventory variance reconciliation comes later anyway

**When to prioritize:** High payment volume tenants, finance team blocked on Stripe/Razorpay payout reports, or pre-GL cash proof requirements.

---

### 10.2 Option B — Inventory (recommended primary)

**Scope (proposed INV/INV-style phases):**

1. **INV0** — Stock ledger model, warehouse/location, on-hand qty
2. **INV1** — Reservations on SO confirm; release on cancel
3. **INV2** — Fulfillment deduction hook from SO fulfillment events
4. **INV3** — Availability API for quote/SO line-add (`ATP` guard)
5. **INV4** — Adjustments, transfers, low-stock signals

**Pros:**

- **Closes the product ERP loop** left open since SO2 fulfillment
- Directly addresses **TD-04** (highest commercial-stack debt)
- Unblocks COGS, shipment integrity, and eventually GL
- Catalog C0–C5 explicitly deferred stock to this phase
- Differentiates vs CRM-only competitors

**Cons:**

- Large surface area; multi-warehouse/serial expands scope
- Requires careful authority boundaries (ledger vs commercial snapshots)
- Must not mutate SO/Invoice commercial lines — mirror payments pattern

**When to prioritize:** Any tenant selling physical goods with fulfillment obligations — **default after quote-to-cash**.

---

### 10.3 Option C — Helpdesk / Service Operations

**Scope:** Complete Helpdesk roadmap phases 1C–1G + portal hardening:

| Phase | Work |
|-------|------|
| 1C remainder | Production Mailroom pilot, template polish |
| 1D | Portal smoke tests, partner/customer channel hardening |
| 1E | Field service & warranty |
| 1F | CSAT, role presets, audit export completeness |
| 1G | Process Designer for cases |

**Pros:**

- **Already 60–70% shipped** — incremental value fast
- Mailroom M0–M7 v1 complete — strong ingestion foundation
- Service-heavy GTM (audit, support, field ops) benefits immediately
- Independent of Inventory — can run **in parallel** with Option B

**Cons:**

- Does not complete product ERP for distributors/manufacturers
- Does not address fulfillment/stock truth
- Overlap with Portal app requires nav/UX cohesion

**When to prioritize:** Service-first ICP, support SLAs as primary sale, or dedicated service squad.

---

## 11. Strategic decision

**Review conclusion (2026-06-02):**

| Rank | Choice | Rationale |
|------|--------|-----------|
| **1 — Primary** | **B — Start Inventory** | Commercial stack is complete; fulfillment without stock is the largest functional hole for product businesses. Inventory unlocks reservations, ATP, COGS path, and justifies prior SO fulfillment investment. |
| **2 — Parallel (optional)** | **C — Helpdesk / Service Operations** | Mature enough for focused 1C–1D completion without blocking Inventory squad. Recommended if GTM is service-heavy. |
| **3 — Defer** | **A — PAY3.3 Reconciliation** | Cash capture is production-ready via webhooks + manual bank transfer. Settlement matching is finance polish without GL; defer until tenant demand or post-Inventory COGS work. |

**Do not begin PAY3.3** until leadership confirms override of this recommendation.

**Suggested sequencing if single squad:**

```text
Q3 2026: Inventory INV0–INV2 (ledger + reservation + fulfillment hook)
Q4 2026: Inventory INV3–INV4 + Helpdesk 1D hardening (if bandwidth)
2027 H1: PAY3.3 OR GL (based on finance customer pressure)
```

**Architecture prerequisites before Inventory kickoff:**

1. Read `SALES_ORDER_ARCHITECTURE.md` fulfillment hook § — reservation/deduction boundaries
2. Draft `docs/INVENTORY_ARCHITECTURE.md` — authority model (ledger vs commercial)
3. Define event contract: `sales_order.fulfillment.posted` → inventory deduction
4. ATP guard integration point on quote/SO line-add (optional INV3)

---

## Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-02 | Initial platform state review post PAY3.2 |

**Next update trigger:** Inventory architecture approved, or strategic fork decision overridden.
