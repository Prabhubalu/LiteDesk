# Tally Integration — Architecture (GTM Foundations)

**Status:** Live agent path in progress (tray UI + poll/ack + bi-dir orchestrator). Policies below are locked for GA.  
**Audience:** Engineering, integrations, support, security.  
**Related:** `docs/tally_Connector.md` (UX target), `docs/TALLY_SUPPORT_MATRIX.md`, `docs/TALLY_PILOT_RUNBOOK.md`.

---

## 1. Purpose

Sync Arivu commercial / inventory data with **TallyPrime** over Tally’s local **XML HTTP API**. Cloud never talks to Tally directly. A Windows **Arivu Connector Agent** is the only XML client on the customer network.

---

## 2. Topology

```text
Arivu Cloud                          Customer Windows host
─────────────────                    ───────────────────────
Integration Center / Addon
        │
Connector Runtime                    ArivuConnectorAgent (service)
  · TallyConnection / bindings         · pair + heartbeat (TLS)
  · Outbox + Bull queues               · poll jobs / offline queue
  · Adapter (mock | live-via-agent)    · single-flight XML sequencer
        │◄────── HTTPS TLS ──────────►│
                                       │ localhost / LAN only
                                       ▼
                                 TallyPrime XML (:9000+)
```

| Layer | Responsibility | Foundation location |
|-------|----------------|---------------------|
| Addon entitlement | `ADDON_KEYS.TALLY` (`tally`) | `server/constants/addonKeys.js`, `tallyAddonConstants.js` |
| Cloud connection | Pairing codes, agent token hash, heartbeat | `tallyConnectionService.js`, `TallyConnection` model |
| Agent RPC | `discover`, `executeXml`, `ackJob`, `heartbeat` | `tallyAgentProtocol.js` |
| Sync queues | `integrations:tally:sync`, `integrations:tally:agent-inbound` | `tallySyncConstants.js`, `tallySyncQueueService.js` |
| Adapter | `verifyConnection`, `discoverCompanies`, `pushVoucher`, `pullChanges` | `tallyConnectorAdapter.js` (mock default) |
| Agent EXE | Windows service bridge | `connectors/arivu-agent/` (skeleton; installer via CI) |

**Hard rules**

1. Cloud **never** opens customer port **9000** (or any Tally XML port). Agent is the only XML client.
2. One in-flight XML write per Tally company GUID (single-flight sequencer on agent; `companyWriteConcurrency: 1` default).
3. Tenant isolation on all connection / job / outbox rows (`organizationId`).
4. Live XML path is agent-mediated; default `TALLY_CONNECTOR_MODE=mock` until live verify is wired.

---

## 3. Agent EXE packaging

| Artifact | Notes |
|----------|--------|
| `ArivuConnectorSetup.exe` | Signed one-click installer (Inno/WiX). Published by CI from `connectors/arivu-agent/installer` — see `client/public/connectors/README.txt`. |
| Windows service | `ArivuConnectorAgent` — silent, starts at boot |
| Local Tally bind | Default `127.0.0.1:9000`–`9010`; never auto-expose to internet |

Agent config defaults: `connectors/arivu-agent/src/config.js`.

---

## 4. Cloud runtime

- **Queues:** Bull (`TALLY_SYNC_QUEUE_NAME`, agent-inbound). Redis TLS supported when URL is `rediss://`.
- **Jobs:** `ConnectorSyncJob` / `ConnectorSyncRun` with connector key `tally`.
- **Multi-company:** Per-company binding + **per-company write affinity** (no cross-company voucher bleed). Default write concurrency **1** per company (`TALLY_DEFAULT_SETTINGS.companyWriteConcurrency`).
- **Retry:** Exponential backoff profile in `tallySyncConstants.js`.

---

## 5. Source-of-truth (SoT) defaults

From `TALLY_DEFAULT_SETTINGS` (`server/constants/tallyAddonConstants.js`):

| Entity | Default direction |
|--------|-------------------|
| Parties, items, stock | `bidirectional` |
| Invoices, payments, POs, receipt notes | `arivu_to_tally` |
| Sync interval | 5 minutes |
| Dry-run default | `true` (first sync) |
| Auto-approve mapping confidence | `0.95` |

**Stock SoT (policy lock):** Arivu inventory ledger is canonical; Tally mirrors. Stock qty changes must go through a single canonical inventory path (no dual-deduct).

Per-binding SoT overrides are planned on `TallyCompanyBinding` (GTM-3/9); do not invent UI as shipped until bindings land.

---

## 6. Voucher number policy

**Default (locked):**

- Arivu commercial document number → Tally voucher **`REFERENCE`**
- Tally voucher series owns **`VOUCHERNUMBER`** (prefer Automatic Retain)

Optional future setting: “Arivu owns number” for Manual Prevent Duplicates series — not default.

---

## 7. Voucher lifecycle — cancel, not delete

| Action | Policy |
|--------|--------|
| Cancel / void in Arivu | Sync **Cancel** semantics to Tally (Alt+X style), not hard Delete |
| Alter | Update by Tally `MASTERID` / GUID when mapped |
| Hard delete of synced vouchers | **Forbidden** via connector |

Only **Posted / Approved** commercial states sync. Never push Arivu Draft. Fail cleanly on locked / closed FY.

---

## 8. GST / IRN

- Sales vouchers require GST fidelity fields (GSTIN, place of supply, HSN, tax splits) before queue — or fail validation.
- **IRN policy (v1):** **Preserve** IRN / QR / ack fields when present on Invoice. Do **not** generate IRN via IRP/GSP in GTM v1 (optional partner SKU later).

---

## 9. Multi-company queues

- One Agent may discover multiple companies; each company GUID has its own write lane.
- Queue job affinity must include company GUID so parallel companies do not serialize unnecessarily, but a single company never receives concurrent XML writes.
- Multi-FY / multi-GSTIN series awareness is GTM-9 hardening scope — foundations store company + FY on discovery mocks; full series mapping is not GA-complete until bindings + voucher mappers ship.

---

## 10. Security

| Control | Requirement |
|---------|-------------|
| Agent ↔ cloud | HTTPS/TLS only; agent token stored hashed (`agentTokenHash`) |
| Secrets | Encrypted at rest on connection (`encryptedSecrets`); never log tokens |
| Tally user | Dedicated **least-privilege** Tally user for the Agent (no unnecessary admin rights) |
| Port 9000 | Bind localhost or private LAN; **never** expose Tally XML to the public internet; firewall deny inbound from WAN |
| Cloud | No outbound connect to customer `:9000` |
| Audit | Sync jobs/runs/events retain tenant-scoped audit for support |
| Entitlement | `requireAddonEntitlement('tally')` + RBAC for integrations |

---

## 11. Foundation vs not-yet-shipped

**Present (foundations):**

- Addon key + default settings + pricing registry stub
- Connection pairing / heartbeat
- Sync queue + mock adapter + agent RPC stubs
- Agent package skeleton (`connectors/arivu-agent`)
- GTM packaging docs + version matrix + XML fixture regression (this GTM-9 pack)

**Not claimed complete:**

- Live agent `executeXml` → Tally round-trip in production
- Full Integration Center UX (`docs/tally_Connector.md`)
- Full master/voucher mapper coverage, IRN generation, GSTR-2B engine
- Signed installer auto-update pipeline (CI target documented; not assumed shipped)

---

## 12. Explicit non-goals (GTM v1)

- Replacing Tally as GST return filing UI
- ClearTax-class IRP/GSP product (preserve IRN only)
- Bank statement OCR / Account Aggregator
- Second ERP connectors beyond shell reuse
