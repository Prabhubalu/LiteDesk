# Email Template HTML Import — QA Checklist

**Spec:** [EMAIL_TEMPLATE_HTML_IMPORT_SPEC.md](./EMAIL_TEMPLATE_HTML_IMPORT_SPEC.md) §15  
**Last audited:** 2026-07-01 (code review + automated tests)

Use this checklist for manual sign-off on a **fresh email template** (re-import if saved before the email table-hook fix).

---

## Automated coverage

| Area | Tests |
|------|--------|
| Sanitizer, analysis, merge tags, Grapes conversion | `server/services/contentPlatform/__tests__/htmlImport.test.js` (9 tests) |
| Org merge mappings normalize | `server/services/contentPlatform/__tests__/emailMergeTagMappingService.test.js` |
| ZIP asset extraction | `client/src/modules/template/utils/emailHtmlZipExport.test.ts` |

---

## Acceptance criteria

### AC-1: Creation flow — Import HTML option

- [x] Email format shows Blank / Choose Template / Import HTML cards
- [x] Import HTML opens wizard without creating template until confirm
- [x] PDF/HTML formats unchanged

**Manual:** New → Email → verify three cards; PDF still shows gallery only.

---

### AC-2: Paste and upload

- [x] Paste editor with syntax highlighting (Monaco)
- [x] Upload `.html` / `.htm` ≤ 2MB
- [x] Empty input disables Analyze + inline validation message

---

### AC-3–AC-4: Analysis and sanitization

- [x] Implemented server-side with UI report
- **Manual:** Import HTML with script, external CSS, form — verify warnings and clean preview

---

### AC-5: Merge tag mapping

- [x] Detection, skip, replace, org persistence + settings page at `/templates/email-merge-mappings`

---

### AC-6: Visual editor handoff

- [x] Email table hooks skipped; MSO chunk storage
- **Manual:** Editor layout must match preview after save/reload

---

### AC-7–AC-12: Builder advanced features

- [x] Advanced menu, edit warning, Monaco, validation, preview, export (incl. ZIP)

---

### AC-13: i18n and accessibility

- [x] Keys under `templates.htmlImport.*`
- [ ] **Manual:** Keyboard nav + screen reader spot-check

---

### AC-14: Security

- [x] Auth + org context on endpoints; client-side asset fetch for ZIP (no server SSRF)

---

## Recommended manual test script (~15 min)

1. Delete broken pre-fix templates.
2. Import HTML → analyze → map → open builder.
3. Preview desktop/mobile/dark vs canvas.
4. Save → reload.
5. Edit HTML → Restore previous HTML.
6. Validate → Export (html, copy, zip).
7. **Templates → Merge mappings** — edit → re-import auto-fill.
8. Delete template.

---

## Phase 3 (implemented)

- HubSpot conditional blocks — keep or strip during import (`hubspotConditionalService.js`, wizard panel)
- External CSS fetch — org hostname allowlist + SSRF-safe server fetch (`emailExternalCssService.js`, settings panel)
- Litmus client preview — Instant API when `LITMUS_API_KEY` is set; proxied images via `/templates/html/client-preview/:guid/:client`

**Litmus setup:** set `LITMUS_API_KEY` (and optional `LITMUS_API_BASE_URL`) in server environment.
