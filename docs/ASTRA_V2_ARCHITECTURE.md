# Astra v2 — AI Platform Architecture (Source of Truth)

> **Product = Arivu** (the CRM users work in).
> **Platform = Astra** (the AI layer/coworker embedded in Arivu).
>
> This document is the **active** source of truth for the AI platform runtime.
> For the **agent/tool roadmap, OOTB App×Module coverage, and workforce execution plan**, see
> [`ASTRA_AGENT_TOOL_CATALOG.md`](./ASTRA_AGENT_TOOL_CATALOG.md).
> The legacy implementation under `server/services/ai/` is in **cutover** and will
> be removed once every surface is migrated (see [Cutover](#cutover--legacy)).

---

## 1. Design goals

1. **Clean-slate, layered platform** — one predictable pipeline, no tangle of
   ad-hoc services.
2. **Grounded by construction** — Astra never states a CRM fact that did not
   come from a tool result. The LLM only *rephrases* a deterministic draft.
3. **Governed** — every turn passes through risk, audit, credits, and PII
   governance. Writes/destructive actions require explicit confirmation.
4. **Tenant-safe** — every data access is scoped to `organizationId` and
   excludes soft-deleted rows (`deletedAt: null`).
5. **Reuse, don't rebuild** — provider access, settings, PII, credits, audit,
   and the vector store are reused from the existing, hardened `ai/` primitives.

---

## 2. The pipeline

```
          ┌──────────────────────────────────────────────────────────┐
Request → │  Context  →  Orchestrator  →  Agents  →  Tools  →  Models  │ → Answer
          └──────────────────────────────────────────────────────────┘
                 ▲               ▲            ▲          ▲         ▲
                 └───── Governance (risk · audit · credits · pii · confirm) ─────┘
                 └───── Memory (personal · org · session) ──────────────────────┘
```

### Context (`context/`)
- `contextPacket.js` — the normalized, testable context object every layer reads
  (org, user, surface, focus record, query, history, memory, locale, now).
- `contextEngine.js` — hydrates the packet with personal + org memory
  (best-effort; a memory outage never blocks an answer).

### Orchestrator (`orchestrator/runOrchestrator.js`)
`intent → tool(s) → grounded answer → LLM polish`
- **Intent** — coarse classifier: `crm_search | knowledge | workflow | chitchat`.
  A strong how-to phrase ("how do I configure…") outranks incidental CRM nouns.
- **Tools** — selects and runs the tool for the intent.
- **Grounded answer** — deterministic draft + `claims[]` derived **only** from
  tool results.
- **Status brief** — for “status / about / details of X” on a resolved org,
  deal, or person, `buildRecordStatusBrief` pulls related open deals, cases,
  tasks, and people; the LLM narrates a 2–4 sentence readout (still grounded).
- **Email draft** — “draft/write an email…” routes to `email_draft` (not CRM
  search). Uses chat focus (e.g. named deal) + returns an `email.send`
  confirmation proposal.
- **LLM polish** — rephrases the draft in a coworker voice. **Override rule:**
  if hits exist but the polished text drops *every* grounded claim, the polished
  text is rejected and the grounded draft is surfaced. The model can never erase
  or invent facts.

### Agents (`agents/`)
- `agentRegistry.js` — catalog of capability profiles (tool allow-list + system
  hint + autonomy level).
- `builtinAgents.js` — shipped agents: `coworker`, `crm-analyst`,
  `inbox-assistant`.
- `workflowAgent.js` — runs an ordered list of tool steps as one unit; halts on
  a write tool until confirmed.
- `customAgentMigration.js` — maps legacy `AiTenantAgent` docs → v2 agent specs.

### Tools (`tools/`)
- `toolRegistry.js` — idempotent registry; a tool is
  `{ name, family, risk, description, run(input, ctx) }`.
- `families/index.js` — the hardened production tool surface and
  `planCrmSearch`.

Families: `search.crm`, `crm.deals`, `crm.cases`, `crm.people`,
`crm.tasks`, `crm.events`, `knowledge.search`, `email.draft`, `email.send`,
`calendar.createEvent`, `reports.run`, `workflow.run`.

**Module catalog** (`tools/moduleCatalog.js`) is the SoT for which platform
modules Astra can list/search. Seed-aligned module keys are classified
`ready` (model-backed) or `unsupported` (honest empty — never deals fallback).

**`search.crm` invariants**
- Never regexes the full user sentence against a record name.
- A name term is extracted **only** from quotes or after `named/called/titled`.
- `planCrmSearch` returns `{ entity, listIntent, openOnly, overdueOnly, searchTerm,
  filter, sort, unsupported, guidance }`; the filter is always scoped to
  `organizationId` and `deletedAt: null` when supported.
- Entity detection covers all catalog modules (tasks/events/orgs/quotes/… win
  over the deals default when those synonyms appear).
- Deals default to **open pipeline** on a bare list request unless won/lost/closed
  or a named record.
- Tasks: incomplete by default; `overdue` / `today` date filters.
- Events: `today` or upcoming Planned.
- **Field contract:** primary title + status/subtitle fields only — tenant
  custom fields are not NL-queryable in Astra v2.

### Models (`models/`)
- `modelRouter.js` — the only path to providers. Composes
  `ai/providerRegistry` + `ai/aiSettingsResolver` + `ai/vector/vectorStoreRegistry`.
  Implements `LlmPort` + `EmbeddingPort` and exposes the `VectorStorePort`.
- `ports/*.js` — JSDoc typedefs only (`llmPort`, `embeddingPort`,
  `vectorStorePort`).

### Governance (`governance/`)
- `risk.js` — `read | write | destructive`; anything above `read` needs
  confirmation.
- `audit.js` — reuses `writeAiAuditLog`.
- `credits.js` — reuses `assertCreditsAvailable` / `debitCredits`.
- `pii.js` — reuses `redactText` / `redactMessages`.
- `confirmAction.js` — builds the confirmation contract replayed on approval.

### Memory (`memory/`)
- `personalMemoryService.js` → `AstraPersonalMemory` (per-user, durable).
- `orgMemoryService.js` → `AstraOrgMemory` (shared org grounding/glossary).
- `sessionMemory.js` — ephemeral in-process conversation buffer.

### Autonomous (`autonomous/autonomousService.js`)
Goals (`AstraGoal`) + Next-Best-Action (grounded, tool-backed cards) + per-
surface contracts (`home`, `deals`, `inbox`).

### Experience (`experience/sse.js`)
Framework-agnostic Server-Sent Events helpers for streaming turns.

---

## 3. Data models

| Model | Scope | Purpose |
| --- | --- | --- |
| `AstraPersonalMemory` | org + user (unique) | durable coworker prefs + facts |
| `AstraOrgMemory` | org + scope + key (unique) | shared grounding/glossary/playbooks |
| `AstraGoal` | org (+ optional user) | autonomous objectives + progress |

All three use `wrapTenantModel` for tenant-connection routing.

---

## 4. HTTP surface

Mounted at **`/api/ai/v2`** (next to legacy `/api/ai`), guarded by
`requireAstraV2AccessMiddleware` — **no non-production bypass**.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/status` | flags + registered tools/agents |
| POST | `/ask` | run a turn |
| GET | `/ask/stream` | SSE turn |
| GET | `/tools`, `/agents` | catalogs |
| GET | `/next-best-actions` | autonomous cards |
| GET/POST/PUT | `/goals` | goal CRUD |
| GET/PUT | `/memory` | personal + org memory |

---

## 5. Flags

| Env | Default | Meaning |
| --- | --- | --- |
| `ASTRA_V2` | `true` | master switch for the v2 platform |
| `ASTRA_V2_SHADOW` | `false` | run v2 for comparison but surface legacy |

`compat/cutover.js` reads these to decide the engine per request.

---

## 6. Cutover & legacy

- Legacy AI lives at `server/services/ai/` and is **not deleted yet**.
- `compat/legacyMap.js` maps every legacy ability/service to its v2 owner.
- `compat/deprecationMap.js` tracks status
  (`active | shadowed | deprecated | removable`) and lists **protected** legacy
  modules that v2 reuses and must survive deletion
  (`providerRegistry`, `aiSettingsResolver`, `piiRedaction`, `aiCreditService`,
  `aiAuditLogService`, `vector/*`).
- Removal of the rest of `server/services/ai/` happens in a follow-up once all
  surfaces are migrated.

---

## 7. Testing

`node --test server/services/astra/eval/__tests__/astraV2.test.js`

Covers: bootstrap idempotency, the golden intent set (including "list open
deals"), `planCrmSearch` hardening, grounded answer + LLM override, `search.crm`
grounding, and workflow execution/confirmation.

Golden set lives in `eval/goldenIntent.js` — regressions there fail CI.
