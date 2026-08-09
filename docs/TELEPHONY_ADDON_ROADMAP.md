# Telephony Addon — Implementation Roadmap

**Product placement:** Settings → Addons (installable capability)  
**Architecture alignment:** Provider-agnostic `TelephonyProvider` registry + Call Manager + SSE + Process Designer + Notification Engine + Bull workers  
**First provider:** Twilio (Voice + WebRTC Client SDK + signed webhooks)  
**Last updated:** 2026-08-06

---

## 1. Locked principles

1. Telephony is an **addon** (`telephony`), not a Helpdesk-style app.
2. CRM never calls provider SDKs — only `getProviderForOrganization()` → `TelephonyProvider`.
3. Product realtime uses **SSE** (`telephonySSEHub`); WebRTC media talks to the provider (Twilio Device).
4. Telephony owns calls, recordings, transcripts, queues, IVR, campaigns; CRM apps store **references** on Activities/Timeline.
5. Adding a provider = new adapter + registry entry; CallManager/CRM unchanged.

## 2. Surfaces

| Surface | Route |
|---------|--------|
| Calls | `/telephony/calls` |
| Call detail | `/telephony/calls/:callId` |
| Phone numbers | `/telephony/phone-numbers` |
| Provider settings | `/telephony/settings` |
| Queues | `/telephony/queues` |
| Agents | `/telephony/agents` |
| IVR | `/telephony/ivr` |
| Campaigns | `/telephony/campaigns` |
| Analytics | `/telephony/analytics` |
| Recordings | `/telephony/recordings` |
| Softphone | Global dock (entitled users) |

## 3. API

- Authenticated: `/api/telephony/*` — entitlement + `telephony.*` permissions
- Webhooks: `/api/telephony/webhooks/:provider` — signature validation, idempotent receipts

## 4. Providers registered

| Key | Status |
|-----|--------|
| `twilio` | Production adapter (token, place/hangup/mute/hold, recording, webhooks) |
| `exotel` | Registered stub / normalize webhooks |
| `plivo` | Registered stub / normalize webhooks |
| `knowlarity` | Registered stub / normalize webhooks |
| `generic_sip` | Registered stub |

## 5. Process Designer triggers

- `TELEPHONY_INCOMING_CALL`
- `TELEPHONY_CALL_ANSWERED`
- `TELEPHONY_CALL_ENDED`
- `TELEPHONY_CALL_MISSED`
- `TELEPHONY_RECORDING_READY`
- `TELEPHONY_VOICEMAIL_RECEIVED`
- `TELEPHONY_TRANSCRIPT_READY`
- `TELEPHONY_SUMMARY_READY`

Install seeds a Missed Call → Create Task recipe.

## 6. Permissions

`telephony.{view,call,listen,download,manage,admin,ai}`

## 7. Ops checklist

1. Seed addon catalog (`seedAddonDefinitions`)
2. Install Telephony from Settings → Addons
3. Configure Twilio credentials + TwiML App + from-number
4. Point Twilio voice/status callbacks to `/api/telephony/webhooks/twilio`
5. Ensure worker process runs (`telephony-jobs` Bull queue)

## 8. Follow-ups

- Encrypt provider credentials at rest
- Copy recordings into object storage with retention cleanup
- Full Plivo/Exotel/Knowlarity Voice + WebRTC mappings
- Whisper/STT via AI adapter port (summary already uses LLM when keyed)
