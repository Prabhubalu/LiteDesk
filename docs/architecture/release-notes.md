# Release Notes / What's New — Implementation Spec

**Status:** Ready for engineering  
**Scope:** v1 production-grade  
**Aligned with:** `Architecture_Document.md`, `docs/USER_ONBOARDING_ARCHITECTURE.md`, `GlobalSurfacesProvider` invariants

---

## 1. Purpose

Platform-wide product announcements authored by Arivu platform admins and surfaced to tenant users on app load and via Help → What's New.

**Not in scope (v1):**
- Tenant-authored release notes
- In-app tours linked to items
- Public changelog page / RSS
- Email digest of releases (use notification engine in v2)
- Localized release content (English platform copy in v1; UI chrome is i18n)
- Org-level beta cohort targeting (`targetOrgIds` — deferred to v2)
- Role-based targeting (`targetRoleBuckets` — deferred to v2)
- In-product "NEW" badge API (`GET /api/release-notes/badges` — field reserved; endpoint deferred)

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Data scope** | Master DB only (`arivu_master`) | Product announcements are platform-global, not tenant CRM data |
| **Authoring** | `isPlatformAdmin` via Control Plane | Matches `/control/*` and `requirePlatformAdmin` pattern |
| **Consumption** | Any authenticated tenant user | `protect` middleware; targeting applied server-side |
| **UI ownership** | `GlobalSurfacesProvider` | Same invariant as GlobalSearch — layouts must not own global modals |
| **State** | `useReleaseNotes` composable | No new Pinia store (6-store limit); ephemeral UI state in composable |
| **Notifications** | Separate from `notificationEngine` | Avoid polluting rules engine with product marketing content |
| **Content locale** | English only (v1) | Release `title`/`summary`/`description` stored as plain strings; all UI labels via `vue-i18n` |
| **Rich content** | Markdown → sanitized HTML | DOMPurify on client render; server stores markdown source |

---

## 3. Data Model (Master DB)

All models live in `server/models/` and are **not** wrapped with `tenantModelProxy`.

### 3.1 `ReleaseNote`

```js
{
  _id: ObjectId,
  version: String,          // semver display, e.g. "2.8.0" — not enforced unique
  slug: String,             // unique, URL-safe, e.g. "2-8-0-helpdesk-inbox"
  title: String,            // required, max 120
  summary: String,          // required, max 280
  importance: String,       // enum: major | minor | patch
  status: String,           // enum: draft | scheduled | published | archived
  targetApps: [String],     // optional; APP_KEYS enum subset; empty = all apps
  targetPlans: [String],    // optional; enum: trial | paid; empty = all plans
  badgeExpiresAt: Date,     // optional; for future in-product "NEW" badges (see §3.5)
  scheduledPublishAt: Date, // optional; required when status=scheduled
  publishedAt: Date,        // set on publish
  publishedBy: ObjectId,    // ref User
  createdBy: ObjectId,      // ref User
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
```js
{ status: 1, publishedAt: -1 }
{ slug: 1 }                          // unique
{ status: 1, scheduledPublishAt: 1 } // scheduler job
```

### 3.2 `ReleaseNoteItem`

```js
{
  _id: ObjectId,
  releaseNoteId: ObjectId,  // ref ReleaseNote, required, indexed
  type: String,               // enum: feature | improvement | bugfix
  title: String,              // required, max 120
  description: String,        // markdown, max 4000
  imageUrl: String,           // optional; CDN/S3 URL
  ctaLabel: String,           // optional, max 40
  ctaUrl: String,             // optional; external https or internal route
  sortOrder: Number,          // default 0
  createdAt: Date
}
```

**Indexes:**
```js
{ releaseNoteId: 1, sortOrder: 1 }
```

### 3.3 `UserReleaseView`

```js
{
  _id: ObjectId,
  userId: ObjectId,           // ref User, required
  releaseNoteId: ObjectId,    // ref ReleaseNote, required
  viewedAt: Date,             // default now
  source: String              // enum: auto_modal | drawer | help_center | snooze
}
```

**Indexes:**
```js
{ userId: 1, releaseNoteId: 1 }  // unique
{ userId: 1, viewedAt: -1 }
```

### 3.4 `UserReleaseSnooze` (v1 — supports "Remind me later")

```js
{
  _id: ObjectId,
  userId: ObjectId,
  snoozedUntil: Date,         // e.g. now + 24h
  createdAt: Date
}
```

**Indexes:**
```js
{ userId: 1 }  // unique — one active snooze per user
```

### 3.5 `badgeExpiresAt` (reserved for v2)

Optional date after which in-product **"NEW"** labels on nav items or features should stop showing. Distinct from the Help-menu unseen dot (`GET /api/release-notes/badge`).

**v1:** Field is stored and editable in Control Plane; no consumer UI or API yet.  
**v2:** `GET /api/release-notes/badges` returns active badge keys for the current user, e.g.:

```json
{
  "badges": [
    { "key": "nav.helpdesk.inbox", "releaseId": "...", "expiresAt": "2026-07-01T00:00:00.000Z" }
  ]
}
```

Badge keys are authored on `ReleaseNoteItem` in v2 (not in v1 schema). v1 only reserves `badgeExpiresAt` at the release level for scheduling expiry.

---

## 4. Targeting Service

`server/services/releaseNoteTargetingService.js`

**Input:** `{ user, organization, userAppKeys }`  
**Output:** MongoDB filter fragment merged into unseen/history queries.

| Field | Resolution |
|-------|------------|
| `targetApps` | Intersect with user's entitled app keys from `user.appAccess` / app registry. Empty array = no filter. |
| `targetPlans` | Map `organization.subscription.tier` (`trial` \| `paid`). Empty = no filter. |

v1 targeting is **app + plan only**. Role and org cohort targeting can be added in v2 without schema migration if reserved as optional empty arrays later.

Platform admins (`isPlatformAdmin`) always see all published notes in history; unseen logic still respects views.

**Publish lifecycle:** Once `status: published`, a release cannot revert to draft. Corrections require a new release or `DELETE` → `status: archived`.

---

## 5. Backend APIs

Mount table in `server/server.js`:

```js
app.use('/api/release-notes', require('./routes/releaseNoteRoutes'));           // user
app.use('/api/platform/release-notes', require('./routes/platformReleaseNoteRoutes')); // admin
```

All routes: `protect` middleware. Platform routes additionally: `requirePlatformAdmin()`.

### 5.1 Platform Admin APIs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/platform/release-notes` | Paginated list. Query: `status`, `page`, `limit`, `sort=-createdAt` |
| `GET` | `/api/platform/release-notes/:id` | Single note with embedded items |
| `POST` | `/api/platform/release-notes` | Create draft |
| `PUT` | `/api/platform/release-notes/:id` | Update draft or scheduled |
| `DELETE` | `/api/platform/release-notes/:id` | Archive: `status: archived` (only allowed lifecycle exit for published notes) |
| `POST` | `/api/platform/release-notes/:id/publish` | Publish now; sets `publishedAt`, `publishedBy`; irreversible |
| `POST` | `/api/platform/release-notes/:id/schedule` | Body: `{ scheduledPublishAt }` → `status: scheduled` |
| `GET` | `/api/platform/release-notes/:id/audience-preview` | Count of users who would see this note |
| `GET` | `/api/platform/release-notes/:id/stats` | View metrics for a published/archived note (see §5.5) |

**Create/Update body:**
```json
{
  "version": "2.8.0",
  "slug": "2-8-0-helpdesk-inbox",
  "title": "Helpdesk inbox redesign",
  "summary": "Faster triage, better threading.",
  "importance": "major",
  "targetApps": ["HELPDESK"],
  "targetPlans": [],
  "badgeExpiresAt": null,
  "items": [
    {
      "type": "feature",
      "title": "Unified inbox",
      "description": "All channels in one view.",
      "imageUrl": null,
      "ctaLabel": "Open inbox",
      "ctaUrl": "/helpdesk/inbox",
      "sortOrder": 0
    }
  ]
}
```

Validation: express-validator in `server/middleware/releaseNoteValidation.js`.

### 5.2 User APIs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/release-notes/unseen` | Targeted published notes not yet viewed, not snoozed |
| `POST` | `/api/release-notes/:id/view` | Idempotent upsert `UserReleaseView` |
| `POST` | `/api/release-notes/view-batch` | Body: `{ releaseNoteIds: [] }` — used by "Got It" |
| `POST` | `/api/release-notes/snooze` | Body: `{ hours: 24 }` — default 24 |
| `GET` | `/api/release-notes/history` | Paginated published history. Query: `page`, `limit` |
| `GET` | `/api/release-notes/badge` | Lightweight: `{ count, highestImportance }` for nav badge |

### 5.3 `GET /api/release-notes/unseen` Response

```json
{
  "success": true,
  "data": {
    "releases": [
      {
        "id": "...",
        "version": "2.8.0",
        "slug": "2-8-0-helpdesk-inbox",
        "title": "Helpdesk inbox redesign",
        "summary": "Faster triage, better threading.",
        "importance": "major",
        "publishedAt": "2026-06-01T00:00:00.000Z",
        "items": [
          {
            "id": "...",
            "type": "feature",
            "title": "Unified inbox",
            "description": "All channels in one view.",
            "descriptionHtml": "<p>All channels in one view.</p>",
            "imageUrl": null,
            "ctaLabel": "Open inbox",
            "ctaUrl": "/helpdesk/inbox",
            "sortOrder": 0
          }
        ]
      }
    ],
    "surface": "modal",
    "combinedImportance": "major"
  }
}
```

**Server logic:**
1. `status: published`, `publishedAt <= now`
2. Exclude IDs in `UserReleaseView` for `req.user._id`
3. Exclude if `UserReleaseSnooze.snoozedUntil > now`
4. Apply targeting service
5. Sort by `publishedAt` ascending (oldest unseen first)
6. Cap at **10 releases** / **90 days** lookback
7. Compute `surface`:
   - `major` in batch → `"modal"`
   - else if any `minor` → `"drawer"`
   - else → `"badge_only"` (patch-only; no auto-interrupt)
8. `combinedImportance` = max tier in batch (`major` > `minor` > `patch`)

**Caching:** `Cache-Control: private, max-age=60` on unseen/badge; invalidate on view/snooze.

### 5.4 Scheduled Publish Job

`server/services/releaseNotePublishScheduler.js` + `node-cron` (every 5 min):
- Find `status: scheduled` where `scheduledPublishAt <= now`
- Transition to `published`, set `publishedAt`

### 5.5 `GET /api/platform/release-notes/:id/stats`

Returns adoption metrics for Control Plane. Only for `published` or `archived` notes.

```json
{
  "success": true,
  "data": {
    "releaseNoteId": "...",
    "targetedUserCount": 1240,
    "viewedUserCount": 892,
    "viewRate": 0.719,
    "viewsBySource": {
      "auto_modal": 410,
      "drawer": 280,
      "help_center": 152,
      "snooze": 50
    },
    "lastViewedAt": "2026-06-10T14:22:00.000Z"
  }
}
```

**Computation:**
- `targetedUserCount` — count of active users matching targeting rules at query time (same logic as `audience-preview`)
- `viewedUserCount` — distinct `userId` in `UserReleaseView` for this `releaseNoteId`
- `viewRate` — `viewedUserCount / targetedUserCount` (0 if denominator is 0)
- `viewsBySource` — grouped counts from `UserReleaseView.source`
- `lastViewedAt` — max `viewedAt` for this release

**Note:** `targetedUserCount` is a point-in-time estimate (user/org roster changes). Cache 5 min server-side; not real-time.

### 5.6 Future: `GET /api/release-notes/badges` (v2)

Not implemented in v1. Will return in-product "NEW" badge keys for nav/features where `badgeExpiresAt > now` and the user is in the targeted audience. See §3.5.

---

## 6. Backend File Layout

```
server/
  models/
    ReleaseNote.js
    ReleaseNoteItem.js
    UserReleaseView.js
    UserReleaseSnooze.js
  controllers/
    releaseNoteController.js          # user endpoints
    platformReleaseNoteController.js  # admin endpoints
  services/
    releaseNoteService.js
    releaseNoteTargetingService.js
    releaseNotePublishScheduler.js
  middleware/
    releaseNoteValidation.js
  routes/
    releaseNoteRoutes.js
    platformReleaseNoteRoutes.js
  scripts/
    seedReleaseNotes.js               # example seed data
```

### 6.1 Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Routes** | Auth, validation, delegate |
| **Controllers** | HTTP mapping, error codes |
| **Service** | CRUD, unseen aggregation, view batch, audience preview, stats |
| **Targeting** | Filter construction from user/org context |

---

## 7. Frontend Architecture

### 7.1 Global Surface Ownership

Mount in `GlobalSurfacesProvider.vue` (not `PlatformShell`, not layouts):

```vue
<WhatsNewModal v-model="whatsNewModalOpen" :releases="unseenReleases" ... />
<WhatsNewDrawer v-model="whatsNewDrawerOpen" :releases="unseenReleases" ... />
```

Trigger fetch from `useReleaseNotes` composable, initialized once post-auth in `App.vue` or `GlobalSurfacesProvider` `onMounted`.

**Custom events (for Help menu):**
- `arivu:open-whats-new` → opens `ReleaseNotesCenter` drawer
- `arivu:open-release-notes-center` → same

### 7.2 Components

| Component | Path | Role |
|-----------|------|------|
| `WhatsNewModal.vue` | `client/src/components/release-notes/` | Auto-show for `major`; focus-trapped dialog |
| `WhatsNewDrawer.vue` | `client/src/components/release-notes/` | Auto-show for `minor`; slideout from right |
| `ReleaseNotesCenter.vue` | `client/src/components/release-notes/` | Full history + unseen list (Help entry) |
| `ReleaseCard.vue` | `client/src/components/release-notes/` | Single release with grouped items |
| `ReleaseNoteItemRow.vue` | `client/src/components/release-notes/` | Item with image, markdown body, CTA |
| `PlatformReleaseNoteEditor.vue` | `client/src/views/admin/` | Control Plane CMS |
| `PlatformReleaseNotesList.vue` | `client/src/views/admin/` | Control Plane list |

### 7.3 Composable

`client/src/composables/useReleaseNotes.js`

```js
// State (module-level refs, single-flight fetch)
// - unseenReleases, badgeCount, highestImportance
// - whatsNewModalOpen, whatsNewDrawerOpen, centerOpen
// - loading, error

// Methods
// - fetchUnseen()        — called after auth + appShell loaded
// - fetchBadge()         — lightweight poll on route focus
// - markViewed(ids, source)
// - snooze(hours = 24)
// - openCenter()
// - dismissModal()       — marks viewed + captures analytics
```

**Init timing (critical):**
1. Wait for `authStore.isAuthenticated`
2. Wait for `appShellStore.isLoaded` (app keys available for client-side surface hints)
3. Skip if `route.path.startsWith('/onboarding')`
4. Skip if onboarding state `active && !completed` (fetch `/api/onboarding/me`; defer until complete or dismissed)
5. Delay auto-modal **1500ms** after shell paint (avoid fighting coachmarks on first session)
6. Respect `prefers-reduced-motion` — no slide animation; instant show

### 7.4 Help Menu

Add section to `UserMenu.vue` above Theme/Sign out:

```
Help
 ├ Documentation   → VITE_HELP_DOCS_URL (external, new tab)
 ├ Contact Support → VITE_HELP_SUPPORT_URL or mailto from env
 └ What's New      → dispatch arivu:open-whats-new
```

i18n namespace: `client/src/locales/en/navigation.json` (or new `releaseNotes.json`):
- `navigation.helpMenu`
- `navigation.helpDocumentation`
- `navigation.helpContactSupport`
- `navigation.helpWhatsNew`

Nav badge: dot on Help parent or What's New row when `badgeCount > 0` and `highestImportance !== 'major'` (major uses modal).

### 7.5 Control Plane Routes

```js
// client/src/router/index.js
{
  path: '/control/release-notes',
  name: 'control-release-notes',
  component: () => import('@/views/admin/PlatformReleaseNotesList.vue'),
  meta: { requiresAuth: true, requiresPlatformAdmin: true }
},
{
  path: '/control/release-notes/:id',
  name: 'control-release-note-edit',
  component: () => import('@/views/admin/PlatformReleaseNoteEditor.vue'),
  meta: { requiresAuth: true, requiresPlatformAdmin: true }
}
```

Add nav link in `ControlPlane.vue` sidebar.

### 7.6 API Client

`client/src/utils/releaseNotesApi.js` — thin wrappers over `apiClient`:
- `getUnseen()`, `getBadge()`, `getHistory({ page, limit })`
- `markViewed(id, source)`, `markViewedBatch(ids, source)`, `snooze(hours)`
- Platform: `listNotes()`, `getNote(id)`, `getStats(id)`, `createNote()`, `updateNote()`, `publish()`, `archive()`, etc.

---

## 8. UX Rules

| `combinedImportance` | Auto behavior | Badge | Persistent access |
|---------------------|---------------|-------|-------------------|
| `major` | Modal on load (after defer rules) | None while modal open | Help → What's New |
| `minor` | Drawer on load OR badge if user closed without viewing | Dot on Help | Help → What's New |
| `patch` | No auto-interrupt | Dot if unseen | Help → What's New only |

**Modal actions:**
- **Got It** → `view-batch` for all displayed release IDs, close, `release_dismissed`
- **View Release Notes** → open `ReleaseNotesCenter`, keep modal open state cleared, `release_opened`
- **Remind me later** → `snooze(24)`, close, `release_snoozed`

**Multi-release modal:** Single scrollable modal; releases separated by version header (`Version 2.7.0`, `Version 2.8.0`). Items grouped by type within each release.

**Accessibility:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on title
- Focus trap (Headless UI `Dialog` / `DialogPanel`)
- Escape closes drawer; Escape on major modal → snooze (not silent dismiss without tracking)

**Mobile:** Modal and drawer are full-screen sheets below `md` breakpoint.

---

## 9. Analytics

`client/src/config/posthogReleaseNotes.ts` — same dynamic-import pattern as `posthogPlatformHome.ts`.

| Event | Properties |
|-------|------------|
| `release_viewed` | `release_id`, `release_version`, `importance`, `source`, `release_count` |
| `release_dismissed` | `release_ids[]`, `importance`, `combined_importance`, `source: auto_modal` |
| `release_opened` | `source: help_menu \| badge \| modal_cta`, `release_id?` |
| `release_snoozed` | `hours`, `release_count` |
| `release_item_clicked` | `release_id`, `item_id`, `item_type`, `cta_url` |
| `release_published` | `release_id`, `importance`, `target_apps` (platform admin only, server-side optional) |

---

## 10. Security

| Concern | Mitigation |
|---------|------------|
| XSS in markdown | Store markdown; render via sanitized HTML (DOMPurify); disallow raw HTML input in v1 |
| Image URLs | Validate `https:` only on write; optional allowlist of CDN host |
| CTA URLs | Internal routes must start with `/`; external must be `https://` |
| Tenant isolation | Views keyed by `userId`; no cross-user data in responses |
| Admin auth | `requirePlatformAdmin()` on all `/api/platform/release-notes/*` |
| Rate limit | Existing `/api` rate limiter applies; view-batch max 20 IDs per request |

---

## 11. i18n (v1)

| Layer | Approach |
|-------|----------|
| UI chrome (buttons, section headers, Help labels) | `releaseNotes.*` keys in all locales via `i18n:sync-keys` |
| Release content (`title`, `summary`, `description`) | English only; stored as authored |
| Section headers in modal | i18n: `releaseNotes.sectionFeatures`, `sectionImprovements`, `sectionBugfixes` |

v2: add `locale` field on items or nested `translations` map.

---

## 12. Onboarding Interaction

Per `docs/USER_ONBOARDING_ARCHITECTURE.md` maintenance rules:

- Do **not** auto-show modal/drawer while user is on `/onboarding` or `onboarding.active === true`
- Do **not** compete with coachmarks in first 1500ms after first Platform Home visit
- What's New in Help menu remains available during onboarding (user-initiated only)
- No new onboarding steps or tours for this feature

---

## 13. Example Seed Data

`server/scripts/seedReleaseNotes.js`:

1. **Major** — `2.8.0` — Platform Home redesign — 2 features, 1 improvement — `targetApps: []`
2. **Minor** — `2.8.1` — Helpdesk inbox — 1 feature — `targetApps: ['HELPDESK']`
3. **Patch** — `2.8.2` — Bug fixes — 2 bugfix items — `importance: patch`
4. One **draft** for admin UI testing

Run: `node server/scripts/seedReleaseNotes.js` (platform admin user required for `createdBy`).

---

## 14. Implementation Phases

### Phase 1 — Backend foundation
- [x] Models + indexes
- [x] Targeting service
- [x] User APIs: unseen, view, view-batch, snooze, history, badge
- [x] Platform admin CRUD + publish + stats
- [x] Validation middleware
- [x] Seed script
- [x] Unit tests: targeting, unseen aggregation, idempotent view

### Phase 2 — User UI
- [x] `useReleaseNotes` composable + API client
- [x] `WhatsNewModal`, `WhatsNewDrawer`, `ReleaseCard`, `ReleaseNoteItemRow`
- [x] `ReleaseNotesCenter`
- [x] Mount in `GlobalSurfacesProvider`
- [x] Help menu in `UserMenu.vue`
- [x] i18n keys + `i18n:sync-keys`
- [x] `posthogReleaseNotes.ts`

### Phase 3 — Control Plane CMS
- [x] List + editor views
- [x] Router entries + Control Plane nav
- [x] Image upload via existing `/api/upload` (store URL on item)
- [x] Audience preview + stats endpoints
- [x] Publish scheduler cron

### Phase 4 — Hardening
- [x] Reduced-motion + a11y audit
- [x] Onboarding deferral integration
- [x] Error/empty states
- [x] Manual QA checklist (below)

---

## 15. Test Plan

| Scenario | Expected |
|----------|----------|
| Platform admin creates draft, publishes | Tenants see in unseen |
| User views major release, clicks Got It | Not in unseen; in history |
| User snoozes | Hidden 24h, returns in unseen |
| Helpdesk-only targeting | Sales-only user does not see |
| Trial-only targeting | Paid org does not see |
| Onboarding active | No auto-modal; Help works |
| Patch-only unseen | Badge only, no modal/drawer |
| Multiple unseen majors | Single modal, both versions shown |
| Published note | Cannot revert to draft; archive only via DELETE |
| Stats endpoint | `viewRate` matches viewed / targeted counts |
| `view-batch` idempotent | No duplicate `UserReleaseView` rows |

---

## 16. Environment Variables

```bash
# client/.env
VITE_HELP_DOCS_URL=https://docs.arivu.example
VITE_HELP_SUPPORT_URL=https://support.arivu.example

# server — no new required vars; uses master DB
```

---

## 17. Distinction from Notifications

| | Release Notes | Notifications |
|--|---------------|---------------|
| Purpose | Product changelog | Operational events |
| Scope | Platform-global | Org + app scoped |
| Engine | `releaseNoteService` | `notificationEngine` |
| Real-time | Poll on load/focus | SSE |
| User prefs | Snooze only | Full preference system |

Do not emit domain events or create `Notification` records for releases in v1.
