# Invoices Module — Implementation Roadmap

**Source architecture:** `docs/INVOICE_ARCHITECTURE.md` (approved — authoritative)

**Strategic direction:** Ship a **platform-native, snapshot-based** Invoice module as the billing layer downstream of Sales Orders. Invoice inherits structural patterns from SO/Quotes; it owns receivable lifecycle, allocation posting, and commercial lock after Post.

**Prerequisite:** Sales Orders SO0–SO4 complete — see `docs/SALES_ORDER_ROADMAP.md`.

**Payment / GL / inventory ledger:** Payment capture and GL posting explicitly **out of scope** until INV4 hooks.

**Last updated:** 2026-06-02

---

## Progress tracker

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **INV0** — Domain contract + allocation post | ✅ Done | `Invoice`, `InvoiceSection`, `InvoiceLine`, lifecycle constants, totals service, allocation post/reverse, platform module registration, Post API stub |
| **INV1** — SO conversion + Void | ✅ Done | SO → Invoice conversion, Post/Void handlers, SO rollup integration, readiness UI, billing coverage |
| **INV2** — Agent UI + approval | ✅ Done | List, record, sections/lines CRUD, approval workflow, activity |
| **INV3** — Credit notes + PDF + multi-SO | ✅ Done | Credit notes, PDF/email, multi-SO wizard |
| **INV4** — Payment readiness | ✅ Done | Payment rollup hooks, payment-summary API, void guard (Payment module PAY0) |

---

## Locked decisions (from architecture)

| # | Decision | Value |
|---|----------|-------|
| 1 | Default bill-on policy | **`fulfill`** — align with SO3 `DEFAULT_BILL_ON` |
| 2 | Multiple invoices per SO | **Yes** — until SO `fully_invoiced` |
| 3 | Partial line invoicing | **Yes** — multiple allocations per SO line |
| 4 | Allocation authority | **`SalesOrderInvoiceAllocation`** — existing collection |
| 5 | Post transition | Allocations written **only on Post**, not Draft |
| 6 | Cross-module IDs | `invoiceId` / `invoiceLineId` UUIDs |
| 7 | Posted commercial lock | Immutable qty/pricing/discounts/taxes/sections/lines |
| 8 | Corrections | Credit Note, Void, Write Off, Payments only |
| 9 | Partially Posted | **Reserved** — documentation only (no INV0–INV2 implementation) |
| 10 | Source metadata | **`sourceContext`** + **`sourceRef { moduleKey, recordId }`** |

---

## INV3 — Credit notes + PDF + multi-SO (done)

### Credit notes

| Item | Route / file | Notes |
|------|--------------|-------|
| Create | `POST /api/invoices/from-invoice/:invoiceId/credit-note` | Full / partial / line-level |
| Credit summary | `GET /api/invoices/:id/credit-summary` | Line creditability + linked credit notes |
| Post | Reuses `POST /api/invoices/:id/post` | `credit_reversal` allocation rows |

### PDF + email

| Item | Route / file | Notes |
|------|--------------|-------|
| Generate PDF | `POST /api/invoices/:id/documents/generate` | Section/bundle-aware; `InvoiceDocument` versioning |
| List PDFs | `GET /api/invoices/:id/documents` | Version history |
| Send / resend | `POST /api/invoices/:id/send-email` | Attach snapshot PDF; `resend: true` |
| Storage | `/api/invoice-documents/{org}/{invoice}/{file}.pdf` | Same static pattern as quotes |
| Activity | `invoice_pdf_generated`, `invoice_emailed`, `credit_note_pdf_generated`, `credit_note_emailed` | Append-only audit |
| Permission | `invoices.export` | PDF + email |
| Branding | Reuses quote org branding via `invoiceBrandingService` | Logo, color, footer |

### Multi-SO invoice wizard

| Item | Route / file | Notes |
|------|--------------|-------|
| Readiness | `POST /api/invoices/multi-so-readiness` | Validates same account, contact, currency |
| Create | `POST /api/invoices/from-sales-orders` | `sourceType: merge`; per-SO allocations on post |
| UI | Sales Orders list bulk action **Combined invoice** | `InvoiceMultiSoWizardModal` |

---

## INV4 — Payment readiness (done)

| Item | Route / file | Notes |
|------|--------------|-------|
| Rollup service | `invoicePaymentRollupService.js` | `amountPaid`, `amountDue`, `paymentStatus`, lifecycle transition |
| Void guard | `invoiceVoidService.js` | Blocks void when `amountPaid > 0` |
| Payment summary | `GET /api/invoices/:id/payment-summary` | Allocations, due, canReceivePayment |
| Payment allocations | `GET /api/invoices/:id/payment-allocations` | Invoice-centric allocation list |
| Activity mirror | `invoiceActivityService.js` | `payment_applied`, `payment_reversed` |

Payment capture: **`docs/PAYMENTS_ROADMAP.md` PAY0**.

---

## Relationship to SO3 stub

| Artifact | SO3 status | Invoice action |
|----------|------------|----------------|
| `SalesOrderInvoiceAllocation` | ✅ Live | Canonical bridge — post/reverse in INV0 |
| `salesOrderInvoiceAllocationService` | Rollups only | Extended INV0 |
| Readiness UI | Stub | Wire INV1 |
| Multi-SO billing | — | INV3 merge wizard |
