# Internationalization (i18n) Guidelines

Enterprise localization infrastructure for Arivu. All platform chrome uses **vue-i18n** with **ICU MessageFormat** syntax.

**See also:** [I18N_SUMMARY.md](./I18N_SUMMARY.md) (what we built) · [I18N_DEVELOPER_GUIDE.md](./I18N_DEVELOPER_GUIDE.md) (add/update languages and strings)

## Namespace ownership

| Namespace | Owner team | Purpose |
|-----------|------------|---------|
| `actions.*` | Platform UX | Buttons and verbs (save, cancel, delete) |
| `states.*` | Platform UX | Loading, empty, error, success states |
| `validation.*` | Platform UX | Form validation copy |
| `errors.*` | Platform + API | Semantic error codes from server |
| `navigation.*` | Platform UX | Sidebar, tabs, wayfinding |
| `common.*` | Platform UX | Cross-cutting ICU templates (counts, greetings) |
| `settings.*` | Settings squad | Organization/profile settings (add when migrating) |
| `records.*` | CRM / records | Record page chrome and shared record UI |
| `forms.*` | Forms | Form builder, list, responses, and public fill surfaces |
| `process.*` | Automation | Process designer |
| `appointments.*` | Scheduling | Booking pages, public manage, appointment components |
| `tasks.*` | CRM | Task modals, drawers, widgets |
| `events.*` | CRM | Events list, detail, execution surfaces |
| `deals.*` | CRM | Deal modals and related widgets |
| `people.*` | CRM | People/contact surfaces and participation UI |
| `organizations.*` | CRM | Organization and group surfaces |
| `inbox.*` | Communications | Inbox, email thread, connect wizards |
| `dashboard.*` | Platform | Dashboard widgets and home |
| `import.*` | Platform | CSV/universal import modals |
| `audit.*` | Audit app | Audit and portal response views |
| `platform.*` | Platform | Instance management, landing, registry |

**Feature namespaces** use the feature name as the first segment (`deals.list.empty`). Do not add keys to `common` unless used in 3+ unrelated features.

## Key naming rules

1. **Max depth: 3** segments — `actions.save.confirm` ✅, `actions.save.confirm.dialog` ❌
2. **lowerCamelCase** segments only — `errors.permission_denied` uses snake for API code mapping only inside `errors.*`
3. **Forbidden leaf segments** (too generic): `title`, `label`, `message`, `text`, `name`, `description`, `error`, `hint`, `placeholder`
4. **Semantic keys** — describe intent, not appearance:
   - ✅ `actions.save`, `states.loading`, `errors.permission_denied`
   - ❌ `title`, `label`, `message`
5. **No duplicate phrases across domains** — if two features need "Save", both use `actions.save`
6. **Deprecation** — set `"deprecated": true` and `"deprecatedBy": "actions.save"`; remove usages before deleting

## When NOT to translate

Do **not** pass these through `$t()` / `t()`:

- Record names, emails, notes, activity bodies (user/data content)
- Automation/process sentences stored in the database (until Phase 4 server `labelKey`)
- Email templates and notification bodies (until Phase 4)
- User-generated content

**Configurable tenant copy (translate via catalog, not raw `t(apiLabel)`):**

- System field labels → `{module}.sysField*` + `resolveFieldLabel()`
- Common custom field labels → `common.phrase{Phrase}` (e.g. `phraseAnnualRevenue`)
- Default pipeline stages / deal picklists → `deals.stage*`, `deals.picklist*` + `configurableLabelResolver.js`
- Sidebar/tab module names → `navigation.module*` + `navigationLabels.js`

Tenant labels with no catalog entry fall back to the API string unchanged.

## ICU usage (required)

All user-visible platform strings must be valid ICU MessageFormat.

```json
{
  "recordsCount": {
    "message": "{count, plural, one {# record} other {# records}}",
    "description": "List header count"
  }
}
```

### Pluralization

```js
t('common.recordsCount', { count: records.length })
```

### Interpolation

```js
t('common.welcomeUser', { name: user.firstName })
```

### Select (gender / variant)

```js
t('common.assignedToUser', { gender: 'female' })
```

### Rules

- **Never** concatenate translated fragments: `t('a') + value + t('b')` ❌
- **Always** use a single ICU template with parameters ✅
- Workflow/automation copy: use `buildSentence()` from `@/utils/localeSentence`

## Interpolation rules

- Pass primitive params only (`string`, `number`, `boolean`)
- Format dates/numbers **before** interpolation if embedded in sentences
- Use `{name}` consistent naming across locales
- Server error params: pass through `resolveApiErrorMessage(t, payload)` with `payload.params`

## Catalog file format (TMS-ready)

```json
{
  "save": {
    "message": "Save",
    "description": "Primary save action button",
    "context": "settings-form"
  }
}
```

Files live in `src/locales/{lang}/{namespace}.json`. Keys in file are **relative** to namespace (loader prefixes `actions.` etc.).

Export for Crowdin/Lokalise/Phrase: `npm run i18n:extract -- --export`

## Pseudo-localization

| Tag | Purpose |
|-----|---------|
| `en-XA` | Accent + ~30% length expansion |
| `ar-XB` | RTL + pseudo accents |

Enable in **Profile → Localization QA** (dev/staging) or `localStorage.setItem('arivu:i18n:pseudoLocale', 'en-XA')`.

## Centralized locale service

Use `useLocale()` for:

- `language`, `locale`, `timeZone`, `currency`
- `isRtl`, `isPseudo`
- `formatDate`, `formatTime`, `formatCurrency`, `formatNumber`, `formatRelativeTime`
- `setLanguage()`

Do **not** call `toLocaleString()` / `Intl.*` in Vue components — ESLint `arivuI18n/no-direct-intl` enforces this.

## Semantic errors

Server returns `{ code: "PERMISSION_DENIED", params?: {} }`. Client maps via `errors.*` keys. Never display raw server `message` in production UI when `code` is present.

## Telemetry

Enable with `localStorage.setItem('arivu:i18n:telemetry', '1')` or the developer settings toggle. Tracks missing keys, fallback usage, and locale load failures in dev/staging.

## Tooling

| Script | Purpose |
|--------|---------|
| `npm run i18n:validate` | ICU syntax, key rules, missing keys in existing locale dirs |
| `npm run i18n:lint` | Orphaned/deprecated keys vs source usage |
| `npm run i18n:extract` | Used keys report; `--export` for TMS |
| `npm run i18n:find-hardcoded` | English strings in enforced UI paths |
| `npm run i18n:check` | sync-keys check + validate + lint + extract (CI) |
| `npm run i18n:sync-keys` | Copy missing keys from `en` → all locales |
| `npm run i18n:add-language -- <code> [locale]` | Register a new language and scaffold locale files |
| `npm run i18n:extract:check` | Fail if source uses `t()` keys missing from catalog |

## Developer workflow (new features)

1. Add user-visible copy with `t('feature.semanticKey')` — never hardcode English in enforced paths.
2. Add the key to `src/locales/en/{namespace}.json`.
3. Run `npm run i18n:sync-keys` so every locale gets the new key (English until translated).
4. Optionally `npm run i18n:translate-locale -- de` or target locale.
5. Run `npm run i18n:check` before opening a PR.

**Navigation / fields:** reuse `navigationLabels.js`, `resolveFieldLabel`, `configurableLabelResolver.js` (see `.cursor/rules/i18n-new-ui.mdc`).

**Module list views:** reuse `moduleListLabels.js` for titles, stats, saved views, columns, and filters.

## Adding a new language

1. Run `npm run i18n:add-language -- pl pl-PL` (replace with your ISO 639-1 code and BCP 47 locale).
2. The script updates `src/i18n/constants.ts` and `scripts/i18n/shared.mjs`, then mirrors `en` locale files.
3. Translate with `npm run i18n:translate-locale -- pl` or edit `src/locales/pl/*.json` directly.
4. For RTL languages, add the code to `RTL_LANGUAGES` in `src/i18n/constants.ts`.
5. Run `npm run i18n:check` before opening a PR.

**New enforced surface:** extend `scripts/i18n/find-hardcoded.mjs` phase map and add a CI step in `.github/workflows/test.yml` so regressions fail the build.

## Bundle performance

- Locales load lazily via `import.meta.glob` (per-language JSON files)
- **Staged load:** `initI18n` applies **core** namespaces first (~500KB), then loads `settings`, `forms`, and `process` in the background
- `/settings` and `/forms` routes call `ensureFullLocaleLoaded()` before render
- Language switches (`setI18nLanguage`) await the **full** bundle
- Dev budget warnings (uncompressed flat messages): core 512KB, full 1.5MB; per-namespace 96KB for core namespaces only (`settings` / `forms` / `process` are excluded — they are large by design)
- Fallback cache: English loaded first; other locales merge on top

## ESLint

- `arivuI18n/no-hardcoded-ui-strings` — `warn` in `components/ui`, `layouts`, `common`, `modals`
- `arivuI18n/no-direct-intl` — `warn` in all `src` except locale utils

Escalate to `error` as surfaces are migrated.
