# Arivu Track 6 Phase 3 — Dynamic Throughput & Campaign ETA

**Audience:** Arivu backend + frontend developers  
**AMDS dependency:** Track 6 Phase 3 — see [TRACK-6-PHASE3-COMPLETE.md](./TRACK-6-PHASE3-COMPLETE.md) (AMDS repo)  
**Prerequisite:** [ARIVU-TRACK-6-PHASE1-DRAFT.md](./ARIVU-TRACK-6-PHASE1-DRAFT.md) (policy sync) + [ARIVU-TRACK-6-PHASE2-DRAFT.md](./ARIVU-TRACK-6-PHASE2-DRAFT.md) (reputation display)

---

## 1. Goal

Show users **how fast** mail will send (effective rate + ETA), not just credits and reputation. Block marketing sends when reputation < 40.

---

## 2. Files to modify

| File | Action |
|------|--------|
| `server/constants/emailPolicyDefaults.js` | `MARKETING_MIN_SENDER_REPUTATION` (40) |
| `server/services/amds/amds-client.js` | `getTenantThroughput`, `getCampaignEstimate` |
| `server/services/amds/amds-types.js` | Throughput + estimate types |
| `server/services/amds/handlers/tenantEventHandler.js` | `throughput.updated` webhook |
| `server/services/amds/amds-errors.js` | `marketing_restricted` user message |
| `server/models/org-email-policy.js` | Cache effective rates + warmup stage |
| `server/services/orgEmailPolicyService.js` | Serialize throughput, refresh + send guard |
| `server/services/marketing/marketingCampaignCreditPrecheckService.js` | Reputation check + estimate fetch |
| `server/controllers/marketingCampaignController.js` | Pre-check extension + send guard |
| `server/controllers/emailPolicyController.js` | Refresh throughput on policy GET/sync |
| `client/src/components/marketing/CampaignSendDrawer.vue` | ETA + effective rate UI |
| `client/src/components/settings/EmailPolicyCreditsPanel.vue` | Throughput card |
| `client/src/locales/en/marketing.json` | ETA / throughput / reputation block strings |
| `client/src/locales/en/settings.json` | Throughput settings strings |
| `server/scripts/validate-amds-track6-phase3.js` | E2E throughput + estimate test |

---

## 3. Types

Add to `server/services/amds/amds-types.js`:

```javascript
/**
 * @typedef {Object} TenantThroughputResponse
 * @property {string} tenant_id
 * @property {number} max_hourly_rate
 * @property {number} max_burst_rate
 * @property {number} effective_hourly_rate
 * @property {number} effective_burst_rate
 * @property {{ reputation: number, warmup: number, infra: number, combined: number, warmup_stage: string }} multipliers
 * @property {number} reputation_score
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CampaignEstimateResponse
 * @property {string} campaign_id
 * @property {string} tenant_id
 * @property {number} recipient_count
 * @property {TenantThroughputResponse} throughput
 * @property {number|null} estimated_seconds
 * @property {string|null} estimated_completion
 */
```

Extend `AmdsTenantEventType` with `'throughput.updated'` and add optional `throughput` on `AmdsTenantWebhookEvent`.

---

## 4. AMDS client

```javascript
async getTenantThroughput(tenantId) {
  const { data } = await this.http.get(
    `/v1/tenants/${encodeURIComponent(tenantId)}/throughput`
  );
  return data;
}

async getCampaignEstimate(tenantId, campaignId, recipientCount) {
  const { data } = await this.http.get(
    `/v1/campaigns/${encodeURIComponent(campaignId)}/estimate`,
    { params: { tenant_id: tenantId, recipient_count: recipientCount } }
  );
  return data;
}
```

---

## 5. Webhook — `throughput.updated`

```javascript
case 'throughput.updated': {
  if (!event.throughput) return;
  await OrgEmailPolicy.findOneAndUpdate(
    { organizationId },
    {
      effectiveHourlyRate: event.throughput.effective_hourly_rate,
      effectiveBurstRate: event.throughput.effective_burst_rate,
      warmupStage: event.throughput.multipliers?.warmup_stage ?? null,
      throughputUpdatedAt: new Date()
    }
  );
  break;
}
```

---

## 6. Settings API response

Extend `GET /api/settings/email-policy` (and sync) — poll AMDS throughput on load like reputation:

```json
{
  "maxHourlyRate": 5000,
  "effectiveHourlyRate": 3750,
  "effectiveBurstRate": 62,
  "warmupStage": "stage_2",
  "throughputUpdatedAt": "2026-07-02T12:00:00.000Z",
  "senderReputation": 86
}
```

Optional proxy (not required for Phase 3): `GET /api/settings/email-policy/throughput` → AMDS throughput API.

---

## 7. Campaign precheck API

Extend `GET /api/marketing/campaigns/:id/precheck?recipientCount=N`:

```json
{
  "ready": true,
  "checks": [
    { "key": "senderReputation", "status": "ok", "message": "Sender reputation: 86 / 100" }
  ],
  "credits": { "recipientCount": 25000, "creditsNeeded": 25000, "creditsRemaining": 80000 },
  "throughput": {
    "maxHourlyRate": 5000,
    "effectiveHourlyRate": 3750,
    "senderReputation": 86,
    "warmupStage": "stage_2"
  },
  "estimate": {
    "estimatedSeconds": 24000,
    "estimatedCompletion": "2026-07-02T18:40:00.000Z"
  }
}
```

When `reputationEnabled` and `senderReputation < 40`, add blocking check with `status: "error"` and `ready: false`.

Campaign external ID for AMDS estimate = Arivu campaign `_id` string (same as batch send).

---

## 8. Campaign send drawer UI

`CampaignSendDrawer.vue` receives extended precheck from `CampaignDetail.vue` when the user opens Send or Schedule. Display after credit summary:

```text
Recipients:              25,000
Credits required:        25,000
Credits remaining:       80,000
Sender reputation:       86 / 100
Max hourly rate:         5,000 / hour
Current effective rate:  3,750 / hour
Estimated completion:    6 hours 40 minutes
```

Disable **Send** when precheck `ready === false` (includes reputation < 40).

---

## 9. Marketing send guard

In `marketingCampaignController.sendCampaign` (and `scheduleCampaign`):

```javascript
const reputationGuard = await assertMarketingSendAllowed(organizationId);
if (!reputationGuard.allowed) {
  return res.status(403).json({
    success: false,
    code: reputationGuard.code,
    message: reputationGuard.error
  });
}
```

Handle AMDS `403 marketing_restricted` via `AmdsApiError.isMarketingRestricted` as fallback on batch send.

---

## 10. Settings throughput card

`EmailPolicyCreditsPanel.vue` — section after reputation card:

```vue
<section v-if="policy.effectiveHourlyRate != null">
  <h5>{{ t('settings.emailPolicyThroughputTitle') }}</h5>
  <dl>
    <dt>{{ t('settings.emailPolicyMaxHourlyRate') }}</dt>
    <dd>{{ formatLimit(policy.maxHourlyRate) }}/hr</dd>
    <dt>{{ t('settings.emailPolicyEffectiveHourlyRate') }}</dt>
    <dd>{{ formatLimit(policy.effectiveHourlyRate) }}/hr</dd>
    <dt>{{ t('settings.emailPolicyWarmupStage') }}</dt>
    <dd>{{ policy.warmupStage || '—' }}</dd>
  </dl>
  <p class="hint">{{ t('settings.emailPolicyThroughputHint') }}</p>
</section>
```

---

## 11. i18n keys (en)

**marketing.json**

| Key | Message |
|-----|---------|
| `campaignsThroughputReputation` | Sender reputation: {score} / 100 |
| `campaignsThroughputMaxHourly` | Max hourly rate: {rate} / hour |
| `campaignsThroughputEffectiveHourly` | Current effective rate: {rate} / hour |
| `campaignsEstimateCompletion` | Estimated completion: {duration} |
| `campaignsEstimateDurationHoursMinutes` | {hours} hours {minutes} minutes |
| `campaignsEstimateDurationHours` | {hours} hours |
| `campaignsEstimateDurationMinutes` | {minutes} minutes |
| `campaignsReputationBlocked` | Marketing campaigns require sender reputation of at least 40. |

**settings.json**

| Key | Message |
|-----|---------|
| `emailPolicyThroughputTitle` | Send throughput |
| `emailPolicyEffectiveHourlyRate` | Effective hourly rate |
| `emailPolicyWarmupStage` | Warm-up stage |
| `emailPolicyThroughputHint` | Effective rate = max rate × reputation × warm-up × infrastructure. |

Run `npm run i18n:sync-keys` after adding en keys.

---

## 12. Checklist

```
[ ] emailPolicyDefaults — MARKETING_MIN_SENDER_REPUTATION
[ ] amds-client — getTenantThroughput, getCampaignEstimate
[ ] amds-types — throughput + estimate types
[ ] tenantEventHandler — throughput.updated
[ ] OrgEmailPolicy — effectiveHourlyRate, effectiveBurstRate, warmupStage cache
[ ] orgEmailPolicyService — refresh + assertMarketingSendAllowed
[ ] marketingCampaignCreditPrecheckService — reputation + estimate
[ ] CampaignSendDrawer — ETA + effective rate
[ ] marketingCampaignController — send guard + precheck extension
[ ] EmailPolicyCreditsPanel — throughput display
[ ] validate-amds-track6-phase3.js
[ ] i18n en keys + sync
```

---

## 13. Testing

```bash
# AMDS
npm run validate:track-6c

# Arivu (after implementation)
node server/scripts/validate-amds-track6-phase3.js [organizationId]
```

Script should:

1. Sync policy with `max_hourly_rate` 5000
2. GET AMDS throughput → verify effective rate reflects reputation multiplier
3. GET campaign estimate for 25k recipients
4. Simulate `throughput.updated` webhook → MongoDB cache updated
5. Verify reputation < 40 blocks `assertMarketingSendAllowed`

Manual UI:

1. Campaign composer shows ETA for large audience
2. Reputation 35 → send button disabled + error check in precheck

---

## 14. Out of scope (Phase 4)

| Feature | Phase |
|---------|-------|
| Full reputation guidance + recommendations | Phase 4 |
| Throughput history charts | Phase 4 |

---

**Last updated:** July 2, 2026
