# i18n Controlled Rollout

Infrastructure is complete. This document tracks **migration execution** (not setup).

## Commands

```bash
npm run i18n:report          # burndown + phase status
npm run i18n:report:json     # writes src/locales/i18n-rollout-report.json
npm run i18n:baseline        # snapshot hardcoded count for delta tracking
npm run i18n:find-hardcoded  # all enforced paths
node scripts/i18n/find-hardcoded.mjs --scoped --phase=ui      # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=layouts # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=tables  # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms   # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=summary # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=navigation # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=notifications # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=auth # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-shell # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-account # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-users-access # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-groups-helpdesk # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-assignment-rules # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-apps-sla # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-app-panels # phase gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-modules-fields-shell # incremental gate (CI, lines 1–910)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-modules-fields-editor # incremental gate (CI, lines 911–2450)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-modules-fields-tabs # incremental gate (CI, lines 2451–5035)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-modules-fields-modals # incremental gate (CI, lines 5036–5480)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-modules-fields-messages # incremental gate (CI, script toasts)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-modules-fields # full file gate (CI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-remaining-sm # CI (12 smaller settings components)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-remaining-drawers # CI (drawers + application detail)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-people-types # CI (PeopleTypesSettings)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-core-module-detail # CI (CoreModuleDetail)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=settings-integrations # CI (IntegrationsSettings)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=records-shell # CI (record page shell chrome)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=records-activity-pane # CI (activity timeline, tags, sections)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=records-generic-content # CI (GenericRecordContent full file)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=records-comment-editable # CI (CommentInput, EditableLabeledValue)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=records-deal-page # CI (DealRecordPage)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=records-task-page # CI (TaskRecordPage)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=records-activity-section # CI (ActivitySection)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=records-activity-comment-card # CI (ActivityCommentCard)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-question-types # CI (form builder question types)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-modals # CI (DuplicateFormDialog, FormCreationModal)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-preview # CI (FormPreview, FormPreviewDrawer, PreviewAndSave)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-tabs # CI (FormDetailsTab, FormSettingsTab, FormTemplateTab)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-analytics-panels # CI (FormAnalytics, analytics/*, CorrectiveActionPanel, AuditorVerificationPanel)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-outcomes-template # CI (OutcomesAndRules, ResponseTemplateBuilder)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-report-blocks # CI (BlockSettings, ReportBlock, ReportBlockPreview)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-views # CI (TrendsChart, FormReportView, FormComparisonView, FormAnalyticsWidget) — after forms-report-blocks
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-sections-builder # CI (SectionsBuilder, formEditPermissions)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-builder-shell # CI (FormBuilder.vue)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-hub-list # CI (Forms.vue, FormResponses.vue, FormDetail.vue)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-hub-response-detail # CI (FormResponseDetail.vue)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=forms-hub-wizard # CI (FormCreate.vue, FormFill.vue, PublicFormView.vue)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=process-flow # CI (process-flow/*, processDesignerConstants.js)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=process-admin-views # CI (admin process & flow views)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=process-admin-components # CI (admin process/automation chrome, AppFlows, AutomationContext, ControlPlane)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=appointments # CI (appointments scheduling UI)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=business-hours # CI (business-hours components)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=global-chrome # CI (GlobalSearch, UserMenu)
node scripts/i18n/find-hardcoded.mjs --scoped --phase=app-surfaces # CI (tasks, events, deals, people, inbox, dashboard, etc.)
npm run i18n:validate # CI (catalog parity + naming)
npm run i18n:ensure-useI18n # wire useI18n on remaining Vue SFCs
npm run i18n:prune-orphans -- fr de hi es # drop stale keys
npm run i18n:translate-es # machine-translate en → es (skips ICU plural/select; review actions.* manually)
npm run i18n:translate-phase-b # fr → de → hi (long-running; log to file if backgrounding)
npm run i18n:translate-locale -- it # any supported locale code
npm run i18n:mirror-locales -- fr de hi # copy en catalogs to Phase B locales
npm run i18n:rename-assign-rules-keys # one-time: assignRulesCondField_* → assignRulesCondFieldCamelCase
npm run i18n:sync-keys          # copy new en keys → all locales (local dev)
npm run i18n:sync-keys:check    # CI: fail if any locale missing en keys
npm run i18n:extract:check      # CI: fail if t() keys missing from en catalog
npm run i18n:apply-cognates     # hand-tuned cognate overrides (all locales)
npm run i18n:apply-phase-ab-full # MT phase-A/B keys incl. full records namespace
```

## Phase order (strict)

1. `components/ui/**` — **complete** (CI gate)
2. `layouts/**` — **complete** (CI gate)
3. **Tables slice** — **complete** (`DataTable`, `TableView`, `MetricsWidget`, `KeyFieldsWidget` — CI gate)
4. **Forms slice** — **complete** (`DynamicFormField`, `DynamicForm`, `FormTagsField`, `CreateRecordDrawer`, `DateFilterDropdown`, `DependencyPopupModal`, `LinkRecordsDrawer`, `KanbanBoard`, `LifecycleStageWidget` — CI gate)
5. `components/common/**` — **complete** (`SummaryView` — CI gate)
6. **Navigation** — **complete** (`AppSidebar`, `AppSidebarSkeleton`, `TabBar`, `Nav.vue` — CI gate)
7. **Notifications** — **complete** (`components/notifications/**`, `Nav.vue` sidebar chrome — CI gate)
8. **Modals** — **N/A** (`components/modals/` empty; no CI gate)
9. **Auth** — **complete** (`Login.vue`, `LoginForm.vue` — CI gate)
10. **Settings shell** — **complete** (CI gate `settings-shell`)
11. **Settings account** — **complete** (`ProfileSettings`, `OrganizationSettings`, `SecuritySettings` — CI gate `settings-account`)
12. **Settings users & access** — **complete** (`UserManagement`, `RolesPermissions`, `RoleFormDrawer`, `RoleUsersModal`, `InviteUserModal`, `EditUserModal`, `GroupsSettings` — CI gate `settings-users-access`; hub `UsersAccessSettings` in `settings-shell`)
13. **Settings groups modal + helpdesk execution** — **complete** (`GroupFormModal`, `HelpdeskExecutionSettings` — CI gate `settings-groups-helpdesk`; `HelpdeskSlaScheduleSection` deferred)
14. **Settings assignment rules** — **complete** (`AssignmentRulesSettings` — CI gate `settings-assignment-rules`; domain enum values in condition picklists remain English API labels)
15. **Settings apps hub + SLA schedule** — **complete** (`AppsSettings`, `HelpdeskSlaScheduleSection` — CI gate `settings-apps-sla`)
16. **Settings app panels** — **complete** (`SalesSchema`, `HelpdeskSchema`, `HelpdeskAnalyticsDashboard`, `SalesPipelines`, `SalesPlaybooks` — CI gate `settings-app-panels`)
17. **Modules & Fields shell** — **complete** (lines 1–910 — CI gate `settings-modules-fields-shell`)
18. **Modules & Fields field editor** — **complete** (lines 911–2450 — CI gate `settings-modules-fields-editor`)
19. **Modules & Fields other tabs + modals** — **complete** (lines 2451–5480, script toasts — gates `settings-modules-fields-tabs`, `-modals`, `-messages`)
20. **Modules & Fields (full)** — **complete** (`ModulesAndFields.vue` — CI gate `settings-modules-fields`; ~730 `modFields*` keys)
21. **Settings remaining (small)** — **complete** (Business hours, core/apps lists, platform, hierarchy, app management, subscription detail, module form — CI gate `settings-remaining-sm`)
22. **Settings drawers + application detail** — **complete** (`AddCustomFieldDrawer`, `RelationshipFormDrawer`, `ApplicationDetail` — CI gate `settings-remaining-drawers`)
23. **Settings people types** — **complete** (`PeopleTypesSettings` — CI gate `settings-people-types`)
24. **Settings core module detail** — **complete** (`CoreModuleDetail` — CI gate `settings-core-module-detail`)
25. **Settings integrations** — **complete** (`IntegrationsSettings` — CI gate `settings-integrations`)
26. **Record page shell** — **complete** (`RecordPageShell`, `RecordHeader`, `RecordContextTabs`, `RecordFieldsSection`, `CustomFieldsSection`, `RelatedRecordsSection` — CI gate `records-shell`; new `records` namespace)
27. **Record activity pane + sections** — **complete** (`RecordActivityTimeline`, `RecordRightPane`, `RecordTagPopover`, `RecordStateSection`, section components — CI gate `records-activity-pane`)
28. **Generic record content** — **complete** (`GenericRecordContent.vue` — CI gate `records-generic-content`; ~66 `generic*` keys in `records` namespace; reuses `actions.*`, `records.relatedTitle`, `records.detailsTitle`)
29. **Comment + editable field** — **complete** (`CommentInput`, `EditableLabeledValue` — CI gate `records-comment-editable`; 15 `comment*` / `editable*` keys)
30. **Deal record page** — **complete** (`DealRecordPage.vue` — CI gate `records-deal-page`; ~27 `deal*` keys in `records` namespace; reuses `actions.*`, `records.generic*`)
31. **Task record page** — **complete** (`TaskRecordPage.vue` — CI gate `records-task-page`; 19 `task*` keys in `records` namespace; reuses `actions.*`, `records.generic*`, `records.related*`)
32. **Activity section** — **complete** (`ActivitySection.vue` — CI gate `records-activity-section`; 20 `activity*` filter/search keys; reuses `actions.search`, `actions.back`, `actions.close`, `records.genericTabActivity`, `records.activityCommentPh`)
33. **Activity comment card** — **complete** (`ActivityCommentCard.vue` — CI gate `records-activity-comment-card`; 4 keys + `actions.edit` / `cancel` / `save`, `records.activityReply`)

**Record-page track (phases 26–33) is complete** for CI-gated UI chrome.

34. **Form builder question types** — **complete** (`question-types/*`, `SignaturePad.vue` — CI gate `forms-question-types`; `forms` namespace keys for inputs, evidence, file upload, signature)
35. **Form builder modals** — **complete** (`DuplicateFormDialog.vue`, `FormCreationModal.vue` — CI gate `forms-modals`; wizard + duplicate dialog keys in `forms` namespace)
36. **Form builder preview** — **complete** (`FormPreview.vue`, `FormPreviewDrawer.vue`, `PreviewAndSave.vue` — CI gate `forms-preview`; preview + readiness checklist keys)
37. **Form builder tabs** — **complete** (`FormDetailsTab.vue`, `FormSettingsTab.vue`, `FormTemplateTab.vue` — CI gate `forms-tabs`; `forms.tab*`, `forms.settings*`, `forms.template*`, `forms.field*`, `forms.status*` keys; reuses `actions.copy`, `actions.close`, `records.editableUnassigned`)
38. **Form analytics & response panels** — **complete** (`FormAnalytics.vue`, `analytics/*`, `CorrectiveActionPanel.vue`, `AuditorVerificationPanel.vue` — CI gate `forms-analytics-panels`; `forms.analytics*`, `forms.corrective*`, `forms.auditor*` keys; reuses `actions.*`, `states.saving`, `forms.fieldStatus`)
39. **Form outcomes & response template builder** — **complete** (`OutcomesAndRules.vue`, `ResponseTemplateBuilder.vue` — CI gate `forms-outcomes-template`; `forms.outcomes*`, `forms.rt*` keys; reuses `forms.tabTemplateHeading`, `forms.fieldFormType`, `forms.settingsFormVersion`, `forms.settingsKpiAvgRating`, `forms.previewDefaultTemplateName`, `forms.previewDefaultReportHeading`)
40. **Form report blocks** — **complete** (`report-blocks/BlockSettings.vue`, `ReportBlock.vue`, `ReportBlockPreview.vue` — CI gate `forms-report-blocks`; `forms.rb*`, `forms.rbp*` keys; reuses `forms.rtDefaultHeadingContent`, `forms.rtDefaultTextContent`, `forms.previewDefaultReportHeading`, `forms.rtAlignLeft/Center/Right` where applicable, `forms.rtBlock*` type labels, `forms.outcomesMetric*`, `forms.settingsKpiAvgRating`, `actions.delete`)
41. **Form views & analytics widget** — **complete** (`TrendsChart.vue`, `FormReportView.vue`, `FormComparisonView.vue`, `FormAnalyticsWidget.vue` — CI gate `forms-views`; `forms.report*`, `forms.comparison*`, `forms.trendsChart*`, `forms.widget*` keys; reuses `forms.auditor*`, `forms.correctiveStatus*`)
42. **Form sections builder** — **complete** (`SectionsBuilder.vue`, `formEditPermissions.js` — CI gate `forms-sections-builder`; `forms.builder*`, `forms.permBlocking*` keys; reuses `forms.status*`)
43. **Form builder shell** — **complete** (`FormBuilder.vue` — CI gate `forms-builder-shell`; `forms.builderShell*` keys; reuses `actions.save`, `states.saving`, `forms.tabTemplateHeading`)
44. **Forms hub list views** — **complete** (`Forms.vue`, `FormResponses.vue`, `FormDetail.vue` — CI gate `forms-hub-list`; `forms.hub*` keys; reuses `forms.type*`, `forms.status*`, `forms.visibility*`, `forms.fieldFormId`, `forms.fieldStatus`, `records.editableUnassigned`, `actions.edit`, `actions.duplicate`, `forms.auditorApproved`, `forms.auditorRejected`, `forms.settingsLink*`)
45. **Form response detail** — **complete** (`FormResponseDetail.vue` — CI gate `forms-hub-response-detail`; `forms.hubBackToResponses`, `forms.hubResponseDetail*` keys; reuses `forms.hubActionAddCorrective`, `forms.hubConfirmApprove`, `forms.hubConfirmReject`, `forms.hubApproveFailed`, `forms.hubRejectFailed`, `forms.hubReview*`, `forms.hubStatNew`, `forms.reportOverallScore`, `forms.reportCompliance`, `forms.reportPassRate`, `forms.correctiveAnswerLabel`, `forms.correctivePassFailFail`, `forms.corrective*`, `forms.auditor*`, `forms.report*`, `forms.comparison*` via child panels)
46. **Forms hub wizard & fill** — **complete** (`FormCreate.vue`, `FormFill.vue`, `PublicFormView.vue` — CI gate `forms-hub-wizard`; `forms.hubCreate*`, `forms.hubFill*`, `forms.hubPublic*` keys; reuses `forms.wizard*`, `forms.tabDetailsHeading`, `forms.outcomesHeading`, `forms.tabTemplateHeading`, `forms.previewSaveHeading`, `forms.field*`, `forms.visibilityInternal`, `forms.builderShell*`, `forms.previewSubmitForm`, `forms.answerYes`, `forms.answerNo`, `forms.selectOption`, `forms.textAnswerPh`, `forms.evidenceRequiredHeading`, `actions.*`, `states.saving`)

47. **Process flow designer** — **complete** (`ProcessFlowCanvas.vue`, `ProcessFlowNode.vue`, `ProcessNodeInspector.vue`, `ProcessSettingsPanel.vue`, `ProcessActionFields.vue`, `ProcessRecordPicker.vue`, `ProcessTestModal.vue`, `ProcessRunInsightBar.vue`, `processDesignerConstants.js` — CI gate `process-flow`; `process.*` keys for designer chrome, triggers, inspector, test/run insight; reuses `actions.cancel`, `actions.copy`, `process.palette*`)

48. **Process admin views** — **complete** (`Processes.vue`, `BusinessFlows.vue`, `BusinessFlowDetail.vue`, `BusinessFlowForm.vue`, `BusinessFlowHealth.vue`, `ProcessFlowDesigner.vue`, `ProcessSetupView.vue`, `AutomationRules.vue` — CI gate `process-admin-views`; ~255 `process.*` keys via `scripts/i18n/admin-views-keys.json`; reuses `actions.*`, `states.saving`, `common.viewRecord`, `process.appKey*`)

49. **Process admin & automation components** — **complete** (`ProcessCreationWizard`, `AutomationRuleForm`, `AutomationRulePreview`, `ProcessExecutionLogs`, `RuleEditPanel`, `TimelineItem`, `AppFlows`, `AutomationContext`, `AutomationBadge`, `AutomationSettings`, `ControlPlane` — CI gate `process-admin-components`; ~260 `process.*` keys via `scripts/i18n/admin-components-keys.json`; shared `processTimelineSummaries.js`; reuses `actions.*`, `states.saving`, designer constants from `process-flow`; API event metadata remains English)

50. **Appointments scheduling** — **complete** (`src/components/appointments/**`, `src/views/appointments/**`, `PublicManageAppointmentView.vue` — CI gate `appointments`; `appointments.*` keys via `scripts/i18n/appointments-keys.json`; reuses `actions.*`, `states.*`, `settings.saveChanges`, `common.viewRecord`; server status values `Planned`/`Cancelled` and API enums shown as data remain English)

51. **Business hours components** — **complete** (`src/components/business-hours/**` — CI gate `business-hours`; 88 new `settings.settingsBh*` keys via `scripts/i18n/business-hours-keys.json`; reuses existing `settingsBh*` from parent settings, `actions.*`, `states.*`, `common.filterFrom`/`filterTo`, `appointments.day*`; `BusinessHoursSettings.vue` already migrated)

52. **Global chrome** — **complete** (`GlobalSearch.vue`, `UserMenu.vue` — CI gate `global-chrome`; 34 new `navigation.*` keys via `scripts/i18n/global-chrome-keys.json`; reuses `navigation.signOut`, `navigation.settings`, `actions.cancel`, `actions.save`; `PlatformShell.vue` has no user-facing template strings; `buildCommandsFromRegistry.ts` command descriptions deferred)

53. **App surfaces (bulk)** — **complete** (tasks, events, deals, people, organizations, inbox, dashboard, import, audit, platform, record utilities, and related views — CI gate `app-surfaces`; ~1,400 keys across 10 new namespaces via `npm run i18n:migrate-remaining` + `scripts/i18n/auto-migrate-vue.mjs`; mirrored to `fr`/`de`/`hi`; Spanish via `npm run i18n:translate-es`; excludes legacy/demo/smoke-test views, `HelloWorld`, icon stubs, and `RecordPageExample`; dynamic script strings and tenant data remain English)

54. **Catalog hygiene** — **complete** (`prune-orphaned-keys.mjs` removes keys not in `en`; orphaned inbox/task keys cleaned from `es`/`fr`/`de`/`hi`)

55. **Final Vue coverage** — **complete** (`ensure-useI18n.mjs` on all non-skip `.vue` files; `run-final-vue-migrations.mjs` for record shell, ui, common widgets, activity, events/forms/people misc; 54 components wired)

56. **CI validate** — **complete** (`npm run i18n:validate` in `.github/workflows/test.yml`)

57–65. **Remaining strings** — **complete** (inbox “coming soon” toasts; script toasts batch-migrated earlier; `buildCommandsFromRegistry.ts` descriptions remain English until palette builder is wired to `t()`)

66. **Spanish** — **complete** (bulk `i18n:translate-es` + `i18n:translate-es-gaps` for ICU overrides)

67. **Phase B MT** — **complete** (`fr`/`de`/`hi` bulk-translated via Google Translate; ~96–98% of keys differ from `en`; remainder are ICU skips, identical words, or API failures; re-run `npm run i18n:translate-locale -- hi` to fill gaps)

68. **Phase C locales** — **mirrored** (`it`, `pt`, `nl`, `ru`, `ar`, `ja`, `zh`, `ko` copied from `en` via `i18n:mirror-locales`; run `npm run i18n:translate-locale -- it` per locale when needed)

**Form builder track (phases 34–43) is complete** for CI-gated UI chrome (`src/components/forms/**`, builder shell, `formEditPermissions.js`). **Forms product views track (phases 44–46) is complete** for CI-gated hub UI (`Forms*.vue`, `FormResponseDetail.vue`, `FormCreate.vue`, `FormFill.vue`, `PublicFormView.vue`). **Process designer track (phases 47–49) is complete** — flow designer (`process-flow`), admin views (`process-admin-views`), and admin/automation components (`process-admin-components`) are CI-gated under `process.*` (~690 keys in `process.json`).

## Sprint discipline

- Annotate deferred files: `<!-- TODO(i18n-phaseN): migrate chrome -->`
- Do not add keys outside namespace ownership (see `I18N_GUIDELINES.md`)
- New or modified UI in enforced paths **must** use `t()` — ESLint `error` on `components/ui/**`
- Run pseudo-locale (`en-XA`, `ar-XB`) before marking a phase complete

## Language rollout

| Phase | Locales | Status |
|-------|---------|--------|
| A | `en`, `es` | `es` keys complete; bulk MT via `npm run i18n:translate-es` + ICU fixes via `npm run i18n:translate-es-gaps` (~2% still match `en` — symbols, product names, words identical in Spanish) |
| B | `fr`, `de`, `hi` | Bulk MT complete (~96–98% translated); ICU gaps remain like Spanish |
| C | `it`, `pt`, `nl`, `ru`, `ar`, `ja`, `zh`, `ko` | **Mirrored** from `en`; MT on demand (`npm run i18n:translate-locale -- it`) — not bulk-run by default |

69. **Navigation + tabs + record chrome (Phase A/B)** — **complete** (`navigationLabels.js`, sidebar `labelKey`, tab `titleKey` + `resolveTabTitle`, record section adapters via `recordSectionLabels.js`, system field labels via `fieldLabelResolver.js` / `people.sysField*`)

70. **Configurable tenant labels (Phase A/B+)** — **complete** (`configurableLabelResolver.js`: pipeline/stage/picklist, `common.phrase*`, tab module names; org/task `sysField*`; `localizeSelectOptions` in `DetailsSection`; cognate patches via `i18n:apply-cognates`)

71. **Field labels on task + people surfaces** — **complete** (`TaskRecordPage`, `ParticipationEditModal`, `AttachToAppModal`, `SalesConvertLeadModal` → `resolveFieldLabel` / `getAppNameKey`)

72. **i18n automation for future development** — **complete** (`sync-locale-keys.mjs`, `extract --fail-on-missing`, expanded `i18n:check`, Cursor rule `.cursor/rules/i18n-new-ui.mdc`)

## Keeping translations current (future features)

When you add UI strings or modules:

1. **Code** — use `t('namespace.key')`; navigation via `navigationLabels.js`; fields via `resolveFieldLabel` / `useFieldLabel`.
2. **Catalog** — add keys to `src/locales/en/{namespace}.json`.
3. **Sync** — `npm run i18n:sync-keys` (copies placeholders to `es`, `fr`, `de`, …).
4. **Translate** — `npm run i18n:translate-locale -- de` for one locale, or `i18n:apply-phase-ab` for nav/records/sysField scope.
5. **Verify** — `npm run i18n:check` before push (CI runs this + hardcoded-string phase gates).

**CI already blocks:** missing locale keys, invalid ICU, `t()` keys not in catalog, hardcoded English in enforced paths.

**Not automatic (by design):** machine translation of new keys (run translate script); tenant-custom labels (add `common.phrase*` or `{module}.phrase*`); record names; Phase C bulk MT (~260 keys/locale still English in full catalog until prioritized).

See **Developer workflow** in `I18N_GUIDELINES.md`.

## Rollout decisions (post–phase 68)

- **Phase C bulk MT deferred** — eight locales × ~6k keys is hours of API time; English mirrors are acceptable until a locale is prioritized.
- **Phase B** — run once via `npm run i18n:translate-phase-b` (~1.5–2 h total); monitor `/tmp/i18n-phase-b.log`.
- **Phase 55 dedupe** — left as validate warnings only; consolidating keys risks breaking `t('domain.key')` call sites.
- **Phase 4** (tenant labels, emails, automation DB copy) — separate product epic, not blocking UI i18n CI.

## Deferred (high volume)

- Tenant/module labels, automation copy, emails — Phase 4
- Notification event-type group labels in sheet/drawer scripts (dynamic metadata; not panel chrome)

## Burndown

Run `npm run i18n:report` each sprint. Target: hardcoded count only decreases unless new UI is added.
