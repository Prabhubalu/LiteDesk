# Helpdesk realtime alerts

Agent-facing alerts when cases receive inbound email, live chat messages, or new-case events — plus dev tools to simulate them without production traffic.

**Related:** [HELPDESK_CASES_ROADMAP.md](./HELPDESK_CASES_ROADMAP.md) · [HELPDESK_QA_ROLLOUT_CHECKLIST.md](./HELPDESK_QA_ROLLOUT_CHECKLIST.md)

---

## Completed (current implementation)

### Server

| Item | Status | Notes |
|------|--------|--------|
| `HELPDESK` app key on notification SSE stream | ✅ | `GET /api/notifications/stream?appKey=HELPDESK` |
| Domain events `CASE_EMAIL_RECEIVED`, `CASE_CHAT_MESSAGE_RECEIVED` | ✅ | Emitted after inbound email / live chat ingestion |
| Notification rules + recipient resolver | ✅ | `CASE_NOTIFY_TARGETS` — case owner, else HELPDESK agents, else org admins |
| Case notifications on create / assign / SLA (existing) | ✅ | Via `caseExecutionService` + `notificationEngine` |
| `Notification` / `NotificationPreference` models allow `HELPDESK` | ✅ | Required for persistence |
| HELPDESK default in-app preferences | ✅ | `notificationPreferenceBootstrap.js` |
| Skip notifying `triggeredBy` user | ✅ | Avoid self-alert when agent creates case |
| Dev simulation API | ✅ | `POST /api/notifications/dev/simulate` (non-prod or `ENABLE_NOTIFICATION_SIMULATE=true`) |
| CLI `npm run simulate:helpdesk-notification` | ✅ | `server/scripts/simulateHelpdeskNotification.js` |

### Client

| Item | Status | Notes |
|------|--------|--------|
| Route → `HELPDESK` app key (`/helpdesk/...`) | ✅ | `notificationAppKey.js`; bell reconnects on app switch |
| SSE + unread badge + bell ring | ✅ | `NotificationBell.vue`, `useNotificationStream.js` |
| Toast on inbound helpdesk events | ✅ | `helpdeskNotificationAlerts.js` |
| Two-tone sound (Web Audio) | ✅ | `helpdeskNotificationSound.js`; mute via `localStorage` key `helpdesk_notification_sound_enabled` |
| **Internal tab title stacking** (Gmail-style) | ✅ | Background case tab: `New email · New email · {case title}` (or `New message · …`) |
| **Internal tab highlight** | ✅ | Amber background on unread background tabs |
| **Tab icon animation** | ✅ | Email: wiggle + amber pulse ring; chat: pulse + green ring; respects `prefers-reduced-motion` |
| Clear tab alert on tab focus | ✅ | `switchToTab` clears prefix + highlight |
| Dev panel “Test helpdesk alerts” | ✅ (opt-in) | `VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL=true` in `client/.env.local` |

### Event types with realtime UI today

| Event | Bell / toast / sound | Internal tab (if case tab open in background) |
|-------|----------------------|-----------------------------------------------|
| `CASE_EMAIL_RECEIVED` | ✅ | ✅ stack + email icon animation |
| `CASE_CHAT_MESSAGE_RECEIVED` | ✅ | ✅ stack + chat icon animation |
| `CASE_CREATED` | ✅ | ❌ (no tab prefix; no dedicated case tab yet) |
| `CASE_ASSIGNED`, SLA, etc. | ✅ (existing rules) | ❌ |

### Not done yet (follow-ups)

- Settings UI toggle for notification sound (only `localStorage` today).
- Click toast → navigate to case.
- HELPDESK alerts while user is on **Sales** (would need a second background SSE connection).
- Tab alert on **Cases list** tab when only list is open (only **case detail** tabs today).
- `CASE_CREATED` tab highlighting when case opened in background tab.

---

## Prerequisites (testing)

1. **MongoDB** — `MONGODB_URI` (or `MONGO_URI`) in `server/.env`.
2. **API server** running — `cd server && npm start` (or your usual dev command).
3. **Target user** — must have `HELPDESK` in `allowedApps`.
4. **Browser** — logged in as that user on a **`/helpdesk/...`** route (e.g. `/helpdesk/cases`). SSE is scoped per app; Sales routes do not receive HELPDESK stream events.
5. **Sound** — click the page once before testing; browsers often block audio until user gesture.

---

## QA: internal tab alerts

1. Open a case: `/helpdesk/cases/<caseId>` (internal tab created).
2. Open another internal tab (e.g. Cases list) so the case tab is **in the background**.
3. Simulate inbound activity (dev panel **Server + SSE → Email** or CLI below) using that `caseId`.
4. **Expect:** case tab title stacks `New email · … · {case title}`, amber tab background, animated case icon.
5. Click the case tab → title and styling reset to normal.

Repeat with **Chat** / `CASE_CHAT_MESSAGE_RECEIVED` (green pulse on icon).

---

## CLI: `simulate:helpdesk-notification`

Run from the **`server`** directory:

```bash
cd server
npm run simulate:helpdesk-notification
```

### Help

```bash
npm run simulate:helpdesk-notification -- --help
```

### Options

| Flag | Description |
|------|-------------|
| `--event <TYPE>` | Event to simulate. Default: `CASE_EMAIL_RECEIVED`. |
| `--mode self\|pipeline` | Delivery mode. Default: `self`. |
| `--user-email <email>` | Target user by email. |
| `--user-id <id>` | Target user by MongoDB ObjectId. |
| `--case-id <id>` | Case ObjectId. **Required** for `pipeline` mode. |

If neither `--user-email` nor `--user-id` is set, the script picks the first active user with `HELPDESK` in `allowedApps`.

### Event types (`--event`)

| Value | Simulates |
|-------|-----------|
| `CASE_CREATED` | New case |
| `CASE_EMAIL_RECEIVED` | Inbound customer email on a case |
| `CASE_CHAT_MESSAGE_RECEIVED` | Visitor live chat message |

### Modes (`--mode`)

| Mode | Behavior |
|------|----------|
| **`self`** (default) | Writes an IN_APP notification for the target user and pushes it over SSE. Best for verifying bell, toast, sound, and tab alerts (with open case tab + `--case-id`). |
| **`pipeline`** | Runs the real notification engine (rules + recipient resolver). Use with `--case-id`. You only receive the alert if you are a configured target (e.g. case owner, helpdesk agent pool). |

### Examples

Default (email alert to first HELPDESK user):

```bash
npm run simulate:helpdesk-notification
```

Tab alert test (use real case id):

```bash
npm run simulate:helpdesk-notification -- \
  --user-email you@company.com \
  --case-id 674a1b2c3d4e5f6789012345 \
  --event CASE_EMAIL_RECEIVED
```

Live chat message:

```bash
npm run simulate:helpdesk-notification -- --event CASE_CHAT_MESSAGE_RECEIVED
```

New case:

```bash
npm run simulate:helpdesk-notification -- --event CASE_CREATED
```

Full pipeline (real routing) for a case you own:

```bash
npm run simulate:helpdesk-notification -- \
  --user-email admin@example.com \
  --mode pipeline \
  --case-id 674a1b2c3d4e5f6789012345 \
  --event CASE_EMAIL_RECEIVED
```

### Expected CLI output

On success you should see the target user email, event type, mode, and notification id (for `self` mode). In the browser (on `/helpdesk/`): unread badge, toast, optional sound, bell ring animation; if a matching case tab is in the background, stacked title + highlight + icon animation.

---

## HTTP API (alternative to CLI)

Requires a valid Bearer token (same as the app). Routes are under `/api/notifications` and use normal auth middleware.

All simulation entry points are **disabled in production** unless you set `ENABLE_NOTIFICATION_SIMULATE=true`.

### Metadata

```bash
curl -s http://localhost:3000/api/notifications/dev/simulate/meta \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Simulate (delivers to the authenticated user)

```bash
curl -X POST http://localhost:3000/api/notifications/dev/simulate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"CASE_EMAIL_RECEIVED","mode":"self","caseId":"674a1b2c3d4e5f6789012345"}'
```

Pipeline example:

```bash
curl -X POST http://localhost:3000/api/notifications/dev/simulate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "CASE_CREATED",
    "mode": "pipeline",
    "caseId": "674a1b2c3d4e5f6789012345"
  }'
```

**Body fields**

| Field | Required | Description |
|-------|----------|-------------|
| `eventType` | Yes | `CASE_CREATED`, `CASE_EMAIL_RECEIVED`, or `CASE_CHAT_MESSAGE_RECEIVED` |
| `mode` | No | `self` (default) or `pipeline` |
| `caseId` | For `pipeline`; recommended for tab tests in `self` | MongoDB case `_id` |

Replace `localhost:3000` with your API base URL if different.

---

## In-app dev panel (opt-in)

**Hidden by default.** Not shown in production builds.

To enable locally, add to `client/.env.local`:

```env
VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL=true
```

Restart the Vite dev server, then:

1. Open any `/helpdesk/...` page while logged in.
2. Click **“Test helpdesk alerts”** (bottom-right).
3. **UI only** — instant toast/sound/badge/tab update (uses route `caseId` when on a case page).
4. **Server + SSE** — full path same as CLI `self` mode for the logged-in user.

Remove the env line (or set to `false`) to hide the panel again.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| CLI says simulation disabled | `NODE_ENV` must not be `production`, or set `ENABLE_NOTIFICATION_SIMULATE=true`. |
| No bell/toast in browser | Tab must be on `/helpdesk/...`; user needs `HELPDESK` in `allowedApps`. |
| SSE never connects | Network tab: `GET /api/notifications/stream?appKey=HELPDESK`; 403 = missing app entitlement. |
| No sound | Click the page once; `localStorage` `helpdesk_notification_sound_enabled` ≠ `'false'`. |
| No internal tab highlight | Case detail tab must exist for that `caseId` and be **not** the active tab. |
| Pipeline mode: nothing received | Try `self` mode or use a case where you are owner / in HELPDESK pool. |
| Notifications not persisted | Restart server after deploy; `Notification.appKey` must include `HELPDESK`. |

---

## Related local simulators (email / mailroom)

These exercise inbound **content** (cases, mailroom), not the bell directly. After ingestion, notifications fire through the normal pipeline when configured.

| Command | Purpose | More detail |
|---------|---------|-------------|
| `npm run simulate:mailbox` | Create a test mailbox locally | `server/platform/mailroom/README.md` |
| `npm run simulate:parser-inbound` | Inject a fake inbound email | `server/docs/INBOUND_PARSER_CRM_INTEGRATION.md` |

Example flow: create mailbox → simulate inbound → confirm case activity **and** agent alerts (bell + tab if case tab is backgrounded).

---

## Implementation reference

### Server

| Piece | Path |
|-------|------|
| Domain events | `server/constants/domainEvents.js` |
| Rules | `server/constants/notificationRules.js` |
| Recipients | `server/services/notificationRecipientResolver.js` |
| Case emit helpers | `server/services/caseNotificationService.js` |
| Ingestion hooks | `server/services/helpdeskChannelIngestionService.js` |
| Engine + SSE publish | `server/services/notificationEngine.js` |
| SSE controller | `server/controllers/notificationStreamController.js` |
| Preferences bootstrap | `server/services/notificationPreferenceBootstrap.js` |
| Models | `server/models/Notification.js`, `NotificationPreference.js` |
| CLI script | `server/scripts/simulateHelpdeskNotification.js` |
| Simulator service | `server/services/notificationDevSimulator.js` |
| HTTP controller | `server/controllers/notificationDevController.js` |
| Routes | `server/routes/notificationRoutes.js` |

### Client

| Piece | Path |
|-------|------|
| App key from route | `client/src/utils/notificationAppKey.js` |
| Notification store | `client/src/stores/notifications.js` |
| Toast + sound | `client/src/utils/helpdeskNotificationAlerts.js`, `helpdeskNotificationSound.js` |
| Internal tab alerts | `client/src/utils/helpdeskTabAlerts.js` |
| Tab bar UI + icon animation | `client/src/components/TabBar.vue` |
| Tab state | `client/src/composables/useTabs.js` |
| Bell / SSE | `client/src/components/notifications/NotificationBell.vue`, `useNotificationStream.js` |
| Dev panel | `client/src/components/dev/HelpdeskNotificationDevPanel.vue` |
| i18n tab labels | `client/src/locales/en/navigation.json` (`tabNewEmail`, `tabNewMessage`) |
| npm script | `server/package.json` → `simulate:helpdesk-notification` |
