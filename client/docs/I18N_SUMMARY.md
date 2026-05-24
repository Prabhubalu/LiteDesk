# LiteDesk internationalization — summary

This document describes what was implemented for platform-wide localization in LiteDesk: infrastructure, migration approach, runtime behavior, and the surfaces that were brought under translation control.

For day-to-day development, see [I18N_DEVELOPER_GUIDE.md](./I18N_DEVELOPER_GUIDE.md). For key rules and ICU syntax, see [I18N_GUIDELINES.md](./I18N_GUIDELINES.md). For phase-by-phase migration history, see [I18N_ROLLOUT.md](./I18N_ROLLOUT.md).

---

## Goals

1. **User-facing UI** in all supported languages, not only English.
2. **Stable key structure** so translations can be maintained, synced, and validated in CI.
3. **Tenant-configurable labels** (fields, pipelines, picklists, module names) resolved through catalogs where possible, without hardcoding API strings in components.
4. **Safe rollout** — English fallback, missing-key telemetry, and automated checks on new work.

---

## Supported languages

| Code | Default locale | Notes |
|------|----------------|-------|
| `en` | `en-US` | Source catalog; fallback for all locales |
| `es` | `es-ES` | |
| `fr` | `fr-FR` | |
| `de` | `de-DE` | |
| `it` | `it-IT` | |
| `pt` | `pt-PT` | |
| `nl` | `nl-NL` | |
| `ru` | `ru-RU` | |
| `ar` | `ar-SA` | RTL; listed in `RTL_LANGUAGES` |
| `hi` | `hi-IN` | |
| `ja` | `ja-JP` | |
| `zh` | `zh-CN` | |
| `ko` | `ko-KR` | |

**Pseudo locales** (QA only): `en-XA` (length stress), `ar-XB` (RTL stress).

---

## Architecture (client)

```
src/locales/{lang}/{namespace}.json   ← message catalogs (one file per namespace)
src/i18n/
  index.ts          ← vue-i18n instance, init, setLanguage
  loadLocale.ts     ← lazy load + staged core/deferred bundles
  constants.ts      ← languages, namespaces, budgets
src/utils/
  navigationLabels.js       ← sidebar, tabs
  moduleListLabels.js         ← list/kanban/calendar list chrome
  fieldLabelResolver.js       ← system field labels
  configurableLabelResolver.js ← tenant phrases, pipelines, picklists
```

**Runtime flow**

1. App starts → `initI18n()` loads **core** namespaces for the org/user language.
2. **Deferred** namespaces (`settings`, `forms`, `process`) load in the background (~680KB combined per locale).
3. Routes under `/settings` and `/forms` wait for the full bundle before render.
4. Language switch loads core immediately, then the full bundle.
5. Missing keys fall back to English; dev builds can show `[missing:key]` and log telemetry.

**Why staged loading:** A full locale is ~1.1MB uncompressed. Core (~480KB) covers navigation, lists, records, inbox, dashboard, platform home, etc. Heavy admin builders load when needed.

---

## Catalog structure

- **Namespaces** (e.g. `actions`, `common`, `navigation`, `people`, `deals`) map to `src/locales/en/actions.json`.
- **Keys** are max **3 segments**: `people.listViewAll` → message id `people.listViewAll`.
- **Leaf keys** use semantic names (`listCreate`, not `label` or `message`).
- Each entry: `{ "message": "...", "description": "..." }` for translators and TMS export.

Shared namespaces are listed in `src/i18n/constants.ts` (`SHARED_NAMESPACES`).

---

## What was migrated (by area)

### Shell and navigation

- Sidebar, top tabs, global search, user menu.
- App names via `navigation.app*` keys and `APP_NAME_KEYS`.

### List views (all CRM modules)

- Page titles, saved views (“All People”, “My Deals”, …), stat cards, search placeholders, create buttons.
- Column and filter labels via `resolveFieldLabel` / `moduleListLabels.js`.
- Empty states, filter chips, “Clear search & filters”.
- Wired in `ModuleList.vue` and `ListView.vue`.

### Views

- **People** — app context tabs, participation UI.
- **Deals** — list + kanban; pipeline stage columns remain tenant/API names unless catalogued.
- **Events** — list + **FullCalendar** toolbar (Today, Month, Week, Day, List).
- **Platform home** — greetings, focus line fallback, today-strip chips, alerts, section headers.

### Records and forms

- Record page shell, activity timeline, generic content, deal/task record pages.
- Large **forms** and **settings** surfaces migrated in phased CI gates (see `I18N_ROLLOUT.md`).

### Configurable tenant labels

- System fields: `{module}.sysField*` per module.
- Common tenant phrases: `common.phrase*` (e.g. annual revenue).
- Deal stages/pipelines/picklists: `deals.stage*`, `deals.pipeline*`, `deals.picklist*`.
- Resolved in UI via `configurableLabelResolver.js` and `resolveFieldLabel()`.

### Notifications and inbox

- Notification bell tooltips (split into one/many keys — no ICU `plural` in message strings; vue-i18n message compiler limitation).
- Inbox get-started tips: `@` in copy escaped by rewording (linked-message syntax conflict).

---

## Automation and quality gates

| Command | Role |
|---------|------|
| `npm run i18n:check` | CI: key sync, validate, lint, extract |
| `npm run i18n:sync-keys` | Copy new English keys into all locale files |
| `npm run i18n:sync-keys:check` | CI: fail if any locale missing keys |
| `npm run i18n:extract:check` | CI: fail if `t()` uses keys not in catalog |
| `npm run i18n:validate` | ICU + naming rules |
| `npm run i18n:find-hardcoded` | Scans enforced paths for English literals |
| `npm run i18n:translate-locale -- hi` | Machine-translate missing non-English strings |
| `npm run i18n:add-language -- pl pl-PL` | Register language + scaffold files |

**Cursor rule:** `.cursor/rules/i18n-new-ui.mdc` reminds agents to use `t()` and shared resolvers for new UI.

---

## Runtime fixes applied

| Issue | Resolution |
|-------|------------|
| ICU `{count, plural, ...}` in notification tooltip | Replaced with `bellTooltipUnreadOne` / `bellTooltipUnreadMany` + branch in component |
| `@` in inbox tip HTML | Removed literal `@` from message text; use “mentions” wording |
| Hindi bundle “exceeds 48KB” warning | Staged loading + realistic dev budgets (core 512KB, full 1.5MB) |
| List/home still English | Hardcoded strings in `PlatformHome.vue`, `platformHomeGreeting.js`; API `focusLine` and record titles may still be English from server |

---

## What is intentionally still English

| Source | Reason |
|--------|--------|
| User-entered record names, notes, emails | Data, not UI copy |
| Custom pipeline/stage names without catalog entries | Tenant configuration |
| Some API `focusLine` / dynamic summaries | Server returns final strings; needs backend `labelKey` or MT pipeline |
| ICU plurals inside JSON messages | Avoid; use one/many keys or branch in code (see guidelines) |

---

## Org and user language

- Organization default language and user preference drive `initI18n()` / `setI18nLanguage()`.
- Profile/settings can change language at runtime; full bundle is loaded on switch.
- Formatting uses `useLocale()` (`formatDate`, `formatCurrency`, etc.) — not raw `Intl` in components.

---

## Recommended verification

1. Set org or user language to `hi` (or target locale).
2. Hard refresh the browser.
3. Walk: sidebar → People list → Deals (list/kanban) → Events (list/calendar) → Platform home → Settings (loads deferred catalogs).
4. Run `npm run i18n:check` before merging i18n changes.

---

## Related documents

| Document | Audience |
|----------|----------|
| [I18N_DEVELOPER_GUIDE.md](./I18N_DEVELOPER_GUIDE.md) | Adding/updating strings and languages |
| [I18N_GUIDELINES.md](./I18N_GUIDELINES.md) | Key rules, ICU, namespaces |
| [I18N_QA_CHECKLIST.md](./I18N_QA_CHECKLIST.md) | QA passes |
| [I18N_ROLLOUT.md](./I18N_ROLLOUT.md) | Detailed migration phases |

---

## Maintenance mindset

- **New UI** → always `t('namespace.semanticKey')` + English catalog + `i18n:sync-keys`.
- **New language** → `i18n:add-language` + translate + optional RTL flag.
- **Copy change** → edit `en` first, sync, then update translations (or MT per locale).
- **Do not** delete English keys without checking all locales and `i18n:lint` orphans.

This rollout makes the product **localizable by design**; remaining English is either missing keys, untranslated locale files, or server-provided text that still needs a backend localization pass.
