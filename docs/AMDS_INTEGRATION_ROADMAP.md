# AMDS Integration Roadmap — Arivu

**Version:** 1.1  
**Date:** June 30, 2026  
**Status:** Phases A–C + Track 3 complete; Phase D partial; Phase E pending  
**Audience:** Arivu backend + frontend engineers, platform ops  

This roadmap defines **what to build in Arivu** to integrate with **AMDS (Arivu Mail Delivery System)** as the **default platform outbound email provider**, while keeping existing providers (Gmail mailbox, AWS SES, OCI Email Delivery, Resend, generic SMTP) available as overrides.

**Related documents**

| Document | Purpose |
|----------|---------|
| [ARIVU-INTEGRATION.md](./ARIVU-INTEGRATION.md) | AMDS API contract, webhook spec, idempotency, env vars (source of truth for AMDS ↔ Arivu protocol) |
| [COMMUNICATION_PLATFORM_PHASE_PLAN.md](../server/docs/COMMUNICATION_PLATFORM_PHASE_PLAN.md) | Existing outbound/inbound platform (Phases 0–8) |
| [CRM_EMAIL_ENTERPRISE_ARCHITECTURE.md](../server/docs/CRM_EMAIL_ENTERPRISE_ARCHITECTURE.md) | Communication model, send paths, provider routing |
| [R0_EMAIL_INFRA_RUNBOOK.md](../server/docs/R0_EMAIL_INFRA_RUNBOOK.md) | System vs CRM email env matrix |

**Legend:** ⬜ Not started · 🟡 In progress · ✅ Done · 🔒 Blocked on AMDS phase

---

## 1. Goals and non-goals

### Goals

1. Route **platform outbound email** through AMDS HTTP API (`POST /v1/messages`) — Arivu never opens SMTP for the AMDS path.
2. Make **AMDS the default** for CRM/agent and system mail when AMDS env is configured.
3. Receive delivery results via **signed webhooks** and update `Communication` (and future Helpdesk) records.
4. Preserve **tenant isolation**, idempotency, audit events, and existing communication platform patterns.
5. Keep all **existing providers** selectable via env or tenant integration config.

### Non-goals (Phase 0a–1)

| Item | Reason |
|------|--------|
| Remove SES / OCI / Resend / SMTP | Tenant overrides and migration safety |
| Replace Gmail API / Gmail SMTP sends | User-connected mailboxes are not platform delivery |
| AMDS template rendering | AMDS Phase 2+ |
| Bounce / complaint / open / click webhooks | Track 3 (bounce) done in Arivu; complaint Track 3+ |
| Domain verification UI in Arivu | Track 3 done (Settings → AMDS domains proxy) |
| Marketing / bulk campaigns via AMDS | AMDS Phase 3 |

---

## 2. Architecture (target state)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Arivu                                                                 │
│                                                                          │
│  Agent send (Communication)          System mail (OTP, invite, digest)  │
│         │                                      │                         │
│         ▼                                      ▼                         │
│  outboundEmailSendService              userAccountEmailService           │
│    │ Gmail mailbox? ──► Gmail API/SMTP (unchanged)                       │
│    │ else platform ──► emailProviderGateway ──► emailService             │
│                              │                                           │
│                              ▼                                           │
│                    provider === 'amds' (default)                           │
│                              │                                           │
│                              ▼                                           │
│                    AmdsClient.sendMessage()                              │
│                              │                                           │
│  Webhook ◄───────────────────┼───────────────────────────────────────  │
│  POST /api/internal/webhooks/amds                                        │
│         │                                                                │
│         ▼                                                                │
│  Update Communication.status → delivered | failed                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTP (private network)
                               ▼
                    ┌──────────────────────┐
                    │ AMDS Gateway :8080    │
                    │ Worker → SMTP/Mailpit │
                    └──────────────────────┘
```

**Principle (from AMDS spec):** Arivu decides *what* to send. AMDS decides *how* it is delivered.

---

## 3. Current state vs target

| Area | Today | After AMDS integration |
|------|-------|------------------------|
| CRM default provider | `resend` (`runtimeConfigResolver`) | `amds` (fallback `resend` if AMDS env missing) |
| System default provider | `oci-email-delivery` | `amds` (override via `SYSTEM_EMAIL_PROVIDER`) |
| Platform send transport | Direct SMTP / SES / OCI | AMDS HTTP API |
| Gmail mailbox send | Gmail API / SMTP | **Unchanged** |
| Delivery confirmation | SES/generic webhooks only | + AMDS signed webhooks |
| Idempotency | `Communication.idempotencyKey` | Reuse + AMDS `idempotency_key` |
| Helpdesk tickets | Not implemented | Same AMDS pattern when module lands |

**Code touchpoints (existing)**

| File | Role |
|------|------|
| `server/services/emailService.js` | Provider routing — add AMDS branch |
| `server/platform/communication/email/runtimeConfigResolver.js` | Default provider — change to `amds` |
| `server/platform/communication/providers/emailProviderGateway.js` | Provider key detection |
| `server/platform/communication/outbound/outboundEmailSendService.js` | Agent send routing |
| `server/services/emailQueueService.js` | Async send worker |
| `server/models/Communication.js` | Delivery status + message IDs |
| `server/server.js` | Mount webhook before `express.json()` |

---

## 4. Provider selection (after integration)

Resolution order (unchanged pattern, new default):

```
1. Tenant integration: org.integrations['email-provider'].config.provider
2. Env: EMAIL_PROVIDER (CRM) / SYSTEM_EMAIL_PROVIDER (system)
3. Default: amds (if AMDS_BASE_URL + AMDS_API_KEY set) else resend (dev compat)
```

| Provider key | Transport | When used |
|--------------|-----------|-----------|
| `amds` | AMDS HTTP API | **Default** platform + system mail |
| `gmail` | Gmail API / SMTP | Connected mailbox (bypasses AMDS) |
| `aws-ses` | AWS SDK | Tenant/env override |
| `oci-email-delivery` | OCI SMTP | Tenant/env override |
| `resend` | Resend SMTP/API | Tenant/env override or AMDS-unconfigured dev |
| `smtp` | Generic nodemailer | Custom SMTP override |

Gmail sends in `outboundEmailSendService` are evaluated **before** platform provider — no change.

---

## 5. Phased roadmap

### Phase A — Foundation (client + config)

**Goal:** AMDS HTTP client and env wiring; no production traffic yet.  
**Status:** ✅ Done  

| # | Deliverable | File(s) | Acceptance |
|---|-------------|---------|------------|
| A1 | TypeScript/JSDoc types for AMDS API | `server/services/amds/amds-types.js` | Matches [ARIVU-INTEGRATION.md §3.3](./ARIVU-INTEGRATION.md#33-typescript-types) |
| A2 | HTTP client (`sendMessage`, `getMessageStatus`) | `server/services/amds/amds-client.js` | Bearer auth, 10s timeout, error wrapping |
| A3 | Config singleton + `isAmdsConfigured()` | `server/config/amds.js` | Lazy init; missing env → not configured (no crash at boot) |
| A4 | Provider module | `server/services/emailProviders/amdsEmailDelivery.js` | `PROVIDER_KEY`, `sendViaAmds()`, address parsing |
| A5 | Env vars in `.env.example` | `server/.env.example` | `AMDS_BASE_URL`, `AMDS_API_KEY`, `AMDS_WEBHOOK_SECRET`, `AMDS_WEBHOOK_PATH` |
| A6 | Unit tests | `server/services/amds/__tests__/`, `server/services/emailProviders/__tests__/amdsEmailDelivery.test.js` | Mock HTTP; idempotency key builder |

**Env (Arivu)**

```bash
AMDS_BASE_URL=http://localhost:8080
AMDS_API_KEY=amds_dev_key
AMDS_WEBHOOK_SECRET=dev_webhook_secret
AMDS_WEBHOOK_PATH=/api/internal/webhooks/amds
EMAIL_PROVIDER=amds
SYSTEM_EMAIL_PROVIDER=amds
```

**Env (AMDS — for local dev)**

```bash
ARIVU_WEBHOOK_URL=http://localhost:3000/api/internal/webhooks/amds
WEBHOOK_SIGNING_SECRET=dev_webhook_secret
AMDS_API_KEY=amds_dev_key
```

---

### Phase B — Send path integration

**Goal:** Platform outbound and system mail route through AMDS by default.  
**Status:** ✅ Done  

| # | Deliverable | File(s) | Acceptance |
|---|-------------|---------|------------|
| B1 | AMDS branch in `sendEmail()` | `server/services/emailService.js` | Before OCI/SES/SMTP when `provider === 'amds'` |
| B2 | `isRuntimeConfigReady()` for AMDS | `server/services/emailService.js` | Ready when `fromEmail` + AMDS env set (no SMTP creds) |
| B3 | Default provider → `amds` | `server/platform/communication/email/runtimeConfigResolver.js` | Fallback to `resend` if AMDS not configured |
| B4 | Provider key detection | `server/platform/communication/providers/emailProviderGateway.js` | `getActiveProviderKey()` returns `amds` |
| B5 | CC/BCC passthrough | `server/services/emailService.js`, gateway | AMDS request includes cc/bcc arrays |
| B6 | Idempotency key mapping | `server/services/emailProviders/amdsEmailDelivery.js` | `arivu-{module}-{tenantId}-comm-{communicationId}` |
| B7 | Retry policy (Arivu → AMDS) | `amds-client.js` or provider | 5xx/timeout: 3 retries, 1s/2s/4s backoff |
| B8 | Attachment policy | `server/services/emailService.js` | Phase 0a: fall back to SMTP if attachments + non-amds override, else clear error |
| B9 | Update seeder defaults | `server/services/communicationDefaultsSeeder.js` | Default integration provider `amds` |
| B10 | Integration registry copy | `server/constants/integrationRegistry.js` | List AMDS as default platform provider |

**Send result shape (AMDS accepted)**

```javascript
{
  success: true,
  messageId: '<uuid>',           // AMDS message_id
  provider: 'amds',
  deliveryStatus: 'queued'       // final delivery via webhook
}
```

**Communication update on accept (not final delivery)**

```javascript
{
  status: 'sent',                              // accepted by AMDS queue
  externalMessageId: messageId,
  providerMessageKey: `amds:${messageId}`,
  'metadata.provider': 'amds',
  'metadata.amdsMessageId': messageId
}
```

---

### Phase C — Webhook + delivery status

**Goal:** AMDS delivery events update Arivu records; idempotent processing.  
**Status:** ✅ Done  

| # | Deliverable | File(s) | Acceptance |
|---|-------------|---------|------------|
| C1 | HMAC signature middleware | `server/middleware/verifyAmdsSignature.js` | `X-AMDS-Timestamp` + `X-AMDS-Signature`, 5 min skew |
| C2 | Raw body route (pre-json) | `server/routes/internal/amdsWebhookRoutes.js` | Same pattern as `arivuInboundWebhookRoutes` |
| C3 | Mount in `server.js` | `server/server.js` | Before global `express.json()` |
| C4 | Webhook idempotency model | `server/models/AmdsWebhookEvent.js` | Unique index on `event_id`; optional 30-day TTL |
| C5 | Webhook handler | `server/controllers/amdsWebhookController.js` | Parse JSON after verify; ack 200 quickly |
| C6 | Communication event handler | `server/services/amds/handlers/communicationEventHandler.js` | Match `message_id` → update status |
| C7 | CommunicationEvent append | `server/services/communicationEventWriter.js` usage | Events: `amds_delivered`, `amds_failed` |
| C8 | Polling fallback API | `server/controllers/communicationsController.js` or service | If `sent` > 30s, `GET /v1/messages/:id` server-side |
| C9 | Health endpoint | `GET /api/internal/webhooks/amds/health` | Returns configured + AMDS reachability (optional) |
| C10 | Tests | webhook signature, duplicate event_id, status update | Manual curl test from integration doc §7 |

**Webhook → Communication mapping**

| AMDS `event_type` | `Communication.status` | Extra fields |
|-------------------|--------------------------|--------------|
| `message.delivered` | `delivered` | `metadata.deliveryUpdatedAt` |
| `message.failed` | `failed` | `metadata.deliveryError` |
| `message.bounced` | `bounced` | `metadata.bounceClassification`, `bounceDiagnostic`, `bounceRecipient` |

Match key: `metadata.arivu_communication_id` / `arivu_entity_id`, `externalMessageId`, or `providerMessageKey` (`amds:{message_id}`).

Metadata routing (from send):

```javascript
metadata: {
  arivu_module: relatedTo.moduleKey,   // e.g. workspace, people, cases
  arivu_entity_id: communicationId,
  arivu_communication_id: communicationId,
  arivu_org_id: organizationId
}
```

---

### Phase C2 — Track 3 (bounce, domains, typed errors)

**Goal:** Bounce webhooks, domain admin proxy, AMDS error codes on send (sync + queue).  
**Status:** ✅ Done  
**Depends on:** AMDS Track 3 (`npm run validate:track-3`)

| # | Deliverable | File(s) | Acceptance |
|---|-------------|---------|------------|
| T1 | `AmdsApiError` + Track 3 types | `amds-errors.js`, `amds-types.js` | 422/403/429 body fields |
| T2 | Client domains + suppressions + 429 retry | `amds-client.js` | `registerDomain`, `verifyDomain`, `createSuppression` |
| T3 | Bounce webhook handler | `communicationEventHandler.js`, `bounceContactHandler.js`, `bounceNotify.js` | `message.bounced` → Communication + suppression + notification |
| T4 | Send path 422/403 | `amdsEmailDelivery.js`, `communicationsController.js` | User-facing errors |
| T5 | Queue worker error codes | `emailQueueService.js`, `buildCommunicationUpdateFromSendResult` | `metadata.sendErrorCode` on async send failure |
| T6 | Domain settings API + UI | `amdsDomainsController.js`, `IntegrationsSettings.vue` | Register / verify DNS via Arivu proxy |
| T7 | Case timeline delivery badges | `CaseEmailTimelineMessage.vue` | Delivered / Bounced / Failed |
| T8 | Validation script | `server/scripts/validate-amds-track3-bounce.js` | Send → simulate-bounce → `status: bounced` |

**Validate locally:**

```bash
# Terminal 1 — AMDS
cd AMDS && npm run docker:up && npm run dev

# Terminal 2 — Arivu
cd Arivu/server && npm run dev

# Terminal 3 — bounce E2E
cd Arivu/server && node scripts/validate-amds-track3-bounce.js
```

---

### Phase D — UI and observability

**Goal:** Agents see send/delivery state; ops can diagnose AMDS issues.  
**Status:** 🟡 Partial (Track 3 case timeline + AMDS settings UI done)  
**Estimate:** 1–2 days remaining  
**Depends on:** Phase C + Track 3  

| # | Deliverable | File(s) | Acceptance |
|---|-------------|---------|------------|
| D1 | Expose delivery fields on Communication API | Existing serializers / lean responses | ✅ via `status` + `metadata` |
| D2 | Inbox / record email UI states | Client communication components | 🟡 Case email timeline badges; CRM inbox pending |
| D3 | Integrations settings — AMDS default | `IntegrationsSettings.vue` | ✅ AMDS provider + domain UI |
| D4 | Pipeline diagnostics | `/api/communications/pipeline-diagnostics` | AMDS provider stats, recent webhook failures |
| D5 | Logging | AMDS client + webhook handler | Structured logs; no secrets |
| D6 | Alerting guidance | `server/docs/R0_EMAIL_INFRA_RUNBOOK.md` or new AMDS runbook section | High `failed` rate, webhook 401s |

**UI status mapping**

| `Communication.status` | Display |
|------------------------|---------|
| `sending` | Spinner — "Sending…" |
| `sent` (AMDS queued) | Spinner — "Sending…" (or label "Queued") |
| `delivered` | Checkmark — "Delivered" |
| `bounced` | Warning — "Bounced" + `metadata.bounceDiagnostic` |
| `failed` | Error — show `metadata.deliveryError`; offer resend |

---

### Phase E — Production hardening

**Goal:** Safe rollout to OCI/production with fallback and ops runbook.  
**Status:** ⬜ Not started  
**Estimate:** 2–3 days  
**Depends on:** Phases A–D  

| # | Deliverable | Acceptance |
|---|-------------|------------|
| E1 | Private network: Arivu → AMDS (VCN IP / internal DNS) | No public exposure of AMDS `/v1/*` |
| E2 | Webhook URL on AMDS side → Arivu private endpoint | `ARIVU_WEBHOOK_URL` matches production |
| E3 | Secret rotation runbook | Quarterly `AMDS_API_KEY` + `AMDS_WEBHOOK_SECRET` |
| E4 | Feature flag (optional) | `AMDS_ENABLED=true` for gradual rollout |
| E5 | Staged migration | Week 1: `EMAIL_PROVIDER=amds` staging only; Week 2: production |
| E6 | Rollback | Set `EMAIL_PROVIDER=resend` or `oci-email-delivery` — no code deploy |
| E7 | Monitor AMDS queue depth + Arivu failed send rate | Dashboard or log alerts |

---

### Phase F — Helpdesk module (future)

**Goal:** When Helpdesk ships, wire ticket replies through the same AMDS pipeline.  
**Status:** 🟡 Partial — Cases outbound + webhook + timeline done via Communication model  
**Depends on:** Helpdesk module + AMDS Phase 1 stable  

| # | Deliverable | Notes |
|---|-------------|-------|
| F1 | Ticket reply schema AMDS fields | Per [ARIVU-INTEGRATION.md §5.2](./ARIVU-INTEGRATION.md#52-mongodb-schema-changes) |
| F2 | `sendTicketReplyEmail` service | Idempotency: `arivu-helpdesk-{orgId}-ticket-{ticketId}-reply-{replyId}` |
| F3 | Helpdesk webhook handler | Route `metadata.arivu_module === 'helpdesk'` |
| F4 | Helpdesk UI delivery states | Same pattern as Phase D |

Reuse Phases A–C infrastructure — no second AMDS client.

---

## 6. Open decisions (resolve before Phase B)

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Attachments on AMDS path | Block / SMTP fallback / wait for AMDS API | **SMTP fallback** when tenant has SMTP configured; else block with clear error until AMDS Phase 2 |
| 2 | `sent` vs new `queued` status | Reuse `sent` / add enum value | Reuse `sent` for AMDS accept; webhook sets `delivered`/`failed` (no schema migration) |
| 3 | System mail on AMDS | All system mail / CRM only | **All system mail** default to AMDS; keep `SYSTEM_EMAIL_PROVIDER=oci-email-delivery` override |
| 4 | Dev without AMDS | Fail / fallback | **Fallback to resend** when `AMDS_BASE_URL` unset |
| 5 | Implementation language | TypeScript / JavaScript | **JavaScript + JSDoc** (matches repo) |

---

## 7. File checklist (new + modified)

### New files

| Path | Phase |
|------|-------|
| `server/services/amds/amds-types.js` | A |
| `server/services/amds/amds-client.js` | A |
| `server/services/amds/index.js` | A |
| `server/config/amds.js` | A |
| `server/services/emailProviders/amdsEmailDelivery.js` | A |
| `server/middleware/verifyAmdsSignature.js` | C |
| `server/routes/internal/amdsWebhookRoutes.js` | C |
| `server/controllers/amdsWebhookController.js` | C |
| `server/models/AmdsWebhookEvent.js` | C |
| `server/services/amds/handlers/communicationEventHandler.js` | C |
| `server/services/amds/__tests__/amds-client.test.js` | A |
| `server/services/emailProviders/__tests__/amdsEmailDelivery.test.js` | A |

### Modified files

| Path | Phase |
|------|-------|
| `server/services/emailService.js` | B |
| `server/platform/communication/email/runtimeConfigResolver.js` | B |
| `server/platform/communication/providers/emailProviderGateway.js` | B |
| `server/platform/communication/outbound/outboundEmailSendService.js` | B |
| `server/services/communicationDefaultsSeeder.js` | B |
| `server/constants/integrationRegistry.js` | B |
| `server/server.js` | C |
| `server/.env.example` | A |
| `client/src/components/settings/IntegrationsSettings.vue` | D |
| `server/docs/R0_EMAIL_INFRA_RUNBOOK.md` | E |

---

## 8. Test plan (per phase)

### Phase A

- [ ] `AmdsClient.sendMessage` — mock 202, stores `message_id`
- [ ] `AmdsClient.sendMessage` — mock 400, no retry
- [ ] `AmdsClient.sendMessage` — mock 5xx, retries 3 times
- [ ] `isAmdsConfigured()` false when env missing

### Phase B

- [ ] Send Communication without mailbox → AMDS `POST /v1/messages` called
- [ ] Send with Gmail mailbox → Gmail path, AMDS not called
- [ ] `EMAIL_PROVIDER=aws-ses` → SES path, AMDS not called
- [ ] Duplicate idempotency key → same `message_id`, no duplicate email
- [ ] Send with attachments → fallback or error per decision §6

### Phase C

- [ ] Valid webhook signature → `Communication.status = delivered`
- [ ] Invalid signature → 401
- [ ] Duplicate `event_id` → 200 `{ duplicate: true }`, no double update
- [ ] Failed delivery webhook → `status = failed`, error stored
- [ ] Poll fallback recovers status when webhook delayed

### Phase D–E

- [ ] UI shows Sending / Delivered / Failed
- [ ] Staging end-to-end: reply → Mailpit → webhook → UI
- [ ] Rollback: `EMAIL_PROVIDER=resend` restores previous behavior

---

## 9. Local development checklist

Prerequisites:

- AMDS repo: `npm run setup && npm run dev`
- Arivu API: `http://localhost:3000`
- Mailpit UI: `http://localhost:8025`

Steps:

1. Set Arivu + AMDS env vars (§5 Phase A).
2. Complete Phases A → C.
3. Send test email from CRM record or workspace inbox.
4. Confirm email in Mailpit within ~5 seconds.
5. Confirm webhook updates `Communication.status` to `delivered`.
6. Run manual webhook curl from [ARIVU-INTEGRATION.md §7](./ARIVU-INTEGRATION.md#7-local-development-checklist).

---

## 10. Timeline summary

| Phase | Name | Estimate | Cumulative |
|-------|------|----------|------------|
| **A** | Foundation (client + config) | 2–3 days | ~3 days |
| **B** | Send path integration | 3–4 days | ~7 days |
| **C** | Webhook + delivery status | 3–4 days | ~11 days |
| **D** | UI + observability | 2–3 days | ~14 days |
| **E** | Production hardening | 2–3 days | ~17 days |
| **F** | Helpdesk (future) | TBD | — |

**MVP for first production send:** Phases **A + B + C** (~2 weeks).

---

## 11. Success metrics

| Metric | Target |
|--------|--------|
| Platform sends via AMDS (non-Gmail) | > 95% when `EMAIL_PROVIDER=amds` |
| Webhook processing latency (p95) | < 500 ms |
| Duplicate send rate (idempotency failures) | 0 |
| Delivery confirmation within 60s | > 99% (webhook or poll) |
| Failed delivery rate (AMDS `message.failed`) | Baseline + alert threshold TBD |

---

## 12. Maintenance

- **API contract changes:** update [ARIVU-INTEGRATION.md](./ARIVU-INTEGRATION.md) in AMDS repo first, then sync this roadmap and Arivu code.
- **New AMDS webhook events** (`message.bounced`, etc.): extend Phase C handler; wire to existing suppression pipeline from Communication Platform Phase 2.
- **Do not** add parallel outbound frameworks — extend `emailService` + `emailProviderGateway` + AMDS handler only.

---

*Phases A–C are implemented. Next: Phase D (UI + observability), then Phase E (production hardening).*
