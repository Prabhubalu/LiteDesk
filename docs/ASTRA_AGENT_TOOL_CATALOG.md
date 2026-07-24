# Astra Mission Control + Platform Defaults + Universal Fabric

> **Product direction (locked):** CapIndex + universal `module.*` fabric + **Astra Mission Control** as Ask entry + **20 seeded Platform default agents** (Mission Control + 19 specialists) + optional Master-authored extras + grounded Knowledge fabric.  
> **Naming:** Never say “CRM” in user-facing agent copy — say **Platform** (product: Arivu).  
> Parent: [`ASTRA_V2_ARCHITECTURE.md`](./ASTRA_V2_ARCHITECTURE.md)

## Architecture

```
ModuleDefinition ∪ moduleCatalog ∪ listTools ∪ knowledge
        → CapIndex(org)
        → Seeded Platform defaults (mission-control + specialists)
        → Optional Master propose/create extras
        → AstraTenantAgent (tool recipes + full prompt pack)
        → Mission Control plan → specialist agent loop(s) → merge
```

### Platform default agents

Source: `server/services/astra/agents/defaultAgentCatalog.js` + `defaultAgents/*.md`.

| Key | Role |
| --- | --- |
| `mission-control` | Always-on Ask orchestrator (no direct writes) |
| `summary` … `workday-orchestrator` | 19 specialists (see catalog) |

**Deferred:** Strategic Advisor (listed historically under Mission Control; no Platform spec yet).

Seed: `SEED_BUILTIN_AGENTS` = all 20. Catalog version `ASTRA_CATALOG_VERSION = 2`. Soft-alias: `coworker` → Mission Control.

### Universal fabric

| Tool | Risk | Notes |
| --- | --- | --- |
| `module.search` | read | Requires `moduleKey` |
| `module.get` | read | `moduleKey` + `recordId` |
| `module.create` / `module.update` | write | Confirm-gated |
| Domain actions | write | `quotes.send`, `invoices.send`, `payments.record`, `refunds.create`, `sales_orders.fulfill`, `cases.assign|resolve`, … |

Registry CI: `server/services/astra/tools/__tests__/moduleRegistry.test.js` (`assertModuleRegistryComplete`).

### CapIndex

`GET /api/ai/v2/cap-index` — bindable capabilities for Master (`ready` | `read_only` | `unavailable`).

### Master

- `POST /api/ai/v2/master/propose` — plain English → CapIndex-bound proposal  
- `POST /api/ai/v2/master/create` — persist **extra** agents (merge/reuse near-duplicates)

Does **not** replace Mission Control as the default Ask entry.

Thresholds: match ≥0.62, auto-create ≥0.80, duplicate ≥0.88, max 2 runtime creates/day/org.

### Knowledge fabric

Shared `groundedRetriever` for:

- Astra `knowledge.search` (audience `internal` | `public`)
- Case-created draft job → `Case.aiAssist.suggestedReply`
- Live Chat bot (public corpus; keyword fallback)

Admin: Settings → AI → **Knowledge** (`/api/ai/v2/knowledge-sources`).

Website: curated URL fetch or paste (no full-site crawl in v1).

### Agent loop

`server/services/astra/orchestrator/agentLoop.js` — after empty/weak tool result, reflect and try an alternate tool (max 3 steps, 1 transient retry).

### Mission Control router

Ask defaults to `mission-control`. `orchestrator/missionControl.js` plans specialists (heuristic + optional LLM), runs primary (+ parallel extras), merges into one Platform answer. Explicit `request.agent` remains for Settings → Try.

### Vector agent memory

`agentVectorMemory.js` embeds agent catalog for duplicate ≥0.88 detection on Master create.
