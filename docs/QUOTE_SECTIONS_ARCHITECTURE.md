# Quote Sections — Architectural Review & Enhancement Proposal

**Status:** Recommendation (pre-implementation)  
**Scope:** Cross-cutting enhancement to the completed Quotes module (Q0–Q9)  
**Last reviewed:** 2026-05-29  
**Audience:** Engineering, product, CPQ/commerce platform design

---

## 1. Executive summary

Enterprise proposals are structured documents, not flat SKU lists. Customers expect grouped commercial narratives — **Hardware**, **Professional Services**, **Optional Add-ons**, **Future Expansion** — each with visible subtotals, optional opt-in groups, and section-level commercial terms.

The current Quotes module ships a **`lineGroupKey` placeholder** on `QuoteLine` that is writable via PATCH but unused in totals, UI, PDF, portal, or conversion. That field is sufficient for presentation-only tagging; it is **not** sufficient for enterprise-grade sections with totals, discounts, optional semantics, portal acceptance, or revision-safe identity.

**Recommendation:** Evolve to a **first-class `QuoteSection` entity** (parallel to `QuoteLine`), with lines referencing `quoteSectionId`. Extend `quoteTotalsService` into a three-tier totals hierarchy (line → section → quote). Persist section discount **inputs** and section **computed totals** using the same snapshot pattern already used on lines and quote headers.

This aligns with world-class CPQ platforms (Salesforce CPQ Line Groups, SAP/Oracle section rollups, Zoho Quote sections) while staying faithful to Arivu's platform-first, snapshot-based, revision-safe architecture.

---

## 2. Current state assessment

### 2.1 What exists today

| Area | Current behavior |
|------|------------------|
| **Line grouping** | `lineGroupKey` on `QuoteLine` — indexed string, PATCH-writable, **no consumer** |
| **Line ordering** | Global `lineOrder`; drag reorder preserves bundle groups |
| **Totals** | Line → quote only; `filterIncludedLines()` handles bundles + `hiddenLine` |
| **Discounts** | Per-line + global on quote header; no intermediate tier |
| **Revisions** | Multi-document `Quote` rows; lines cloned with new `quoteLineId`, bundle parent ID remap |
| **Portal partial accept** | Line-level `quoteLineId` selection; bundle parent auto-includes children |
| **PDF** | Flat "Lines" table; no grouping, no discount breakdown |
| **Conversion** | `QuoteConversionLink` per revision; metadata carries `acceptedLineIds` |
| **UI** | Single flat table in `QuoteLinesRecordSection.vue`; bundle indent only |

### 2.2 Architectural strengths to preserve

- **Snapshot-based commercial truth** — never re-resolve catalog after save
- **First-class lines** — not embedded arrays on `Quote`
- **Revision as new `Quote` document** — clone + remap pattern proven for bundles
- **Bundle parent/child integrity** — `parentBundleLineId`, pricing mode rollup rules
- **Layered locks** — approval lock, commercial lock, record lock, `lockedSnapshot`
- **Stable public IDs** — `quoteLineId` for portal/conversion traceability

### 2.3 Gap analysis vs enterprise goals

| Goal | `lineGroupKey` alone | First-class `QuoteSection` |
|------|---------------------|----------------------------|
| Section titles & descriptions | String key only; no metadata | Rich section entity |
| Section totals | Not computed | Native rollup tier |
| Section discounts | Not supported | Discount inputs + persisted totals |
| Optional sections | No semantics | `optionalSection`, `includeInQuoteTotal` |
| Portal section opt-in | No stable section identity | `quoteSectionId` → expand to lines |
| PDF proposal structure | Flat list | Section headers + subtotals |
| Revision-safe rename | Key change breaks references | Section ID stable; title editable |
| Conversion by section | Not possible | Section IDs in conversion metadata |
| Approval audit | N/A | Section CRUD in activity timeline |

**Verdict:** `lineGroupKey` should be **retired in favor of `quoteSectionId`**, not extended.

---

## 3. Architecture options

### 3.1 Option A — Minimal: embedded sections on `Quote` (not recommended)

Store `sections: [{ key, title, order, discount… }]` as a Mixed/ subdocument array on `Quote`. Lines keep `lineGroupKey` pointing to `key`.

| Pros | Cons |
|------|------|
| Smallest schema surface | Sections tied to quote document size |
| No new collection | Revision clone must deep-copy embedded array + remap keys |
| | No independent section CRUD queries |
| | Weak portal/conversion references |
| | Fights first-class `QuoteLine` precedent |

**Use when:** Never for enterprise CPQ. Acceptable only as a 48-hour spike; do not ship.

### 3.2 Option B — Recommended: first-class `QuoteSection` collection

New Mongoose model scoped to `quoteId`, with stable `quoteSectionId` (UUID string, mirroring `quoteLineId`).

| Pros | Cons |
|------|------|
| Matches `QuoteLine` first-class pattern | New model, routes, UI state |
| Revision clone mirrors bundle remap | Migration from `lineGroupKey` |
| Independent CRUD + audit events | Totals engine grows one tier |
| Portal/conversion reference stable IDs | |
| Platform-reusable across apps | |

### 3.3 Option C — Ideal long-term: `QuoteSection` + nesting + templates

Option B plus:

- `parentSectionId` for one-level nesting (e.g. **Hardware → Servers**)
- Org-level **section templates** (Settings → Quotes → default proposal structure)
- Section-level tax jurisdiction (when tax engine ships)
- Process Designer triggers on section totals / optional section inclusion

**Recommendation:** Implement **Option B now**, schema-ready for Option C (`parentSectionId` nullable from day one).

---

## 4. Recommended domain model

### 4.1 `QuoteSection` (new)

```javascript
// server/models/QuoteSection.js
{
  organizationId,          // ObjectId, indexed
  quoteId,                 // ObjectId → Quote, indexed
  quoteSectionId,          // String UUID, unique, indexed (stable public id)

  sectionTitle,            // String, required, trim
  sectionDescription,      // String, optional (HTML or plain — match quote description pattern)
  sectionOrder,            // Number, default 0, indexed

  sectionType,             // enum: 'standard' | 'optional' | 'future'
                           // optional = customer opt-in group
                           // future = excluded from current totals, proposal narrative only

  includeInQuoteTotal,     // Boolean, default true
                           // For optional sections: agent can include/exclude from quote total
                           // before send (e.g. "priced in" vs "priced separately")

  parentSectionId,         // ObjectId → QuoteSection, default null (future nesting)

  // Section discount INPUTS (same semantics as line/global discounts)
  sectionDiscountType,     // 'percent' | 'amount' | null
  sectionDiscountValue,    // Number
  sectionDiscountAmount,   // Number (explicit override when > 0)

  // Section totals — PERSISTED snapshots (written by quoteTotalsService)
  sectionSubtotal,         // Σ included line lineSubtotal in section
  sectionLineDiscountTotal,// Σ line-level discounts in section
  sectionDiscountTotal,    // Section-level discount applied
  sectionTaxTotal,         // Σ line tax in section (0 until tax engine)
  sectionTotal,            // Net section total after section discount + tax

  // Presentation / export
  showSectionTotal,        // Boolean, default true (hide subtotal row for narrative-only sections)
  pageBreakBefore,         // Boolean, default false (PDF)

  lockedSnapshot,          // Boolean — set when quote commercially locked
  hiddenSection,           // Boolean, default false — omit from PDF/portal (internal grouping)

  createdAt, updatedAt
}
```

**Indexes:**

- `{ organizationId: 1, quoteId: 1, sectionOrder: 1 }`
- Unique `{ quoteSectionId: 1 }`
- `{ organizationId: 1, quoteId: 1, parentSectionId: 1 }` (future nesting)

### 4.2 `QuoteLine` changes

```javascript
// Add
quoteSectionId: { type: ObjectId, ref: 'QuoteSection', default: null, index: true }

// Deprecate (keep one release for read/migration)
lineGroupKey: { ... }  // stop writing; migration maps to QuoteSection
```

**Invariants:**

1. Every non-adjustment line SHOULD belong to a section (enforce soft-default: auto "General" section).
2. Bundle parent + all children MUST share the same `quoteSectionId`.
3. Moving a bundle parent moves the entire group.
4. `adjustment` lines may live in a dedicated section or quote-level only (recommend: allow section assignment for visibility).

### 4.3 `Quote` header — no structural change required

Existing quote-level totals remain authoritative for the document:

```
quote.subtotal        = Σ sectionTotal (included sections only)
quote.grandTotal      = quote.subtotal − globalDiscount + tax + adjustment
```

Optional: add `defaultSectionId` on quote for new lines — low priority.

### 4.4 `customerResponse` extension (portal-ready)

```javascript
customerResponse: {
  // existing fields…
  acceptedSectionIds: [String],   // quoteSectionId values (future portal UX)
  selectionMode: 'lines' | 'sections' | 'mixed',  // audit hint
  acceptedSectionSubtotal: Number // optional rollup for display
}
```

`acceptedLineIds` remains **canonical** for conversion. Section acceptance expands to line IDs server-side (same pattern as bundle parent → children).

---

## 5. Totals engine design

### 5.1 Computation hierarchy

```text
┌─────────────────────────────────────────────────────────────┐
│  Quote grandTotal                                           │
│    = Σ includedSection.sectionTotal                         │
│      − globalDiscount                                       │
│      + quote-level tax adjustments                          │
│      + adjustmentTotal                                      │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  QuoteSection.sectionTotal                                  │
│    = sectionSubtotal − sectionDiscountTotal + sectionTaxTotal│
│    where sectionSubtotal = Σ filterIncludedLines(line).subtotal│
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  QuoteLine.lineTotal (unchanged)                            │
│    = qty × unitPrice − lineDiscount + lineTax               │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Section inclusion rules

A section contributes to quote totals when **all** of:

| Rule | Condition |
|------|-----------|
| Not hidden | `hiddenSection !== true` |
| Included flag | `includeInQuoteTotal === true` |
| Type | `sectionType !== 'future'` (future sections are narrative-only, zero contribution) |
| Optional | `sectionType !== 'optional'` OR agent set `includeInQuoteTotal: true` |

**Note:** `optional` sections with `includeInQuoteTotal: false` appear on PDF/portal with subtotals but do **not** roll into quote `grandTotal` until customer accepts (portal) or agent toggles inclusion.

This differs from `optionalLine` on bundle components (within-bundle opt-in). Both can coexist:

- **Optional section** — entire commercial group (e.g. Premium Support)
- **Optional line** — component within a bundle

### 5.3 Persist vs compute — recommendation

| Field tier | Persist? | Rationale |
|------------|----------|-----------|
| Section discount **inputs** | **Yes** | Commercial terms; must survive recalculate |
| Section **computed totals** | **Yes** | Same pattern as `lineSubtotal` / `quote.subtotal`; PDF/portal/approval need stable numbers at send time |
| Section totals in API responses | Computed on write, read from DB | Avoid client-side drift |
| Live preview in UI | Compute client-side from lines | Optional optimistic display; server authoritative on save |

**Do not** compute section totals only in memory — enterprise CPQ persists rollups so sent PDFs, approval snapshots, and conversion metadata remain auditable even if line data is later corrected via revision.

### 5.4 `quoteTotalsService` extension

New exports:

```javascript
computeSectionTotals(section, linesInSection)
computeAllSectionTotals(sections, lines)
computeQuoteTotalsFromSections(sections, quoteDiscount)
recomputeQuoteAndSectionTotals(quoteId)  // orchestrator
```

**Order of operations:**

1. Recompute each line (`computeLineTotals`) — unchanged
2. Group lines by `quoteSectionId`; apply `filterIncludedLines` per section
3. Compute section subtotals + section discounts
4. Sum included sections → quote subtotal
5. Apply global discount → grand total
6. Persist section rows + quote header

**Triggers:** Same as today — any line add/patch/delete/reorder, section CRUD, section discount patch, bundle optional toggle, `POST /recalculate`.

### 5.5 Discount stacking order (locked)

```text
Line gross
  → line discount
  → line subtotal
    → section subtotal (sum of line subtotals)
      → section discount
      → section total
        → quote subtotal (sum of included section totals)
          → global discount
          → grand total
```

Global discount applies **after** section discounts (enterprise standard for proposal-level "customer discount"). Document this in API docs to prevent ambiguity.

---

## 6. Cross-cutting impact analysis

### 6.1 Revisions

**Current:** Clone quote header → clone lines (parents first, remap `parentBundleLineId`).

**Required change:**

1. Clone `QuoteSection` rows for source `quoteId` → new `quoteId`
2. Build `oldSectionId → newSectionId` map (Mongo `_id`) and `oldQuoteSectionId → newQuoteSectionId` map (UUID)
3. Clone lines with remapped `quoteSectionId` + existing bundle remap
4. Recompute section + quote totals on new revision

Section titles/descriptions/discounts copy forward; `lockedSnapshot: false` on new section rows.

**Revision-safe:** Yes — same clone-and-remap pattern as bundles.

### 6.2 Approvals

No workflow change. Approvals gate on quote status and `approvalLocked`; section edits respect the same locks:

| Lock state | Section CRUD | Section discount |
|------------|--------------|------------------|
| Draft / Approved (unlocked) | Allowed | Allowed |
| `approvalLocked` | Blocked | Blocked |
| Commercially locked (Sent+) | Blocked unless `overridePricing` | Blocked unless override |
| Record locked (Expired/Rejected/Cancelled/Converted) | Blocked | Blocked |

**Approval thresholds** (Process Designer on `grandTotal`) continue to work — section discounts flow into quote total before threshold evaluation.

**Approval-safe:** Yes.

### 6.3 Activity timeline

New activity actions (via `quoteActivityService`):

| Action | When |
|--------|------|
| `quote_section_created` | Section add |
| `quote_section_updated` | Title/description/type change |
| `quote_section_deleted` | Section remove (lines must move first or cascade to default) |
| `quote_section_discount_updated` | Section discount patch |
| `quote_line_section_moved` | Line reassigned between sections |

Include `quoteSectionId`, `sectionTitle` in `details` for readable timeline entries. Extend `quoteActivityUiAdapter.js`.

### 6.4 Documents / PDFs

**Current:** Flat "Lines" heading + table.

**Target structure:**

```text
[Quote header — unchanged]

── Hardware ──────────────────────────────
  [line rows]
                          Section Subtotal  $XX,XXX
                          Section Discount  ($X,XXX)
                          Section Total     $XX,XXX

── Professional Services ─────────────────
  [line rows]
                          Section Total     $XX,XXX

── Optional Add-ons ──────────────────────  (marked Optional)
  [line rows]
                          Section Total     $X,XXX  (may be excluded from doc total)

── Totals ────────────────────────────────
  Subtotal / Line discounts / Global discount / Tax / Grand Total
```

Implementation in `renderQuotePdf`:

- Accept `sections[]` sorted by `sectionOrder`
- Lines grouped by `quoteSectionId`; uncategorized → "General" or omit header
- Respect `showSectionTotal`, `hiddenSection`, `sectionType` labels
- Optional watermark/label for `optional` and `future` sections

**Template evolution:** Keep `templateId: 'default'`; add section-aware layout. Future: template metadata for section styling (org branding settings).

### 6.5 Conversion contracts

**Current:** `buildConversionMetadata` carries `acceptedLineIds`, `acceptedGrandTotal`.

**Extend metadata:**

```javascript
{
  acceptedLineIds: [...],           // canonical
  acceptedSectionIds: [...],        // denormalized for downstream SO modules
  sectionBreakdown: [{
    quoteSectionId, sectionTitle, sectionType,
    sectionTotal, lineCount, accepted
  }],
  acceptedGrandTotal
}
```

`resolveConversionTypeForQuote` unchanged (still line-driven partial vs full). Downstream Sales Order module can create SO line groups from section breakdown.

**Conversion-safe:** Yes — additive metadata; no schema coupling to target modules.

### 6.6 Portal interactions

**Phase 1 (with sections ship):**

- Group lines by section in `PublicQuoteView.vue`
- Section subtotal rows (read-only)
- Optional sections visually distinct (`sectionType: 'optional'`)
- Line-level partial accept **unchanged** (checkboxes per selectable line)

**Phase 2 (optional section acceptance — future):**

- Section-level checkbox: "Include Premium Support (+$X,XXX)"
- Expands to all selectable lines in section server-side
- Store `acceptedSectionIds` + derived `acceptedLineIds`
- Optional sections with `includeInQuoteTotal: false` excluded from portal total until selected

**Portal-ready:** Yes — stable `quoteSectionId` enables both phases without breaking existing line-level accept.

### 6.7 Bundle quote lines

**Rules (enforce in `quoteLineController`):**

| Operation | Rule |
|-----------|------|
| Add bundle | Assign parent + all children to target `quoteSectionId` |
| Move line to section | If bundle parent, move entire group |
| Move bundle component alone | Reject — must move parent |
| Section delete | Reject if contains lines; or move lines to default section first |
| Section totals | Sum using `filterIncludedLines` — same fixed/rollup/hidden rules as quote |
| Rollup bundle in optional section | Parent hidden in UI; components counted in section subtotal |

**Bundle-compatible:** Yes — section is orthogonal to bundle hierarchy; both use clone-and-remap on revision.

---

## 7. Optional sections & future customer acceptance

### 7.1 Section types

| `sectionType` | Quote totals | PDF | Portal | Customer accept |
|---------------|-------------|-----|--------|-----------------|
| `standard` | Included | Full display | Lines selectable | Line checkboxes |
| `optional` | Excluded unless `includeInQuoteTotal` | Marked "Optional" | Section opt-in (phase 2) | Section or line select |
| `future` | Never included | Narrative / roadmap pricing | Display only, not selectable | Not selectable |

### 7.2 Example mapping

```text
Hardware (standard)
  Servers
  Networking

Professional Services (standard)
  Implementation
  Training

Optional Add-ons (optional, includeInQuoteTotal: false)
  Premium Support

Future Expansion (future)
  Additional Licenses
```

### 7.3 Acceptance workflow evolution

```text
Today:     customer selects quoteLineIds → Accepted / Partially Accepted
Phase 2:   customer selects quoteSectionIds → expand to lines → same status machine
Future:    org policy "require optional section explicit opt-in" → reject full accept if optional unchecked
```

Partial acceptance totals (`sumAcceptedTotals`) should optionally apply section discounts for fully-accepted sections — compute from persisted section snapshots, not live re-aggregation, to match sent PDF.

---

## 8. API design

### 8.1 New routes

Mount under existing `/api/quotes/:id/sections`:

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/sections` | List sections for quote (ordered) |
| `POST` | `/sections` | Create section |
| `PATCH` | `/sections/:sectionId` | Update title, description, type, order, flags |
| `PATCH` | `/sections/:sectionId/discounts` | Section discount inputs |
| `PATCH` | `/sections/reorder` | Bulk `sectionOrder` update |
| `DELETE` | `/sections/:sectionId` | Delete empty section only |

`sectionId` param accepts Mongo `_id` or `quoteSectionId` (match line route pattern).

### 8.2 Modified routes

| Route | Change |
|-------|--------|
| `GET /quotes/:id` | Embed `sections[]` alongside `lines[]` |
| `POST /quotes/:id/lines` | Accept optional `quoteSectionId`; default to quote's default section |
| `POST /quotes/:id/bundles` | Accept optional `quoteSectionId` |
| `PATCH /quotes/:id/lines/:lineId` | Accept `quoteSectionId` (move line); enforce bundle rules |
| `PATCH /quotes/:id/lines/reorder` | Allow cross-section reorder → update `quoteSectionId` when section boundary crossed |
| `POST /quotes/:id/recalculate` | Recompute section + quote totals |
| `POST /quotes/:id/revise` | Clone sections + remap |
| `GET /api/public/quotes/:token/view` | Include `sections[]` |
| `POST /api/public/quotes/:token/accept` | Phase 2: accept `sectionIds[]` |

### 8.3 Response shape (record GET)

```javascript
{
  quote: { /* header totals unchanged */ },
  sections: [
    {
      quoteSectionId, sectionTitle, sectionOrder, sectionType,
      includeInQuoteTotal, showSectionTotal,
      sectionDiscountType, sectionDiscountValue,
      sectionSubtotal, sectionDiscountTotal, sectionTotal,
      lockedSnapshot
    }
  ],
  lines: [ /* each line includes quoteSectionId */ ],
  totals: { /* quote-level, unchanged keys */ }
}
```

### 8.4 Validation errors (new codes)

| Code | When |
|------|------|
| `SECTION_NOT_FOUND` | Invalid section reference |
| `SECTION_HAS_LINES` | Delete section with lines |
| `BUNDLE_SECTION_SPLIT` | Move component without parent |
| `SECTION_COMMERCIALLY_LOCKED` | Edit after Sent without override |
| `OPTIONAL_SECTION_REQUIRED` | Future portal policy (phase 2) |

---

## 9. UI design

### 9.1 Record page — lines section refactor

Evolve `QuoteLinesRecordSection.vue` from flat table to **section-grouped grid**:

```text
┌─ Lines ──────────────────── [+ Section] [+ Line] [+ Bundle] ─┐
│                                                               │
│  ▼ Hardware                                    [⋮]  $45,000   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ⠿ SKU   Name   Qty   Price   Discount   Total          │ │
│  │ ⠿ ...   Server ...                                      │ │
│  │ ⠿ ...   Switch ...                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│  Section discount: [ 5% ▼ ]          Section total: $42,750 │
│                                                               │
│  ▼ Optional Add-ons  (Optional)                [⋮]   $3,200   │
│  ☐ Include in quote total                                     │
│  ...                                                          │
│                                                               │
│  ── Quote totals panel (unchanged + section summary) ──      │
└───────────────────────────────────────────────────────────────┘
```

**Components (suggested split):**

| Component | Responsibility |
|-----------|----------------|
| `QuoteSectionsRecordSection.vue` | Orchestrator (replaces monolithic lines section) |
| `QuoteSectionBlock.vue` | Section header, collapse, subtotal, discount row |
| `QuoteSectionLinesTable.vue` | Lines table (extract from current) |
| `QuoteSectionFormModal.vue` | Create/edit section |
| `useQuoteSectionsSession.js` | Busy state, optimistic patches |

**Interactions:**

- Drag section headers → reorder sections (`PATCH /sections/reorder`)
- Drag lines within/between sections → update `lineOrder` + `quoteSectionId`
- Bundle groups move atomically (extend existing `buildOrdersFromVisibleSequence`)
- Collapse/expand per section (client-only state)
- Commercial lock / override lock — same as lines today

### 9.2 Portal

- Section headers with subtotals
- Optional badge on `optional` sections
- Phase 2: section checkbox with "select all lines in section"

### 9.3 Settings (optional, long-term)

Org-level **proposal section templates** — not required for initial ship; schema can add later.

---

## 10. Migration strategy

### 10.1 Data migration script

`server/scripts/migrateQuoteSections.js`:

1. For each quote with lines:
   - If any `lineGroupKey` values exist → create one `QuoteSection` per distinct key (title = key)
   - Else → create single **"General"** section (`sectionOrder: 0`)
2. Assign each line `quoteSectionId` from mapping
3. Run `recomputeQuoteAndSectionTotals` per quote
4. Log quotes migrated; do not delete `lineGroupKey` yet

### 10.2 Rollout phases

| Step | Action | Risk |
|------|--------|------|
| 1 | Deploy model + totals engine; migration script | Low — additive |
| 2 | API returns sections; UI still flat (feature flag) | Low |
| 3 | Enable section UI | Medium — UX change |
| 4 | PDF section layout | Low |
| 5 | Portal section grouping | Low |
| 6 | Stop writing `lineGroupKey`; deprecate in docs | Low |
| 7 | Remove `lineGroupKey` field (major version) | Breaking — schedule |

### 10.3 Backward compatibility

- `lineGroupKey` PATCH continues to work for one release → maps to find-or-create section by title
- Clients ignoring `sections[]` still function (lines unchanged)
- Quote totals remain on header — no client totals math required

### 10.4 New quote defaults

On `createQuote`:

- Auto-create **"General"** section OR apply org template sections (empty)
- New lines default to first section / General

---

## 11. Testing requirements

| Area | Tests |
|------|-------|
| Totals | Section subtotal, section discount, optional/future exclusion, global discount order |
| Bundles | Fixed/rollup in sections; move parent moves children |
| Revisions | Section clone + ID remap; totals match source |
| Portal | Section grouping in view payload; accept still line-canonical |
| PDF | Section headers render; hidden/future sections |
| Locks | Section edit blocked when commercially locked |
| Migration | lineGroupKey → section mapping; General fallback |

Extend `npm run test:quotes` — target 20+ new unit tests in `quoteSectionTotals.test.js`, `quoteSectionRevision.test.js`.

---

## 12. Implementation workstreams (not a new roadmap phase)

Cross-cutting slices, shippable independently:

| Workstream | Depends on | Delivers |
|------------|------------|----------|
| **S1 — Domain + totals** | — | Model, service, migration, tests |
| **S2 — API** | S1 | CRUD, embed in GET, revise clone |
| **S3 — Agent UI** | S2 | Section-grouped line grid |
| **S4 — PDF** | S1 | Section-aware default template |
| **S5 — Portal display** | S2 | Grouped public view |
| **S6 — Portal section accept** | S5 | Section opt-in (phase 2) |

Estimated effort: **S1–S4 ≈ 2–3 weeks** for enterprise MVP; **S5–S6 ≈ 1 week** additional.

---

## 13. Open decisions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Nested sections in MVP? | **No** — flat sections; `parentSectionId` reserved |
| 2 | Require all lines in a section? | **Soft yes** — auto "General" prevents orphans |
| 3 | Can `future` sections have discounts? | **No** — narrative only, zero totals |
| 4 | Section delete with lines? | **Block** — force move or reassign first |
| 5 | Global discount base | **Sum of section totals** (after section discounts) |
| 6 | Tax allocation | **Line-first**, roll up to section when tax engine ships |
| 7 | `adjustment` line type in sections? | **Allow** — useful for "Professional Services → Implementation credit" |

---

## 14. Summary recommendation

| Question | Answer |
|----------|--------|
| Is `lineGroupKey` sufficient? | **No.** Evolve to **`QuoteSection`** with **`quoteSectionId`** on lines. |
| Minimal vs ideal? | Ship **first-class sections + flat hierarchy** now; nest + templates later. |
| Persist section totals? | **Yes** — inputs + computed snapshots, same as lines/quote. |
| Optional sections? | **`sectionType: 'optional'`** + **`includeInQuoteTotal`**; portal section accept in phase 2. |
| Revision / approval / bundle / conversion / portal safe? | **Yes**, following existing clone-remap, lock, and stable-ID patterns. |

This design gives Arivu enterprise proposal structure without compromising the snapshot-based, platform-first architecture that Quotes Q0–Q9 established.

---

## Appendix A — Reference: current file touchpoints

| Layer | Files to modify |
|-------|-----------------|
| Models | `QuoteSection.js` (new), `QuoteLine.js`, `Quote.js` (customerResponse) |
| Services | `quoteTotalsService.js`, `quotePublicAcceptanceService.js`, `quoteConversionService.js`, `quoteActivityService.js` |
| Controllers | `quoteSectionController.js` (new), `quoteLineController.js`, `quoteController.js`, `quoteDocumentController.js`, `publicQuoteController.js` |
| Routes | `quoteRoutes.js` |
| Client | `QuoteLinesRecordSection.vue` → split, `quotesRecordAdapter.js`, `PublicQuoteView.vue`, `quoteActivityUiAdapter.js`, `quoteRecordPatch.js` |
| Tests | `server/utils/__tests__/quoteSection*.test.js` |
| Migration | `server/scripts/migrateQuoteSections.js` |
| Docs | Update `QUOTES_ROADMAP.md` §4.2 to reference this spec |

## Appendix B — Totals fixture example

```text
Hardware section:
  Line A: $10,000 (no line discount)
  Line B: $5,000 (10% line discount → $4,500)
  Section subtotal: $14,500
  Section discount: 5% → $725
  Section total: $13,775

Optional section (includeInQuoteTotal: false):
  Line C: $3,000
  Section total: $3,000 (excluded from quote subtotal)

Quote:
  Subtotal (included sections): $13,775
  Global discount: $500
  Grand total: $13,275
```
