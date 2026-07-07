# ADR: Content Studio Architecture

**Status:** Accepted  
**Date:** 2026-07-06  
**Scope:** Articles addon (`articles`) + Blog addon (`blog`)

---

## Context

Arivu needs a world-class editorial experience for:

- **Articles** — Helpdesk knowledge base (addon; requires Helpdesk app)
- **Blog** — Marketing blog (addon; requires Marketing app)

Both are priced addons with a 7-day trial. Source product spec: `docs/ContentEngine.md`. Implementation roadmap: `docs/CONTENT_STUDIO_ROADMAP.md`.

---

## Decision

### 1. Shared Content Canvas, two addons

One block-based editor and one `ContentDocument` model serve both addons. Differentiation is via:

- `addonKey` (`articles` | `blog`)
- `contentType` (`knowledge_article` | `blog_post`)
- `appKey` (`HELPDESK` | `MARKETING`)
- Addon-specific routes, settings, and publishing targets

### 2. Tiptap for editorial content; GrapesJS for layout templates

| Use case | Editor |
|----------|--------|
| Articles, blog posts | **Tiptap + ProseMirror** (Notion-like, keyboard-first) |
| Email, PDF, landing layout templates | **GrapesJS** (existing `ContentTemplate`) |

Stored source of truth is **structured JSON blocks**, never HTML.

### 3. Rendering via extended `contentPlatform`

- Authoring → `ContentDocument` + `ContentDocumentVersion`
- Publish → renderer applies `ContentTheme` / Brand Profile per channel
- Channels (phased): `portal_kb`, `blog_web`, `headless_json`

### 4. Addon entitlement gates all feature APIs

```
/api/helpdesk/articles/*  → requireHelpdeskApp + requireAddonEntitlement('articles')
/api/marketing/blog/*     → requireMarketingApp + requireAddonEntitlement('blog')
/api/content-studio/*     → shared utilities (block registry)
```

Install requires parent app entitlement (`requiredApps` on `AddonDefinition`).

### 5. Pricing

- `trialDays: 7` for both addons
- Plan prices TBD (`flatPriceCents: null` in registry until product sets pricing)

---

## Consequences

**Positive**

- One editor investment serves both products
- Reuses themes, assets, render cache, audit from `contentPlatform`
- Clear addon monetization independent of base app subscription

**Negative / trade-offs**

- Two editor paradigms in the product (Template Builder vs Content Canvas) — mitigated by naming and UX separation
- Tiptap integration is net-new frontend work (CS-1)

---

## Out of scope (this ADR)

- Public hosted subdomain delivery (CS-3)
- AI Studio (CS-5)
- HTML migration from legacy `Document.knowledge_article` (CS-A)
