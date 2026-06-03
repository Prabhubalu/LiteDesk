# Quote Approvals and Revisions Architecture

**Status:** Draft for review

**Scope:** Quote Revisions & Approvals UX only.

**Explicitly out of scope:** Procurement, GL/accounting, Inventory UI, fulfillment/inventory reservations, and any new backend domain. This architecture extends the existing Quotes stack: `Quote`, `QuoteLine`, `QuoteSection`, `QuoteApproval`, `ApprovalInstance`, quote PDF/document generation, and quote activity.

**Review decisions approved:**

- Approve comments are optional in MVP.
- Watermarked PDF preview is allowed for assigned quote approvers.
- Risk thresholds start as conservative hardcoded constants.
- Compare actions are allowed from historical revisions.

## 1. Goals

1. Give sellers and approvers a clear **Revision Compare View** before sending or approving revised quotes.
2. Upgrade the generic approval detail into a quote-aware **Approval Workspace**.
3. Support a **Revision Decision Workflow** that highlights changes since the last approved revision.
4. Link revision and approval activity so every decision has durable context.
5. Keep the design future-ready for compare snapshots and approval SLA without requiring those systems in the first implementation.

## 2. Current Baseline

| Area | Current state |
|---|---|
| Revisions | `POST /api/quotes/:id/revise` clones quote header, sections, and lines into a new Draft revision with the same `quoteNumber` and incremented `revisionNumber`. |
| Revision list | `GET /api/quotes/:id/revisions` returns lightweight revision rows. UI shows a timeline and can open a historical revision. |
| Approvals | Quote record supports submit / approve / reject. Process Designer approvals sync through `ApprovalInstance` and `quoteApprovalProcessService`. |
| Approval history | `QuoteApproval` stores immutable `submit`, `approve`, and `reject` events with `quoteId`, `revisionNumber`, comment, actor, and metadata. |
| Activity | Quote activity records status, approval, sharing, revision, line, and conversion events. |
| Documents | Quote PDF/email/public link exist and already respect draft vs formal send behavior. |

## 3. Design Principles

| Principle | Rule |
|---|---|
| Additive | Prefer read endpoints, derived compare payloads, and UI surfaces over disruptive schema changes. |
| Snapshot-safe | Compare against stored quote/section/line snapshots, never live catalog pricing. |
| Revision-aware | Every approval and activity event exposed in this UX must show the revision it belongs to. |
| Approval-friendly | Approvers should see what changed, why it matters, and the customer-facing document before deciding. |
| Commercially scoped | Risk indicators are quote-level commercial signals only: price, discount, quantity, total, terms, validity, and customer-facing text. |
| Future-ready | Design payloads so compare snapshots and SLA timers can be persisted later without changing UI contracts. |

## 4. Revision Compare View

### 4.1 Entry Points

| Surface | Entry |
|---|---|
| Quote Revisions section | Add **Compare** action on each non-current revision row and a default "Compare to previous" action for the current revision. |
| Quote header actions | Show **Review changes** when current revision is Draft, Pending Approval, Approved, or Sent and a prior revision exists. |
| Approval Workspace | Embed the compare summary and link to the full compare view. |
| Activity timeline | Revision-created and approval events link to the relevant compare view. |

### 4.2 Compare Target Rules

Default comparison order:

1. **Last approved revision** for the same `quoteNumber`.
2. If none, **previous revision number**.
3. If none, show "No prior revision to compare."

Manual compare:

- Allow `fromRevision` and `toRevision` selection among revisions with the same `quoteNumber`.
- Block cross-quote comparison.
- Historical revisions remain read-only.
- Allow compare actions from historical revisions.
- Support compare filters as a future-ready UI/API contract.

Compare filters readiness:

```text
GET /api/quotes/:id/revisions/compare?fromRevision=1&toRevision=2&impactArea=pricing&customerVisible=true&changeType=changed
```

MVP may compute the full payload and apply filters in memory. The contract should support:

- `impactArea`
- `customerVisible`
- `changeType`
- `riskLevel`
- `sectionId`
- `lineType`

### 4.3 Compare Payload

Target endpoint:

```text
GET /api/quotes/:id/revisions/compare?fromRevision=1&toRevision=2
```

Response shape:

```json
{
  "quoteNumber": "QT-0001",
  "from": {
    "quoteId": "...",
    "revisionNumber": 1,
    "status": "Approved",
    "approvedAt": "2026-06-01T10:00:00.000Z"
  },
  "to": {
    "quoteId": "...",
    "revisionNumber": 2,
    "status": "Draft"
  },
  "summary": {
    "executiveSummary": [
      "Grand total increased by USD 12,500.",
      "Two lines were added and one line was removed.",
      "Discount increased by USD 1,500."
    ],
    "changeCounts": {
      "header": 2,
      "sectionsAdded": 1,
      "sectionsRemoved": 0,
      "sectionsChanged": 1,
      "linesAdded": 2,
      "linesRemoved": 1,
      "linesChanged": 3
    },
    "totalDelta": 12500,
    "discountDelta": 1500,
    "riskLevel": "medium",
    "riskIndicators": [],
    "impactAreas": ["pricing", "scope", "discount"]
  },
  "headerDiffs": [],
  "sectionDiffs": [],
  "lineDiffs": [],
  "approvalHistory": []
}
```

### 4.4 Header Field Diff

Compare only fields that affect approval, customer commitment, or document interpretation.

| Field group | Fields |
|---|---|
| Identity | `quoteTitle`, `ownerId`, `customerId`, `organizationRefId`, `contactId` |
| Dates | `quoteDate`, `validUntil` |
| Commercial | `currency`, `exchangeRateSnapshot`, `subtotal`, `lineDiscountTotal`, `globalDiscountTotal`, `taxTotal`, `adjustmentTotal`, `grandTotal` |
| Discount policy | `globalDiscountType`, `globalDiscountValue`, `globalDiscountAmount` |
| Terms | `termsConditions`, `paymentTerms`, customer-facing notes if present in current quote model/custom fields |
| Approval | `approvalRequired`, `approvalStatus` |

Diff row shape:

```json
{
  "field": "grandTotal",
  "label": "Grand total",
  "fromValue": 50000,
  "toValue": 62500,
  "changeType": "changed",
  "impactArea": "pricing",
  "customerVisible": true,
  "delta": 12500,
  "severity": "high"
}
```

Every diff row must include:

- `impactArea`: `pricing`, `scope`, `terms`, `timing`, `customer`, `approval`, `structure`, or `metadata`.
- `customerVisible`: whether the change can appear on customer-facing quote documents, portal views, or emails.

### 4.5 Section Diff

Match sections by stable section public ID when available, then by normalized title/order as fallback.

Section change types:

- `added`
- `removed`
- `changed`
- `unchanged`
- `moved`

Section fields to compare:

- Section title
- Section type
- Include-in-total flag
- Section order
- Section total / discount values when present
- Count of added/removed/changed lines inside the section

### 4.6 Line Diff

Match lines by source lineage where possible:

1. Same `quoteLineId` if a revision cloning flow preserves lineage metadata in the future.
2. Existing cloned line metadata if available.
3. Fallback composite key: variant, SKU snapshot, item name snapshot, section, line type, bundle parent relationship, and order proximity.

Line change types:

- `added`
- `removed`
- `changed`
- `unchanged`
- `moved`

Line fields to compare:

| Field group | Fields |
|---|---|
| Item identity | SKU snapshot, item name snapshot, description snapshot, variant reference |
| Structure | Section, line order, line type, bundle parent/child relationship, hidden/optional flags |
| Quantity | Quantity, unit of measure if present |
| Price | Unit price snapshot, list price snapshot, override flags if present |
| Discount | Discount type/value/amount |
| Tax | Tax amount/snapshot summary |
| Totals | Line subtotal, line total, currency snapshot |

Commercial deltas:

- Quantity delta
- Unit price delta
- Discount delta
- Tax delta
- Extended total delta

### 4.7 Visual Treatment

| Diff type | UX |
|---|---|
| Added | Green-tinted row with "Added" badge. |
| Removed | Red-tinted row with "Removed" badge and prior values. |
| Changed | Neutral row with inline before/after values and delta. |
| Moved | Small movement indicator with old/new section or order. |
| High risk | Warning badge on the changed field, section, and summary. |

The compare page should default to a compact summary plus expandable sections:

1. Summary and commercial impact
2. Header changes
3. Section changes
4. Line changes
5. Approval/activity context

## 5. Approval Workspace

### 5.1 Entry Points

| Surface | Behavior |
|---|---|
| `/approvals/:id` | If `entityType === 'quote'`, render quote-aware workspace blocks. |
| Quote record approval banner/actions | Link to the relevant approval workspace when a process approval exists. |
| Approval inbox | Include quote number, revision, total, risk level, and change count in the row preview. |

### 5.2 Workspace Layout

Recommended layout:

1. **Decision header:** quote number, revision, status, total, customer, due state when SLA exists later.
2. **Revision summary:** comparison against last approved or previous revision.
3. **Change summary:** high-signal grouped changes with risk badges.
4. **PDF preview:** current revision PDF, with fallback "Generate preview" action.
5. **Approval history:** revision-scoped `QuoteApproval` rows plus linked `ApprovalInstance` decision history.
6. **Decision form:** approve/reject with optional approval note and required rejection reason.

### 5.3 PDF Preview

MVP options:

- Embed generated PDF in an iframe/object when a document exists.
- Provide **Generate preview PDF** action when none exists.
- For Draft/Pending Approval, generate a watermarked preview and never mark the quote formally sent.

PDF preview must show:

- Quote number and revision number
- Draft/formal state
- Generated timestamp
- Download/open action

### 5.4 Approval History

Approval history should combine:

- `QuoteApproval` rows for the same `quoteId` and `revisionNumber`
- Related `ApprovalInstance` decision data when the decision came from Process Designer
- Quote activity events tagged with the same revision

History row shape:

```json
{
  "type": "quote_approval",
  "action": "approve",
  "revisionNumber": 2,
  "actor": { "id": "...", "name": "Asha Rao" },
  "comment": "Approved with revised discount",
  "metadata": {
    "approvalId": "APR-001",
    "compareLink": "/quotes/.../compare?fromRevision=1&toRevision=2"
  },
  "createdAt": "2026-06-02T12:00:00.000Z"
}
```

### 5.5 Approve / Reject Reasons

Approval decision behavior:

| Decision | Reason behavior |
|---|---|
| Approve | Optional comment, recommended when medium/high risk indicators exist. |
| Reject | Required reason. |
| Return to draft / rejected quote | Keep existing quote lifecycle behavior; do not invent a new approval status. |

Reason persistence:

- Store reason/comment in `QuoteApproval.comment`.
- Mirror structured reason metadata in `QuoteApproval.metadata.reasonCode` when reason codes are introduced.
- Include reason in quote activity details for timeline display.

## 6. Revision Decision Workflow

### 6.1 Last Approved Revision

Definition:

- The last approved revision is the highest `revisionNumber` for the same `quoteNumber` where either:
  - Quote `status` is `Approved`, `Sent`, `Viewed`, `Accepted`, `Partially Accepted`, `Partially Converted`, or `Converted`, or
  - A `QuoteApproval` row has `action = approve` for that revision.

If the current revision has no prior approved revision, compare against the previous revision.

### 6.2 Decision States

| Quote status | Workspace behavior |
|---|---|
| Draft | Show compare summary and "Submit for approval" if permitted. |
| Pending Approval | Show full approval workspace and decision controls for approvers. |
| Approved | Show approved decision summary and compare context. |
| Rejected | Show rejection reason and changes that were rejected. |
| Sent or later | Show read-only approval and compare context. |

### 6.3 Margin-Sensitive Indicators

The first version should avoid true margin math unless margin/cost fields already exist in quote line data. Use commercial proxies:

| Indicator | Trigger |
|---|---|
| Price decreased | Any line unit price decreases compared with baseline. |
| Discount increased | Line or global discount amount/rate increases. |
| Total decreased | `grandTotal` decreases while quantity is same or higher. |
| Free/zero line added | Added line has zero unit price or zero line total. |
| High-value line removed | Removed line exceeds configured or default amount threshold. |
| Terms changed | Payment terms, validity, or customer-facing terms changed. |

Future true-margin support can add:

- Cost snapshot
- Gross margin amount
- Gross margin percent
- Margin threshold policy

### 6.4 Commercial Risk Levels

Risk level should be derived, not manually set.

| Level | Example conditions |
|---|---|
| Low | Text/date-only changes, section reordering, small total delta. |
| Medium | Added/removed lines, discount increase below high-risk threshold, validity/terms change. |
| High | Large total decrease, high-value line removal, price decrease on accepted items, discount above threshold, customer-facing terms materially changed. |

Default thresholds should be tenant-configurable later. MVP can use conservative constants.

## 7. Activity Integration

### 7.1 Activity Events

Add or enrich activity event details for:

| Event | Required details |
|---|---|
| `quote_revision_created` | `fromRevision`, `toRevision`, `fromQuoteId`, `toQuoteId`, `compareLink` |
| `quote_submitted_for_approval` | `revisionNumber`, `compareBaselineRevision`, `changeCounts`, `riskLevel`, `compareLink` |
| `quote_approved` | `revisionNumber`, `approvalId`, `riskLevel`, `reason/comment`, `compareLink` |
| `quote_rejected` | `revisionNumber`, `approvalId`, `reason`, `compareLink` |
| `quote_pdf_generated` | `revisionNumber`, `documentId`, `documentUrl`, `watermarked` |

### 7.2 Compare Links

Compare links should be stable URLs that can be reconstructed from IDs:

```text
/quotes/:id/compare?fromRevision=1&toRevision=2
```

The `:id` should be the target/current revision Mongo ID. The API must still validate that both revisions belong to the same organization and `quoteNumber`.

### 7.3 Activity Display

Quote activity cards should show:

- Revision badge
- Risk badge when present
- Short change summary
- Link to compare view
- Link to approval workspace when event came from an `ApprovalInstance`

## 8. API Architecture

### 8.1 Read Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/quotes/:id/revisions/compare` | Compare two revisions for one quote number. |
| `GET /api/quotes/:id/approval-workspace` | Quote-specific approval context for record page or approval detail. |
| `GET /api/quotes/:id/approval-history?revisionNumber=N` | Revision-scoped approval and decision history. |

### 8.2 Write Endpoints

No new write endpoint is required for MVP beyond existing:

- `POST /api/quotes/:id/submit-for-approval`
- `POST /api/quotes/:id/approve`
- `POST /api/quotes/:id/reject`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`

Recommended write enhancement:

- Accept optional `comment` on approve.
- Require `reason` on reject.
- Store comments/reasons in `QuoteApproval.comment` and activity details.

### 8.3 Compare Service

Add a server-side quote compare service:

```text
server/services/quoteRevisionCompareService.js
```

Responsibilities:

- Resolve quote family by `quoteNumber`.
- Load headers, sections, and lines for from/to revisions.
- Normalize fields for comparison.
- Match sections and lines.
- Compute header, section, and line diffs.
- Compute commercial deltas and risk indicators.
- Return deterministic payload for UI, activity, and approval workspace.

The service should not mutate quotes.

### 8.4 Approval Workspace Service

Add a quote approval workspace read service:

```text
server/services/quoteApprovalWorkspaceService.js
```

Responsibilities:

- Resolve current quote and revision baseline.
- Call compare service.
- Load revision-scoped `QuoteApproval` rows.
- Load pending process approval gates.
- Resolve latest PDF/document preview metadata.
- Return one payload for `/approvals/:id` and quote record usage.

## 9. UI Architecture

### 9.1 New / Updated Components

| Component | Purpose |
|---|---|
| `QuoteRevisionCompareView.vue` | Full compare page. |
| `QuoteRevisionComparePanel.vue` | Reusable compact compare summary for record and approval workspace. |
| `QuoteApprovalWorkspace.vue` | Quote-specific approval workspace content. |
| `QuoteApprovalHistory.vue` | Revision-scoped approval and activity history. |
| `QuotePdfPreviewPane.vue` | PDF preview/open/download block. |
| `QuoteCommercialRiskBadge.vue` | Consistent risk indicator display. |

### 9.2 Routing

Add route:

```text
/quotes/:id/compare
```

Query params:

- `fromRevision`
- `toRevision`
- `approvalId` optional, for workspace back-linking

### 9.3 Approval Detail Integration

`ApprovalDetail.vue` should detect:

```js
approval.entityType === 'quote'
```

Then render `QuoteApprovalWorkspace` instead of only generic entity context.

Generic approval detail remains unchanged for other entity types.

### 9.4 Quote Record Integration

Update the Revisions section:

- Show current/active badge.
- Add compare action.
- Show last approved badge when available.
- Show risk summary for current vs baseline when available.

Update quote header/lines actions:

- Show **Review changes** before submit/approve when relevant.
- Keep existing revise/submit/approve/reject actions.

## 10. Permissions

| Action | Permission |
|---|---|
| View compare | Same as quote view. |
| View approval workspace | Quote view plus approval visibility; approvers can view assigned approval. |
| Generate preview PDF | Existing quote document/export permission, or quote view for watermarked approval preview if current policy allows. |
| Approve/reject | Existing quote approve permission or assigned `ApprovalInstance` approver. |

## 11. Data and Persistence Strategy

### MVP

- Compute compare payload on demand from existing quote, section, line, approval, document, and activity data.
- Store reasons/comments in existing `QuoteApproval.comment`.
- Store compare summary metadata on activity events when events are created.

### Future Compare Snapshots

Future optional model:

```text
QuoteCompareSnapshot
```

Potential fields:

- `organizationId`
- `quoteNumber`
- `fromQuoteId`
- `toQuoteId`
- `fromRevisionNumber`
- `toRevisionNumber`
- `summary`
- `riskIndicators`
- `headerDiffs`
- `sectionDiffs`
- `lineDiffs`
- `createdBy`
- `createdAt`

Use only when performance, audit immutability, or approval evidence requires persisted compare payloads.

## 12. Future Approval SLA Readiness

Do not implement SLA timers in MVP, but reserve payload fields:

```json
{
  "approvalSla": {
    "policyId": null,
    "startedAt": null,
    "dueAt": null,
    "breachedAt": null,
    "status": "not_configured"
  }
}
```

Future SLA support should attach to `ApprovalInstance` and expose:

- Due by
- Time remaining
- Escalated approvers
- Breach reason
- Approval queue sorting

## 13. Implementation Phases

### Phase A: Compare Foundation

- Add compare service and read endpoint.
- Add compare route and full compare view.
- Add compare actions to Revisions section.

### Phase B: Approval Workspace

- Add approval workspace read service/endpoint.
- Render quote-aware workspace inside `ApprovalDetail.vue`.
- Add PDF preview and approval history blocks.
- Support approve comments and required reject reasons.

### Phase C: Decision Intelligence

- Add last-approved baseline logic.
- Add commercial risk indicators.
- Add margin-sensitive proxy indicators.
- Show risk/change counts in approval inbox and quote record.

### Phase D: Activity Links

- Enrich revision and approval activity details with revision numbers and compare links.
- Update activity cards to surface compare/workspace links.

## 14. Acceptance Criteria

| Area | Criteria |
|---|---|
| Revision compare | Users can compare current revision against last approved or previous revision and see header, section, and line diffs. |
| Line diffs | Quantity, price, discount, added lines, removed lines, moved lines, and total deltas are visible. |
| Section diffs | Added, removed, changed, and moved sections are visible. |
| Approval workspace | Approvers see revision summary, PDF preview, change summary, approval history, and decision controls. |
| Decision workflow | Pending approval view shows changes since last approved revision and highlights commercial risks. |
| Reasons | Reject requires a reason; approve can capture an optional comment. |
| Activity | Revision and approval events link to compare context and show revision numbers. |
| Scope control | No procurement, GL, inventory UI, or new backend domain work is introduced. |

## 15. Open Questions for Review

1. Should approve comments be optional always, or required when risk level is high?
2. Should quote PDF preview generation be allowed for all approvers even if they lack export permission, as long as the PDF is watermarked?
3. What default thresholds should define high-risk discount and total changes before tenant admin controls exist?
4. Should compare actions be visible on historical revisions, or only from the active/current revision context?
