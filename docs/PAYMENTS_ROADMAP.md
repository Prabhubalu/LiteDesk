# Payments Module — Implementation Roadmap

**Source architecture:** `docs/PAYMENTS_ARCHITECTURE.md` (approved — authoritative)

**Strategic direction:** Ship a **platform-native, allocation-aware** Payments module as the cash authority layer downstream of Invoices. Payments adjust receivable rollups only — never commercial snapshots.

**Prerequisite:** Invoices INV0–INV3 complete — see `docs/INVOICE_ROADMAP.md`, `docs/COMMERCIAL_PLATFORM_RETROSPECTIVE.md`.

**Last updated:** 2026-06-02

---

## Progress tracker

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **INV4** — Invoice payment hooks | ✅ Done | Rollup service, payment-summary API, activity mirrors, void guard |
| **PAY0** — Domain + record/apply/reverse | ✅ Done | Models, services, APIs, migration script, tests |
| **PAY1** | ✅ Done | `Refund`, `RefundAllocation`, refund workflow, payment/refund UI, invoice visibility |
| **PAY2** — Customer credit + statements | ✅ Done | `CustomerCreditBalance`, `CustomerCreditApplication`, statement API/PDF/CSV |
| **PAY3** — Online payments (gateway) | ✅ PAY3.2 done | Razorpay, Manual Bank Transfer |

---

## Locked decisions (from architecture §17)

| # | Decision | Value |
|---|----------|-------|
| 1 | Billing authority | **`SalesOrderInvoiceAllocation`** — payments never write |
| 2 | Cash authority | **`PaymentAllocation`** — sole source of `amountPaid` |
| 3 | Commercial immutability | Never mutate invoice line/section snapshots |
| 4 | Default apply grain | Invoice header — line-level optional (PAY1) |
| 5 | Multi-invoice payment | Yes — same account |
| 6 | Reversal semantics | `status: reversed` — never delete |
| 7 | **paymentPurpose** | `invoice_payment` \| `deposit` \| `retainer` \| `on_account` |
| 8 | **Allocation policy** | Auto-apply = oldest `dueDate` first; manual override |
| 9 | **paymentInstrumentSnapshot** | Immutable at record |
| 10 | Customer Statement | ✅ PAY2 — API, PDF, CSV, activity audit |

---

## INV4 — Invoice payment hooks

| Item | File / route | Notes |
|------|--------------|-------|
| Rollup service | `invoicePaymentRollupService.js` | `amountPaid`, `amountDue`, `paymentStatus`, lifecycle transition |
| Void guard | `invoiceVoidService.js` | Already blocks when `amountPaid > 0` |
| Payment summary | `GET /api/invoices/:id/payment-summary` | Allocations, refundable, due |
| Activity mirror | `invoiceActivityService.js` | `payment_applied`, `payment_reversed` |

---

## PAY0 — Domain + record/apply/reverse

### Models

| Model | File |
|-------|------|
| Payment | `server/models/Payment.js` |
| PaymentAllocation | `server/models/PaymentAllocation.js` |
| PaymentReversal | `server/models/PaymentReversal.js` |

### Constants

| File | Contents |
|------|----------|
| `paymentLifecycle.js` | Statuses, purposes, instrument methods, rollup helpers |
| `paymentPermissions.js` | RBAC keys |
| `paymentModuleDefaults.js` | Platform module field defaults |

### Services

| Service | Responsibility |
|---------|----------------|
| `paymentRecordService.js` | Record payment + optional auto/manual apply |
| `paymentAllocationPolicyService.js` | Oldest-due-date auto-apply plan |
| `paymentAllocationService.js` | Apply allocations to invoices |
| `paymentReversalService.js` | Reverse allocations via PaymentReversal |
| `invoicePaymentRollupService.js` | Invoice receivable rollups |
| `paymentRollupService.js` | Payment header rollups |
| `paymentActivityService.js` | Append-only audit |
| `invoicePaymentSummaryService.js` | Invoice-centric payment summary |

### API

| Method | Route |
|--------|-------|
| POST | `/api/payments` |
| GET | `/api/payments` |
| GET | `/api/payments/:id` |
| POST | `/api/payments/:id/allocations` |
| POST | `/api/payments/:id/reversals` |
| GET | `/api/invoices/:id/payment-allocations` |
| GET | `/api/invoices/:id/payment-summary` |

### Migration

```bash
node server/scripts/migratePaymentsToCoreModule.js
```

### Tests

```bash
cd server && npm run test:payments
```

---

## PAY1 — Refund + UI (done)

### Server

| Item | File / route | Notes |
|------|--------------|-------|
| Refund model | `server/models/Refund.js` | Linked to Payment; reason catalog |
| RefundAllocation | `server/models/RefundAllocation.js` | Audit mirror when allocations unwound |
| Refund reasons | `server/constants/refundReasons.js` | 8-value catalog |
| Refund workflow | `server/services/refundService.js` | Creates refund + reversal + rollups |
| Refund API | `POST /api/payments/:id/refunds` | Manual allocation + unallocated portion |
| Eligibility | `GET /api/payments/:id/refund-eligibility` | Wizard data |
| Refund detail | `GET /api/refunds/:id` | Refund + allocations |
| Invoice visibility | `GET /api/invoices/:id/payment-summary` | Extended with refunds |

### Client

| Item | File | Notes |
|------|------|-------|
| Payment record | `paymentsRecordAdapter.js` | Allocations + refunds sections |
| Refund wizard | `PaymentRefundWizardModal.vue` | Issue refund from payment record |
| Invoice payments | `InvoicePaymentsRecordSection.vue` | Payments + refunds on invoice |
| Routes | `/payments`, `/payments/:id` | List + record |
| Activity | `paymentActivityUiAdapter.js` | Refund events |

### Tests

```bash
cd server && npm run test:payments
```

---

## PAY2 — Customer credit + statements (done)

### Authority model

| Layer | Model | Writes |
|-------|-------|--------|
| Billing | `SalesOrderInvoiceAllocation` | Never touched |
| Cash | `PaymentAllocation` | `amountPaid` |
| Credit | `CustomerCreditApplication` | `creditAppliedTotal` |

`amountDue = grandTotal - amountPaid - writeOffTotal - creditAppliedTotal`

Credit balances decrease **only** via `CustomerCreditApplication` (or audited refund of unallocated cash).

### Server

| Item | File / route | Notes |
|------|--------------|-------|
| Credit balance | `server/models/CustomerCreditBalance.js` | Materialized from payment unallocated |
| Credit application | `server/models/CustomerCreditApplication.js` | Credit authority — apply/reverse |
| Balance service | `server/services/customerCreditBalanceService.js` | Sync, rollup, refund reduction |
| Application service | `server/services/customerCreditApplicationService.js` | Apply, auto-apply, reverse |
| Statement service | `server/services/customerStatementService.js` | JSON, CSV, PDF, activity |
| Statement API | `/api/customer-statements/*` | Preview, export, credit apply |
| Invoice rollup | `invoicePaymentRollupService.js` | Extended for `creditAppliedTotal` |
| Payment summary | `GET /api/invoices/:id/payment-summary` | Credit applications + `canApplyCredit` |

### API

| Method | Route |
|--------|-------|
| GET | `/api/customer-statements` |
| GET | `/api/customer-statements/export.csv` |
| GET | `/api/customer-statements/export.pdf` |
| GET | `/api/customer-statements/credit-balances` |
| POST | `/api/customer-statements/credit-applications` |
| POST | `/api/customer-statements/credit-applications/:id/reverse` |

### Client

| Item | File | Notes |
|------|------|-------|
| Apply credit modal | `CustomerCreditApplyModal.vue` | From invoice payments section |
| Invoice payments | `InvoicePaymentsRecordSection.vue` | Credit applications + apply button |
| Statement panel | `CustomerStatementPanel.vue` | Preview, CSV, PDF on payment record |
| Activity | `paymentActivityUiAdapter.js`, `invoiceActivityUiAdapter.js` | Credit + statement events |

### Tests

```bash
cd server && npm run test:payments
```

27 tests — lifecycle, credit, statement CSV/balance math.

---

## PAY3 — Online payments (PAY3.0 shipped)

**Architecture:** `docs/PAYMENT_GATEWAYS_ARCHITECTURE.md` v1.1  
**Operations:** `docs/PAYMENT_GATEWAY_OPERATIONS.md` v1.0  
**Idempotency:** `docs/PAYMENT_GATEWAY_IDEMPOTENCY.md` v1.0  
**Retrospective:** `docs/PAYMENTS_RETROSPECTIVE.md` v1.1

| Sub-phase | Status | Scope |
|-----------|--------|-------|
| **PAY3.0** | ✅ Done | `PaymentLink`, `PaymentGatewaySession`, `PaymentGatewayEvent`, Stripe adapter (mock in test), webhooks, credential health, capture → Payment |
| **PAY3.1** | ✅ Done | Portal Pay Now, Payment Link UI (`/pay/:token`), event replay admin UI |
| **PAY3.2** | ✅ Done | Razorpay adapter + webhook; Manual Bank Transfer (`BankTransferInstruction`) |
| **PAY3.3** | ⬜ Next | Reconciliation import and matching |

```bash
cd server && npm run test:payment-gateways   # 11 scenarios
```

---

## Relationship to frozen commercial layer

| Artifact | Status | Payment action |
|----------|--------|----------------|
| `SalesOrderInvoiceAllocation` | ✅ Frozen | **Never write** |
| Invoice commercial snapshots | ✅ Frozen | **Never mutate** |
| `Invoice.amountDue` / `amountPaid` | ✅ Schema live | Rollup from `PaymentAllocation` |
| Credit notes | ✅ INV3 | Reduce `amountDue` — not payment targets |
| Write-offs | Schema-ready | Collections owns — coordinated rollup only |
