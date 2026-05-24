# Localization QA Checklist

Run before each release that touches UI copy or locale infrastructure.

## Pre-flight

- [ ] `npm run i18n:check` passes in CI
- [ ] No new hardcoded strings in enforced paths (`i18n:find-hardcoded` with `I18N_FAIL_ON_HARDCODED=1` when baseline allows)
- [ ] All new keys have English ICU entries with `description` metadata
- [ ] Spanish (or target pilot locale) has matching keys for new English keys

## Pseudo-localization (mandatory)

- [ ] Enable **en-XA** in Profile → Localization QA
- [ ] Walk Settings, sidebar, one list view, one record page, one modal
- [ ] Confirm no `[missing:key]` placeholders in shipped surfaces
- [ ] Confirm buttons and nav do not clip (German-length expansion simulates overflow)
- [ ] Switch to **ar-XB** and confirm `<html dir="rtl">` is applied

## RTL smoke (ar / ar-XB)

- [ ] Sidebar and main content order mirror correctly
- [ ] Modals and drawers align to logical start edge
- [ ] Icons with `data-mirror-rtl` or `.icon-mirror-rtl` flip where appropriate
- [ ] No hard-coded `ml-*` / `mr-*` causing overlap in RTL (prefer `ms-*` / `me-*`)
- [ ] Form labels and inputs align readably

## Locale formatting

- [ ] Currency matches org setting with correct symbol position
- [ ] Dates respect org `locale` and `timeZone`
- [ ] Relative times (`formatRelativeTime`) read naturally in pilot locale

## Search and sort

- [ ] Search finds "Jose" when record is "José" (`localeIncludes`)
- [ ] Search finds "Muller" when record is "Müller" (transliteration)
- [ ] List sort order correct for accented names (`localeCompare` / `localeSort`)

## German overflow

- [ ] Switch locale to `de` (when bundle available) or use **en-XA**
- [ ] Primary buttons in modals do not truncate critical verbs
- [ ] Table column headers do not overlap
- [ ] Toast messages wrap instead of clipping

## Accessibility

- [ ] `lang` / `dir` on `<html>` match active locale
- [ ] Screen reader announces page title in correct language for migrated screens
- [ ] Focus order logical in RTL modals
- [ ] Keyboard navigation works in Settings language controls

## API errors

- [ ] Permission denied shows localized `errors.permission_denied`, not raw server text
- [ ] Unknown codes fall back to `errors.server_error`

## Mobile

- [ ] Pseudo-locale expansion does not break mobile nav or tab bar
- [ ] Sticky save bars remain visible with long action labels

## Regression targets (minimum path)

1. Login (when migrated)
2. Settings landing + Organization settings
3. One CRM list + one record detail
4. One confirmation modal with destructive action
5. Profile + Localization QA panel

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| QA | | |
| Product (copy) | | |
