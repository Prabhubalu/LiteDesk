# Onboarding Activation Analytics

**Status:** Instrumentation live (PostHog). Onboarding v1 complete — **maintenance mode only**.

**Prerequisite:** `VITE_POSTHOG_KEY` set in client env. Events are no-ops when unset.

**Before any onboarding change, review:** this doc · `docs/USER_ONBOARDING_ARCHITECTURE.md` · `.cursorrules`

**Primary use:** Monitor funnels, identify bottlenecks, justify changes with data. Do not build new onboarding features proactively.

---

## 1. Event catalog

| Event | When fired | Key properties |
|-------|------------|----------------|
| `onboarding_started` | First `startedAt` on onboarding state, register, or invite accept | `persona`, `origin`, `organization_id` |
| `onboarding_step_completed` | Wizard/checklist step completed (not skipped) | `step_key`, `persona`, `origin`, `organization_id` |
| `onboarding_completed` | `completedAt` set on user onboarding | `persona`, `origin`, `organization_id` |
| `invite_sent` | User created via invite (drawer or founder wizard) | `source` (`settings_drawer` \| `founder_wizard`), `send_email`, `has_welcome_note`, `has_suggested_task` |
| `invite_accepted` | Invite accept + auto-login | `entitled_apps` |
| `first_contact_created` | Founder wizard `create_first_contact` | `source` (`onboarding_wizard`), `persona`, `origin` |
| `sample_data_accepted` | Founder accepts sample data offer | `persona`, `origin`, `organization_id` |
| `coachmark_seen` | Coachmark dismissed | `coachmark_key` (`sidebar`, `command_palette`, `tabs`) |
| `first_time_empty_state_seen` | First visit to module with `FIRST_TIME` empty state | `module_key`, `app_key`, `persona`, `origin` |

**Existing related events:** `user_logged_in` (login method), `$pageview` (all routes).

**Implementation:** `client/src/config/posthogOnboarding.ts` + hooks in `useOnboarding.js`, invite surfaces, `ModuleList.vue`.

---

## 2. Funnel A — Founder activation (self-serve)

**Goal:** Register → setup → first value → team → retention.

| Step | PostHog event / filter | Notes |
|------|------------------------|-------|
| 1. Register | Custom: first `$pageview` on `/onboarding` after signup, or `onboarding_started` where `origin = self_serve` | Registration fires `onboarding_started` immediately |
| 2. Onboarding started | `onboarding_started` | `persona = founder` |
| 3. First contact | `first_contact_created` OR `sample_data_accepted` | Either path counts as first value |
| 4. Invite teammate | `invite_sent` where `source = founder_wizard` OR `onboarding_step_completed` where `step_key = founder_invite_teammate` | |
| 5. Onboarding complete | `onboarding_completed` | Wizard finished |
| 6. Day 7 active | PostHog retention insight on `user_logged_in` or `$pageview` | 7-day returning users from step 1 cohort |

**Suggested PostHog funnel (ordered):**
1. `onboarding_started` — filter `origin = self_serve`
2. `onboarding_step_completed` — filter `step_key = founder_goal`
3. `first_contact_created` OR `sample_data_accepted`
4. `invite_sent`
5. `onboarding_completed`

---

## 3. Funnel B — Invited member activation

**Goal:** Invite → accept → first action → checklist done → retention.

| Step | PostHog event / filter | Notes |
|------|------------------------|-------|
| 1. Invite sent | `invite_sent` | Admin-side |
| 2. Invite accepted | `invite_accepted` | Member-side; also fires `onboarding_started` (`origin = invited`) |
| 3. First action | `onboarding_step_completed` where `step_key = member_visit_module` OR `member_first_action` | Module visit + first action steps |
| 4. Checklist complete | `onboarding_completed` | `persona = member` |
| 5. Day 7 active | Retention on accepted cohort | Filter `invite_accepted` → 7-day `$pageview` |

**Suggested PostHog funnel (ordered):**
1. `invite_sent`
2. `invite_accepted`
3. `onboarding_step_completed` — `step_key = member_visit_module`
4. `onboarding_step_completed` — `step_key = member_first_action`
5. `onboarding_completed`

---

## 4. Supporting metrics

| Metric | Definition |
|--------|------------|
| Time to first contact | `first_contact_created` timestamp − `onboarding_started` (PostHog formula / HogQL) |
| Invite accept rate | `invite_accepted` / `invite_sent` |
| Coachmark completion | Unique users with all three `coachmark_seen` keys |
| First-time empty state reach | `first_time_empty_state_seen` by `module_key` |
| Stalled invites | In-app `ONBOARDING_INVITE_STALLED` notifications (server); correlate with `invite_sent` without `invite_accepted` within 3 days |

---

## 5. Governance & iteration policy

Onboarding v1 is productionized. Treat as a **platform capability** in maintenance mode — not an active product initiative.

### Rules

1. No P4 roadmap.
2. No new mechanics (wizards, tours, assistants, persona tracks) without PostHog funnels, interviews, support-ticket trends, or activation/retention metrics.
3. Extend `onboardingService` — no parallel frameworks.
4. New apps/modules: merge checklist required (below).
5. Prefer maintenance: bug fixes, analytics, funnel instrumentation, new-module alignment, i18n, Platform Home consistency.
6. Enhancement proposals must include: **funnel step · conversion/drop-off · evidence · expected impact · success metric**.

### Enhancement proposal (required for non-maintenance changes)

| Field | Example |
|-------|---------|
| Funnel step | Founder funnel step 3 → 4 (`first_contact_created` → `invite_sent`) |
| Conversion / drop-off | 42% proceed; 58% drop after first contact |
| Evidence | PostHog funnel export, 3 interview transcripts, ticket #1234 |
| Expected impact | Reduce step 3→4 drop by 15% |
| Success metric | Step 3→4 conversion ≥57% within 30 days of ship |

### New module/app merge checklist

Required before merge. See architecture doc for implementation paths.

| ☐ | Item |
|---|------|
| ☐ | i18n complete (all locales) |
| ☐ | FIRST_TIME empty state |
| ☐ | Module visit tracking |
| ☐ | PostHog analytics event coverage |
| ☐ | Platform Home integration reviewed (if applicable) |
| ☐ | Permissions validated |
| ☐ | Empty-state classification reviewed (`FIRST_TIME` / `NO_DATA` / `NO_ACCESS` / `NOT_CONFIGURED` / `DISABLED`) |

Deferred v1 items (tours, chatbot, re-onboarding, billing onboarding) stay deferred unless metrics justify them.

## 6. Org setup progress (derived state)

Org-level checklist steps are computed in `syncOrgAutomaticCompletions`:

| Step | Auto-complete when |
|------|-------------------|
| `org_workspace_profile` | Org has name + timezone + currency |
| `org_first_record` | ≥1 People record |
| `org_invite_sent` | >1 active user |
| `org_email_connected` | Connected mailbox (Gmail sync or outbound) |
| `org_import_done` | Completed/partial import in `ImportHistory` |
| `org_settings_visited` | Founder visits `/settings` (client `record_settings_visit`) |

No manual PATCH required for derived steps.
