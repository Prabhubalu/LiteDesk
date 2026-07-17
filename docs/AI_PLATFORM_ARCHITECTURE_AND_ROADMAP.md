# Arivu AI Platform — Architecture & End-to-End Roadmap

> **Status:** Phase 0–4 complete for roadmap abilities (commercial/collection agents included as propose-only); GA hardening + eval regression remain ongoing  
> **Owner:** Platform  
> **Created:** 2026-07-16  
> **Updated:** 2026-07-17  
> **Related:** `Architecture_Document.md` (platform SoT), `docs/architecture/documents-module-roadmap.md` (existing OCR/semantic), `docs/USER_ONBOARDING_ARCHITECTURE.md`

---

## 0. Product Thesis

Do **not** ship a generic "ChatGPT in CRM." Ship **tenant-aware, cross-app AI that understands Arivu's commercial + service graph** — Deal → Quote → SalesOrder → Invoice → Payment, plus Cases/SLA, Documents/KB, Mailroom/Inbox, Marketing, Inventory.

**Market story:**

> *"Arivu AI drafts quotes from deal intent, explains what's missing before conversion, and answers from your documents — while staying inside your approvals, SLA, and permissions."*

This story is only possible because Arivu already owns: DealLines → commercial conversion chain, Documents OCR + semantic index, Mailroom threading, multi-app RBAC/Profiles/sharing, SLA + Process/Approval engines.

### Positioning tiers

| Tier | What | Role |
|------|------|------|
| **A — Signature** | Commercial Copilot, Revenue→Cash intelligence, unified work-graph Q&A, policy-aware assist, audit narratives | Differentiation — lead marketing with these |
| **B — Parity** | Draft/rewrite/summarize/translate, field extraction, next-best-action, NL analytics, import mapping | Expected — must feel excellent |
| **C — Hygiene** | Grammar, subjects, tone | Never lead with these |

---

## 1. Current State (baseline, already shipped)

| Capability | Location | Status |
|------------|----------|--------|
| Document OCR index | `documentOcrIndexService` + hourly scheduler + backfill script | Shipped |
| Document semantic search | 128-dim **hash** embeddings on `Document.searchEmbedding`; `GET /documents/search/semantic`; JS cosine in-process | Shipped — not real embeddings |
| Platform Home focus | `platformHomeFocusService` — rule-based, explicitly **no LLM** | Shipped — keep as deterministic fallback |
| Realtime | SSE hubs (notifications, inbox, data-changes) | Reuse for AI streaming |
| Async | Bull + Redis queues (`email`, `inbound`, `import`, `analytics`, `campaignSend`) | Reuse pattern for AI jobs |
| Addons | `ADDON_KEYS` (`live_chat`, `email_credits`, `articles`, `blog`) + `AddonDefinition` + `TenantAddonConfiguration` | Reuse pattern for AI billing |

**No `/api/ai` spine exists.** Everything below builds it once, then reuses it everywhere.

---

## 2. Architecture

### 2.1 Topology decision (locked)

- **Same Node server.** `/api/ai/*` mounts in `server/server.js`; AI code lives in `server/services/ai/`.
- **No AI microservice.** Tenant isolation (`tenantContext`, `wrapTenantModel`), permissions (Role/Profile/sharing), and context builders live in-process — duplicating them in another service would create drift and a new leak surface.
- **Runtime split via existing pattern:** short inline calls run in the web process (streamed over SSE); long/expensive work goes through Bull (existing `worker.js` first; a dedicated AI worker deployment only when metrics force it — same repo, same codebase).
- **Extraction triggers** (only if measured): web latency degradation under AI load, embedding backfills starving requests, provider timeouts affecting Express.

```
UI (composer / record actions / command palette / portal Ask)
  → POST /api/ai/*  (protect → resolveAppContext → requireAppEntitlement
                     → organizationIsolation → requirePermission → AI addon gate)
      → context builders (record + relationships + threads + docs; organizationId ALWAYS)
      → orchestrator (prompt assembly + RAG + allowlisted tools)
      → LlmPort / EmbeddingPort (provider adapters)
      → sync: SSE token stream (inbox hub pattern)
      → async: Bull queue `ai-jobs` → worker
      → AiAuditLog (who, org, records, prompt version, model, tokens, outcome)
```

### 2.2 Ports & adapters (future-proofing core)

Nothing above the ports may import a provider SDK or the Atlas driver directly.

```
server/services/ai/
├── ports/
│   ├── llmPort            # complete(), stream()
│   ├── embeddingPort      # embed(texts[]) → vectors[]
│   └── vectorStorePort    # upsert(), deleteBySource(), search()
├── adapters/
│   ├── openaiLlmAdapter           # default (Phase 0)
│   ├── azureOpenAiLlmAdapter      # Phase 0/1 — enterprise BYOK
│   ├── anthropicLlmAdapter        # Phase 1 — Claude
│   ├── googleGeminiLlmAdapter     # Phase 1/2 — Gemini
│   ├── openaiEmbeddingAdapter     # default embeddings
│   ├── (voyage / azure embedding) # optional when LLM ≠ OpenAI family
│   ├── atlasVectorStore           # launch backend
│   ├── inMemoryVectorStore        # tests
│   └── (qdrantVectorStore)        # Stage-3 escape hatch
├── context/               # per-surface context builders
├── orchestrator/          # prompt assembly, RAG, tool loop
├── tools/                 # allowlisted server tools (read + draft)
├── prompts/               # versioned prompt artifacts (never inline strings)
└── audit/                 # AiAuditLog service
```

Config: `AI_VECTOR_STORE=atlas|mongo|memory|qdrant`, `AI_ATLAS_VECTOR_INDEX=ai_vector_chunks_embedding`, `AI_DEFAULT_LLM_PROVIDER=openai`, per-ability model config (small model for classify/route, larger for generate), BYOK vs platform key per org.

### 2.2.1 LLM & embedding providers (locked)

**Default platform provider: OpenAI.** Tenants may select other popular providers via org AI settings (platform key or BYOK). Product code always talks to `LlmPort` / `EmbeddingPort` — never to a vendor SDK directly.

| Provider | Role | Phase | Notes |
|----------|------|-------|-------|
| **OpenAI** | Default LLM + embeddings | **0** | Platform default; `gpt-4o-mini` (classify/route), `gpt-4o` (generate/agents), `text-embedding-3-small` |
| **Azure OpenAI** | Same model family, enterprise region/BYOK | **0–1** | Preferred for EU/compliance BYOK; same adapter contract as OpenAI |
| **Anthropic** | Claude for generate/agents | **1** | Strong for long-context agents; embeddings still via OpenAI/Voyage unless tenant configures otherwise |
| **Google Gemini** | Alternate generate/classify | **1–2** | Popular BYOK option |
| **OpenRouter** | Unified LLM + embeddings gateway | **0** | OpenAI-compatible; model ids are provider-prefixed (`openai/gpt-4o`) |
| **AWS Bedrock** (optional) | Enterprise multi-model | **2+** | Only if demand; wraps Claude/Titan/etc. behind same ports |

**Org AI settings (per tenant):**

| Field | Purpose |
|-------|---------|
| `enabled` | Master AI on/off (middleware gate) |
| `llmProvider` | `openai` \| `azure_openai` \| `anthropic` \| `gemini` \| `openrouter` \| (`bedrock`) |
| `embeddingProvider` | Defaults to OpenAI; auto-aligns to OpenRouter when LLM is OpenRouter; may differ for Anthropic/Gemini |
| `keyMode` | `platform` (Arivu key + **`ai_credits`**) \| `byok` (tenant key, **no credit debit**) |
| `apiKey` / Azure resource fields | Encrypted at rest when BYOK |
| `region` | Where applicable (Azure region, etc.) |
| `modelOverrides` | Optional per-ability model ids |
| `dataUseConsent` | Required before enable |

**Resolution order:** ability override → org `modelOverrides` → org provider defaults → platform defaults (`AI_DEFAULT_LLM_PROVIDER`).

**Rules:**

1. New tenants default to **OpenAI + platform key** (lowest friction).
2. Changing LLM provider does **not** require re-embedding unless `embeddingProvider` / `embeddingModel` also changes (then bump `embeddingVersion` + backfill).
3. Unsupported provider = `NOT_CONFIGURED` empty state, not a hard crash.
4. `AiAuditLog` always records `provider` + `model` + `keyMode`.

### 2.3 Vector store strategy (locked: Atlas first)

**Decision: MongoDB Atlas Vector Search** — same data plane, same `organizationId` tenancy, index lives with tenant data, no new infra. External store (prefer **Qdrant** over Pinecone) only as a measured Stage-3 escape hatch.

**Canonical chunk model** (index chunks, not whole documents — stored in Mongo regardless of where vectors live later):

| Field | Purpose |
|-------|---------|
| `organizationId` | Tenant wall — required on every write and search |
| `sourceType` | `document` \| `article` \| `case` \| `email` … |
| `sourceId`, `chunkId`, `chunkIndex` | Parent linkage, idempotent upsert, ordering |
| `text` | Citations / prompt injection |
| `embedding` | Vector |
| `embeddingModel`, `embeddingVersion` | Model swap = bump version + backfill job |
| `appKey`, `moduleKey` | Retrieval scoping |
| `updatedAt` | Staleness detection |

**Growth path (ops decision with metrics, never a rewrite):**

```
Stage 0  Hash embeddings + JS cosine            ← shipped today
Stage 1  Real embeddings + Atlas Vector Search  ← launch target
Stage 2  Chunking, caching, model tiering       ← scale on Atlas
Stage 3  Qdrant adapter behind VectorStorePort  ← only if p95 latency/cost/Mongo load force it
```

Cutover discipline: dual-write behind flag, read from new, drop old.

### 2.4 Embedding pipeline

```
Document/Article/Case updated
  → Bull job: ai.embed (idempotent by chunkId)
  → chunk → EmbeddingPort.embed → VectorStorePort.upsert
Parent deleted/trashed → deleteBySource
```

- Never embed large content in the HTTP request path.
- Extend the existing backfill-script pattern (`backfillDocumentsSemanticIndex.js`) — do not invent a parallel one.
- Incremental re-index on update + full re-embed job when `embeddingVersion` bumps.

### 2.5 Hard invariants (never break)

1. Every vector search filters `organizationId` **in the store AND in app code** (defense in depth).
2. **Permission check after retrieval** — a vector hit is not authorization; re-load the record through existing services with Profile + sharing.
3. No product feature imports a provider SDK or Atlas vector API — adapters only.
4. RAG answers **always cite** `sourceType` + `sourceId` + excerpt; "no answer found" is a valid output.
5. **Suggest → human confirm** for all writes. AI never auto-sends email, changes Stage/Status/price, posts invoices, decides approvals, or closes cases.
6. Deterministic engines stay authoritative: SLA, conversion services, approvals, permissions. AI proposes; engines decide. AI must not become a second workflow runtime.
7. Platform Home stays rule-based by default; LLM ranking only as optional layer on top of the deterministic payload.
8. i18n on every AI surface; `NOT_CONFIGURED` empty state when no key/entitlement; AI failure never blocks core CRM flows (circuit breaker → "AI unavailable").

---

## 3. Trust Tiers (three products, one adapter stack)

| Tier | Context allowed | Tools | Injection posture |
|------|-----------------|-------|-------------------|
| **Staff Assist** | Everything the user can see (Profile + sharing enforced) | Read + draft tools | Standard |
| **Portal Ask** (customer-facing) | Published KB/articles ONLY — never CRM internals | Read-only, KB-scoped | Strict; disclaimers required |
| **Inbound/untrusted** (mailroom, chat, webforms) | Content is hostile input, never instructions | Read-only or none; classification output schemas only | Sanitize, strip instruction-following on untrusted text, restricted tool loop |

---

## 4. Abilities Catalog

Product shape is **hard-coded** (surfaces, tools, guardrails, schemas); every run is **context-based** (tenant + record + permissions). 

### 4.1 Tier A — Signature

| Ability | Surface | Context | Writes (confirm-only) |
|---------|---------|---------|----------------------|
| **Commercial Copilot** | Deal / Quote record pages | DealLines, catalog, price books, coverage, approvals | Draft quote via `CommercialConversionService` DTO |
| **Revenue→Cash intelligence** | Deal/SO/Invoice, Platform Home | Conversion links, allocations, payment state, overdue balances | Draft follow-up + payment link |
| **Unified work-graph Q&A** | Command palette, Platform Home | Relationships API across People↔Deal↔Case↔Doc↔Invoice, with citations | None (read-only) |
| **Inbox → Case/Deal router** | Mailroom + Inbox | Thread, sender identity resolution, open cases/deals | Propose link/create Case, Deal, Task |
| **Policy-aware assist** | Cases, Deals | SLA clocks, business hours, approval gates, stage/status | Suggestions that respect engine state only |
| **Knowledge RAG** | Documents, Articles, Portal Ask, agent side-panel | Chunked embeddings (Atlas), OCR text | None |
| **Audit narrative** | Audit app, Form responses | Scored responses, findings, timelines | Draft finding summaries + corrective actions |

### 4.2 Tier B — Parity

Draft/rewrite/tone/translate (email, case reply, live chat, campaigns) · thread/case/deal summaries (cached by record `updatedAt`) · field extraction from email/notes (confirm-to-apply) · next-best-action (status-aware) · meeting/event prep brief · catalog line assist · segment/subject/body assist · NL → analytics intent (validated definitions, never free DB queries) · import column mapping · duplicate/merge suggestions (People/Org embeddings, suggest-only) · live-chat bot recipes (FAQ + escalate).

### 4.3 Simple LLM call vs agent

Plain call: rewrite, translate, summarize, extract, classify one item, doc Q&A.  
Agent: only when a **multi-step sequence** must retrieve across domains, choose tools, and adapt to intermediate results.

---

## 5. Agentic AI (bounded, proposal-first)

### 5.1 Execution model

```
User goal
  → Planner creates bounded steps
  → Server validates plan + permissions
  → Read-only tools execute
  → Agent prepares proposed changes
  → User confirms
  → EXISTING services perform writes
  → AiAuditLog records every step
```

### 5.2 Agent roster (in rollout order)

| # | Agent | Tools | Write policy |
|---|-------|-------|--------------|
| 1 | **Meeting/Record research** | `getRecordContext`, `getCommunicationThread`, `searchDocuments` | Read-only |
| 2 | **Inbox triage** | + sender resolution, open case/deal lookup | Propose routing/reply; user confirms |
| 3 | **Case resolution** | + `calculateSla`, KB search | Propose response + task; never auto-close/send |
| 4 | **Commercial** | + `getQuoteCoverage`, catalog lookup | User confirms lines, prices, quote creation |
| 5 | **Revenue collection** | + `getInvoiceBalance`, payment link draft | Finance user confirms every communication |
| 6 | **Audit remediation** | Findings, scores, timelines | Auditor confirms assignments |

### 5.3 Tool allowlist (initial)

Read: `getRecordContext`, `searchDocuments`, `getCommunicationThread`, `getQuoteCoverage`, `getInvoiceBalance`, `calculateSla`.  
Draft: `draftTask`, `draftCommunication`.  
**Never exposed:** raw Mongo, arbitrary HTTP, code execution, generic "update any record", approval decisions.

### 5.4 Agent controls

Max steps/tokens/duration/cost per run · tenant + Profile + sharing + field-permission checks on **every tool call** · idempotency keys on writes · structured tool schemas with server-side validation · stale-state guard (`updatedAt`/ETag check before apply; "record changed — regenerate?" UX) · cancellation + timeout · no agent-to-agent delegation initially · prompt-injection isolation for email/doc/portal content.

---

## 6. Trigger Model

| Trigger | Examples | Phase |
|---------|----------|-------|
| **On-demand (UI)** | Draft reply, summarize, Ask | 1 |
| **Event-driven** | New mailroom message → classify/route (untrusted tier) | 2–3 |
| **Automation step** | `ai_classify` / `ai_extract` node type inside the **existing** process designer — structured output back into the engine, reuses approval gates | 3 |
| **Scheduled** | Nightly overdue-invoice briefs, digest summaries | 4 |

---

## 7. Governance, Security & Legal

### 7.1 Data protection

- **PII redaction / data minimization** in context builders before any provider call (strip secrets, tokens, payment fields).
- **Tenant AI policy flags** on `Organization` AI settings: master enable/disable (gated at middleware, not UI), BYOK vs platform key, provider/region preference, data-use consent.
- Provider contracts: DPA, region pinning, **no training on tenant data** (contractual).
- `AiAuditLog` retention policy — prompts are a second copy of customer data; define TTL/purge.
- Portal-facing AI: customer disclaimers; generated-content ownership = tenant.

### 7.2 Prompt-injection defense

Mailroom/portal/webform text is untrusted input: sanitize, never treat as instructions, restrict/disable tools on untrusted-context runs, validate all structured outputs server-side.

### 7.3 Audit

`AiAuditLog` (tenant-scoped, `wrapTenantModel`): user, org, ability, prompt version, model, context record refs, token counts, cost, outcome, accept/reject. Every agent step logged.

### 7.4 Conversation persistence

`AiConversation` (tenant-scoped, per-user): Arivu Assistant threads (`title`, `messages[]`, optional `moduleKey`/`recordId`). CRUD under `/api/ai/conversations` with `protect` + org isolation + AI access. Client hydrates from API (one-time migrate from legacy localStorage).

---

## 8. Cost, Performance & Reliability

| Concern | Mechanism |
|---------|-----------|
| Metering | **`ai_credits`** when `keyMode=platform` — debit per call (tokens → credits); soft warning at ~20%; hard block at 0 with upgrade/buy path. BYOK: no credit debit; still log tokens for observability |
| Caching | Record summaries keyed on record `updatedAt`; query-embedding + top-K cache (org + query hash + corpus version TTL) |
| Model tiering | Cheap model for classify/route; larger for generation — per-ability config in one adapter |
| Fallback | Provider circuit breaker → `NOT_CONFIGURED`/"AI unavailable" empty state; never block CRM |
| Latency budget | Inline assist target < 3s (sync + SSE); anything heavier → Bull async with progress |
| Rate limits | Reuse `routeRateLimitMiddleware` pattern on `/api/ai` (applies in both key modes) |

---

## 9. Quality: Evals & Feedback

- **Eval harness** — golden sets per ability (e.g. 50 case threads → expected summaries; 30 deals → expected quote drafts). Run on every prompt/model change. Hang off existing node test runner / ATP patterns.
- **Feedback capture** — 👍/👎 + reason on every AI output → PostHog.
- **Hallucination guards** — mandatory citations for RAG; schema validation on structured outputs (e.g. quote line suggestions must reference real `Item` ids); "no answer" allowed.
- **Prompt versioning** — prompts as versioned server artifacts; version logged in `AiAuditLog` so regressions are traceable.

**PostHog instrumentation (Phase 0 requirement):** ability invoked, accept/reject rate, tokens, latency, provider errors, deflection/containment rate (portal/chat), credit balance / BYOK mode.

---

## 10. Packaging & Billing (locked)

Reuse addon machinery (`addonKeys.js`, `AddonDefinition`, `TenantAddonConfiguration`, `/api/admin/addon-pricing`) — same pattern as `email_credits`.

### 10.1 Dual key modes (both required)

| Mode | Who pays the LLM | Arivu meters | UX |
|------|------------------|--------------|-----|
| **`platform`** (default) | Arivu (platform OpenAI/etc. key) | **Yes — `ai_credits`** | Credit balance, soft/hard limits, buy/upgrade |
| **`byok`** | Tenant (own OpenAI / Azure / Anthropic / Gemini key) | **No credit debit** | Key status + provider select; optional usage stats only |

Org may switch `keyMode` in AI settings at any time (admin permission). Switching to BYOK requires a valid encrypted key + data-use consent. Switching to platform requires available credits (or purchase).

### 10.2 Capability packages + credits

| Package / addon | Contents | Persona |
|-----------------|----------|---------|
| **Arivu AI** (`ai`) | **Full suite** — Assist, Commercial, Service, Knowledge (one install unlocks everything) | Org |
| **AI Credits** (`ai_credits`) | Metered pool for platform-key usage only (not a feature gate) | Org (purchased / included) |

Product surfaces (Assist / Commercial / Service / Knowledge) are **capabilities inside `ai`**, not separate marketplace addons.

Entitlement = **`ai` installed and active** **AND** (BYOK configured **OR** credits remaining for platform mode). Empty states:

- No `ai` addon → `DISABLED` / upsell Arivu AI
- `ai` but `keyMode=platform` and credits = 0 → `NOT_CONFIGURED` / buy credits
- `ai` but `keyMode=byok` and missing/invalid key → `NOT_CONFIGURED` / add key

Legacy split keys (`ai_assist`, `ai_commercial`, `ai_service`, `ai_knowledge`) remain as entitlement aliases only (disabled in catalog).

### 10.3 Credit ledger (platform mode)

- Debit after successful provider response (failed/circuit-breaker calls do not debit).
- Conversion: tokens (prompt + completion + embedding) → credits via admin pricing table (`AddonPricingDefinition`).
- Soft warn ~20% remaining; hard block at 0.
- `AiAuditLog` stores `keyMode`, tokens, `creditsDebited` (0 when BYOK).
- Mirror `email_credits` / AMDS patterns where possible — do not invent a parallel billing framework.

### 10.4 BYOK rules

- Key stored encrypted at rest; never returned in full to client (mask last 4).
- Tenant chooses provider from supported list (§2.2.1).
- Rate limits + audit + PII redaction still apply.
- Platform never uses BYOK key for other tenants.

## 11. UX Principles

1. **Inline, not a separate "AI app"** — buttons on Inbox, Case, Deal, Quote, Document, palette.
2. **Citations everywhere** — link to Case # / Deal / Doc / Invoice.
3. **Confirm-to-write** — preview + apply, never silent mutation.
4. **Same permissions as the UI.**
5. **Stream via SSE** (existing hub pattern; no WebSocket).
6. **Answer in user's language** (13 locales — real differentiator). Multilingual RAG design explicit: multilingual embeddings vs query translation.
7. **Cold-tenant experience:** defined zero-RAG behavior, structure-only sample prompts, setup checklist (upload docs, connect mailbox, enable addon).
8. Merge checklist compliance for every AI surface: i18n, empty-state classification (`NOT_CONFIGURED`/`FIRST_TIME`), PostHog, permissions validated.

---

## 12. Roadmap

### Phase 0 — AI Platform Spine (foundation; no user-visible AI yet)

**Scope**

- `server/services/ai/` skeleton: `LlmPort` + **OpenAI adapter** (default), `EmbeddingPort` + OpenAI embeddings, `VectorStorePort` + `AtlasVectorStore` + `InMemoryVectorStore` (tests)
- Provider registry: resolve adapter from org `llmProvider` / `embeddingProvider`; stub hooks for Azure / Anthropic / Gemini (implement in Phase 0–1 per §2.2.1)
- Chunk schema (with `embeddingModel`/`embeddingVersion`) + Bull `ai.embed`/delete jobs + backfill script (extend existing pattern)
- `/api/ai` mount with full middleware chain + AI addon/entitlement gate + rate limits
- Permissions: `ai.*` keys in `server/permissions/`, Role/Profile integration
- `AiAuditLog` model + service (tenant-scoped)
- Org AI settings: enable/disable, provider select, BYOK vs platform key, region, model overrides, data-use consent
- PII redaction in context-builder base; prompt artifact store with versions
- Metering: `ai_credits` ledger + BYOK path (§10); circuit breaker; PostHog event schema
- Env: `AI_VECTOR_STORE`, `AI_DEFAULT_LLM_PROVIDER=openai`, platform OpenAI key(s), `validateEnv.js` updates

**Exit criteria:** embed + search a document via Atlas behind the port with org filter enforced (test proves cross-tenant search returns nothing); an `/api/ai/echo`-class ability streams over SSE with audit row + PostHog events; addon gate blocks un-entitled orgs; org can switch provider field without code change (adapter registry returns `NOT_CONFIGURED` until adapter ships); platform-mode call debits credits; BYOK-mode call uses org key and debits 0 credits.

### Phase 1 — Assist + Knowledge (first user-visible wedge)

**Scope**

- Ship remaining LLM adapters as needed: **Azure OpenAI**, **Anthropic**, **Gemini** (registry already wired in Phase 0)
- Replace hash embeddings with real embeddings for Documents (keep `GET /documents/search/semantic` contract; swap to `$vectorSearch`); extend to Helpdesk Articles
- **Knowledge RAG** with citations: staff side-panel Ask (Documents + Articles)
- **Case/Inbox draft reply + thread summary** (staff tier, confirm-to-send via existing communication send path + idempotency)
- Record summary on People/Deal/Case (cached by `updatedAt`)
- Feedback capture (👍/👎) + eval golden sets for summaries and drafts
- i18n + empty states + merge checklist for all surfaces

**Exit criteria:** semantic search quality visibly better than hash baseline on eval set; draft-accept and summary-usefulness metrics flowing to PostHog; zero cross-tenant leakage in retrieval tests.

**North-star metric:** draft-accept rate > 40% (kill/iterate criteria if missed after 6 weeks of beta).

### Phase 2 — Commercial Copilot + Work-Graph Q&A

**Status:** Implemented (propose-only; human confirm for quote apply, payment links, field patches, merges)

**Scope**

- Deal→Quote draft through `CommercialConversionService` DTO (never reads DealLines directly); coverage-gap explanation; catalog line assist (validated against real `Item`/price book ids)
- Revenue→Cash: overdue-invoice brief + follow-up draft + payment-link proposal
- Command-palette NL Q&A across the relationship graph with citations
- First agent: **Meeting/Record research** (read-only)
- Field extraction from email/notes (confirm-to-apply)
- Duplicate/merge suggestions (People/Org)

**Exit criteria:** quote drafts pass schema validation 100%; palette Q&A answers with correct citations on eval set; agent runs bounded (steps/cost caps) with full audit trail.

### Phase 3 — Agents in Proposal Mode + Automation Integration

**Status:** Implemented (propose-only; soft-fail overlays)

**Scope**

- **Inbox triage agent** + **Case resolution agent** (proposal mode; untrusted-tier hardening for inbound text)
- Event-driven trigger: mailroom classify/route
- `ai_classify`/`ai_extract` step types in the existing process designer (structured outputs into the engine; approval gates reused)
- Policy-aware suggestions (SLA clocks, business hours, approval state)
- Platform Home: optional AI focus layer on top of rule-based payload (flagged)
- Portal Ask (customer tier: KB-only, disclaimers, containment tracking)

**Exit criteria:** triage proposals accepted > 50% on beta tenants; zero injection-test escapes; portal containment rate measured.

### Phase 4 — Full-Suite AI

**Scope**

- Marketing: segment/subject/body assist; campaign summary — **implemented** (subject/body assist + campaign summary; `aiMarketingService`)
- NL → analytics intent (validated definitions only) — **implemented** as saved-report matching: `aiAnalyticsIntentService` maps a question to reports the user can already view (visibility filter from `analyticsReportAccessService`); never builds or runs ad-hoc queries; suggest-only (UI: Analytics Home ask box; `POST /ai/analytics/intent-suggest`)
- Live-chat bot recipes (FAQ + escalate) with deflection metrics — **implemented**: opt-in `LiveChatBot.aiAssist`; after keyword miss, KB RAG via `aiLiveChatBotService` (`abilityKey: live_chat_bot`); soft-fail never blocks chat; visitor agent request still escalates; `botAiAnswered` + `GET /live-chat/bots/deflection-metrics`; FAQ preview `POST /ai/live-chat/faq-preview`; UI in Live Chat Bots settings
- Audit narrative + remediation agent — **implemented**: `aiAuditNarrativeService` drafts narrative + remediation from failed scored questions only (questionId allow-list); propose-only (never writes FormResponse / assigns / approves); `POST /ai/audit/responses/:responseId/narrative`; UI on Response Detail (`AiAuditNarrativePanel`)
- **Commercial + Collection agents** — **implemented as propose-only**: `aiCommercialAgentService` proposes deal→quote next steps (`create_quote` only when coverage allows) and overdue-invoice collection steps (`invoiceId` allow-list); never creates quotes, sends email, or issues payment links; `POST /ai/agents/commercial/:dealId`, `POST /ai/agents/collection`; UI on Deal record + AI Settings
- Scheduled triggers (digests, briefs) — **implemented as preview/generation slice**: `aiDigestBriefService` turns existing deterministic notification digest aggregates into a daily/weekly brief; preview-only (`autoSend: false`), scheduler remains authoritative; `POST /ai/digests/brief-preview`; UI in AI Settings
- Import mapping assist — **implemented** (`aiImportMappingService`, suggest-only, allow-listed fieldKeys)

**Exit criteria:** per-package adoption + revenue metrics justify GA pricing; eval regression suite green across all abilities. Commercial/collection agents remain gated for GA auto-send until accept-rate eval data is green.

### Rollout discipline (all phases)

Feature-flag per tenant: internal orgs → beta tenants → GA (consistent with instance-based provisioning). Support playbook: what support does when "AI told a customer something wrong" (trace via `AiAuditLog` prompt version + context refs; disable ability per org via settings).

---

## 13. Decisions Locked / Open

| Decision | Status |
|----------|--------|
| Same Node server, no microservice | **Locked** |
| Bull for long jobs; SSE for streaming | **Locked** |
| Atlas Vector Search first; Qdrant escape hatch behind port | **Locked** |
| Ports/adapters; no direct SDK imports in product code | **Locked** |
| Suggest → confirm for all writes; engines stay authoritative | **Locked** |
| Chunk model with versioned embeddings | **Locked** |
| Agents: proposal-first, bounded, read-only tools first | **Locked** |
| **First wedge order** (Knowledge+Service in P1 before Commercial in P2) | Locked by this roadmap — revisit only with evidence |
| **Billing: single `ai` suite addon + metered `ai_credits` (platform) + BYOK** | **Locked** — see §10 |
| **LLM: OpenAI default; multi-provider via adapters (Azure, Anthropic, Gemini; Bedrock later)** | **Locked** — see §2.2.1 |
| **Key mode: platform key default; BYOK supported per org** | **Locked** (same as billing) |
| Multilingual RAG approach (multilingual embeddings vs query translation) | Open — decide in Phase 1 design |

---

## 14. Non-Goals (explicitly out)

- Standalone AI microservice / separate auth-tenant stack
- Fine-tuning or training on tenant data
- Auto-send email, auto-close cases, auto-change Stage/Status/price, auto-post invoices, auto-decide approvals
- Free-form SQL/Mongo access for the model
- One global cross-tenant vector index
- Replacing Platform Home rules with LLM-only ranking
- Per-module provider SDK calls in controllers
- Agent-to-agent delegation (initially)
- GPU self-hosted models (unless a customer contractually requires it)

---

*This document is the source of truth for AI implementation. Update it when locking open decisions, completing phases, or changing architecture boundaries. Update `Architecture_Document.md` §"AI / Semantic" when each phase ships.*
