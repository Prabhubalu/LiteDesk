# Content & Document Platform — Implementation Roadmap

> **Status:** Planning  
> **Source PRD:** Arivu Content & Document Platform v2.0 (Documents 1–4)  
> **Architecture reference:** `Architecture_Document.md`  
> **Related:** `docs/architecture/documents-module-roadmap.md` (storage/repository — separate concern)

**Last updated:** 2026-06-25 (rendering architecture locked)

---

## 1. Executive synthesis

The PRD defines a **platform-level Content & Document Platform** — not a module-specific print tool. It is the unified engine for:

| Output | Examples |
|--------|----------|
| Print / PDF | Invoices, quotes, audit reports, payslips |
| Email | Campaign, transactional, case notifications |
| HTML / Portal | Landing pages, knowledge articles, portal pages |
| Labels / Images | Product labels, certificates, cards |

### 1.1 Four PRD documents — what each owns

| Doc | Title | Owns |
|-----|-------|------|
| **1** | Product Vision & Platform Architecture | Vision, scope, non-goals, design principles, service topology, rendering pipeline, integration boundaries, scalability, security, success metrics |
| **2** | Core Engines & Functional Requirements | 30 engines (Template, Canvas, Component, Layout, Styling, Theme, Asset, Font, Data Provider, Merge Tag, Variable, Formula, Expression, Repeater, Preview, Validation, Rendering, Queue, Version, Dependency, Snippets, Packages, Localization, Accessibility) |
| **3** | UX Specification & Builder Experience | IA, 18 screens, builder workspace, panels, personas, progressive disclosure, collaboration UX |
| **4** | Engineering Specification | Data model, MongoDB collections, component JSON schema, REST APIs, events, permissions, queue/render architecture, edge cases, phased delivery |

### 1.2 Platform boundaries (locked)

**Content Platform owns:** composition, layout, styling, rendering, preview, template versioning, validation.

**Content Platform does NOT own:**

| Concern | Owner |
|---------|-------|
| File retention / DMS | Documents Module |
| Record storage | Domain modules |
| Workflow execution | Process Engine |
| E-signature execution | Signing integration |
| OCR / search indexing | Separate platform capabilities |
| Approval workflows | Process Designer |

Generated outputs are **delivered to** Documents Module or domain modules; the platform does not become a CMS or workflow engine.

### 1.3 Design principles (implementation guardrails)

1. **Platform-first** — metadata-driven; no hardcoded module assumptions
2. **API-first** — every UI action has a REST equivalent
3. **Component-driven** — documents are JSON trees of typed components
4. **Renderer-independent** — intermediate layout tree → pluggable renderer adapters (PDF/HTML/Email/Image)
5. **Immutable versions** — only published versions render; rollback never destroys history
6. **Tenant isolation** — templates, themes, assets, jobs scoped by `organizationId`
7. **Stateless render workers** — horizontal scale via queue

---

## 2. Current state (Arivu / Arivu)

### 2.1 Fragmented document generation

| Location | Pattern | Gap |
|----------|---------|-----|
| `quoteDocumentController.js` | Hardcoded PDFKit layout | Not template-driven |
| `invoiceDocumentController.js` | Hardcoded PDFKit layout | Not template-driven |
| `blockBasedPdfService.js` | Block-based audit reports | Module-specific schema; not shared platform |
| `reportTemplateService.js` | Form response templates | Legacy branding; audit-only |
| `communicationsController.js` | Static `EMAIL_TEMPLATES` array | No builder, no merge tags |
| `client/src/constants/documentTemplates.js` | Seeded rich HTML snippets | Not connected to render engine |

### 2.2 Reusable platform assets

| Capability | Reuse |
|------------|-------|
| File storage | `fileStorageService` + object storage |
| Permissions | `Role.appPermissions` + `checkPermission` |
| Audit | Immutable audit log pattern |
| Branding | Quote/invoice branding services (extract → Theme Engine) |
| Async jobs | Existing queue/worker patterns (extend for render jobs) |
| Module metadata | Field metadata for merge tag discovery |
| Documents output | `QuoteDocument` versioning/checksum → `RenderOutput` pattern |

### 2.3 Strategic positioning vs Documents Module

```
┌─────────────────────────────────────────────────────────────┐
│  Content & Document Platform (THIS ROADMAP)                 │
│  Author → Validate → Render → Output bytes                │
└──────────────────────────┬──────────────────────────────────┘
                           │ delivers RenderOutput
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Documents Module (separate roadmap)                        │
│  Store → Version → Link → Share → Retention                 │
└─────────────────────────────────────────────────────────────┘
```

Build order: Content Platform can ship first with inline download; Documents Module absorbs outputs when ready.

---

## 3. Target architecture

### 3.1 Service decomposition (v1 — monolith-friendly, service-ready)

Initial delivery as **namespaced services inside `server/`** with clear module boundaries. Split to microservices only when load warrants it.

```
content-platform/
├── templateService       # CRUD, lifecycle, permissions
├── themeService          # Org branding
├── assetService          # Images, logos, fonts metadata
├── validationService     # Pre-publish checks
├── renderService         # Pipeline orchestration
├── queueService          # Async jobs
├── versionService        # Immutable snapshots
├── dependencyService     # Impact analysis
└── engines/
    ├── dataProvider      # Runtime context assembly
    ├── mergeTag          # {{Record.Field}} resolution
    ├── variable          # Calculated / runtime vars
    ├── formula           # SUM, IF, DATEFORMAT, etc.
    ├── expression        # Visibility / conditions
    ├── repeater          # Collection iteration
    ├── layout            # Page composition
    └── renderers/        # Pluggable adapters (see §3.2)
```

### 3.2 Rendering architecture (locked)

Three-tier strategy. The **intermediate layout tree** is the stable contract; renderers are interchangeable adapters over it.

| Tier | Choice | Rationale |
|------|--------|-----------|
| **Today (v1)** | **Puppeteer — HTML-first** | Fast iteration; builder preview and PDF share the same HTML path; email and portal HTML reuse the same output |
| **Platform design** | **Intermediate layout tree** | Renderer-independent; new formats added by adapter only; no template or pipeline redesign |
| **Future (opt-in)** | **PDFKit adapter** | High-volume or latency-sensitive workloads only — added when browser-based rendering becomes a measurable bottleneck |

```
Component JSON (template)
        ↓
  Data + expression resolution
        ↓
  Intermediate Layout Tree    ← stable platform contract
        ↓
  ┌─────┴─────┬─────────┬──────────┐
  ↓           ↓         ↓          ↓
HTML       Puppeteer   Email     Image
Renderer   PDF Adapter Renderer  Renderer
(v1)       (v1 default) (v1)     (C5)
               ↓
         PDFKit Adapter (future — specialized high-volume only)
```

**v1 rules**

- All PDF output flows: `Layout Tree → HTML Renderer → Puppeteer PDF Adapter`.
- Builder live preview uses the same HTML Renderer (no separate preview engine).
- Do not build a PDFKit component path in C1–C6 unless profiling proves Puppeteer is insufficient for a specific workload.
- Legacy module PDFKit code (`quoteDocumentController`, `invoiceDocumentController`) is migrated **off** direct PDFKit layout, not extended.

**Layout tree responsibilities (renderer-agnostic)**

- Resolved component tree with computed positions, page breaks, repeater expansion
- Applied theme tokens and print styles
- Page geometry (size, margins, header/footer regions)
- No browser or PDFKit specifics in the tree schema

### 3.3 Rendering pipeline (deterministic)

```
Template (published version)
  → Load Theme
  → Assemble Runtime Context (Data Providers)
  → Resolve Merge Tags
  → Execute Variables & Formulas
  → Evaluate Expressions (visibility)
  → Expand Repeaters
  → Build Intermediate Layout Tree
  → Apply Styles
  → Validate (runtime)
  → Renderer Adapter (HTML / Puppeteer-PDF / Email / Image)
  → Store Output / Return Response
```

### 3.4 Component JSON contract (lock in Phase 0)

Every canvas element serializes to:

```json
{
  "id": "uuid",
  "type": "Heading | Paragraph | Table | MergeTag | Repeater | ...",
  "name": "Invoice Title",
  "layout": { "x", "y", "width", "height", "rotation", "zIndex" },
  "style": { "typography", "spacing", "borders", "colors" },
  "bindings": { "mergeTags", "variables", "formulas" },
  "visibility": { "expression" },
  "children": []
}
```

### 3.5 Core MongoDB collections

| Collection | Purpose |
|------------|---------|
| `content_templates` | Metadata only (name, status, moduleScope, latestVersion) |
| `content_template_versions` | Immutable `jsonDefinition` snapshots |
| `content_themes` | Org branding (colors, typography, headers, footers) |
| `content_assets` | Asset metadata + `storageKey` |
| `content_fonts` | Font metadata, license, fallbacks |
| `content_snippets` | Reusable text fragments |
| `content_components` | Reusable design blocks |
| `content_render_jobs` | Async job state |
| `content_render_outputs` | Output metadata, checksum, storage ref |
| `content_validation_reports` | Pre-publish validation history |
| `content_dependencies` | Template ↔ field/asset/theme edges |
| `content_audit_logs` | Immutable platform audit |

All collections include `organizationId` and platform system fields.

---

## 4. Phased roadmap

### Overview

| Phase | Name | Outcome | PRD alignment |
|-------|------|---------|---------------|
| **C0** | Contracts & foundation | Schemas, permissions, APIs stubbed | Doc 4 §3–9 |
| **C1** | Template lifecycle + merge render | Programmatic PDF from JSON template | Doc 2 §2–4, 14, 22 |
| **C2** | Theme + assets + validation | Branded, validated templates | Doc 2 §9–12, 21 |
| **C3** | Builder MVP | No-code visual editor | Doc 3 §6–15 |
| **C4** | Advanced data engines | Variables, formulas, repeaters | Doc 2 §15–18 |
| **C5** | Multi-format + async queue | Email, HTML, async PDF at scale | Doc 2 §22–23 |
| **C6** | Platform integration | Quotes, Invoices, Process, Notifications | Doc 1 §13 |
| **C7** | Reuse & governance | Snippets, packages, dependencies | Doc 2 §25–28 |
| **C8** | Localization & accessibility | i18n templates, a11y validation | Doc 2 §29–30 |
| **C9** | AI & marketplace (future) | AI assist, import, marketplace | Doc 4 §20 Phases 2–4 |

---

### Phase C0 — Contracts & foundation

**Goal:** Lock engineering contracts before UI investment.

| # | Deliverable | Details |
|---|-------------|---------|
| C0.1 | Platform module registration | `content-templates` app module; permissions: view, create, edit, publish, archive, render |
| C0.2 | Data models | Mongoose models for all collections in §3.4 |
| C0.3 | Component type registry | Server + client shared contract (`contentComponentRegistry`) |
| C0.4 | REST API skeleton | Template CRUD, version list, publish stub, render stub |
| C0.5 | Event model | `TemplateCreated`, `TemplatePublished`, `RenderRequested`, `RenderCompleted`, `RenderFailed` |
| C0.6 | Permission integration | Tenant-scoped RBAC via existing `checkPermission` |
| C0.7 | Error contract | Structured errors: `code`, `message`, `details`, `traceId` |

**Exit criteria**

- [ ] POST/GET template APIs work with tenant isolation
- [ ] Component JSON schema validated on save
- [ ] Publish creates immutable `content_template_versions` row
- [ ] Architecture review sign-off on schema + API contracts

**Dependencies:** None  
**Estimate:** 2–3 sprints

---

### Phase C1 — Headless render MVP (PDF)

**Goal:** End-to-end render without builder — templates authored as JSON (seed/migration).

| # | Deliverable | Details |
|---|-------------|---------|
| C1.1 | Data Provider Engine v1 | Current record, organization, current user, system vars (`Today`, `PageCount`) |
| C1.2 | Merge Tag Engine | `{{Entity.Field}}`, nested relations, fallbacks, formatters (date, currency) |
| C1.3 | Layout Engine v1 | A4/Letter, margins, header/footer, page numbers, page breaks |
| C1.4 | Layout tree builder | Renderer-agnostic tree from resolved components (page breaks, positions, theme) |
| C1.5 | HTML Renderer | Layout tree → print-ready HTML (shared by preview and PDF path) |
| C1.6 | Puppeteer PDF adapter | HTML → PDF; default and only v1 PDF renderer |
| C1.7 | Component types (MVP set) | Page, Section, Heading, Paragraph, RichText, Image, Table, Divider, Spacer, MergeTag |
| C1.8 | Render API | `POST /content/render` (sync); `templateId` + `recordContext` + `outputFormat` |
| C1.9 | Seed templates | Invoice, Quote, Simple Letter JSON templates |
| C1.10 | Render output storage | Checksum, version ref, file path via `fileStorageService` |

**Exit criteria**

- [ ] Render quote/invoice-equivalent PDF from JSON template + live record data
- [ ] Preview API returns PDF in < 3s for standard 2-page template
- [ ] Merge tag errors produce actionable diagnostics

**Dependencies:** C0  
**Estimate:** 3–4 sprints

---

### Phase C2 — Theme, assets, validation

**Goal:** Organization branding and publish gate.

| # | Deliverable | Details |
|---|-------------|---------|
| C2.1 | Theme Engine | Colors, typography, table styles, header/footer, watermark |
| C2.2 | Theme APIs | CRUD, publish, preview |
| C2.3 | Asset Engine | Upload, optimize, CDN/storage key, tags, versioning |
| C2.4 | Font Engine v1 | Google Fonts + upload; fallbacks; embed in PDF |
| C2.5 | Validation Engine v1 | Broken merge tags, missing assets, invalid formulas (stub), publish block on errors |
| C2.6 | Version Engine | Compare, restore, release notes |
| C2.7 | Template lifecycle UI (minimal) | List, detail, publish, version history (no canvas yet) |

**Exit criteria**

- [ ] Theme change propagates to rendered PDF without template edit
- [ ] Templates with critical validation errors cannot publish
- [ ] Asset upload respects tenant isolation and size limits

**Dependencies:** C1  
**Estimate:** 2–3 sprints

---

### Phase C3 — Visual Builder MVP

**Goal:** No-code template authoring (Doc 3 core).

| # | Deliverable | Details |
|---|-------------|---------|
| C3.1 | Builder shell | Toolbar, component library, canvas, properties, layers, status bar |
| C3.2 | Canvas Engine | Drag-drop, multi-select, snap, align, zoom, pan, undo/redo, auto-save |
| C3.3 | Component Library (MVP) | Layout + Typography + Media + Data components from C1 |
| C3.4 | Properties Panel | Position, size, typography, spacing, data binding |
| C3.5 | Layers Panel | Tree, reorder, lock, hide, duplicate |
| C3.6 | Merge Tag Explorer | Field tree from module metadata; drag-to-canvas |
| C3.7 | Preview Engine | Live preview with sample/runtime data; print mode |
| C3.8 | Template Gallery | Blank + 5 seeded professional templates |
| C3.9 | Dashboard (minimal) | Template counts, recent, quick create |

**Exit criteria**

- [ ] Business user creates 2-page invoice template without developer
- [ ] Interactive preview < 500ms for standard template (PRD metric)
- [ ] Auto-save + undo survives session refresh
- [ ] i18n complete for all builder strings

**Dependencies:** C2  
**Estimate:** 4–6 sprints (largest phase)

---

### Phase C4 — Advanced data engines

**Goal:** Power-user template logic.

| # | Deliverable | Details |
|---|-------------|---------|
| C4.1 | Variable Engine | Global, local, calculated, runtime, session |
| C4.2 | Formula Engine | Math, date, currency, text, aggregations (SUM, AVG, IF, DATEFORMAT, etc.) |
| C4.3 | Expression Engine | Visibility, conditional formatting, dynamic labels |
| C4.4 | Repeater Engine | Line items, related lists, nested repeaters, group-by, subtotals |
| C4.5 | Runtime Parameters | Language, currency, hidePrices, watermark override |
| C4.6 | Variables Manager UI | Create, validate, dependency display |
| C4.7 | Validation Engine v2 | Formulas, circular refs, performance warnings |

**Exit criteria**

- [ ] Invoice with line-item repeater + tax formula renders correctly across pages
- [ ] Conditional sections hide/show based on record data
- [ ] Validation catches circular variable references

**Dependencies:** C3  
**Estimate:** 3–4 sprints

---

### Phase C5 — Multi-format output & async queue

**Goal:** Beyond sync PDF.

| # | Deliverable | Details |
|---|-------------|---------|
| C5.1 | HTML Renderer | Standalone HTML output |
| C5.2 | Email Renderer | Layout tree → HTML Renderer → inline-CSS email HTML for notification service |
| C5.3 | Image Renderer | PNG/JPG for labels/previews |
| C5.4 | Queue Engine | `POST /content/render/async`; job states; priority levels |
| C5.5 | Render Queue UI | Job list, retry, cancel, download |
| C5.6 | Worker scaling | Redis-backed queue; retry with exponential backoff |
| C5.7 | Caching layer | Compiled templates, themes, fonts (Redis) |

**Exit criteria**

- [ ] 100-page async PDF completes within SLA via queue
- [ ] Email template renders and hands off to Notification Service
- [ ] Failed jobs retry 3x with logged diagnostics

**Dependencies:** C4  
**Estimate:** 2–3 sprints

---

### Phase C6 — Platform integration (first consumers)

**Goal:** Replace siloed PDF paths; modules call Content Platform.

| # | Deliverable | Details |
|---|-------------|---------|
| C6.1 | Quote integration | Replace `renderQuotePdf` with template render + adapter |
| C6.2 | Invoice integration | Replace `renderInvoicePdf` with template render |
| C6.3 | Audit report migration | Map block-based templates → component JSON; deprecate `blockBasedPdfService` |
| C6.4 | Email integration | Replace static templates in communications with Content Platform |
| C6.5 | Process Designer action | `render_document` step: templateId + record ref → output |
| C6.6 | Notification Service hook | `RenderCompleted` event → email delivery |
| C6.7 | Default template per module | Module settings: default template per document purpose |
| C6.8 | Public/share links | Reuse quote public document pattern for generic outputs |

**Migration strategy**

1. Ship platform templates mirroring current hardcoded layouts (pixel-parity target)
2. Feature flag per module: `useContentPlatformRender`
3. Run parallel render (old + new) in shadow mode; compare checksums
4. Cut over per tenant; remove legacy renderers after 1 release

**Exit criteria**

- [ ] Quotes and Invoices use Content Platform in production
- [ ] No new hardcoded PDF layout code in module controllers
- [ ] Process Designer can trigger document generation

**Dependencies:** C5 (sync path can start after C1 with C6.1–6.2 using sync render)  
**Estimate:** 3–4 sprints

---

### Phase C7 — Reuse, packages, governance

| # | Deliverable | Details |
|---|-------------|---------|
| C7.1 | Content Snippets | CRUD, link to templates, update propagation |
| C7.2 | Reusable Components | Versioned blocks (invoice header, address block) |
| C7.3 | Dependency Engine | Impact graph; warn before delete |
| C7.4 | Package export/import | ZIP manifest; conflict resolution |
| C7.5 | Dependency Viewer UI | |
| C7.6 | Validation Center UI | Navigate-to-component on error |
| C7.7 | Collaboration v1 | Comments, mentions, review requests (no live co-edit) |

**Dependencies:** C6  
**Estimate:** 2–3 sprints

---

### Phase C8 — Localization & accessibility

| # | Deliverable | Details |
|---|-------------|---------|
| C8.1 | Multi-language templates | Translation keys, locale params |
| C8.2 | Regional formatting | Numbers, currency, dates, RTL |
| C8.3 | Accessibility validation | Alt text, contrast, tagged PDF checks |
| C8.4 | Plural rules | i18n pluralization in merge output |

**Dependencies:** C4, C7  
**Estimate:** 2 sprints

---

### Phase C9 — AI, import, marketplace (future)

Per PRD Doc 4 §20 Phases 2–4. **Do not start without product evidence.**

| Track | Capabilities |
|-------|--------------|
| AI authoring | Generate template, suggest merge tags, explain validation, brand alignment |
| Import | DOCX conversion, PDF layout import |
| Marketplace | Template packages, ratings, tenant import |
| Collaboration v2 | Live presence, co-authoring, branching |
| Extensibility | Component SDK, custom renderer plugins |
| PDFKit adapter | Direct layout-tree → PDF for profiled high-volume workloads (bypasses Puppeteer) |
| Advanced AI | Layout optimization, accessibility fixes, personalization |

---

## 5. API surface (v1 contract)

Lock at C0; implement incrementally.

### Templates

| Method | Path | Phase |
|--------|------|-------|
| POST | `/api/content/templates` | C0 |
| GET | `/api/content/templates` | C0 |
| GET | `/api/content/templates/:id` | C0 |
| PUT | `/api/content/templates/:id` | C0 |
| DELETE | `/api/content/templates/:id` | C0 |
| POST | `/api/content/templates/:id/clone` | C2 |
| POST | `/api/content/templates/:id/publish` | C2 |
| POST | `/api/content/templates/:id/archive` | C2 |

### Versions

| Method | Path | Phase |
|--------|------|-------|
| GET | `/api/content/templates/:id/versions` | C2 |
| POST | `/api/content/templates/:id/versions/:version/restore` | C2 |
| POST | `/api/content/templates/:id/versions/compare` | C2 |

### Render

| Method | Path | Phase |
|--------|------|-------|
| POST | `/api/content/render` | C1 |
| POST | `/api/content/render/preview` | C3 |
| POST | `/api/content/render/async` | C5 |
| GET | `/api/content/render/jobs/:jobId` | C5 |
| GET | `/api/content/render/jobs/:jobId/output` | C5 |

### Themes, Assets, Validation, Packages

| Area | Phase |
|------|-------|
| `/api/content/themes/*` | C2 |
| `/api/content/assets/*` | C2 |
| `/api/content/validate` | C2 |
| `/api/content/packages/export`, `/import` | C7 |

---

## 6. Permissions model

| Resource | Actions |
|----------|---------|
| Template | view, create, edit, delete, publish, archive, clone, export, render |
| Theme | view, edit, publish |
| Asset | upload, replace, delete, manage |
| Render job | view, retry, cancel |

Register under `content-templates` module key. Admin role gets full set; standard users get view + render on published templates.

---

## 7. MVP definition (minimum to start module migration)

**MVP = C0 + C1 + C2 + C3 (core) + C6.1–6.2**

| Capability | In MVP? |
|------------|---------|
| JSON template render to PDF | ✅ |
| Merge tags from record metadata | ✅ |
| Themes + assets | ✅ |
| Visual builder (core components) | ✅ |
| Publish + version | ✅ |
| Quote/Invoice migration | ✅ |
| Variables / formulas / repeaters | ❌ (C4) |
| Async queue | ❌ (C5) |
| Email renderer | ❌ (C5) |
| AI / marketplace | ❌ (C9) |

---

## 8. Success metrics (from PRD Doc 1 §20)

| Category | Target |
|----------|--------|
| Adoption | Quotes + Invoices on platform; zero new module-specific PDF engines |
| Performance | Interactive preview < 500ms; async jobs within SLA |
| Reuse | Shared themes/components across modules |
| Reliability | Publish validation blocks broken templates; high render success rate |
| UX | Business user publishes template without developer |

---

## 9. Risk register

| Risk | Mitigation |
|------|------------|
| Builder scope creep (Figma parity) | MVP component set only; progressive disclosure |
| PDF fidelity vs current hardcoded layouts | Shadow-mode parallel render; pixel-parity seeds |
| Performance of browser canvas | Virtualize layers; debounce preview |
| Puppeteer latency / scale at volume | Async queue (C5); worker pool; cache compiled HTML; add PDFKit adapter only when profiled bottleneck |
| Formula/expression security | Sandboxed evaluator; no arbitrary JS; depth/timeout limits |
| Microservice premature split | Monolith modules with clear boundaries first |
| Documents Module overlap | Strict boundary: platform renders bytes; Documents stores/links |

---

## 10. Suggested team parallelization

After C0 contracts are locked:

```
Track A (Backend)     Track B (Frontend)       Track C (Integration)
─────────────────     ──────────────────       ─────────────────────
C1 render pipeline    C3 builder shell         C6 shadow migration
C2 theme/validation   C3 canvas/components     Seed templates
C4 formula/repeater   C3 panels/preview        Process Designer hook
C5 queue              C2 minimal list UI       Email handoff
```

---

## 11. Pre-build checklist

Before sprint 1:

- [ ] Architecture review: schema, API, permission keys, layout tree schema
- [x] PDF renderer: **Puppeteer (HTML-first)** for v1; PDFKit deferred to future high-volume adapter
- [ ] Confirm queue backing store (Redis availability)
- [ ] Define MVP component type enum (freeze list)
- [ ] Assign first consumer module (Quotes recommended — already has document flow)
- [ ] Align with Documents Module roadmap for output handoff contract
- [ ] Create `content-templates` i18n namespace

---

## 12. Document index

| PRD doc | Roadmap sections |
|---------|------------------|
| Doc 1 Vision | §1, §3, §8 metrics |
| Doc 2 Engines | §3.1–3.2, Phases C1–C8 engine mapping |
| Doc 3 UX | Phase C3, C7 UI deliverables |
| Doc 4 Engineering | §3.3–3.4, §5 APIs, §6 permissions, §9 risks |

---

*This roadmap is the single execution plan synthesized from PRD Documents 1–4. Update phase status as implementation progresses.*
