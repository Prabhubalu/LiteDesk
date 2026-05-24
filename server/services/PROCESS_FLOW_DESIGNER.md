# Process Flow Designer — Product & Engineering Spec

**Status:** In progress (Phase 0–3 + ProcessDefinitionVersion; split/merge execution deferred)  
**Version:** 1.1  
**Date:** May 2026  
**Type:** Platform specification (client + server)

**Changelog (1.1):** Stable edge IDs, `executionPath`, `nodeSteps.durationMs`, optional node `meta`, future `ProcessDefinitionVersion` note, sentence-driven inspector UX.

---

## Related documents

| Document | Scope |
|----------|--------|
| `PROCESS_ENGINE_STEP_0.md` | Executor, graph model |
| `PROCESS_ENGINE_PHASE_2.md` | Behavior nodes (`field_rule`, etc.) |
| `PROCESS_ENGINE_PHASE_3.md` | Approvals, pause/resume |
| `PROCESS_DESIGNER_PHASE_4.md` | Original guided UI (superseded by this spec for editing UX) |
| `PROCESS_EDITOR_IMPLEMENTATION.md` | Rule-card editor (to be deprecated) |
| `EXECUTION_BOUNDARY_RULES.md` | Automation ↔ Process boundaries (locked) |

---

## 1. Purpose

Replace the rule-card / modal process editor with a **full-page visual flow designer** powered by a third-party canvas library. The canvas is not the product differentiator by itself—the differentiator is **operations-first automation**: CRM-native orchestration, human approvals, guardrails, and **explainability** (especially visual execution debugging).

### Product positioning

| Generic tools (e.g. n8n) | Arivu / LiteDesk |
|--------------------------|------------------|
| Technical-first | Operations-first |
| Integration-centric | Business-aware, CRM-native |
| “What ran?” | “Why didn’t my deal move stages?” |
| Power users | Admins and ops leads |

**Principle:** The canvas is the **explainability surface**. Value = safe orchestration + approvals + visual run replay.

---

## 2. Locked product decisions

| # | Decision |
|---|----------|
| 1 | **Canvas only** — no dual “rule cards” primary view. Deprecate `ProcessEditor.vue` modal as the default edit experience. |
| 2 | **v1 branching** — **IF nodes only**, with **true / false** outgoing edges (`edge.condition: true \| false`). No merge, switch, or parallel in v1. |
| 3 | **Full-page designer** — dedicated route, not a tab inside a modal. |
| 4 | **Phase 3 engine priorities** — (1) Wait/Delay → (2) Webhook trigger → (3) Parallelism only when customer demand justifies complexity. |

---

## 3. Current state (baseline)

### Implemented today

- **Data model:** `Process.nodes` + `Process.edges` + `process.trigger` (`server/models/Process.js`)
- **Executor:** Sequential graph walk with binary condition branching (`server/services/processExecutor.js`, `processNodeHandlers.js`)
- **Node types:** `trigger`, `condition`, `action`, `data_mapping`, `end`, `field_rule`, `ownership_rule`, `status_guard`, `approval_gate`
- **API:** CRUD, activate, duplicate, test, executions (`server/controllers/processController.js`)
- **UI:** Process list, creation wizard, rule-card `ProcessEditor`, execution logs modal, test modal
- **Approvals:** Inbox/detail (Phase 4C); `approval_gate` in engine but **not** in create/edit UI
- **Capability registry:** `getCapabilitiesForProcessDesigner()` — not wired into process UI

### Not implemented today

- **No third-party flow/canvas library** in `client/package.json` (no Vue Flow, React Flow, etc.)
- **View Flow** tab is a placeholder in `ProcessEditor.vue`
- **Rule reordering** is stubbed (`alert` only)
- **Per-node layout** (`x`, `y`) not stored
- **Per-node schema versioning** not stored
- **Stable edge `id`** not on `ProcessEdgeSchema` today (only `fromNodeId` / `toNodeId`)
- **`executionPath` / `nodeSteps`** not persisted on `ProcessExecution`
- **Execution overlay on graph** not built (logs are list/timeline only)

---

## 4. Technology choice — canvas library

### Selected: [Vue Flow](https://vueflow.dev/)

| Package (planned) | Role |
|-------------------|------|
| `@vue-flow/core` | Canvas, nodes, edges, handles |
| `@vue-flow/background` | Grid background |
| `@vue-flow/controls` | Zoom/fit controls |
| `@vue-flow/minimap` | Minimap |

**Rationale:** Vue 3 + Vite stack; maintained; n8n-like UX without embedding n8n (separate runtime, ops, licensing).

**Bundle strategy:** Lazy-load designer route so Settings and CRM lists stay lean.

**Not in scope:** Embedding n8n, React Flow, or a custom SVG engine for v1.

Optional later: `@vue-flow/node-resizer`, layout helper (e.g. `dagre`) for auto-tidy only—not required for Phase 0.

---

## 5. Architecture — single source of truth

```
┌─────────────────────────────────────────────────────────────┐
│ ProcessFlowDesigner (full page)                              │
│  Palette │ Vue Flow Canvas │ Node Inspector                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ PUT /api/admin/processes/:id
                           ▼
              Process { nodes, edges, trigger, layout }
                           │
                           ▼
              processExecutor / processInvocation
```

- **Runtime authority:** `Process.nodes` + `Process.edges` (each edge has stable `id` — see §8).
- **Presentation:** `node.layout { x, y }`; optional `node.meta` (not rendered in v1).
- **Evolution:** `node.version` (integer, per node) — see §8.
- **Run observability:** `executionPath` + `nodeSteps` (+ `durationMs`) on `ProcessExecution` — see §9.

Do **not** introduce a parallel workflow JSON format unless needed for import/export later.

### Deprecations

| Component | Action |
|-----------|--------|
| `ProcessEditor.vue` (modal, Rules tab) | Remove as default; redirect edit → designer route |
| Rule card list UX | Removed (canvas-only) |
| `ProcessCreationWizard.vue` | Optional: keep as “quick start” that generates a graph then redirects to designer—or remove in favor of empty canvas + trigger node |

---

## 6. Routes & navigation

| Route | Name | Purpose |
|-------|------|---------|
| `/settings/automation/processes` | (existing) | List processes |
| `/settings/automation/processes/new` | `process-designer-new` | New process → empty graph + trigger setup |
| `/settings/automation/processes/:id/design` | `process-designer` | Full-page designer (draft edit / active read-only) |

Redirect legacy `/control/processes` (already redirects to settings).

**Entry points:**

- Processes list → **Edit** → `/design`
- **New Process** → `/new` or `/design` with draft id after first save
- Execution logs → **Open in designer (replay mode)** with `?executionId=`

---

## 7. Screen layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Processes   Deal Approval Flow   [Draft]                        │
│ [Design ▾] [Run insight]   Test   Save   Activate   Executions   │
├──────────┬───────────────────────────────────────┬───────────────┤
│ Palette  │  Canvas (Vue Flow)                    │ Inspector     │
│          │  • Design: editable (draft)            │ • config form │
│          │  • Run insight: execution overlay     │ • version     │
│          │    green/blue/red/grey nodes          │ • failure msg │
│          │  minimap · zoom · tidy layout         │               │
└──────────┴───────────────────────────────────────┴───────────────┘
```

### Modes

| Mode | Draft | Active |
|------|-------|--------|
| **Design** | Full edit | Read-only + “Duplicate to edit” |
| **Run insight** | After test or when viewing an execution | Same overlay, no structural edits |

---

## 8. Data model — nodes, edges, versioning

### 8.1 Process nodes

Every node MUST include:

```javascript
{
  id: string,              // stable graph identity (UUID or prefixed slug)
  type: string,
  config: Mixed,
  version: number,         // config schema version, default 1
  layout: {                // canvas only
    x: number,
    y: number
  },
  meta: {                  // optional, v1: stored not rendered
    color: string | null,
    icon: string | null,
    notes: string | null,
    tags: string[]
  }
}
```

**`meta` policy:** Optional on all nodes. Designer does not expose UI in Phase 0–1. Reserved for future categorization, annotations, ownership hints, and in-canvas documentation. Omit or `{}` on save if unused.

### 8.2 Process edges — stable IDs (required)

Today edges are implied by `(fromNodeId, toNodeId, condition)` only. **Do not rely on composite keys** for overlays, analytics, or debugging.

Every edge MUST include:

```javascript
{
  id: string,              // required, stable (e.g. edge_<uuid>)
  fromNodeId: string,
  toNodeId: string,
  condition: true | false | null   // null = sequential; true/false = IF branches
}
```

**Why stable edge IDs:**

- Execution overlay: highlight **traversed edges** by `edgeId`
- Analytics: branch take rates (true vs false)
- Future: edge-level comments, annotations, SLA on transitions
- Avoid fragile keys like `` `${from}:${to}:${condition}` `` when graphs are edited

**Migration:** On first open in designer (or one-time script), assign `id` to legacy edges that lack it. Validator rejects saves without `id` after Phase 0.

**Vue Flow mapping:** `edge.id` ↔ `Process.edges[].id` (not generated per session).

### 8.3 Node config schema versioning

- Set `version: 1` on create (client + server default).
- Bump version when **config schema** for that `type` changes (not when label/copy changes).
- Executor dispatches by `(type, version)`; unknown version → fail at activate with clear error.
- **Activate validation:** block publish if any node has unsupported version.
- **UI:** Inspector shows subtle “Node schema v1”; migration banner when graph has outdated versions.

**Types that MUST be versioned from day one:** `action`, `approval_gate`, future `wait`, webhook trigger config.

Without versioning, integration and approval upgrades break customer workflows.

---

## 9. Execution observability (required with Phase 2)

Persist on every `ProcessExecution` (and test/dry-run executions). Low cost now; high leverage for replay, analytics, branch visualization, and performance analysis.

### 9.1 `executionPath`

Ordered list of node IDs actually visited:

```javascript
executionPath: ['trigger_1', 'condition_2', 'action_3', ...]
```

**Written when:** Each time the executor enters a node (append `nodeId`).

**Uses:**

- Replay animation on canvas (walk the path in order)
- Analytics: common paths, drop-off after IF false
- Debugging: “where did it stop?” without re-walking logs
- Branch visualization: compare path vs full graph
- Performance: correlate path length with outcomes

### 9.2 `nodeSteps`

Per-node audit (append-only):

```javascript
nodeSteps: [{
  nodeId: string,
  edgeId: string | null,     // edge taken *into* this node (null for trigger entry)
  status: 'completed' | 'failed' | 'skipped',
  startedAt: Date,
  endedAt: Date,
  durationMs: number,        // endedAt - startedAt; required when ended
  message: string,           // human-readable (ops language)
  technicalDetail: string | null
}]
```

**`durationMs` policy:**

- Set when step completes, fails, or is marked skipped.
- Wait/approval nodes: duration includes wall-clock wait until resume (valuable for SLA and bottleneck reports).
- Expose in graph-state API for inspector (“Ran for 1.2s”) and future SLA dashboards.

**Executor duty:** On node entry → push to `executionPath`; on node exit → append/update matching `nodeSteps` row with `durationMs`.

### 9.3 Skipped nodes

After terminal state (`completed` / `failed`), nodes not in `executionPath` → overlay `skipped`. Nodes in path but not executed (should not happen in v1 sequential model) → investigate.

### 9.4 `graph-state` API shape (Phase 2)

```
GET /api/admin/processes/:processId/executions/:executionId/graph-state
```

```javascript
{
  executionId: string,
  status: string,
  currentNodeId: string | null,
  executionPath: string[],
  nodes: {
    [nodeId]: {
      status: 'completed' | 'failed' | 'skipped' | 'running' | 'pending',
      message: string | null,
      durationMs: number | null,
      startedAt: string | null,
      endedAt: string | null
    }
  },
  edges: {
    [edgeId]: {
      traversed: boolean,
      durationMs: number | null   // optional: time on transition if measured
    }
  }
}
```

Derive `edges[edgeId].traversed` from `nodeSteps[].edgeId` and `executionPath` (do not use composite keys).

Test endpoint returns the same shape for immediate overlay after dry-run.

---

## 10. Canvas node catalog (v1)

| Palette label | `node.type` | Handles (v1) | Notes |
|---------------|-------------|----------------|-------|
| Trigger | `trigger` + `process.trigger` | 0 in, 1 out | One per flow; configures domain event / manual |
| IF | `condition` | 1 in, **2 out (True / False)** | Only branching primitive in v1 |
| Field rule | `field_rule` | 1 in, 1 out | |
| Ownership | `ownership_rule` | 1 in, 1 out | |
| Status guard | `status_guard` | 1 in, 1 out | |
| Approval | `approval_gate` | 1 in, 1 out | Pause/resume already in engine |
| Action | `action` | 1 in, 1 out | From execution capability registry |
| Map data | `data_mapping` | 1 in, 1 out | Optional in palette if config UI ready |
| End | `end` | 1 in, 0 out | |

### Edge rules (v1)

- Every edge has a unique `id` (§8.2).
- Default edge: `condition: null` (sequential).
- From `condition` node: exactly two edges with `condition: true` and `condition: false` (validator enforced on save).
- **No** parallel split, merge, or loops in v1 validator (acyclic graph required).

### New process flow (setup → designer)

1. **Setup screen** (`/settings/automation/processes/new`) — user picks **App**, **Module**, and **Starts when** (no defaults). Optional process name.
2. **Designer** — empty canvas; palette enabled because `triggerConfigured` is already true. Scope can be edited in Process settings.

Legacy drafts without `triggerConfigured` still see the in-designer trigger gate (banner, disabled palette).

### Core trigger model (Layer 1 UX)

The designer exposes **five** top-level “Starts when” options only. Business events (deal won, stage changed, lifecycle changed, etc.) are **not** top-level triggers — they belong in **IF** nodes or “Watch changes in” under **Record updated**.

| UX option | Stored `trigger.type` | Engine mapping |
|-----------|----------------------|----------------|
| Record created | `domain_event` | `eventType = '<module>.created'` |
| Record updated | `domain_event` | `eventType = '<module>.updated'` + optional `updateWatch` |
| Schedule | `schedule` | `trigger.schedule` (hourly / daily / weekly presets) |
| Webhook | `webhook` | `webhookKey` + secret |
| Manual | `manual` | no `eventType` |

Summary copy is business-readable (e.g. “Runs when a Deal is created”) — never `domain_event`, `eventType`, or cron strings in the UI.

Legacy granular `eventType` values (e.g. `deal.stage.changed`) are migrated to **Record updated** + inferred `updateWatch` on load.

### Trigger types (engine, by phase)

| Trigger | Status | Phase |
|---------|--------|-------|
| `domain_event` | Exists | v1 designer (record created / updated) |
| `manual` | Exists | v1 designer |
| `webhook` | Exists | Phase 3b+ |
| `schedule` | Schema + UX | Runner TBD |

---

## 11. Palette & actions — capability registry

Wire designer palette to:

```javascript
// server/utils/executionCapabilityRegistry.js
getCapabilitiesForProcessDesigner()
```

- Only capabilities with `discoverableBy` including `PROCESS_DESIGNER` and `executionType` `AUTOMATION` or `SYSTEM`.
- Inspector renders forms from capability metadata (no free-form JSON parameters in v1).
- Respect `EXECUTION_BOUNDARY_RULES.md`: process actions delegate to automation handlers; no nested automation rules.

**New API (planned):**

```
GET /api/admin/processes/designer-metadata
```

Returns: node type definitions, trigger options, capability list, allowed apps/modules, validation rules summary.

---

## 12. Graph validation (save & activate)

Extend `processController` validation:

1. At least one node; exactly one trigger path for `domain_event` / `webhook`.
2. Every edge has unique, non-empty `id`; all `fromNodeId` / `toNodeId` reference existing nodes.
3. `condition` nodes: two outgoing edges, one `true`, one `false` (distinct edge IDs).
4. Graph is **acyclic** (v1).
5. All nodes reachable from trigger/start.
6. Every node has `version >= 1` and supported `(type, version)` pair.
7. Draft-only: structural edits; active processes require duplicate → edit → republish (unchanged policy).

Return structured errors for canvas highlighting:

```javascript
{ valid: false, errors: [{ nodeId?, edgeId?, code, message }] }
```

---

## 13. Client components (planned)

| File | Responsibility |
|------|----------------|
| `client/src/views/admin/ProcessFlowDesigner.vue` | Full-page shell, modes, header actions |
| `client/src/components/process-flow/ProcessFlowCanvas.vue` | Vue Flow wrapper |
| `client/src/components/process-flow/ProcessNodePalette.vue` | Drag sources |
| `client/src/components/process-flow/ProcessNodeInspector.vue` | Config forms + sentence preview |
| `client/src/components/process-flow/nodes/*.vue` | Custom node chrome |
| `client/src/composables/useProcessGraph.ts` | `processToFlow`, `flowToProcess`, validate locally |
| `client/src/composables/useProcessExecutionOverlay.ts` | Map `graph-state` → node/edge styles via `executionPath` |
| `client/src/utils/processSentenceBuilder.ts` | Human-readable summaries from node config |

Reuse/refactor logic from:

- `RuleEditPanel.vue` → inspector field sets (behind sentence layer)
- `ProcessTestModal.vue` → test + overlay entry
- `ProcessExecutionLogs.vue` → execution picker for replay
- `process/TimelineItem.vue` → copy for inspector failure detail

### 13.1 Sentence-driven inspector (UX requirement)

The inspector is **operations-first**: admins edit structured fields, but always see a **live plain-language sentence**—not raw operator keys.

**Bad (technical):**

```
Operator: GTE
Field: dealValue
Value: 1000000
```

**Good (sentence):**

```
When Deal Value is greater than ₹10,00,000
```

**Implementation:**

- Top of inspector: **preview card** with generated sentence (updates on every field change).
- Below: compact form controls (dropdowns for field/operator where module metadata exists).
- `processSentenceBuilder.ts` per `node.type`:
  - `condition` → “When {fieldLabel} {operatorPhrase} {formattedValue}”
  - `field_rule` → “Make {field} mandatory when …”
  - `action` → “Create task: {title}” / capability display names
  - `approval_gate` → “Require approval from {role} before continuing”
- Use org locale/currency for money fields; field labels from module definitions, not raw keys.
- Run insight mode: show `nodeSteps.message` and `durationMs` in same sentence style (“Failed after 0.4s: Stage change blocked…”).

This drives **admin confidence, readability, and operational trust**—core to beating technical-first tools.

---

## 14. Execution visualization (Phase 2 — killer feature)

### Goal

Answer on the canvas: **“Why didn’t my deal move stages?”**

Overlay per-node and per-edge state for a selected `ProcessExecution` (or test run), backed by §9 (`executionPath`, `nodeSteps`, stable `edge.id`).

### Visual language

| State | Node | Edge |
|-------|------|------|
| `completed` | Green border, check icon | Solid green if `edgeId` traversed |
| `running` | Blue pulse | Blue on active edge |
| `failed` | Red border; click → sentence in inspector | Red along traversed path to failure |
| `skipped` | Grey, muted | Dashed grey (not in `executionPath`) |
| `pending` / not reached | Default theme | — |

**Replay:** Optional “Play path” animates along `executionPath` in order (future polish; data ready in v1).

Copy must be **operations language** (see §13.1), not stack traces by default.

### UX entry points

- Designer header: **Run insight** + execution dropdown (last 10 runs).
- Test run → auto-switch to Run insight with overlay (`graph-state` from §9.4).
- Processes list: “Debug last run” → designer with `?executionId=`.

---

## 15. Implementation phases

### Phase 0 — Foundation (1–2 weeks)

- [ ] Add `@vue-flow/core` (+ background, controls, minimap).
- [ ] Schema: `layout`, `version`, optional `meta` on nodes; **`id` on edges** (`server/models/Process.js`).
- [ ] Migrate legacy edges: assign `id` on load/save.
- [ ] Routes: `/processes/:id/design`, `/processes/new`.
- [ ] `useProcessGraph`: read-only `processToFlow` (Vue Flow `edge.id` ↔ `Process.edges[].id`).
- [ ] Auto-layout for processes without coordinates.
- [ ] Full-page shell; no edit yet (or minimal pan/zoom only).

**Exit:** Every existing process renders on canvas with stable edge IDs.

---

### Phase 1 — Editable canvas MVP (3–4 weeks)

- [ ] Palette: drag, connect, delete nodes.
- [ ] IF node: True/False handles only.
- [ ] Inspector for all v1 node types including `approval_gate` + **sentence preview** (§13.1).
- [ ] `processSentenceBuilder.ts` for condition, rules, actions, approval.
- [ ] Palette actions from `designer-metadata` / capability registry.
- [ ] Save draft + validation errors on nodes.
- [ ] Activate / duplicate / archive flows unchanged.
- [ ] Deprecate modal `ProcessEditor` as default.
- [ ] Test button (existing API); timeline panel (overlay in Phase 2).

**Exit:** New processes created and edited only on canvas.

---

### Phase 2 — Execution visualization (2–3 weeks)

- [ ] Executor writes `executionPath` + `nodeSteps` (with `durationMs`, `edgeId`) on every run.
- [ ] `GET .../graph-state` API (§9.4); test endpoint returns same shape.
- [ ] Run insight mode + overlay on nodes and **edges by `edgeId`**.
- [ ] Inspector: sentence + `durationMs` on node click in replay mode.
- [ ] Record search in test setup (replace raw ID-only input).

**Exit:** Support can debug a failed run visually in &lt; 1 minute; path replay data exists for analytics later.

---

### Phase 3a — Wait / Delay (Priority 1) — implemented

**Business value:** Remind after 2 days, escalate after 24h, follow-up after 1 week.

**New node:**

```javascript
{
  type: 'wait',
  version: 1,
  config: {
    duration: Number,
    unit: 'minutes' | 'hours' | 'days'
  }
}
```

**Engine:**

- On `wait`: set execution `status: 'waiting_until'`, store `resumeAt` + `pausedNodeId`; `processWaitResumeSchedulerService` cron resumes due runs.
- Worker resumes → continue from single outgoing edge.
- Idempotent resume per `executionId` + `nodeId`.

**Execution overlay:** scheduled = blue; resumed past = green.

**Copy:** “Wait 2 days” not “delay node”.

---

### Phase 3b — Webhook trigger (Priority 2) — implemented

**Unlock:** External systems, custom integrations, inbound events.

```javascript
trigger: {
  type: 'webhook',
  webhookKey: string,
  secretHash: string,
  version: 1
}
```

- `POST /api/hooks/process/:webhookKey` — tenant routed via `{orgId}_` key prefix; Bearer secret (+ optional HMAC); rate limited.
- Designer: webhook URL, rotate secret, payload → `dataBag` mapping on `process.trigger.payloadMapping`.

---

### Phase 3c — Parallelism (Priority 3) — v1 validator implemented

**v1 (done):** Save/activate validation + designer connection guards:

- Non-IF steps: at most **one outgoing** and **one incoming** edge
- IF steps: only **Yes/No** handles; max two branches
- **Acyclic** graph; all steps **reachable** from start
- End: no outgoing; Trigger: no incoming

**Deferred (demand-gated):** `split` / `merge` node types, forked execution tokens, parallel run-insight overlay.

---

## 16. API summary

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/processes/designer-metadata` | Palette + validation hints |
| GET | `/api/admin/processes/:id` | Include `layout`, `version` per node |
| PUT | `/api/admin/processes/:id` | Graph + layout + edge IDs; structured errors |
| POST | `/api/admin/processes/:id/test` | Returns `executionId` + `graph-state` (Phase 2) |
| GET | `/api/admin/processes/:id/executions` | Existing |
| GET | `/api/admin/processes/:id/executions/:executionId/graph-state` | Phase 2 overlay |
| POST | `/api/hooks/process/:webhookKey` | Phase 3b |

---

## 17. Non-goals (v1)

- Parallel split/merge
- Loops / iteration nodes
- Arbitrary code nodes
- n8n-compatible import/export
- Full email/webhook **action** catalog beyond capability registry
- Business Flow meta-canvas as executable graph (see `BusinessFlow` — documentation layer only for now)

---

## 18. Success metrics

| Metric | Target |
|--------|--------|
| Time to answer “why didn’t X happen?” | Down (support + self-serve) |
| Processes edited on canvas vs abandoned create | ↑ |
| Test + Run insight before activate | ↑ |
| Failed-node inspector opens | Track clicks |

---

## 19. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Canvas vs engine drift | Single `useProcessGraph`; one save pipeline |
| Invalid graphs published | Server validation + inline node/edge errors |
| Bundle size | Route-level code split |
| Breaking action configs | Node `version` + migrate on open |
| Edge identity drift | Stable `edge.id`; never composite keys in APIs |
| Replay wrong after edit | Plan for `ProcessDefinitionVersion` (§20); until then, warn if process graph changed since execution |
| Parallel scope creep | Explicitly deferred to Phase 3c |

---

## 20. `ProcessDefinitionVersion` — implemented

**Problem:** Executions referenced the live mutable process document, so replay/debug could show the wrong graph after edits.

**Implemented:**

```javascript
ProcessDefinitionVersion {
  processId: ObjectId,
  versionNumber: number,
  snapshot: { nodes, edges, trigger },  // immutable
  publishedAt: Date,
  publishedBy: ObjectId
}

ProcessExecution {
  processId: ObjectId,
  processDefinitionVersionId: ObjectId,  // bind at start
  executionPath: [...],
  nodeSteps: [...]
}
```

**Rules:**

- **Activate** creates a new `ProcessDefinitionVersion` snapshot; bumps `process.version` (publish counter, distinct from per-node `version`); sets `process.activeDefinitionVersionId`.
- New runs bind `processDefinitionVersionId` + `processDefinitionVersionNumber` on `ProcessExecution`.
- Resume / wait / approval continue on the execution’s published snapshot.
- **Run insight** returns `processGraph` from the execution’s version + `newerVersionAvailable` when a later publish exists.
- **Simulate test** still uses the current draft graph (pre-publish validation).
- Legacy runs without `processDefinitionVersionId` fall back to the live process document graph.

---

## 21. Open questions

1. Keep `ProcessCreationWizard` as quick-start generator or remove entirely?
2. `data_mapping` in v1 palette or Phase 1.1?
3. Store `nodeSteps` embedded on `ProcessExecution` vs separate collection (volume/retention)?
4. Business hours aware waits in 3a or 3a.1?
5. Expose `node.meta` in designer UI — which phase?

---

## 22. Acceptance criteria (release-ready designer)

- [ ] Admin can create/edit a draft process entirely on full-page canvas.
- [ ] IF node only branches true/false; validator rejects invalid graphs.
- [ ] Every edge has stable `id`; overlay uses `edgeId`, not composite keys.
- [ ] Active process opens read-only; duplicate → edit works.
- [ ] All nodes saved with `version: 1`, `layout`, and optional `meta`.
- [ ] Inspector shows **sentence preview** for every editable node type (§13.1).
- [ ] Actions limited to capability registry entries.
- [ ] Run insight uses `executionPath` + `nodeSteps` with `durationMs` on overlay.
- [ ] Traversed edges highlighted by `edge.id`; skipped branches greyed.
- [ ] Failed node click shows human-readable sentence + duration in inspector.
- [ ] No dependency on rule-card modal for edit path.

---

*This spec supersedes the “View Flow placeholder” and rule-card-primary UX described in `PROCESS_EDITOR_IMPLEMENTATION.md` for net-new work. Engine contracts in `EXECUTION_BOUNDARY_RULES.md` remain locked.*
