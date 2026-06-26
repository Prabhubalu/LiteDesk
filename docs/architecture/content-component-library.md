# Content Component Library — PRD

> **Status:** Approved contract (C3+ builder catalog)  
> **Related:** `contentComponentRegistry.js` · `contentComponentMetadata.js` · `content-document-platform-roadmap.md`  
> **Last updated:** 2026-06-25

---

## 1. Component metadata contract

Every Arivu content component exposes a consistent metadata model used by the builder, validation engine, renderers, and AI assistant.

| Field | Description |
|-------|-------------|
| **Purpose** | What the component is intended for |
| **How it works** | Runtime and authoring behavior |
| **Supported Outputs** | Print, PDF, Email, HTML, Portal, Label compatibility |
| **Allowed Child Components** | Nesting rules |
| **Key Properties** | Primary bindings and style controls |
| **Special Behaviors** | Output-specific rules, edge cases, platform hooks |

Extended contract fields (implementation):

| Field | Description |
|-------|-------------|
| **Data Binding** | Merge fields, variables, formulas, repeaters, runtime parameters |
| **Styling** | Typography, colors, spacing, borders, shadows, sizing, alignment |
| **Validation Rules** | Required properties, output compatibility, nesting constraints |
| **AI Metadata** | Natural-language description for recommendation and auto-configuration |

Machine-readable definitions: `server/constants/contentComponentMetadata.js` (mirrored on client).

### Output support legend

| Symbol | Meaning |
|--------|---------|
| ✅ Full | Fully supported |
| ⚠️ Partial | Supported with constraints |
| ❌ None | Ignored or stripped for that output |

---

## 2. Layout components

### Page

| | |
|---|---|
| **Purpose** | Represents a single printable page or email body. |
| **How it works** | Root container of the template. Defines paper size and margins. Multiple pages can exist in a single template. Email templates contain only one page. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email (single page only) · ✅ HTML |
| **Allowed Child Components** | All components |
| **Key Properties** | Paper Size · Orientation · Margins · Background · Header · Footer |
| **Special Behaviors** | Only root-level node. Not draggable from component library. Email templates enforce single-page constraint at validation. |

---

### Section

| | |
|---|---|
| **Purpose** | Groups related content into logical sections. |
| **How it works** | Semantic container with optional background, spacing, and borders. Automatically grows based on content. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | All except Page |
| **Key Properties** | Background · Padding · Margin · Border · Visibility |
| **Special Behaviors** | Typical document structure: Invoice Header → Customer Details → Items → Totals → Footer. |

---

### Container

| | |
|---|---|
| **Purpose** | Generic layout wrapper. |
| **How it works** | HTML `<div>` equivalent. Used for background, border, padding, shadow, and rounded corners. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | Any component |
| **Key Properties** | Background · Border · Padding · Shadow · Border Radius |
| **Special Behaviors** | Non-semantic wrapper; prefer Section when grouping has document meaning. |

---

### Row

| | |
|---|---|
| **Purpose** | Horizontal layout container. |
| **How it works** | Arranges children horizontally. Supports equal width, auto width, and fixed width columns. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | Column, Container, and leaf components |
| **Key Properties** | Gap · Alignment · Distribution · Wrap |
| **Special Behaviors** | Example: `Logo` beside `Invoice No.` |

---

### Column

| | |
|---|---|
| **Purpose** | Vertical container inside Row. |
| **How it works** | Stacks children vertically. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | Any component except Page |
| **Key Properties** | Gap · Alignment · Width · Flex Grow |
| **Special Behaviors** | Example: Name → Address → Phone → Email stacked. |

---

### Divider

| | |
|---|---|
| **Purpose** | Visual separator. |
| **How it works** | Horizontal or vertical line. Styles: solid, dashed, dotted. Supports centered icon. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Orientation · Style · Color · Thickness · Icon |
| **Special Behaviors** | Renders as `<hr>` or styled block depending on output. |

---

### Spacer

| | |
|---|---|
| **Purpose** | Creates empty space. |
| **How it works** | Adjustable height (flow) or height/width (absolute). No content rendering. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Height · Width |
| **Special Behaviors** | Invisible in output except for whitespace. |

---

### Page Break

| | |
|---|---|
| **Purpose** | Forces a new page. |
| **How it works** | Inserts CSS `break-after: page` in print/PDF pipeline. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ❌ Email · ⚠️ HTML (print stylesheet only) |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | None |
| **Special Behaviors** | Ignored for email. No effect in interactive HTML unless print CSS applied. |

---

## 3. Text components

### Heading

| | |
|---|---|
| **Purpose** | Titles and section headers. |
| **How it works** | Renders H1–H6. Supports merge tags in text. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Level (H1–H6) · Text · Typography · Alignment |
| **Special Behaviors** | Inline editing in builder. Merge chips normalized on save. |

---

### Text

| | |
|---|---|
| **Purpose** | Simple paragraph. |
| **How it works** | Plain text block with optional inline formatting. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Text · Typography · Alignment |
| **Special Behaviors** | Supports merge tags, variables, and inline links. Registry type: `Paragraph`. |

---

### Rich Text

| | |
|---|---|
| **Purpose** | Advanced formatted content. |
| **How it works** | WYSIWYG HTML content block. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email (sanitized) · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | HTML · Typography |
| **Special Behaviors** | Supports bold, italic, underline, lists, tables, images, merge tags, variables. Ideal for Terms & Conditions. Email output strips unsafe HTML. |

---

### Link

| | |
|---|---|
| **Purpose** | Clickable hyperlink. |
| **How it works** | Renders `<a href="...">`. Supports static and dynamic URLs. |
| **Supported Outputs** | ✅ Print · ⚠️ PDF (URL text fallback) · ✅ Email · ✅ HTML · ✅ Portal |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Text · Href · Target |
| **Special Behaviors** | Supports website, email (`mailto:`), phone (`tel:`), portal, and merge-driven URLs. |

---

### List

| | |
|---|---|
| **Purpose** | Bulleted or numbered lists. |
| **How it works** | Ordered or unordered list from static items or repeater-bound collection. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Items · Ordered · Bullet Style · Collection |
| **Special Behaviors** | Supports nested lists, custom bullets, and dynamic repeaters. |

---

## 4. Media components

### Image

| | |
|---|---|
| **Purpose** | Displays raster or vector images. |
| **How it works** | Binds to asset URL or merge field. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Src · Alt · Fit · Fill · Crop · Border Radius |
| **Special Behaviors** | Formats: PNG, JPEG, WebP, SVG. Supports lazy loading in HTML output. |

---

### Logo

| | |
|---|---|
| **Purpose** | Specialized organization logo image. |
| **How it works** | Auto-binds to Company, Organization, or Branch logo from tenant settings. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Src (override) · Alt · Theme Override |
| **Special Behaviors** | Falls back to organization branding when src is empty. |

---

### Icon

| | |
|---|---|
| **Purpose** | Displays symbolic icons. |
| **How it works** | SVG, Font Awesome, or Material Icons by name. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Name · Size · Color · Rotation |
| **Special Behaviors** | Email output may rasterize or fall back to Unicode. |

---

### QR Code

| | |
|---|---|
| **Purpose** | Generates QR codes dynamically at render time. |
| **How it works** | Encodes URL, text, record ID, payment link, or vCard from bindings. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Value · Size · Error Correction |
| **Special Behaviors** | Rendered as inline SVG or PNG depending on output adapter. |

---

### Barcode

| | |
|---|---|
| **Purpose** | Linear barcode generation. |
| **How it works** | Encodes value from merge field or static text. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ❌ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Value · Format · Height · Display Value |
| **Special Behaviors** | Formats: Code128, EAN, UPC. QR fallback when format unsupported. |

---

### Signature

| | |
|---|---|
| **Purpose** | Displays signature block. |
| **How it works** | Uploaded image, user signature asset, or placeholder line. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Image Src · Label · Signer Name |
| **Special Behaviors** | Digital signature execution is out of scope; this is display-only. |

---

## 5. Data components

### Merge Field

| | |
|---|---|
| **Purpose** | Displays CRM record fields. |
| **How it works** | Resolves merge path at render time with optional format pipe. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Path · Format · Fallback |
| **Special Behaviors** | Examples: Customer Name, Invoice Number, Case Title. Registry type: `MergeTag`. |

---

### Variable

| | |
|---|---|
| **Purpose** | Displays calculated or session values. |
| **How it works** | Resolves named variable from template or runtime scope. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Name · Default Value · Format |
| **Special Behaviors** | Examples: Grand Total, Subtotal, Today's Date. Requires Variable Engine (C4). |

---

### Formula

| | |
|---|---|
| **Purpose** | Runtime calculated expression. |
| **How it works** | Evaluates expression against data scope at render time. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Expression · Format · Fallback |
| **Special Behaviors** | Example: `Quantity × Price`. Supports nested formulas. Requires Formula Engine (C4). |

---

## 6. Collection components

### Table

| | |
|---|---|
| **Purpose** | Tabular rows and columns. |
| **How it works** | Grid model with header, body, footer rows. Supports dynamic repeat rows from collection binding. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Grid · Collection · Column Widths · Cell Merge · Sort |
| **Special Behaviors** | Supports header/footer, sorting, dynamic rows, cell merge, and totals row. |

---

### Repeater

| | |
|---|---|
| **Purpose** | Repeats child components for each collection item. |
| **How it works** | Iterates collection; renders children in item scope. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | Any component except Page |
| **Key Properties** | Collection · Item Alias · Empty State |
| **Special Behaviors** | Example: Task Card repeated for each task. Works with any collection. |

---

### Line Items

| | |
|---|---|
| **Purpose** | Specialized invoice/quote line table. |
| **How it works** | Pre-built grid with sections, lines, section totals, and document totals. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Columns · Section Visibility · Totals Toggles · Column Widths |
| **Special Behaviors** | Built-in columns: Product, Qty, Price, Discount, Tax, Amount. Resolves from quote/invoice record at render. Registry type: `LineItem`. |

---

### Related Records

| | |
|---|---|
| **Purpose** | Displays related CRM module records. |
| **How it works** | Loads related collection by relation name and module scope. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Relation · Module Scope · Display Fields · Limit |
| **Special Behaviors** | Examples: Tasks, Comments, Activities, Contacts, Invoices. |

---

## 7. Financial components

### Totals

| | |
|---|---|
| **Purpose** | Document financial summary block. |
| **How it works** | Auto-resolves subtotal, discount, tax, shipping, grand total from record. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Show Subtotal · Show Tax · Show Grand Total · Currency |
| **Special Behaviors** | Currency formatting included. Module-aware (quotes/invoices). |

---

### Tax Summary

| | |
|---|---|
| **Purpose** | Grouped tax breakdown. |
| **How it works** | Lists tax lines by rate/name from record tax data. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Show Tax Breakdown · Group By |
| **Special Behaviors** | Example: GST 18%, VAT, Service Tax. |

---

## 8. CRM components

### Address Block

| | |
|---|---|
| **Purpose** | Formatted postal address. |
| **How it works** | Resolves address fields from bound record path. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Path · Address Type (Billing/Shipping) · Format |
| **Special Behaviors** | Supports Customer, Organization, Billing, and Shipping contexts. |

---

### Contact Card

| | |
|---|---|
| **Purpose** | Person summary block. |
| **How it works** | Displays photo, name, phone, email, title, department from People scope. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Path · Visible Fields · Photo Size |
| **Special Behaviors** | Photo falls back to initials avatar when missing. |

---

### Organization Block

| | |
|---|---|
| **Purpose** | Company summary block. |
| **How it works** | Displays logo, company name, address, tax number, website, phone. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Path · Visible Fields · Logo Override |
| **Special Behaviors** | Combines branding and organization merge fields. |

---

## 9. Interactive components

### Button

| | |
|---|---|
| **Purpose** | Clickable call-to-action. |
| **How it works** | Renders styled link/button with href action. |
| **Supported Outputs** | ❌ Print · ❌ PDF · ✅ Email · ✅ HTML · ✅ Portal |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Text · Href · Style · Target |
| **Special Behaviors** | Ignored during print/PDF. Supports email, HTML, and portal actions. |

---

### Social Icons

| | |
|---|---|
| **Purpose** | Social network icon row. |
| **How it works** | Renders linked icons for configured networks. |
| **Supported Outputs** | ❌ Print · ❌ PDF · ⚠️ Email · ✅ HTML · ✅ Portal |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Networks · Size · Color · Links |
| **Special Behaviors** | Clickable only in HTML/Portal. Supports Facebook, LinkedIn, Twitter/X, Instagram, YouTube. |

---

## 10. Print components

### Header

| | |
|---|---|
| **Purpose** | Repeating page header region. |
| **How it works** | Renders at top of every printed page. Can contain logo, page number, dynamic data. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ❌ Email · ⚠️ HTML (print CSS) |
| **Allowed Child Components** | Any component except Page |
| **Key Properties** | Height · Repeat On · First Page Only |
| **Special Behaviors** | Bound to Page header slot or standalone Header component. |

---

### Footer

| | |
|---|---|
| **Purpose** | Repeating page footer region. |
| **How it works** | Renders at bottom of every printed page. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ❌ Email · ⚠️ HTML (print CSS) |
| **Allowed Child Components** | Any component except Page |
| **Key Properties** | Height · Repeat On · First Page Only |
| **Special Behaviors** | Common usage: terms, page number, copyright. |

---

### Page Number

| | |
|---|---|
| **Purpose** | Current/total page indicator. |
| **How it works** | Resolves `System.PageNumber` and `System.PageCount` at render. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ❌ Email · ⚠️ HTML (print CSS) |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Format |
| **Special Behaviors** | Formats: `1` · `Page 1` · `Page 1 of 10`. |

---

### Watermark

| | |
|---|---|
| **Purpose** | Background overlay text or image. |
| **How it works** | Renders behind page content with reduced opacity. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ❌ Email · ⚠️ HTML (print CSS) |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | Text · Image · Opacity · Rotation · Color |
| **Special Behaviors** | Examples: PAID, DRAFT, CONFIDENTIAL. |

---

## 11. Logic components

### Conditional Block

| | |
|---|---|
| **Purpose** | Show or hide content based on expression. |
| **How it works** | Evaluates condition; renders children only when true. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | Any component except Page |
| **Key Properties** | Condition · Else Branch |
| **Special Behaviors** | Example: Show GST only if Country = India. Requires Expression Engine (C4). |

---

### Loop

| | |
|---|---|
| **Purpose** | Logic container that repeats children over a collection. |
| **How it works** | FOR EACH item in collection, render all child components in item scope. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ✅ Email · ✅ HTML |
| **Allowed Child Components** | Any component except Page |
| **Key Properties** | Collection · Item Alias · Index Alias |
| **Special Behaviors** | Unlike Repeater (single template subtree), Loop wraps arbitrary nested layout structures. |

---

### HTML

| | |
|---|---|
| **Purpose** | Embeds custom HTML. |
| **How it works** | Raw HTML block rendered through output adapter sanitization rules. |
| **Supported Outputs** | ✅ Print · ✅ PDF · ⚠️ Email (safe subset) · ✅ HTML · ✅ Portal |
| **Allowed Child Components** | None (leaf) |
| **Key Properties** | HTML · Sanitize · Allow Scripts |
| **Special Behaviors** | PDF/Print via HTML renderer. Email preserves inline styles only. Third-party widgets allowed in HTML/Portal only. |

---

## 12. Reserved types (registry only)

| Type | Notes |
|------|-------|
| `Grid` | Reserved layout primitive — not in builder catalog |
| `Flex` | Reserved layout primitive — not in builder catalog |

---

## 13. Design principles

1. **Platform-first** — components are metadata-driven; no hardcoded module assumptions
2. **Renderer-independent** — components resolve to layout tree blocks; output adapters handle format differences
3. **Progressive implementation** — builder catalog, canvas, properties, and renderers ship incrementally per phase
4. **Consistent contract** — every new component must register type, metadata, validation rules, and at minimum a builder stub before merge
5. **AI-ready** — `aiDescription` on each component enables assistant recommendation and auto-configuration

---

## 14. Implementation status (2026-06-25)

| Area | Status |
|------|--------|
| Type registry (40 + 2 reserved) | ✅ |
| Builder catalog (39 draggable + Page root) | ✅ |
| Metadata contract file | ✅ |
| Full canvas renderers | ⚠️ Partial — Table, LineItem, text, image, layout primitives; stubs for remainder |
| Full PDF/HTML renderers | ⚠️ Partial — see `layoutTreeBuilder.js` |
| Validation (nesting, output compatibility) | ⏳ C4.7 |
| Variable / Formula / Expression engines | ⏳ C4 |
