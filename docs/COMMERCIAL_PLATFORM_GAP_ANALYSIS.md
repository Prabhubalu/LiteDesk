# Commercial Platform Gap Analysis

**Scope:** Quotes, Sales Orders, and Invoices only.

**Goal:** Identify the highest-value improvements inside the existing commercial stack instead of creating a new module.

**Explicitly paused / out of scope:** Inventory, procurement, GL/accounting, and new backend domains. Recommendations below favor workflow, UI, reporting, automation, approvals, documents, analytics, bulk actions, and admin controls layered on the current Quote -> Sales Order -> Invoice path.

**Current baseline reviewed:**

- Quotes Q0-Q9 are MVP complete: quote CRUD, lines, sections, revisions timeline, approvals, PDF/email, public quote portal, partial accept, typed signature, messages, expiry, and Quote -> Sales Order conversion.
- Sales Orders SO0-SO4 are complete: Quote -> SO conversion, manual orders, fulfillment events, reversals, split/merge, invoice readiness, sections, and list bulk merge / combined invoice.
- Invoices INV0-INV4 are complete: SO -> Invoice conversion, post/void, approval workflow, credit notes, PDF/email, multi-SO invoice wizard, payment summary hooks, payment allocations, credit applications, and customer statement panel.

## Priority Summary

| Priority | Theme | Why it matters |
|---|---|---|
| P0 | Commercial command center reporting | Leaders cannot see quote-to-cash bottlenecks, overdue receivables, or fulfillment risk from one place. |
| P0 | Quote revision compare + approval context | Quotes have revisions and approvals, but approvers and sellers lack diff-aware context before sending customer-facing documents. |
| P0 | Invoice aging + collections workflow | Invoices have payment tracking, but collections teams need aging queues, owner assignment, reminders, and next actions. |
| P0 | SO fulfillment workbench + SLA tracking | Fulfillment exists as event posting, but operators need queue views, late-risk signals, and batch execution. |
| P1 | Document/template administration | Quote and invoice PDFs exist, but tenants cannot manage layouts, legal clauses, template defaults, or versioned document packs. |
| P1 | Customer self-service depth | Quote portal and invoice pay exist, but SO visibility, invoice detail/downloads, and customer statements are thin. |
| P1 | Bulk commercial operations | List bulk exists for selected SO flows, but quotes/invoices need operational batch actions. |

## Gap Backlog

### Quotes

| Gap | Category | User value | Business impact | Effort | Priority |
|---|---|---|---|---|---|
| Revision compare view | Missing UX workflows / document experiences | Sellers and approvers can compare Rev 1 vs Rev 2 across header terms, sections, line quantities, discounts, taxes, totals, and customer-facing notes. | Reduces pricing mistakes and approval rework before a revised quote is sent. | M | P0 |
| Revision decision workflow | Missing approval experiences | Approvers see what changed since the last approved/sent revision, not just the current quote record. | Prevents rubber-stamp approvals and protects margin on revised deals. | M | P0 |
| Approval workspace context | Missing approval experiences | Approval detail should show quote amount, margin-sensitive fields, customer, revision, customer messages, PDF preview, and approve/reject reasons in one flow. | Shortens approval cycle time and improves audit quality. | M | P0 |
| Quote analytics dashboard | Missing reporting / analytics | Sales teams can track sent value, acceptance rate, average time to accept, expiry leakage, discounting, revision count, and conversion rate to SO. | Improves forecast confidence and exposes quote process leakage. | M | P0 |
| Quote template designer | Missing document experiences / admin controls | Admins manage quote layouts, default sections, terms, clause blocks, email copy, footer, and brand defaults without code. | Supports enterprise tenants and reduces manual document edits. | L | P1 |
| Quote compare for alternatives | Missing UX workflows | Sellers can compare optional sections, bundles, and alternate quote versions side by side before sending. | Helps teams present better proposals and avoid duplicate quote sprawl. | M | P1 |
| Bulk quote actions | Missing bulk operations | Users can bulk send reminders, expire/cancel drafts, assign owner, regenerate PDFs, submit for approval, or export selected quotes. | Saves seller time and improves operational hygiene on large quote volumes. | M | P1 |
| E-signature readiness upgrade | Missing customer-facing capabilities / document experiences | Typed signature exists, but the experience lacks a full signature certificate, IP/device evidence display, downloadable signed PDF package, and optional e-sign provider handoff. | Makes quote acceptance more defensible for higher-value contracts. | M | P1 |
| Quote customer reminder automation | Missing automation | Automatically remind customers before expiry and alert owners when viewed-but-not-accepted. | Increases conversion and reduces stale quotes. | S-M | P1 |
| Approval SLA timers | Missing automation / approval experiences | Quotes pending approval show due-by timers, escalation owners, and overdue notifications. | Prevents approval bottlenecks from delaying revenue. | M | P1 |
| Quote conversion assistant | Missing conversion workflows | Conversion should show accepted/unmapped lines, already converted lines, target SO previews, and partial conversion warnings before creating SO. | Reduces accidental partial conversions and support cleanup. | M | P1 |
| Quote admin policy controls | Missing admin controls | Admins configure approval thresholds, discount override rules, revision numbering, default validity windows, portal signature requirements, and reminder cadence in one Quotes settings surface. | Moves commercial governance from code/process memory into tenant configuration. | M | P1 |

### Sales Orders

| Gap | Category | User value | Business impact | Effort | Priority |
|---|---|---|---|---|---|
| Fulfillment workbench | Missing UX workflows | Operators need a queue grouped by order, line, due date, fulfillment type, and open quantity, rather than posting events one line at a time from each record. | Improves throughput and reduces missed shipments/service completions. | M-L | P0 |
| SLA / due-date tracking | Missing reporting / automation | Orders should show promised date, fulfillment SLA status, late risk, and breach reason at list, record, and dashboard level. | Makes delivery commitments measurable without adding inventory. | M | P0 |
| Operational dashboards | Missing reporting / analytics | Teams need open orders, fulfillment backlog, partially fulfilled value, invoice-ready value, late orders, split/merge volume, and blocked orders. | Gives operations and sales leadership shared visibility into revenue execution. | M | P0 |
| Split UX preview | Missing UX workflows | Before splitting, users should preview the resulting child order, moved lines, quantities, totals, and billing impact. | Reduces accidental order fragmentation and invoice mismatches. | M | P1 |
| Merge eligibility assistant | Missing UX workflows / bulk operations | Bulk merge should explain incompatible account/contact/currency/status issues and show resulting order preview. | Prevents failed merges and makes batch order cleanup safer. | M | P1 |
| Record-page merge entry | Missing UX workflows | Users can merge from a sales order record by selecting compatible related/open orders, not only from list bulk selection. | Reduces navigation friction for order coordinators. | S-M | P1 |
| SO approval workflow | Missing approval experiences | High-value, discounted, changed, or manually created orders can require approval before confirmation or fulfillment. | Adds control over operational commitments and non-standard orders. | M | P1 |
| Automated invoice suggestions | Missing conversion workflows / automation | When an order becomes billable, the system suggests draft invoices or queues "ready to invoice" actions for owners. | Accelerates billing without introducing GL or new domains. | M | P1 |
| Bulk fulfillment actions | Missing bulk operations | Operators can post fulfillment, mark service complete, backorder, cancel open qty, assign owner, or export selected orders in bulk. | Reduces repetitive record-by-record work. | M | P1 |
| Customer-facing SO status | Missing customer-facing capabilities | Customers can view order status, fulfilled/cancelled/backordered quantities, and related invoice links. | Reduces "where is my order?" requests and improves buyer trust. | M | P1 |
| SO document experience | Missing document experiences | Generate customer-facing order confirmations, packing/service completion notes, and change summaries from the SO record. | Makes SO usable as the operational customer commitment document. | M | P1 |
| Order analytics by source | Missing analytics | Track quote-to-SO conversion time, manually created vs quote-sourced orders, split/merge rate, and fulfillment cycle time. | Helps identify process friction after quote acceptance. | M | P1 |
| SO admin controls | Missing admin controls | Admins configure default bill-on policy display, fulfillment action labels, due-date/SLA defaults, merge rules, and order confirmation requirements. | Lets tenants adapt order operations without branching the product. | M | P2 |

### Invoices

| Gap | Category | User value | Business impact | Effort | Priority |
|---|---|---|---|---|---|
| Aging reports | Missing reporting | Finance users can see current, 1-30, 31-60, 61-90, and 90+ day receivables by customer, owner, currency, and invoice. | Core AR visibility; directly affects cash collection. | M | P0 |
| Collections work queue | Missing UX workflows / automation | Collectors need assigned queues, next follow-up date, promise-to-pay notes, dispute flags, and collection status. | Converts invoice tracking into a repeatable cash workflow. | M-L | P0 |
| Dunning / reminder automation | Missing automation / customer-facing capabilities | Automatically send reminder sequences before due, on due date, and after overdue with tenant-configurable copy and pause rules. | Improves cash timing and reduces manual follow-up. | M | P0 |
| Payment tracking UX upgrade | Missing UX workflows | Invoice payment panels should highlight outstanding amount, expected payment method, failed payment attempts, unapplied credits, and next action. | Helps finance teams resolve unpaid invoices faster. | M | P0 |
| Invoice analytics dashboard | Missing reporting / analytics | Track posted value, paid value, overdue value, DSO proxy, collection effectiveness, credit note rate, void rate, and payment status trend. | Gives leadership cash and billing health without spreadsheet exports. | M | P0 |
| Customer statement UX upgrade | Missing customer-facing capabilities / document experiences | Statements exist internally, but customers need portal access, date range selection, PDF/CSV download, and pay selected invoices from the statement. | Reduces AR support load and improves customer self-service. | M | P1 |
| Invoice detail portal | Missing customer-facing capabilities | Portal invoice list should open invoice details, PDF download, payment history, credit notes, and support/contact action. | Makes portal invoice pay credible for customers with multiple invoices. | M | P1 |
| Invoice template designer | Missing document experiences / admin controls | Admins manage invoice and credit note layouts, tax/legal text, payment instructions, footer, and email templates separately from quote branding. | Supports compliance and brand requirements per tenant. | M-L | P1 |
| Bulk invoice actions | Missing bulk operations | Users can bulk send/resend, generate PDFs, assign collector, apply reminder policy, export, mark disputed, or submit/post approved invoices where eligible. | Makes AR operations scalable. | M | P1 |
| Approval reason and audit UX | Missing approval experiences | Invoice rejection, void, and post actions should capture structured reason codes and show approval/audit history inline. | Improves compliance and reduces ambiguity in finance reviews. | S-M | P1 |
| Dispute workflow | Missing UX workflows / automation | Finance can mark invoices disputed, capture reason, pause dunning, assign owner, and resolve with credit note or resend. | Prevents inappropriate reminders and improves customer experience. | M | P1 |
| Collection admin policies | Missing admin controls | Admins configure payment terms defaults, reminder cadence, collector assignment, grace periods, dispute pause rules, and statement branding. | Standardizes AR behavior across teams. | M | P1 |
| Invoice list saved views for AR | Missing reporting | Add first-class views for Overdue, Due this week, Partially Paid, Unpaid Posted, Disputed, Credit Notes, and High Balance. | Lets AR teams work from the list without custom filters every day. | S | P1 |

## Cross-Cutting Gaps

| Gap | Applies to | User value | Business impact | Effort | Priority |
|---|---|---|---|---|---|
| Quote-to-cash command center | Quotes / SO / Invoices | A single dashboard shows accepted quotes awaiting SO, confirmed orders awaiting fulfillment, fulfilled orders ready to invoice, posted invoices unpaid, and overdue receivables. | Highest-leverage improvement because it turns existing modules into a managed revenue workflow. | M-L | P0 |
| Conversion health reporting | Quotes / SO / Invoices | Users see conversion coverage and exceptions across Quote -> SO -> Invoice, including partially converted quotes and partially invoiced orders. | Prevents revenue leakage between handoffs. | M | P0 |
| Activity-driven automation rules | Quotes / SO / Invoices | Existing activity/status events can trigger reminders, assignments, approvals, and dashboard alerts. | Adds leverage to existing domain events without new modules. | M | P1 |
| Commercial saved views pack | Quotes / SO / Invoices | Prebuilt views reflect daily jobs: Awaiting Approval, Expiring Soon, Ready to Fulfill, Ready to Invoice, Overdue, Needs Follow-up. | Makes the system feel operationally complete immediately. | S-M | P1 |
| Export/report scheduler | Quotes / SO / Invoices | Teams can schedule CSV/PDF summary reports for managers and finance stakeholders. | Reduces manual reporting overhead. | M | P2 |
| Field/admin governance | Quotes / SO / Invoices | Admins control required fields by status transition, document visibility, approval thresholds, and portal exposure per module. | Increases enterprise readiness without changing core data models. | M-L | P1 |

## Recommended Execution Order

1. **P0 command center:** Build the cross-module quote-to-cash dashboard and exception queues using existing records and status fields.
2. **P0 quote approval/revision depth:** Add revision diff, approval context, and conversion assistant to reduce pre-order mistakes.
3. **P0 invoice AR layer:** Add aging, collections queue, reminder policy, and payment tracking UX on top of existing invoice/payment summary data.
4. **P0 SO operations layer:** Add fulfillment workbench, SLA/due-date signals, and operational dashboards.
5. **P1 document/admin layer:** Add quote/invoice template controls, signed document packages, customer SO/invoice portal depth, and bulk actions.

## Non-Goals

- Do not create a new Commercial, AR, Fulfillment, or Collections backend domain yet.
- Do not start inventory reservations, procurement, GL posting, revenue recognition, warehouse allocation, or tax engine work as part of this gap list.
- Do not replace existing Quotes, Sales Orders, Invoices, Payments, or Customer Statement services. The highest-value path is to make the current stack easier to operate, approve, report on, and expose to customers.
