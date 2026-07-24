# Astra Master + Universal Fabric + Knowledge

> **Product direction (locked):** CapIndex + universal `module.*` fabric + Master-authored agents + grounded Knowledge fabric.  
> **No seeded 45-agent zoo in Settings** — only coworker seed + Master-created specialists.  
> Parent: [`ASTRA_V2_ARCHITECTURE.md`](./ASTRA_V2_ARCHITECTURE.md)

## Architecture

```
ModuleDefinition ∪ moduleCatalog ∪ listTools ∪ knowledge
        → CapIndex(org)
        → Master propose/create
        → AstraTenantAgent (tool recipes + Role/Goal/Tools/Constraints template)
        → Orchestrator agent loop (plan→execute→observe→reflect, max 3)
```

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
- `POST /api/ai/v2/master/create` — persist agent (merge/reuse near-duplicates)

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

### Router

Ask does **not** force `coworker`. `resolveAgentKey` scores enabled tenant agents; falls back to coworker / ephemeral.

### Vector agent memory

`agentVectorMemory.js` embeds agent catalog for duplicate ≥0.88 detection on Master create.
