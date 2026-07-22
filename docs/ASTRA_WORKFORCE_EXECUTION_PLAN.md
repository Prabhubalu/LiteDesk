# Astra Workforce Execution Plan

**Source of truth:** [`docs/ASTRA_AGENT_TOOL_CATALOG.md`](docs/ASTRA_AGENT_TOOL_CATALOG.md)  
**Runtime:** [`docs/ASTRA_V2_ARCHITECTURE.md`](docs/ASTRA_V2_ARCHITECTURE.md)

## North star

**AI Workforce + complete OOTB catalog** — router + named seats + focus/scratchpad + handoffs + reviewer + confirm-gated tools, covering **every App and Module** so users **never create Agents or Tools**.

### Definition of done

1. Playbook: **Qualify → Research → Propose → Follow-ups → Review → Confirm** with seat attribution.  
2. **§5b matrix 100% green** — every App/Module has built-in agent(s) + tools.  
3. No custom agent/tool builder product.

## Phases (all are workforce)

| Phase | Name | Workforce outcome |
| --- | --- | --- |
| **A** | Runtime | Router, real seats (`agentKey`), focus, core SALES/platform tools |
| **B** | Staff | Specialists + thin playbook + commercial/helpdesk matrix rows |
| **C** | Collaborate + full matrix | Handoffs, Reviewer, playbooks, **all remaining Apps/Modules** + coverage CI |

## Sprint 1 — Phase A (workforce runtime)

1. **A1+A2** Router + golden CI  
2. **A4+A10** Real seats + `agentKey` on every turn  
3. **A3** Focus  
4. **A5+A6** Task create tools  
5. **A5+A8** Calendar/events  
6. **A7** Email from focus  
7. **A9** Telemetry (`agentKey`)  

**Gate:** Correct routing + seat attribution — then B, then C until §5b is complete.

## Rules

- Every PR advances a workforce contract **and** keeps §5b coverage  
- New App/Module without Astra seats/tools = merge blocker  
- Never ship a DIY agent/tool builder to paper over gaps  
- Writes = `confirm_action` only  
- Extend `server/services/astra` only  

## Status

- [x] Phase A — Workforce runtime  
- [x] Phase B — Staff + thin playbook + matrix slice  
- [x] Phase C — Collaborate + OOTB App/Module seats/tools + coverage CI + canonical playbook + handoffs  

*Depth work remains: wire thin tools to live controllers (quotes, inventory, marketing, etc.) and UI seat attribution.*
