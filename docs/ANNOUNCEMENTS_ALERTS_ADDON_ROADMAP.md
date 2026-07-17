# Announcements & Alerts Addon — Implementation Roadmap

**Source spec:** Product requirement — Announcements & Alerts (pasted 2026-07-15)  
**Product placement:** **Settings → Addons** (install hub) + entitled sidebar app (`Announcements`)  
**Architecture alignment:** Addon platform (AD0), `GlobalSurfacesProvider`, Release Notes delivery patterns, Process Designer / domain events, Notification Engine (adjacent, not owner)  
**Status:** AA0–AA8 shipped; polish (PostHog, media, branding, PD recipes) complete  




**Last updated:** 2026-07-15  
**Design binding:** `docs/design-system/arivu-design-laws.md`, `docs/design-system/arivu-tokens.md`, `docs/design-system/arivu-cursor-enforcement.md`

---

## 1. Executive summary

Announcements & Alerts is an **optional, tenant-installable addon** for creating, scheduling, targeting, and publishing in-app communications (Banner + Popover) to users across web apps, portals, and (later) mobile.

The **same engine** powers two authoring scopes:

| Scope | Author | Data store | Consumers |
|-------|--------|------------|-----------|
| **Organization Communications** | Tenant admins | **Tenant DB** | That org’s users (apps / portals) |
| **Platform Communications** | Arivu platform admins | **Master DB** (`arivu_master`) | Targeted customer orgs / users |

**Hard separations (locked):**

1. **Not Release Notes / What’s New** — `ReleaseNote*` remains the versioned product changelog (Help → What’s New). Announcements own operational + marketing communication surfaces (maintenance, trial/subscription reminders, company blasts, emergency alerts). Platform may *link* to release notes via CTA; it must not duplicate the What’s New center.
2. **Not Content Studio “Announcement” content type** — `docs/ContentEngine.md` Announcement is a publishable content document type. This addon is a **delivery/lifecycle engine** with banner/popover runtime, audience, triggers, and analytics.
3. **Not Notification Engine rules** — In-app/email/SMS notification rules stay in `notificationEngine`. Announcements are first-class UI surfaces (banner/popover) with their own impression/dismiss/ack/CTA tracking. Domain events may *trigger* an announcement publish; they do not replace this module.
4. **Addon-gated** — Tenant admin APIs and runtime delivery for org-authored content require `requireAddonEntitlement('announcements')`. Platform-authored delivery may reach all tenants (edge case §16) via master records and targeting, independent of tenant install for *consumption*; tenant *authoring* always requires install.

---

## 2. Locked principles

1. **Title, display type, audience (≥1), start date** required (business rules §21).
2. **Only `published` → `active` (effective window)** announcements are visible to end users.
3. **Expired → auto-archived** via scheduler (same pattern as Live Chat trial expiry / release-note schedule jobs).
4. **Dismiss / acknowledge** only when configured; non-dismissible stay until expiry or ack.
5. **Tenant isolation** — org announcements always keyed by `organizationId`; never read across tenants.
6. **Permissions** — every mutating admin action checks `announcements.*` (or `isPlatformAdmin` for platform scope).
7. **Auditability** — create/update/status transitions logged (created/modified/published/archived actors + timestamps).
8. **Reuse over invention** — install/uninstall via existing addon settings; delivery ownership in `GlobalSurfacesProvider`; PD via `domainEvents` + process registry; no second onboarding/tour stack.
9. **i18n** — UI chrome via `vue-i18n` (`announcements.*`); announcement body language is author content (multi-language authoring = future).
10. **Empty-state merge checklist** when admin list ships: FIRST_TIME / NO_DATA / NO_ACCESS / NOT_CONFIGURED / DISABLED + module visit tracking + PostHog.
11. **UX = product** — §3A Design Laws binding; guided authoring + live preview; calm runtime; preview≡runtime contract; intent tokens only.

---

## 3. Spec → product surface map

| Spec area | Surface | Phase |
|-----------|---------|-------|
| List View | Announcements → List | AA1 |
| Create / Edit | Announcements → Form | AA1 |
| Analytics | Announcements → Analytics | AA5 |
| Templates | Deferred | Future |
| Settings | Addons hub + Announcements Settings | AA0 / AA1 |
| Banner / Popover runtime | `GlobalSurfacesProvider` | AA2 |
| Audience targeting | Targeting service | AA3 |
| Triggers / scheduling | Lifecycle + scheduler | AA1 / AA4 |
| User behaviour (dismiss/ack/sticky) | User state models + runtime | AA2 / AA3 |
| Rich media | Content fields + media upload reuse | AA1 (images/links); AA4b (attachments/YouTube) |
| CTA buttons | Embedded `ctas[]` | AA1 |
| Trial / subscription automation | System generators (master + tenant) | AA6 |
| Process Flow / Workflow | Domain events + PD actions | AA7 |
| Platform communications | Control Plane authoring + master models | AA8 |
| Approval workflow | Deferred | Future |
| Push / email / SMS / Teams / Slack | Deferred | Future |

**IA (admin):**

```text
Announcements & Alerts
├── List View
├── Create / Edit
├── Analytics
├── Settings
└── Templates (Future)
```

**Entry points:**

| Entry | Route / location |
|-------|------------------|
| Install | `/settings?tab=addons` |
| Addon hub | `/settings?tab=addons&addonView=announcements` |
| Admin app | `/announcements` (list), `/announcements/new`, `/announcements/:id`, `/announcements/analytics` |
| Platform admin | `/control/announcements` (or platform settings equivalent) |
| End-user runtime | Global banner + popover (no dedicated menu required) |

---

## 3A. World-class UX & Brand Spec (locked)

> **North star:** Announcements feel *inevitable and calm* — never noisy, never “marketing modal spam.” Admins publish with confidence via live preview; end users always know what they’re seeing, why, and what they can do next (Design Laws 1–2, 16).

**Constitution (non-negotiable):**

| Law | Application here |
|-----|------------------|
| 1 Intelligence Over Ornament | No decorative gradients, sticker badges, or promo chrome on runtime surfaces |
| 2 Clarity | Every admin field answers “what does the user see?”; every runtime control answers “what happens if I click?” |
| 4 Ownership | Org vs Platform visually distinct; never mixed in one card |
| 6 Attach vs Convert | Edit/duplicate/pause = Assist; **Publish / Archive / Delete** = Convert (explicit confirm) |
| 7–8 Tokens + light/dark | Intent tokens only (`primary`, `neutral`, `warning`, `danger`, `success`) — no hex, no `indigo-*` / `gray-*` in new code |
| 9 Spacing | Strict 8-based rhythm |
| 10 Density | List = Dense; Form = Balanced; Analytics = Comfortable; Runtime banner = Comfortable strip |
| 11 Typography | Page / section / label / value / helper / meta roles; labels never bold |
| 12 Surfaces | Runtime = Elevated (temporary); Admin list = Primary work area |
| 13 Cards | One owner per card (org announcement ≠ platform notice) |
| 14 Buttons | Primary = Publish / Acknowledge / primary CTA; Secondary = Save draft; Tertiary = Duplicate; Destructive = Delete / Archive |
| 15 Forms | Required obvious; disabled explain why; permission-locked show authority |
| 16 State | Loading skeletons, empty with next step, human errors + recovery |
| 17 Nav | Single sidebar entry; no duplicate Settings vs app destinations |
| 18 A11y | Keyboard, focus rings, ≥40px targets, color never sole meaning |
| 19 Performance | Skeletons; optimistic dismiss where safe; no blocking publish without feedback |

Reuse patterns already shipped: **Addons hub** (`AddonsSettings.vue`), **Live Chat workspace nav + empty states**, **What’s New modal/drawer** (Elevated surface + motion), **ModuleList / DataTable** density, **`GlobalSurfacesProvider`** ownership.

### 3A.1 Mental model (make it intuitive)

Admin mental model in **one sentence:**  
*“I write a message → choose how it appears → choose who sees it → choose when → preview → publish.”*

| Step | Admin UI label | Spec fields |
|------|----------------|-------------|
| 1 Message | Message | title, short/detailed description, media, CTAs |
| 2 Appearance | Appearance | displayType (Banner / Popover), priority |
| 3 Audience | Audience | everyone / segments |
| 4 Timing | Timing | trigger + schedule + user behaviour |
| 5 Review | Review & publish | live preview + validation checklist |

**Do not** dump all §6 fields on one scrolling wall. Use a **guided create** (stepper or sticky section nav) with a **live preview rail** (desktop) / preview sheet (mobile).

End-user mental model:  
*“Something important from my org / Arivu — I can act, dismiss, or acknowledge.”*

Identity strip on every runtime unit:

```text
[ Org logo | From Acme ]     or     [ Arivu mark | Platform notice ]
```

Never ambiguous ownership (Law 4).

### 3A.2 Admin app shell

**Density:** Dense list · Balanced form · Comfortable analytics.

**Navigation (calm — Law 17):**

```text
Announcements          ← sidebar (addon entitled)
├── All                /announcements
├── Analytics          /announcements/analytics
└── Settings           /settings?tab=addons&addonView=announcements
```

Reuse `LiveChatWorkspaceNav`-style **subnav** (tabs under page title): All | Scheduled | Active | Paused | Archived — filters are status chips, not separate routes (except Analytics).

**List (Dense):**

- Primary surface: DataTable / ModuleList pattern — sticky toolbar with **Create announcement** (Primary).
- Columns: Title (+ short desc meta), Type (Banner/Popover icon+label), Status pill, Priority (intent token + text), Audience summary, Trigger, Window (start→end), Created by, Modified (meta), Views, Actions.
- Row click → edit/detail; actions in kebab: Edit, Duplicate, Publish, Pause/Resume, Archive, Delete.
- **Status pills** (intent, never color-only):

| Status | Token intent | Label |
|--------|--------------|-------|
| Draft | neutral | Draft |
| Scheduled | secondary / primary soft | Scheduled |
| Published / Active | success | Live |
| Paused | warning | Paused |
| Expired | neutral | Expired |
| Archived | neutral muted | Archived |

- Filters: Status, Type, Priority, Audience, Created by, Active, Expired — chip row + clear.
- Bulk: none in v1 (avoid mass-convert accidents).

**Empty states (Law 16 — classified):**

| Type | Copy intent | Primary CTA |
|------|-------------|-------------|
| FIRST_TIME | “Tell your people what matters — in the moment.” | Create announcement |
| NO_DATA (filtered) | “Nothing matches these filters.” | Clear filters |
| NO_ACCESS | “You don’t have permission to manage announcements.” | Contact admin |
| NOT_CONFIGURED | Addon installed but settings incomplete | Open settings |
| DISABLED | Addon suspended / disabled | Open Addons |

Illustration: reuse platform empty illustration pattern (`empty_state.svg` / Live Chat empty), not emoji.

**Create / Edit — Guided form (Balanced):**

Layout (desktop, ≥1280):

```text
┌─────────────────────────────┬──────────────────────┐
│ Step sections (scroll)      │ Live preview         │
│ 1 Message                   │ [ Banner | Popover ] │
│ 2 Appearance                │ device chrome        │
│ 3 Audience                  │ priority styling     │
│ 4 Timing                    │ CTA buttons live     │
│ 5 Review                    │                      │
└─────────────────────────────┴──────────────────────┘
 Footer: Save draft (Secondary) · Preview (Tertiary) · Publish (Primary / Convert)
```

- **Live preview** updates as you type (deferred value OK); toggle Banner ↔ Popover without losing content.
- **Priority → preview chrome** (still label+icon, not color alone):

| Priority | Preview cue |
|----------|-------------|
| Critical | `danger` left rail + “Critical” meta |
| High | `warning` left rail |
| Medium | `primary` accent |
| Low | `neutral` |
| Information | `neutral` + info icon |

- Appearance cards: two large selectable cards — **Banner** (“Slim bar at the top”) / **Popover** (“Focused moment after login”) — one sentence each, no marketing fluff.
- Timing: progressive disclosure — show scheduling fields when not Immediate; show behaviour toggles as plain language (*“People can dismiss this”*, *“Require acknowledgement before continuing”*) mapped to schema.
- Audience: start with **Everyone** (default). “Specific people” expands segment builder (roles/teams/users). Avoid jargon (“portal users”) behind helper text.
- CTA builder: max visible clarity — label + destination type + target; drag sort; limit UI to **3 CTAs** in v1 (schema may allow more later).
- **Review step:** checklist of business rules unmet (title, display, audience, start…); block Publish until green.
- **Publish = Convert:** confirm dialog: *“This will show to {N} people starting {when}.”* Estimate from audience preview API.
- Permission-locked controls: disabled + helper *“Requires Publish permission”*.

**Duplicate:** quiet Assist action — opens new draft titled “Copy of …”, never auto-publishes.

**Analytics (Comfortable):**

- Summary strip: Active · Views · Ack rate · CTA click rate (stat pattern like `LiveChatReportStatCard`, tokenized).
- Per-announcement detail: simple bars/tables — no chart carnival.
- Empty analytics: “Publish an announcement to see how it performs.”

**Addons hub card:** Match Live Chat / Articles card pattern — name, shortDescription, status badge, Configure → settings, Open → `/announcements`.

### 3A.3 Runtime UX (end user) — calm authority

**Ownership:** `GlobalSurfacesProvider` only. Layouts never mount banner/popover hosts.

**Coexistence with What’s New:**

| Surface | Priority |
|---------|----------|
| Critical announcement banner/popover | Wins immediately |
| Non-critical announcements | May show after What’s New dismissed/snoozed if both pending |
| What’s New | Remains Help → What’s New; never restyled as Announcement |

Queue rules:

1. At most **one banner** + **one popover** visible.
2. Stack by priority, then `startAt` desc.
3. Remaining items wait — never pile modals.

**Banner (Elevated strip, not a card wall):**

```text
┌────────────────────────────────────────────────────────────────────────┐
│ ▌ [From Acme]  Title — short description    [CTA] [CTA]   [Ack] [✕]   │
└────────────────────────────────────────────────────────────────────────┘
```

- Full-bleed top of **app shell** (below global nav if present; never over user menu).
- Left intent rail = priority token.
- Sticky only when `stickyBanner`.
- Auto-close: subtle countdown (meta), pause on hover/focus.
- Non-dismissible: hide ✕; if ack required, primary = Acknowledge.
- Motion: enter 150–200ms slide+fade; exit faster — reuse What’s New motion tokens / HeadlessUI transitions, no bounce.

**Popover (Elevated dialog):**

- Reuse What’s New modal structure (header / scroll body / footer actions) — **not** a second visual language.
- Media optional above body; CTAs in footer (Primary + Secondary); dismiss tertiary or ✕.
- Focus trap, Esc = dismiss only if dismissible; else focus Acknowledge.
- `requireAcknowledgement`: primary button only advances; backdrop click disabled.

**Plain-language runtime copy (chrome i18n):**

| Key intent | Example |
|------------|---------|
| Dismiss | Dismiss |
| Acknowledge | I understand |
| From org | From {orgName} |
| Platform | From Arivu |
| Learn more CTA | Author-defined label |

**Portal:** Same components, portal shell tokens; denser padding OK but same ownership strip.

**Mobile (later):** Bottom sheet for popover; banner as compact top bar — same tokens.

**Anti-patterns (bugs):**

- Multi-modal spam / stacked popovers  
- Purple glow / promo stickers / emoji in chrome  
- Confusing What’s New with Announcements  
- Color-only critical state  
- Dismiss on non-dismissible via Esc or backdrop  
- Admin preview that doesn’t match runtime (WYSIWYG contract)

### 3A.4 Platform vs organization visual ownership

| | Organization | Platform (Arivu) |
|--|--------------|------------------|
| Admin authoring | Tenant Announcements app | Control Plane |
| Runtime badge | Org name + optional logo | “Arivu” + platform mark |
| Tone | Confident, local | Quiet governance |
| Critical mute bypass | N/A | Always show if `criticalBypassOrgMute` |

List/admin for platform: same guided form; density Balanced; page title encodes Platform ownership.

### 3A.5 Microcopy & i18n

- Namespace `announcements.*` (+ `settings.addonsAnnouncements*` for hub).
- No hardcoded English in Vue (i18n rules).
- Author content not translated by platform in v1.
- Errors: human + recovery (*“Couldn’t publish — add an audience, then try again.”*).
- Toasts: success on publish/pause/archive; never celebrate dismiss for admins.

### 3A.6 Accessibility & motion

- Banner/popover in tab order; focus return on close.
- `aria-live="polite"` for non-critical banner appear; `assertive` only for critical.
- Respect `prefers-reduced-motion` (opacity only).
- Contrast: intent tokens meeting Law 18; left rail + text label for priority.
- Targets ≥ 40px for dismiss/ack/CTA.

### 3A.7 UX acceptance criteria (ship gate)

- [ ] New admin can create + publish a banner in **&lt; 2 minutes** without docs (usability bar).
- [ ] Preview matches runtime pixel-intent (type, priority rail, CTAs, dismiss rules).
- [ ] Ownership (org vs Arivu) obvious in &lt; 1 second.
- [ ] Critical never look like Low Information.
- [ ] Empty / loading / error states complete on list, form, analytics, runtime miss.
- [ ] Keyboard-only path: open popover → acknowledge/dismiss → focus restored.
- [ ] Tokens only; 8-based spacing; design-law checklist signed in PR.
- [ ] No regression: What’s New, GlobalSearch, Live Chat surfaces.

### 3A.8 Component inventory (implement against patterns)

```text
views/announcements/
  AnnouncementsListView.vue          # Dense table + filters + empty states
  AnnouncementEditorView.vue         # Guided create/edit + preview rail
  AnnouncementAnalyticsView.vue      # Comfortable stats

components/announcements/
  AnnouncementsWorkspaceNav.vue      # Mirror LiveChatWorkspaceNav
  AnnouncementStatusPill.vue
  AnnouncementPriorityMark.vue       # icon + label + token rail
  AnnouncementTypeCard.vue           # Banner vs Popover selector
  AnnouncementAudiencePicker.vue
  AnnouncementTimingPanel.vue
  AnnouncementCtaEditor.vue
  AnnouncementLivePreview.vue        # shared with runtime props
  AnnouncementBannerHost.vue         # GlobalSurfacesProvider
  AnnouncementPopoverHost.vue        # What’s New–aligned dialog
  AnnouncementOwnershipStrip.vue
  AnnouncementEmptyState.vue
  AnnouncementPublishConfirm.vue     # Convert confirm

composables/useAnnouncements.ts      # runtime queue + fetch
composables/useAnnouncementEditor.ts # form state + preview model
```

**Shared contract:** `AnnouncementLivePreview` and hosts consume the **same presentational props** (`AnnouncementViewModel`) so preview ↔ runtime cannot diverge.

---

## 4. Architecture decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **addonKey** | `announcements` | Short, stable; display name “Announcements & Alerts” |
| **Category** | `COMMUNICATION` | Matches Live Chat catalog |
| **requiredApps** | `[]` | Platform-core only; no Helpdesk/Sales dependency |
| **Org data** | Tenant DB via `wrapTenantModel` | CRM communication data stays tenant-scoped |
| **Platform data** | Master DB models (not proxied) | Same pattern as `ReleaseNote` |
| **Entitlement** | `OrganizationSubscription.addons[]` + `TenantAddonConfiguration` | Existing AD0 pattern |
| **Admin gate** | `requireAddonEntitlement('announcements')` + `announcements.*` perms | Live Chat / Articles pattern |
| **Runtime gate (org)** | Entitlement + published + window + audience match | —
| **Runtime gate (platform)** | Master published + org/user targeting; no tenant uninstall can block critical platform banners (config flag) | Edge case §16 |
| **UI ownership** | `GlobalSurfacesProvider` | Same invariant as GlobalSearch / What’s New — layouts must not own global surfaces |
| **State** | Composable `useAnnouncements` (ephemeral); **no new Pinia store** | 6-store limit (release-notes precedent) |
| **Rich text** | Store sanitized HTML or markdown→HTML (pick one stack; prefer reuse of existing editor used by Release Notes / Content Studio) | Consistency + XSS safety |
| **Analytics** | Dedicated event collection (`AnnouncementEvent`) + rollups | Avoid mixing with notification opens |
| **Release Notes** | Remain separate product | See §1 |

---

## 5. Addon platform registration (AA0)

Mirror Live Chat AD0 wiring.

### 5.1 Catalog

**`AddonDefinition` (master):**

```js
{
  addonKey: 'announcements',
  name: 'Announcements & Alerts',
  category: 'COMMUNICATION',
  requiredApps: [],
  optionalApps: [],
  enabled: true,
  marketplace: {
    category: 'Communication',
    shortDescription: 'Broadcast banners and popovers to users across apps and portals.',
    comingSoon: false,
    beta: true, // flip false at GA
  },
}
```

**Constants:**

- `server/constants/addonKeys.js` → `ANNOUNCEMENTS: 'announcements'`
- Pricing stub in `addonPricingRegistry.js`
- Navigation in `addonNavigationRegistry.js`:

```js
[ADDON_KEYS.ANNOUNCEMENTS]: {
  surfaceId: 'announcements',
  route: '/announcements',
  label: 'Announcements',
  icon: 'megaphone', // align with icon set in use
  permission: 'announcements.view',
  order: 20,
},
```

### 5.2 Install / uninstall

Reuse `addonSettingsController.installAddon` / `uninstallAddon`.

On install:

- Ensure subscription addon entry `TRIAL|ACTIVE`
- Upsert `TenantAddonConfiguration{ organizationId, addonKey: 'announcements', settings }`
- Seed default settings (timezone default, auto-archive on, platform-comms receive on)
- Register permission keys into role permission catalog (org admin defaults: full; others: none)
- Emit audit: addon installed

On uninstall:

- Stop runtime delivery for **org-authored** announcements
- Soft-disable config (`enabled: false` / archive); retain data for reinstall (policy: keep records, mark `archivedAt` on config)
- Unregister nav; PD triggers remain registered but no-ops if entitlement missing

### 5.3 Settings blob (`TenantAddonConfiguration.settings`)

```js
{
  defaultTimezone: 'Asia/Kolkata',
  autoArchiveExpired: true,
  receivePlatformAnnouncements: true, // org can mute non-critical platform? (policy TBD — default true; critical bypass)
  defaultDismissible: true,
  allowedSurfaces: ['web_app', 'portal'], // mobile later
}
```

---

## 6. Data model

### 6.1 Org scope (tenant DB)

#### `Announcement`

```js
{
  organizationId: ObjectId,          // required
  scope: 'organization',             // constant for tenant model

  title: String,                     // required, max 200
  shortDescription: String,          // max 500
  detailedDescription: String,       // rich text / markdown source
  category: String,                  // free or enum later
  tags: [String],

  displayType: 'banner' | 'popover', // required
  priority: 'critical' | 'high' | 'medium' | 'low' | 'information',

  content: {
    body: String,                    // canonical rich body
    imageUrl: String | null,
    icon: String | null,
    youtubeUrl: String | null,       // AA4b
    attachments: [{ name, url, mime, size }], // AA4b
  },

  ctas: [{
    id: String,                      // uuid
    label: String,                   // max 40
    actionType: 'internal_route' | 'external_url' | 'module' | 'dashboard' | 'report' | 'kb' | 'blog',
    target: String,                  // route or URL
    style: 'primary' | 'secondary' | 'link',
    sortOrder: Number,
  }],

  audience: {
    mode: 'everyone' | 'segment',
    segments: [{
      type: 'user_type' | 'role' | 'department' | 'team' | 'user' | 'portal' | 'mobile',
      // user_type values: internal | external | customer | partner | vendor | dealer | employee | portal | mobile
      values: [String],              // ids or enum keys
    }],
  },

  trigger: {
    type:
      | 'immediate'
      | 'scheduled'
      | 'first_login'
      | 'every_login'
      | 'daily'
      | 'weekly'
      | 'once_per_user'
      | 'until_dismissed'
      | 'until_acknowledged'
      | 'until_expiry'
      | 'process_flow'
      | 'workflow',
    // frequency helpers read alongside userBehaviour
  },

  schedule: {
    publishImmediately: Boolean,
    startAt: Date,                   // required
    endAt: Date | null,              // required when scheduled / non-open-ended policy
    timezone: String,
  },

  userBehaviour: {
    dismissible: Boolean,
    stickyBanner: Boolean,
    autoCloseSeconds: Number | null,
    showOnce: Boolean,
    showEveryLogin: Boolean,
    showDaily: Boolean,
    requireAcknowledgement: Boolean,
  },

  status:
    | 'draft'
    | 'pending_approval'             // reserved; unused until approval workflows
    | 'scheduled'
    | 'published'
    | 'active'                       // optional derived; prefer computing active from published + window
    | 'paused'
    | 'expired'
    | 'archived',

  // Prefer: persist draft|scheduled|published|paused|archived|expired;
  // treat "active" as query projection: published && !paused && startAt<=now && (endAt==null||endAt>now)

  source: {
    kind: 'manual' | 'process_flow' | 'workflow' | 'system_subscription' | 'system_trial',
    externalRef: String | null,      // flow/run id
  },

  // Audit denormalized (also write AuditLog)
  createdBy, createdAt,
  modifiedBy, updatedAt,
  publishedBy, publishedAt,
  archivedBy, archivedAt,
  pausedAt, resumedAt,

  // Lightweight counters (updated async)
  stats: {
    views: Number,
    reads: Number,
    dismissals: Number,
    acknowledgements: Number,
    ctaClicks: Number,
  },
}
```

**Indexes (minimum):**

```js
{ organizationId: 1, status: 1, 'schedule.startAt': -1 }
{ organizationId: 1, status: 1, 'schedule.endAt': 1 }
{ organizationId: 1, displayType: 1, priority: 1 }
{ organizationId: 1, createdBy: 1 }
{ organizationId: 1, 'source.kind': 1, 'source.externalRef': 1 }
```

#### `AnnouncementUserState`

Per-user interaction state (tenant DB):

```js
{
  organizationId: ObjectId,
  announcementId: ObjectId,
  userId: ObjectId,
  firstViewedAt, lastViewedAt, viewCount,
  dismissedAt,
  acknowledgedAt,
  lastShownAt,                       // for daily/weekly/login cadence
  ctaClicks: [{ ctaId, clickedAt, count }],
}
```

**Indexes:** `{ organizationId: 1, userId: 1, announcementId: 1 }` unique; `{ announcementId: 1, userId: 1 }`.

#### `AnnouncementEvent` (analytics raw)

```js
{
  organizationId, announcementId, userId,
  type: 'view' | 'read' | 'dismiss' | 'acknowledge' | 'cta_click',
  ctaId: String | null,
  deviceType, platform, surface,     // web_app | portal | mobile
  at: Date,
}
```

TTL optional (e.g. 180 days) + nightly rollup into `stats` / analytics aggregates.

### 6.2 Platform scope (master DB)

#### `PlatformAnnouncement`

Same shape as `Announcement` **minus** tenant-only audience internals; plus:

```js
{
  scope: 'platform',
  target: {
    orgIds: [ObjectId],              // empty = all orgs
    plans: ['trial' | 'paid'],       // empty = all
    apps: [String],                  // empty = all
    // role buckets later
  },
  criticalBypassOrgMute: Boolean,    // maintenance / security
  // authors are platform admins
}
```

#### `PlatformAnnouncementUserState` / events

Master DB, keyed by `{ organizationId, userId, announcementId }` so multi-org users remain correct.

> **Implementation note:** Extract shared schema fragments / validation into `server/services/announcements/*` to avoid diverging org vs platform logic. Two collections, one service layer with `scope` parameter.

---

## 7. Status lifecycle

```text
draft
  → scheduled          (startAt in future, publishImmediately=false)
  → published          (immediate publish or scheduler fires)
       → (active)      // computed while in window and not paused
  → paused             ↔ resume → published
  → expired            (endAt passed — job)
  → archived           (auto after expire, or manual)

pending_approval       // reserved; no UI in v1
```

**Rules:**

| From | To | Who |
|------|----|-----|
| draft | scheduled / published | create+publish perms |
| scheduled | published | scheduler or publish now |
| published | paused | pause perm |
| paused | published | resume perm |
| published/paused | archived | archive perm |
| any non-archived | archived | archive / delete policy |
| * | expired | system job only |

**Delete:** Soft-prefer archive. Hard delete only for drafts (optional). Never hard-delete with analytics history without export policy.

**Visibility to users:** `status ∈ {published}` AND not paused AND `startAt <= now` AND (`endAt == null` OR `endAt > now`) AND audience match AND trigger/cadence allows show.

---

## 8. Permissions

| Permission | Capability |
|------------|------------|
| `announcements.view` | List / detail admin |
| `announcements.create` | Create draft |
| `announcements.edit` | Edit draft/scheduled/paused |
| `announcements.delete` | Delete draft / destroy policy |
| `announcements.publish` | Publish / schedule |
| `announcements.pause` | Pause |
| `announcements.resume` | Resume |
| `announcements.archive` | Archive |
| `announcements.analytics` | Analytics views |

Platform equivalents: `requirePlatformAdmin` (no per-tenant perm).

Wire into role permission catalog + Settings role editor using existing permission registration patterns (same place Live Chat `liveChat.*` is registered).

---

## 9. APIs

### 9.1 Tenant admin (`/api/announcements`)

Middleware: `protect` → `requireAddonEntitlement('announcements')` → permission checks.

| Method | Path | Perm |
|--------|------|------|
| GET | `/` | view — filters: status, type, priority, audience, createdBy, active, expired |
| GET | `/:id` | view |
| POST | `/` | create |
| PUT | `/:id` | edit |
| POST | `/:id/duplicate` | create |
| POST | `/:id/publish` | publish |
| POST | `/:id/schedule` | publish |
| POST | `/:id/pause` | pause |
| POST | `/:id/resume` | resume |
| POST | `/:id/archive` | archive |
| DELETE | `/:id` | delete |
| GET | `/:id/analytics` | analytics |
| GET | `/analytics/summary` | analytics |

### 9.2 Tenant runtime (`/api/announcements/runtime`)

Authenticated users; **entitlement required for org-authored**. Platform merge happens server-side.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/active` | Banner + popover payloads for current user (org ∪ platform) |
| POST | `/:id/view` | Record view |
| POST | `/:id/dismiss` | If dismissible |
| POST | `/:id/acknowledge` | If required |
| POST | `/:id/cta/:ctaId/click` | CTA click + return resolved URL |

### 9.3 Platform admin (`/api/platform/announcements`)

`protect` + `requirePlatformAdmin` — CRUD/lifecycle parallel to §9.1 against `PlatformAnnouncement`.

---

## 10. Delivery runtime (AA2)

### 10.1 Ownership

- Mount banner + popover hosts inside `GlobalSurfacesProvider.vue` (alongside What’s New).
- Composable `useAnnouncements.ts` — fetch `/runtime/active` on auth/bootstrap + focus/login events; no Pinia store.
- Priority stack: `critical` > `high` > … ; at most **one sticky banner** + **one popover** at a time (queue remainder).

### 10.2 Surfaces

| Display | Behavior |
|---------|----------|
| Banner | Top-of-shell strip; sticky optional; CTA row; dismiss/ack controls |
| Popover | Modal/drawer after login or on cadence; richer media |

### 10.3 Cadence evaluation (server authoritative)

Client never decides eligibility alone. Server uses `AnnouncementUserState` + trigger + `userBehaviour` to filter `/runtime/active`.

### 10.4 Portal / mobile

- Portal: same runtime API with portal surface tag; mount in `PortalLayout` via GlobalSurfaces or portal-equivalent provider.
- Mobile: contract reserved (`surface: mobile`); client implementation later.

---

## 11. Audience targeting (AA3)

**Service:** `announcementTargetingService.js`

Resolve user → segment membership:

| Segment type | Resolution source |
|--------------|-------------------|
| everyone | always |
| internal / external / employee | user flags / type |
| customer / partner / vendor / dealer | CRM / portal role maps (document actual field mappings during AA3 spike) |
| portal / mobile | client surface claim + user portal membership |
| role / department / team | Role / Group membership |
| individual users | `userId ∈ values` |

Empty/invalid segments → announcement fails validation at publish.

Dynamic audience builder = Future.

---

## 12. Scheduling & jobs (AA4)

| Job | Action |
|-----|--------|
| `announcementPublishScheduler` | `scheduled` + `startAt<=now` → `published` |
| `announcementExpiryScheduler` | window ended → `expired` → `archived` (if autoArchive) |
| `announcementTrialReminderJob` | AA6 ✅ (`tickSystemAnnouncementReminders`) |
| `announcementSubscriptionReminderJob` | AA6 ✅ (same daily tick) |

Timezone: store UTC instants; display in `schedule.timezone` / org default.

Actions: Schedule, Pause, Resume, Cancel (cancel scheduled → draft or archived).

---

## 13. Subscription & trial automation (AA6)

**Edge case requirement:** system-generated, not manual.

| Event | Behavior |
|-------|----------|
| Trial ≤ 7 days | Upsert system announcement per org; copy updates remaining days daily; every login; CTA Upgrade |
| Subscription 30/15/7/1/0 days | Upsert renewal reminders; CTA Renew |

**Ownership recommendation:**

- Generators live in `server/services/announcements/systemAnnouncementService.js`
- Hook from existing subscription/trial schedulers (extend `addonTrialExpirySchedulerService` / billing webhooks — **do not** invent a parallel billing clock)
- `source.kind = system_trial | system_subscription`
- Prefer **platform-scoped** records when message is from Arivu; **org-scoped** only if tenant-installed templates customize copy (v1: platform-scoped)

Idempotency: one active system announcement per `(organizationId, templateKey)` e.g. `trial_expiry`, `sub_renewal`.

---

## 14. Process Designer / Workflow (AA7)

On addon install, register:

**Triggers (consume):** optional “Announcement Published”, “Announcement Acknowledged”

**Actions (produce):**

- `announcements.publish` — create/publish from template or payload (banner/popover, audience, CTA)
- `announcements.pause` / `archive`

Emit domain events in `server/constants/domainEvents.js` (names TBD, follow existing naming):

- `announcement.published`
- `announcement.acknowledged`
- `announcement.cta_clicked`

Workflow/Process Flow created announcements use `source.kind = process_flow | workflow` and **same lifecycle** as manual.

Example recipes (docs only in AA7): Invoice Approved → Banner; Payment Overdue → Popover + ack.

---

## 15. Analytics (AA5)

**Admin metrics (per announcement + summary):**

- Total Audience (estimated at publish + refresh)
- Views, Reads, Dismissals, Acknowledgements
- CTA Clicks, Click Rate
- Device Type / Platform breakdown
- Active vs Expired counts

APIs under §9.1; UI: Analytics tab + row “Views” on list.

PostHog (product analytics): `announcement_published`, `announcement_viewed`, `announcement_cta_clicked` for funnel health — complementary to tenant analytics.

---

## 16. Audit trail

For every lifecycle mutation write:

- Denormalized fields on document (created/modified/published/archived by/on)
- Platform/tenant audit log entry (reuse existing audit logger used by settings/addon install)

Log: status transitions, publish, pause, resume, archive, delete.

---

## 17. Business rules (engineering checklist)

- [ ] Title required  
- [ ] Display type required  
- [ ] ≥1 audience required  
- [ ] Start date required  
- [ ] End date required for scheduled (and for non-open-ended production policy — recommend required whenever not “publish immediately open-ended”; product may allow null end for sticky until dismiss)  
- [ ] Expired auto-archived  
- [ ] Only published (active window) visible  
- [ ] CTA / images optional; multiple CTAs allowed  
- [ ] Process/workflow-created share lifecycle  
- [ ] Dismiss only if dismissible; non-dismissible until expiry or ack  
- [ ] Trial/subscription system-generated  

Validation: express-validator middleware `announcementValidation.js`.

---

## 18. Client structure (target)

See **§3A.8** for the full component inventory and ownership rules.

```text
client/src/
  views/announcements/          # List · Editor (guided) · Analytics
  components/announcements/     # Preview, hosts, pills, empty, publish confirm
  composables/useAnnouncements.ts
  composables/useAnnouncementEditor.ts
  locales/en/announcements.json
```

Platform Control Plane views under existing `/control` tree — **same** presentational components, Platform ownership strip.

List columns / actions: §3A.2 (aligned to product spec §5).

---

## 19. Phased delivery

### AA0 — Addon foundation
- [ ] `ADDON_KEYS.ANNOUNCEMENTS`
- [ ] Seed `AddonDefinition` + pricing stub
- [ ] Nav registry entry
- [ ] Install/uninstall settings + default `TenantAddonConfiguration`
- [ ] Permission keys registered
- [ ] i18n shell strings + Addons card

### AA1 — Admin CRUD + lifecycle
- [ ] Tenant models + indexes
- [ ] Admin APIs + validation + audit
- [ ] **UX:** Dense list + guided editor + live preview rail (§3A)
- [ ] Status/priority pills with intent tokens (not color-only)
- [ ] Publish = Convert confirm with audience estimate
- [ ] Empty states (FIRST_TIME / NO_DATA / NO_ACCESS / …) + module visit + PostHog
- [ ] i18n `announcements.*` + design-token compliance review

### AA2 — Runtime delivery
- [ ] Runtime APIs + user state
- [ ] Banner + Popover hosts in `GlobalSurfacesProvider` (§3A.3)
- [ ] Shared `AnnouncementViewModel` for preview ↔ runtime
- [ ] Ownership strip (org vs Arivu)
- [ ] Priority queue + dismiss/ack/auto-close + a11y / reduced motion
- [ ] Coexistence rules with What’s New
- [ ] CTA click tracking + navigation

### AA3 — Audience & cadence
- [x] Targeting service for roles/teams/users/types
- [x] Trigger evaluators (first/every login, daily, weekly, once, until dismissed/ack)
- [x] Portal surface pass (`?surface=portal|web_app|mobile`)
- [x] Editor audience + trigger + schedule window

### AA4 — Schedulers + media hardening
- [x] Publish + expiry/archive jobs (`announcementLifecycleSchedulerService`, every 5m)
- [x] Attachments / YouTube (URL-based image, YouTube embed, up to 5 attachment links)
- [x] Branding hooks (ownership strip: org company logo / Arivu mark)

### AA5 — Analytics
- [x] Event ingestion (`AnnouncementEvent`, TTL 180d) + counter rollups
- [x] APIs `/analytics/summary`, `/:id/analytics`
- [x] Analytics UI + workspace nav
- [x] PostHog product events (`announcement_published|viewed|cta_clicked`)

### AA6 — Trial / subscription automation
- [x] System upsert service (`systemAnnouncementService`)
- [x] Day-countdown copy (trial ≤7d; sub 30/15/7/1/0)
- [x] Daily scheduler hook (`ENABLE_SYSTEM_ANNOUNCEMENT_SCHEDULER`, 09:15)

### AA7 — Process Designer / Workflow
- [x] Domain events (`ANNOUNCEMENT_PUBLISHED|ACKNOWLEDGED|CTA_CLICKED`)
- [x] PD actions: `announcements_publish|pause|archive` + trigger metadata
- [x] Install seed recipe (ack → follow-up task)
- [x] Additional recipe pack / E2E smoke (`cta_follow_up_task`, `published_owner_notify` + unit smoke)

### AA8 — Platform communications
- [x] `PlatformAnnouncement` + user-state models (master DB)
- [x] Runtime merge into `/runtime/active` (+ without addon entitle)
- [x] Critical bypass vs org mute (`receivePlatformAnnouncements`)
- [x] Control Plane authoring UI (`/control/announcements`, `/api/platform/announcements`)
- [x] Maintenance / security advisory templates (presets)

### Explicitly out of v1 (Future §22)
Templates, multi-language content, push/email/SMS/WhatsApp/Teams/Slack, full-screen/floating, approval workflows, AI copy, dynamic audience builder, A/B testing, advanced analytics dashboard.

---

## 20. Relation to existing systems

| System | Relationship |
|--------|--------------|
| **Addon platform** | Install, entitlement, nav, settings hub |
| **GlobalSurfacesProvider** | Banner/popover ownership |
| **Release Notes** | Parallel; What’s New stays; CTA may deep-link |
| **Content Studio** | Optional CTA → KB/blog URLs; not content storage |
| **Notification Engine** | May notify *about* an announcement; does not render banner |
| **Process Designer** | Publish/pause actions; domain events |
| **Billing / trial schedulers** | Drive AA6 system announcements |
| **Audit / permissions** | Standard platform mechanisms |
| **Portal shell** | Consume runtime with `surface=portal` |

---

## 21. Testing strategy

| Layer | Coverage |
|-------|----------|
| Unit | Validation, lifecycle transitions, cadence eligibility, targeting filters |
| Integration | Admin CRUD, runtime active set, entitlement denial, platform merge |
| Job | Publish-at / expire-archive |
| E2E | Create → publish → banner shows → dismiss → not shown; trial upsert countdown |
| Security | Cross-tenant IDOR; publish without perm; dismiss non-dismissible |

---

## 22. Open decisions (resolve before AA1 schema freeze)

1. **Open-ended end date:** Allow `endAt: null` for until-dismissed / until-ack, or always require end date?
2. **Org mute of platform announcements:** Allow mute for non-critical only? (Recommended: yes; critical bypass.)
3. **Rich text storage:** Markdown source (Release Notes) vs HTML from existing WYSIWYG?
4. **“Active” as stored status vs computed?** (Recommended: computed.)
5. **Pending approval:** Ship status enum only, or omit until workflows exist?
6. **Upgrade path for Release Notes overlap:** Keep forever separate (recommended) vs migrate marketing popovers into Announcements later.

---

## 23. Success criteria (MVP = AA0–AA5)

- Org admin can install addon, create banner + popover, target everyone + roles, schedule/publish/pause/archive.
- Entitled end users see correct surface with CTA, dismiss/ack rules enforced server-side.
- Analytics show views / dismiss / CTA.
- No regression to What’s New / Live Chat / addon install flows.
- Platform path (AA8) can ship immediately after MVP or in parallel once runtime merge exists (AA2).
- **UX gate (§3A.7) passes** — guided create &lt; 2 min, preview≡runtime, ownership clear, token/a11y compliance.

---

## 24. Suggested first engineering slice

**AA0 + AA1 vertical slice (smallest production-safe path, UX-first):**

1. Register addon key + definition + permissions + nav + Addons hub card.  
2. `Announcement` model + **guided editor with live preview** + dense list (not a bare form).  
3. Minimal runtime: banner + dismissible + ownership strip in `GlobalSurfacesProvider`, sharing preview view-model.  

Then layer AA3 cadence, AA4 jobs, AA5 analytics, AA6/AA7/AA8 — each inheriting §3A laws.
)
