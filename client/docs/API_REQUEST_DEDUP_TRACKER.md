# API Request Dedup Tracker

Living document for duplicate and unnecessary client-side API requests identified in the Arivu audit (2026-06-27). Update this file as each item is fixed, deferred, or verified.

## How to use

1. Pick the next **P0 → P1 → P2** item with status `open`.
2. Implement the fix; note files changed in **Fix log**.
3. Set item status to `fixed` and add verification steps under the item.
4. If partially addressed, use `in-progress` and link the PR or commit.

### Status legend

| Status | Meaning |
|--------|---------|
| `open` | Not started |
| `in-progress` | Work underway |
| `fixed` | Shipped and verified |
| `wontfix` | Accepted cost; document reason |
| `mitigated` | Reduced but not fully eliminated |

---

## Summary

| ID | Area | Severity | Status | Priority |
|----|------|----------|--------|----------|
| [L-01](#l-01-modulelist--listview-initial-double-fetch) | List infra | High | fixed | P0 |
| [L-02](#l-02-listview-paginationsort-double-fetch) | List infra | High | fixed | P0 |
| [L-03](#l-03-hidden-modulelist-fetch-with-alternate-view) | Tasks / Deals / Events | High | fixed | P1 |
| [L-04](#l-04-events-calendar-triple-fetch) | Events | High | fixed | P1 |
| [L-05](#l-05-documents-list-double-fetch) | Documents | High | fixed | P2 |
| [L-06](#l-06-keep-alive-tab-return-refetch) | ModuleList | Medium | fixed | P2 |
| [B-01](#b-01-parallel-ui-composition-stacks) | Bootstrap | High | fixed | P1 |
| [B-02](#b-02-onboardingme-duplicate) | Bootstrap | Medium | fixed | P1 |
| [B-03](#b-03-release-notes-post-login-duplicate) | Bootstrap | Medium | fixed | P2 |
| [B-04](#b-04-i18n-upgrade-twice-after-login) | Bootstrap | Low | fixed | P2 |
| [R-01](#r-01-task-record-relationship-probe) | TaskRecordPage | Critical | fixed | P0 |
| [R-02](#r-02-deal-record-mount-burst) | DealRecordPage | High | fixed | P1 |
| [R-03](#r-03-generic-record-unconditional-users-list) | GenericRecordContent | High | fixed | P1 |
| [R-04](#r-04-case-record-triple-lookup-stacks) | Case pages | High | fixed | P2 |
| [R-05](#r-05-dynamicformfield-per-field-lookups) | Forms | High | fixed | P2 |
| [R-06](#r-06-modules-endpoint-query-fragmentation) | Cross-cutting | Medium | fixed | P2 |

**Progress:** 17 / 17 fixed

---

## Tier 1 — List infrastructure

### L-01: ModuleList + ListView initial double-fetch

**Status:** `fixed` · **Priority:** P0

**Symptom:** Opening any list module (People, Organizations, Tasks list, etc.) shows 2+ `GET /{module}` rows in Network; earlier rows show `(canceled)`.

**Trigger chain:**

1. `ModuleList.buildList()` → `initialListFetch()` → `fetchListReplace()`
2. `ListView.onMounted` → unconditional `emit('fetch')` → `fetchData()` → `fetchListReplace()`

**Key files:**

- `client/src/components/module-list/ModuleList.vue` — `buildList`, `initialListFetch`, `fetchListReplace`
- `client/src/components/common/ListView.vue` — `onMounted` (~L4147–4232)

**Affected endpoints:** `GET /people`, `/organizations`, `/tasks`, `/deals`, `/events`, etc.

**Proposed fix:**

- Single owner for initial fetch: either parent (`ModuleList`) **or** child (`ListView`), not both.
- Option A: Remove unconditional `emit('fetch')` on mount when saved view apply already emitted filters (comment at L4148 acknowledges parent fetch).
- Option B: Skip `initialListFetch()` in `buildList` when `ListView` will mount immediately.

**Verification:**

- [x] `ListView` accepts `skipMountFetch`; `ModuleList` passes it
- [x] `scheduleInitialListFetch()` dedupes `buildList` + `onActivated`
- [ ] Manual: Open People after login → 1 successful `GET /people`

---

### L-02: ListView pagination/sort double-fetch

**Status:** `fixed` · **Priority:** P0

**Symptom:** Changing page or sort fires two identical list GETs.

**Trigger chain:**

1. `ListView.handlePageChange` / `handleSort` → `emit('update:pagination'|'update:sort')` → parent `fetchData()`
2. Same handlers → `emit('fetch')` → parent `fetchData()` again

**Key files:**

- `client/src/components/common/ListView.vue` — `handlePageChange` (~L5153), `handleSort` (~L5158)
- `client/src/components/module-list/ModuleList.vue` — `handlePaginationUpdate`, `handleSortUpdate`

**Proposed fix:** Remove redundant `emit('fetch')` from pagination/sort handlers; parent `@update:*` handlers already fetch.

**Verification:**

- [x] Removed redundant `emit('fetch')` from `handlePageChange` / `handleSort`
- [ ] Manual: Change page on People list → 1 `GET /people`

---

### L-03: Hidden ModuleList fetch with alternate view

**Status:** `fixed` · **Priority:** P1

**Symptom:** Default kanban/calendar view still loads paginated list data in background.

**Trigger chain:** `ModuleList` always mounted; `buildList` + `initialListFetch` run regardless of `view-mode`. Parent simultaneously fetches kanban/calendar dataset.

**Key files:**

- `client/src/views/Tasks.vue` — kanban + always-on `ModuleList`
- `client/src/views/Deals.vue` — same
- `client/src/views/Events.vue` — calendar + hidden list

**Affected endpoints:**

- Tasks: `GET /tasks` (list) + `GET /tasks?limit=500` (kanban)
- Deals: same pattern
- Events: `GET /events` (calendar) + list fetch

**Proposed fix:** Defer or skip `ModuleList` data fetch when `view-mode !== 'list'` until user switches to list view.

**Shipped:** `shouldFetchListData()` gates `scheduleInitialListFetch` in `buildList` / `onActivated`; `watch(viewMode)` fetches when switching to list. Events passes `:view-mode="currentView"`.

**Verification:**

- [x] ModuleList skips list GET when viewMode is kanban/calendar
- [x] watch(viewMode) loads list on switch to list
- [ ] Manual: Tasks board default → no paginated `GET /tasks`; switch to list → 1 fetch

---

### L-04: Events calendar triple-fetch

**Status:** `fixed` · **Priority:** P1

**Symptom:** 3× `GET /events` on first calendar load; 2× on tab return.

**Trigger chain (first load):**

1. `watch(currentView, { immediate: true })` → `fetchCalendarEvents()`
2. `onMounted` → `initializeView()` → `applyView('calendar')` → `nextTick` → `fetchCalendarEvents()`
3. `onMounted` → direct `fetchCalendarEvents()`

**Tab return:** `onActivated` → `initializeView()` (fetch via applyView) + direct `fetchCalendarEvents()`.

**Key file:** `client/src/views/Events.vue`

**Proposed fix:** Single calendar fetch entry point; guard with in-flight promise or “last fetch params” dedup.

**Shipped:** `scheduleCalendarFetch()` coalesces calls; removed `watch` `{ immediate: true }` and duplicate `onMounted`/`onActivated` fetches; record-created handlers refresh only active view.

**Verification:**

- [x] Single entry point for calendar fetch
- [ ] Manual: Open Events calendar → 1 `GET /events` (no hidden list GET from L-03)

---

### L-05: Documents list double-fetch

**Status:** `fixed` · **Priority:** P2

**Symptom:** Documents list view fires duplicate `GET /documents` on open and pagination.

**Trigger chain:**

- `watch(activeView)` → `loadViewData()`
- `ListView` / `DocumentsListView` mount → `@fetch` → `loadListData()`
- Pagination: `handlePaginationUpdate` + `@fetch` both load

**Key files:**

- `client/src/views/Documents.vue`
- `client/src/components/documents/DocumentFolderBrowsePane.vue`

**Proposed fix:** Same pattern as L-01/L-02 — one fetch owner per action.

**Shipped:** `DocumentsListView` + knowledge `ListView` pass `skip-mount-fetch`; parent `onMounted` / `loadViewData` owns initial fetch. Pagination uses `@update:pagination` only (L-02).

**Verification:**

- [x] `skip-mount-fetch` on Documents list + knowledge ListView
- [ ] Manual: Open Documents list → 1 `GET /documents`

---

### L-06: Keep-alive tab return refetch

**Status:** `fixed` · **Priority:** P2

**Symptom:** Returning to a list tab refetches page 1 even when data was loaded moments ago.

**Trigger chain:** `ModuleList.onDeactivated` aborts fetches and clears rows → `onActivated` → `initialListFetch()` when empty. Exposed `reactivate()` is never called by parents.

**Key file:** `client/src/components/module-list/ModuleList.vue`

**Proposed fix:** Preserve rows on deactivate (or use session restore without network); wire tab system to `reactivate()` for soft restore.

**Shipped:** `onDeactivated` no longer clears `data` or resets pagination; in-flight fetches are still aborted. `onActivated` restores scroll/session from cached rows when present.

**Verification:**

- [x] Rows preserved across keep-alive deactivate/activate
- [ ] Manual: Load People → switch tab → return → no `GET /people` if data still valid
- [ ] Scroll/lazy pages restore from session without full refetch

---

## Tier 2 — Bootstrap / login

### B-01: Parallel UI composition stacks

**Status:** `fixed` · **Priority:** P1

**Symptom:** Shell mount hits overlapping UI metadata endpoints.

**Trigger chain:**

- `App.vue` `onMounted` → `loadUIMetadata()` → `GET /ui/sidebar`, `GET /ui/routes`
- `Nav.vue` watch → `buildSidebar()` → `getAppRegistry()` → `GET /ui/registry` (or fallback chain)

**Key files:**

- `client/src/App.vue`
- `client/src/stores/appShell.js`
- `client/src/components/Nav.vue`
- `client/src/utils/getAppRegistry.ts`

**Note:** `loadUIMetadata` has single-flight dedup; registry path is separate stack.

**Proposed fix:** Unify composition load (single endpoint or sequential: registry first, derive sidebar from it).

**Shipped:** `loadUIMetadata()` calls `ensureCachedAppRegistry()` first and fetches **`/ui/routes` only** — removed redundant `/ui/sidebar`. Nav sidebar uses registry; routes feed `initializeDynamicRoutes`.

**Verification:**

- [x] Removed `/ui/sidebar` from bootstrap path
- [ ] Manual: Page refresh → `/ui/registry` + `/ui/routes` only (no `/ui/sidebar`)

---

### B-02: `/onboarding/me` duplicate

**Status:** `fixed` · **Priority:** P1

**Symptom:** 2× `GET /onboarding/me` on shell mount; 3× if redirected to onboarding route.

**Trigger chain:**

- `GlobalSurfacesProvider` → `initializeIfReady()` → `fetchOnboarding()`
- `OnboardingCoachmarks` → `onMounted` → `fetchOnboarding()`
- `Onboarding.vue` → `onMounted` (when on route)

**Key files:**

- `client/src/composables/useOnboarding.js` — no in-flight guard
- `client/src/components/global/GlobalSurfacesProvider.vue`
- `client/src/components/onboarding/OnboardingCoachmarks.vue`

**Proposed fix:** Module-level `sharedInflight` + cache in `useOnboarding` (mirror `usePeopleModuleFields`).

**Shipped:** `fetchOnboardingInflight` coalesces concurrent callers in `useOnboarding.js`.

**Verification:**

- [x] In-flight guard added
- [ ] Manual: Login → shell → 1 `GET /onboarding/me`

---

### B-03: Release notes post-login duplicate

**Status:** `fixed` · **Priority:** P2

**Trigger chain:** `initializeIfReady()` → `fetchUnseen()`; first navigation → `refreshOnFocus()` → `fetchUnseen()` + `fetchBadge()`.

**Key file:** `client/src/composables/useReleaseNotes.js`

**Shipped:** In-flight guard + 10s TTL on `fetchUnseen` (same pattern as B-02).

**Verification:**

- [x] In-flight + TTL on unseen fetch
- [ ] Login → first in-app navigation → 1 unseen fetch

---

### B-04: i18n upgrade twice after login

**Status:** `fixed` · **Priority:** P2

**Trigger chain:** `auth.setUser()` → `upgradeI18nAfterLogin()`; router `beforeEach` from login → same.

**Key files:** `client/src/stores/auth.js`, `client/src/router/index.js`, `client/src/i18n/index.ts`

**Shipped:** Removed duplicate router post-login upgrade; `setUser` → `syncI18nFromOrganization` is single owner.

**Verification:**

- [x] Router duplicate removed
- [ ] Login → locale upgrade runs once

---

## Tier 3 — Record pages

### R-01: Task record relationship probe

**Status:** `fixed` · **Priority:** P0

**Symptom:** Opening a task fires **6×** `GET /relationships/links` + **6×** `GET /relationships/record-context`.

**Trigger chain:** `fetchRelatedRecords()` tries `{ appKey: platform|sales|crm } × { links, record-context }`.

**Key file:** `client/src/pages/tasks/TaskRecordPage.vue` (~L3431)

**Proposed fix:** Resolve appKey from route/meta once; single links + single record-context call.

**Shipped:** Sequential context probe — 2 calls per candidate, stops at first hit (`platform` → `sales` → `crm`). Typical load: 2 calls (was 12).

**Verification:**

- [x] Replaced parallel 6+6 probe with sequential bundle fetch
- [ ] Manual: Open task record → ≤2 relationship calls when platform has data

---

### R-02: Deal record mount burst

**Status:** `fixed` · **Priority:** P1

**Symptom:** After `GET /deals/:id`, 8+ parallel secondary calls; edit drawer repeats lookups.

**Key file:** `client/src/pages/deals/DealRecordPage.vue`

**Endpoints:** activity, comments, threads, `/modules`, `/users/list`, `/v2/organization`, `/people?limit=200`

**Proposed fix:** Shared lookup loader; pass cached data to `CreateRecordDrawer`; use `fetchModulesListCached`.

**Shipped:** Lazy `ensureDealLookups()` on inline-edit / edit drawer open; `recordLookupCache` for users/people/orgs; `moduleDefinitionPrefetch` on edit drawer; navigation ids deferred via `requestIdleCallback`; mount burst reduced to deal + activity + comments + threads + modules.

**Verification:**

- [x] Lookups lazy-loaded; drawer reuses modules cache + lookup cache
- [ ] Open deal (view-only) → no users/people/org GETs until edit
- [ ] Open deal → edit drawer → no duplicate `/modules` or relationship lists

---

### R-03: Generic record unconditional users list

**Status:** `fixed` · **Priority:** P1

**Symptom:** Every generic record loads `GET /users/list?limit=500` even without user fields.

**Key file:** `client/src/components/record-page/GenericRecordContent.vue` — `loadUserLookup`

**Proposed fix:** Gate on module field definitions containing user lookups.

**Shipped:** `moduleNeedsUserLookup()` gates `loadUserLookup` in deferred record load.

**Verification:**

- [x] Gate implemented on module field metadata
- [ ] Manual: Record without user fields → no `/users/list`

---

### R-04: Case record triple lookup stacks

**Status:** `fixed` · **Priority:** P2

**Symptom:** Case page loads users/people/orgs/modules from three composables independently.

**Key files:**

- `client/src/composables/useCaseRecord.js`
- `client/src/composables/useCaseRecordDetailFields.js`
- `client/src/composables/usePersonRecordDetailFields.js`
- `client/src/components/cases/CaseDetailsPanel.vue`
- `client/src/components/cases/CaseContactProfilePanel.vue`

**Proposed fix:** Case-level lookup provider or shared session composable.

**Shipped:** `recordLookupCache.js` coalesces `/users/list`, `/people`, `/v2/organization`. Case composables + `GenericRecordContent` deferred loads share one in-flight request per endpoint/params.

**Verification:**

- [x] Shared lookup cache wired in case composables
- [ ] Manual: Open case → 1× each of users/people/orgs/modules (not 3×)

---

### R-05: DynamicFormField per-field lookups

**Status:** `fixed` · **Priority:** P2

**Symptom:** Each lookup/user field instance fetches on mount; N fields → N architectural fetch sites (partially coalesced by apiClient).

**Key file:** `client/src/components/common/DynamicFormField.vue`

**Proposed fix:** Target-module lookup cache composable; inject into fields.

**Shipped:** Inline combobox lookups for users/people/organizations route through `recordLookupCache.js` (paginated modal browse still uses direct GET with search/page params).

**Verification:**

- [x] Shared cache for users/people/org inline lookups
- [ ] Manual: Form with 3 user fields → 1 `/users/list`

---

### R-06: `/modules` query fragmentation

**Status:** `fixed` · **Priority:** P2

**Symptom:** Same tenant schema fetched with different query shapes → separate cache keys.

**Callers:** `GenericRecordContent`, `DealRecordPage`, `TaskRecordPage`, detail composables, `DynamicForm` — params vary (`context=all`, `key=`, none).

**Proposed fix:** Standardize on `fetchModulesListCached` with normalized keys; pass `moduleOverride` to children.

**Shipped:** `fetchModulesListCached` normalizes `{}` → `{ context: 'all' }`; added `fetchModuleDefinitionCached(moduleKey)` to resolve from full-list cache before keyed fetch. Callers migrated: case/people detail composables, `DealRecordPage`, `TaskRecordPage`, `CreateRecordDrawer`.

**Verification:**

- [x] Normalized modules cache keys + `fetchModuleDefinitionCached`
- [ ] Manual: Navigate deal → edit drawer → 1 modules fetch per session shape

---

## Already mitigated (do not regress)

| Mechanism | Location | Behavior |
|-----------|----------|----------|
| People module fields cache | `usePeopleModuleFields.ts` | Shared inflight + memory cache |
| People types cache | `usePeopleTypes.ts` | Per-appKey cache + 5m localStorage |
| App registry cache | `getAppRegistry.ts` / `appShell.ensureCachedAppRegistry` | Single-flight + sessionStorage |
| Tenant modules cache | `tenantSchemaApiCache.js` | `fetchModulesListCached`, `fetchModuleDefinitionCached` |
| Record lookup cache | `recordLookupCache.js` | `/users/list`, `/people`, `/v2/organization` session inflight |
| GET in-flight dedup | `apiClient.js` | Identical URL+method (excludes AbortSignal GETs) |
| Persistent GET cache (30s) | `apiClient.js` | `/users/list`, `/people`, `/v2/organization`, etc. |
| UI metadata single-flight | `appShell._loadUIMetadataPromise` | Concurrent `loadUIMetadata` deduped |
| Profile refresh | `App.vue` | Only on page refresh, not password login |
| Permission sync | `PermissionSyncHost` | Interval only (2 min), no mount fetch |

**Important:** List `fetchListReplace` uses `AbortSignal` → apiClient **skips** in-flight dedup for those GETs. Fixing L-01/L-02 is required; apiClient dedup alone will not help lists.

---

## Fix log

Record each fix here (newest first).

| Date | ID | Summary | PR / commit |
|------|-----|---------|-------------|
| 2026-06-27 | R-02 | Deal lazy lookups, drawer module prefetch, idle nav ids | (pending commit) |
| 2026-06-27 | L-06, R-04, R-05, R-06 | Keep-alive list row preserve; recordLookupCache; modules cache normalization | (pending commit) |
| 2026-06-27 | B-03, B-04 | Release notes unseen TTL/inflight; single-owner i18n post-login | (pending commit) |
| 2026-06-27 | L-05, R-02 | Documents skipMountFetch; deal lookup gate + drawer modules cache | (pending commit) |
| 2026-06-27 | B-01, R-02, R-03 | Bootstrap routes-only loadUIMetadata; deal modules cache; generic user lookup gate | (pending commit) |
| 2026-06-27 | L-03, L-04 + HAR | Defer list fetch for kanban/calendar; Events calendar dedup; filter hydration guards | (pending commit) |

---

## Verification checklist (smoke)

Run after each P0 batch:

1. **Login → People:** Network filter `people` → 1 successful fetch.
2. **People pagination:** Page 2 → 1 fetch.
3. **Tasks board default:** No paginated list GET until list view selected.
4. **Task record open:** ≤2 relationship calls total.
5. **Page refresh (authenticated):** Note bootstrap call count baseline for B-01/B-02.

---

## References

- Initial investigation: People module duplicate requests after login (Network tab, canceled + 200 pattern).
- Architecture: list flow in `ModuleList.vue` + `ListView.vue`; shell in `App.vue` + `Nav.vue` + `appShell.js`.
