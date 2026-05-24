# i18n developer guide — add languages and update translations

Practical guide for adding UI copy, registering a new language, and keeping all locale files in sync.

**Also read:** [I18N_GUIDELINES.md](./I18N_GUIDELINES.md) (rules), [I18N_SUMMARY.md](./I18N_SUMMARY.md) (what we built).

---

## Quick reference

| Task | Command |
|------|---------|
| Add UI string | `t('namespace.key')` + edit `src/locales/en/{namespace}.json` |
| Propagate new keys to all languages | `npm run i18n:sync-keys` |
| Verify before PR | `npm run i18n:check` |
| Add a new language | `npm run i18n:add-language -- <code> [bcp47-locale]` |
| Machine-translate one locale | `npm run i18n:translate-locale -- de` |
| Find hardcoded English in UI | `npm run i18n:find-hardcoded` |

---

## 1. Add or change UI text (existing languages)

### Step 1 — Use `t()` in Vue/JS

```vue
<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<template>
  <button>{{ t('actions.save') }}</button>
  <p>{{ t('people.listStatTotal', { count: total }) }}</p>
</template>
```

**Do not** hardcode user-visible English in components under CI-enforced paths (see `scripts/i18n/find-hardcoded.mjs`).

### Step 2 — Add the key to English catalog

Edit `src/locales/en/{namespace}.json`:

```json
{
  "listStatTotal": {
    "message": "Total People",
    "description": "People list statistics card label"
  }
}
```

Rules:

- Max **3** dot segments (`people.listStatTotal` ✅).
- Semantic leaf names (`listStatTotal`, not `label` or `message`).
- Prefer reusing shared keys: `actions.save`, `states.loading`, `common.listClearFilters`.

### Step 3 — Sync to all locales

```bash
cd client
npm run i18n:sync-keys
```

This copies **missing** keys from `en` into every other language file. Existing translations are **not** overwritten.

### Step 4 — Translate (optional)

**Option A — Machine translation (OpenAI, requires env):**

```bash
npm run i18n:translate-locale -- de
# or one namespace only:
node scripts/i18n/translate-locale.mjs de --namespaces=people,platform
```

**Option B — Manual:** edit `src/locales/de/people.json` (etc.) directly.

**Option C — Cognate patches** for European languages:

```bash
npm run i18n:apply-cognates
```

### Step 5 — Validate

```bash
npm run i18n:check
```

Fix any ICU errors, missing keys, or extract failures before opening a PR.

---

## 2. Reuse shared resolvers (don’t duplicate keys)

| Need | Use |
|------|-----|
| Sidebar / tab titles | `navigationLabels.js` → `navigation.*` |
| App names (Sales, Helpdesk) | `APP_NAME_KEYS` in `navigationLabels.js` |
| Module list title, views, stats, columns, filters | `moduleListLabels.js` |
| System field labels | `resolveFieldLabel(moduleKey, field, t, te)` |
| Tenant picklists / pipelines / phrases | `configurableLabelResolver.js` |
| List search/create/empty states | `ModuleList.vue` patterns + `common.list*` keys |

Example — field label:

```javascript
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
resolveFieldLabel('people', { key: 'assignedTo', label: apiLabel }, t, te);
```

Example — list view title:

```javascript
import { resolveListPageTitle } from '@/utils/moduleListLabels';
resolveListPageTitle('people', t, te);
```

---

## 3. Add a new language

### Step 1 — Register language and scaffold files

```bash
cd client
npm run i18n:add-language -- pl pl-PL
```

Arguments:

- `pl` — ISO 639-1 code (lowercase, 2 letters).
- `pl-PL` — optional BCP 47 default locale for `Intl` formatters (defaults to a guess like `pl-PL`).

The script:

1. Adds the code to `src/i18n/constants.ts` (`SUPPORTED_LANGUAGES`, `LANGUAGE_TO_DEFAULT_LOCALE`).
2. Updates `scripts/i18n/shared.mjs` (used by validation/sync scripts).
3. Mirrors all `en/*.json` files into `src/locales/pl/`.
4. Runs `npm run i18n:sync-keys`.

### Step 2 — RTL (if applicable)

For right-to-left languages, add the code to `RTL_LANGUAGES` in `src/i18n/constants.ts`:

```typescript
export const RTL_LANGUAGES = new Set<SupportedLanguage>(['ar', 'pl']); // example
```

### Step 3 — Translate

```bash
# Full locale (slow for first run — many keys):
npm run i18n:translate-locale -- pl

# Or namespace by namespace:
node scripts/i18n/translate-locale.mjs pl --namespaces=navigation,common,actions
```

Review `src/locales/pl/*.json` — machine translation is a starting point, not final copy.

### Step 4 — Wire product (if needed)

- Ensure org settings / language picker includes the new code (server may need an allowlist — check org settings API).
- Verify `useLocale().setLanguage('pl')` loads messages and sets `dir="rtl"` when RTL.

### Step 5 — CI

```bash
npm run i18n:sync-keys:check   # all locales have all en keys
npm run i18n:check
```

---

## 4. Update translations for an existing language

### Small copy change (one key)

1. Edit `src/locales/en/{namespace}.json`.
2. Update the same key in `src/locales/{lang}/{namespace}.json` for each language you care about.
3. Run `npm run i18n:validate` and spot-check in the UI.

`sync-keys` does **not** overwrite existing translations — only adds missing keys.

### Bulk update after many new English keys

```bash
npm run i18n:sync-keys          # adds missing keys (English placeholder) everywhere
npm run i18n:translate-locale -- hi # translate only keys still equal to English
```

The translate script skips keys already translated and keys matching English.

### Handoff to translators

Export for TMS:

```bash
npm run i18n:extract -- --export
```

Catalog format per file: `{ "keyName": { "message": "...", "description": "..." } }`.

---

## 5. Pluralization and parameters

### Preferred: one/many keys (vue-i18n safe)

```json
"bellTooltipUnreadOne": { "message": "{count} unread notification" },
"bellTooltipUnreadMany": { "message": "{count} unread notifications" }
```

```javascript
const key = count === 1
  ? 'notifications.bellTooltipUnreadOne'
  : 'notifications.bellTooltipUnreadMany';
t(key, { count });
```

### Avoid in JSON (often breaks compilation)

```json
"bad": { "message": "{count} unread {count, plural, one {notification} other {notifications}}" }
```

The message compiler rejects nested/duplicate placeholders. Use ICU plurals only if you have verified compilation for that locale.

### Interpolation

```json
"greetingWithName": { "message": "Good morning, {name}" }
```

```javascript
t('platform.platformHomeGreetingMorningWithName', { name: firstName });
```

### Do not concatenate translated fragments

```javascript
// Bad
t('prefix') + user.name + t('suffix');

// Good
t('welcomeUser', { name: user.name });
```

---

## 6. Special characters in messages

### `@` (at-sign)

vue-i18n treats `@` as **linked message** syntax. Do not use literal `@mentions` in JSON.

- ✅ “Collaborate using **mentions** in comments.”
- ✅ Use `{'@'}` only if your toolchain validates it (we standardize on rewording).
- ❌ `"Use @mentions in comments"` → compile error.

### HTML in messages

Allowed in some places (e.g. inbox tips with `v-html`). Dev warns about HTML in messages. Prefer plain text or split into separate keys.

---

## 7. What not to translate with `t()`

| Content | Why |
|---------|-----|
| Contact names, deal titles, note bodies | User data |
| Raw API `field.label` when a `sysField*` key exists | Use resolver |
| Server error `message` when `code` is present | Use `resolveApiErrorMessage` |
| Email/notification body templates | Phase 4 / separate pipeline |

---

## 8. Locale loading behavior (for debugging)

| Event | Behavior |
|-------|----------|
| App init | Core namespaces only, then background full load |
| `setI18nLanguage(lang)` | Core immediately, then full bundle |
| Navigate to `/settings` or `/forms` | Router waits for `ensureFullLocaleLoaded()` |
| Missing key | Falls back to English; dev may show `[missing:key]` |

Deferred namespaces: `settings`, `forms`, `process`.

---

## 9. Testing checklist

- [ ] `npm run i18n:check` passes locally.
- [ ] Hard refresh after changing language.
- [ ] Sidebar, tabs, and target feature under test show translated chrome.
- [ ] Empty/loading states use `states.*` or feature keys, not English literals.
- [ ] RTL language: layout direction and icons sane (`ar`, etc.).
- [ ] Pseudo locale `en-XA` in dev: no clipped overflow (Profile → Localization QA).
- [ ] Language switch does not leave stale English on screen (wait for full load on settings).

---

## 10. Troubleshooting

| Symptom | Likely cause | Action |
|---------|----------------|--------|
| English despite Hindi selected | Hardcoded string or missing `t()` | `find-hardcoded`, fix component |
| `[missing:key]` in dev | Key not in catalog or typo | Add to `en`, `sync-keys`, extract:check |
| Message compile error | Invalid ICU or `@` in string | Fix JSON; see section 6 |
| Settings still English briefly | Deferred load | Normal on first visit; wait or prefetch |
| `sync-keys:check` fails in CI | Locale missing keys | Run `sync-keys`, commit |
| Translate script slow | Full locale size | Use `--namespaces=foo,bar` |

---

## 11. File map

```
client/
  src/i18n/constants.ts          # languages, namespaces, RTL, budgets
  src/i18n/index.ts              # initI18n, setI18nLanguage
  src/i18n/loadLocale.ts         # load core/full, ensureFullLocaleLoaded
  src/locales/en/*.json          # source of truth
  src/locales/{lang}/*.json      # translations
  scripts/i18n/
    add-language.mjs           # register new language
    sync-locale-keys.mjs         # en → all locales
    translate-locale.mjs         # MT fill-in
    validate.mjs               # ICU + rules
    extract.mjs                  # used keys vs catalog
    find-hardcoded.mjs           # English in UI files
  docs/I18N_GUIDELINES.md
  docs/I18N_SUMMARY.md
```

---

## 12. PR checklist (copy-paste)

```markdown
- [ ] All new UI strings use `t('namespace.semanticKey')`
- [ ] Keys added to `src/locales/en/{namespace}.json`
- [ ] `npm run i18n:sync-keys` run (if new keys)
- [ ] Target locales updated or `npm run i18n:translate-locale -- xx`
- [ ] `npm run i18n:check` passes
- [ ] No literal `@` in new message values without escaping/rewording
- [ ] Plurals use one/many keys or verified ICU
```

---

## Related scripts reference

| Script | Purpose |
|--------|---------|
| `i18n:add-language` | New language + scaffold |
| `i18n:sync-keys` | Propagate new keys from `en` |
| `i18n:sync-keys:check` | CI: missing keys |
| `i18n:translate-locale` | MT for one locale |
| `i18n:apply-cognates` | Hand-tuned EU cognates |
| `i18n:apply-phase-ab` | Bulk navigation/records MT |
| `i18n:prune-orphans` | Remove unused keys (careful) |
| `i18n:mirror-locales` | Copy en files to new lang dirs |
| `i18n:validate` | ICU and naming |
| `i18n:lint` | Orphan keys |
| `i18n:extract` / `i18n:extract:check` | Key usage vs catalog |
| `i18n:find-hardcoded` | English literals in UI |
| `i18n:check` | Full CI gate |

---

Questions or new surfaces: extend `find-hardcoded.mjs` phases and add keys to the appropriate namespace before merging.
