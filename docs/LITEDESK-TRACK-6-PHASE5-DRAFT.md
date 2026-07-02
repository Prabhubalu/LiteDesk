# LiteDesk Track 6 Phase 5 — Infrastructure Alerts & Recovery UX

**Audience:** LiteDesk backend + frontend developers  
**AMDS dependency:** Track 6 Phase 5 — see [TRACK-6-PHASE5-COMPLETE.md](./TRACK-6-PHASE5-COMPLETE.md)

---

## 1. Goal

Surface platform-level throttling and reputation recovery limits so admins understand why throughput dropped or score recovery is slow.

---

## 2. AMDS APIs to consume

| Endpoint | Use |
|----------|-----|
| `GET /v1/tenants/:id/reputation` | `recovery.day_start_score`, `recovery.remaining_gain_today` |
| `GET /v1/tenants/:id/throughput` | `multipliers.infra` — show when < 1 |
| `GET /v1/admin/infra/status` | Platform ops dashboard (internal) |

---

## 3. Files modified

| File | Action |
|------|--------|
| `server/models/org-email-policy.js` | Cache recovery + infra multiplier fields |
| `server/services/amds/amds-types.js` | Recovery + infra status types |
| `server/services/amds/amds-client.js` | `getInfraStatus` |
| `server/services/orgEmailPolicyService.js` | Cache recovery/infra on refresh |
| `server/services/amds/handlers/tenantEventHandler.js` | Webhook + async AMDS poll |
| `server/services/marketing/marketingCampaignCreditPrecheckService.js` | `infraMultiplier` in throughput summary |
| `server/controllers/platformAmdsInfraController.js` | Platform admin infra status |
| `server/routes/platformAmdsRoutes.js` | `GET /api/platform/amds/infra/status` |
| `client/src/components/settings/EmailPolicyCreditsPanel.vue` | Recovery + infra banners |
| `client/src/components/marketing/CampaignSendDrawer.vue` | Infra load banner |
| `client/src/views/ControlPlaneAmdsInfra.vue` | Platform ops dashboard |
| `client/src/views/ControlPlane.vue` | Control plane nav card |
| `client/src/router/index.js` | `/control/amds-infra` route |

---

## 4. UI

### Settings → Email reputation

Recovery banner when `remaining_gain_today < 3`:

> Reputation can rise up to **{remaining_gain_today}** more points today. Consistent good sending improves your score over time.

### Settings → Send throughput / Campaign composer

When `multipliers.infra < 1`:

> Platform is under heavy load. Effective send rate temporarily reduced.

### Control Plane → AMDS Infrastructure

Platform admins: `GET /api/platform/amds/infra/status` → `/control/amds-infra`

---

## 5. Webhooks

No new webhook types. Continue using `throughput.updated` and `reputation.updated`. Handlers apply webhook payload immediately, then poll AMDS for full recovery/infra fields.

---

## 6. Acceptance criteria

- [ ] Settings reputation panel shows recovery banner when `remaining_gain_today < 3`
- [ ] Settings throughput + campaign send drawer show infra banner when `infraMultiplier < 1`
- [ ] Platform admin can view AMDS infra status in Control Plane
- [ ] Recovery and infra fields cached on policy refresh and webhook events

---

*Draft — July 2, 2026*
