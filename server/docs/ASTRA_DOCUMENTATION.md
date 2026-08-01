# Astra — Complete Product Documentation

**Audience:** Documentation, marketing, and content teams  
**Purpose:** Source material for website pages, help articles, product tours, and buyer-facing explainers  
**Product:** Arivu (the Platform) · **AI layer:** Astra  
**Status:** Production — Astra v2 Ask + Astra Studio (Living Canvas)

---

## How to use this document

This is not an API cheat sheet. It is a **feature narrative** you can reshape into:

- Website product pages and feature sections  
- Help Center articles and “how Astra works” guides  
- Blog posts and launch announcements  
- Sales one-pagers and demo scripts  
- In-app empty states and onboarding copy  

**Voice guidance for public content**

- Call the product users work in **Arivu** (or “the Platform”).  
- Call the AI **Astra**.  
- Prefer “Platform” over “CRM” in user-facing agent and Astra copy.  
- Emphasize: Astra **looks things up** before it speaks; it does not invent customer data.  
- Emphasize: Astra **asks before it changes** anything important (create, update, send).

---

# Part I — What Astra is

## The idea in one paragraph

Astra is Arivu’s built-in AI coworker. It lives inside the same Platform where teams already manage people, organizations, deals, cases, tasks, documents, and more. Instead of opening five screens to answer “What’s going on with Acme?”, a rep can ask Astra in plain language and get an answer grounded in live Platform records—plus clear next steps. When the team needs a shared workspace rather than a chat reply, Astra Studio opens a Living Canvas: an infinite, collaborative board that Astra fills with live widgets, insights, and plans.

## Product vs platform (naming that matters)

| Name | What it is | How to talk about it |
|------|------------|----------------------|
| **Arivu** | The product customers log into | “In Arivu…” / “Your Arivu workspace…” |
| **Astra** | The AI platform inside Arivu | “Ask Astra…” / “Astra drafted…” |
| **Mission Control** | Astra’s default orchestrator | “Astra’s Mission Control routes your question…” |
| **Specialists** | Domain experts Astra can call | “Deal Intelligence,” “Email Agent,” etc. |
| **Astra Studio** | Collaborative AI workspace product | “Open Astra Studio…” / “Living Canvas…” |

Think of Arivu as the office and Astra as the colleague who already has access to the filing cabinets—but only reads what they’re allowed to see, and never files a change without checking with you first.

## Who Astra is for

- **Sales** — pipeline questions, deal risk, meeting prep, outreach drafts, war rooms  
- **Customer success & account teams** — customer 360, renewals, QBRs, health narratives  
- **Support / helpdesk** — case context, similar patterns, knowledge answers, reply drafts  
- **Managers & leadership** — pipeline snapshots, forecasts, executive-style canvases  
- **Operations & admins** — knowledge sources, agent seats, tool permissions, Studio sharing  

Astra is designed so most teams **never need to build their own agents or tools**. Platform defaults cover day-one work; admins can optionally add extras when a tenant has a unique workflow.

## What makes Astra different (positioning pillars)

### 1. Grounded by construction

Astra does not “guess” Platform facts. When it talks about a deal amount, a case status, or a contact name, that claim is supposed to come from a tool result—live lookup in your tenant data. If the evidence is thin, Astra should say so rather than invent numbers.

**Content angle:** “Astra answers from your records—not from imagination.”

### 2. Confirm before it writes

Reading and recommending is free-flowing. Creating a task, updating a deal, sending an email, or assigning a case goes through a **propose → you confirm → execute** path. Destructive or high-impact actions stay under human control.

**Content angle:** “Astra drafts the action. You approve the send.”

### 3. One orchestrator, many specialists

You don’t pick a bot for every job. You ask Astra. **Mission Control** classifies the ask, calls the right specialist seats (Deal Intelligence, Email, Task & Activity, Knowledge, and others), then merges their work into one coherent reply.

**Content angle:** “One conversation. The right experts behind the scenes.”

### 4. Tenant-safe by design

Every lookup is scoped to the organization. Soft-deleted records stay out of results. Widget and tool access still respect Platform permissions. Turns can be audited; sensitive text can be redacted before it hits the model.

**Content angle:** “Same tenancy and permissions your Platform already trusts.”

### 5. Chat when you need answers; canvas when you need a workspace

Quick questions belong in Ask. Multi-hour prep, deal strategy, QBRs, and team collaboration belong in **Astra Studio**—a Living Canvas that stays bound to live data and can be shared with editors and viewers.

**Content angle:** “Ask for answers. Studio for war rooms.”

---

# Part II — How Astra works (story for readers)

## A typical Ask turn (the journey)

Imagine a seller opens Astra and types:  
*“What’s the status of the Acme expansion deal, and draft a follow-up email to Priya.”*

Here’s what happens in plain language:

1. **You ask** from the full Astra page, the side panel, a record page, or Studio chat.  
2. **Astra checks who you are** and that AI is enabled for your org and role.  
3. **It remembers context**—the conversation thread, and any record you’re focused on (for example, the deal page you came from).  
4. **Mission Control plans the work**—this needs deal context *and* an email draft, so Deal Intelligence and Email may both contribute.  
5. **Tools run**—search and fetch live Platform records; draft the email from that context. Nothing is sent yet.  
6. **Astra answers in a coworker voice**—summary, findings, and suggested next steps, still tied to what the tools returned.  
7. **If a write is involved** (send email, create task), you get a clear confirmation card. Only after you confirm does Astra execute.

That loop—**context → plan → tools → grounded answer → confirm writes**—is the heart of Astra. Everything else (Studio, goals, knowledge, Master) builds on it.

## Why answers feel visual

Astra can return more than paragraphs. Replies may include:

- **Metric strips** for quick KPIs  
- **Charts** you can pin toward dashboards where supported  
- **Record lists** with links back into Arivu modules  
- **Honest empty states** when a module isn’t searchable yet or nothing matched  

Documentation articles can teach users to click through from Astra’s list into the real record—Astra is a guide, not a second database.

## Streaming

For longer turns, Astra can stream the reply so the conversation feels live rather than waiting on a blank screen. Product copy can say “Astra thinks out loud as it works” without promising token-level details.

---

# Part III — Ask: everyday features

## Mission Control — the always-on entry

**Mission Control** is Astra’s default brain for Ask. It does not silently rewrite your data. Its job is to:

- Understand what you’re asking  
- Choose one or more specialists  
- Merge their results into a single Platform answer  
- Enforce confirmation when a specialist wants to change something  

Users almost never need to “pick Mission Control.” They just talk to Astra. Power users and admins can still try a specific specialist from Settings when testing prompts.

**Soft alias:** older “coworker” naming resolves to Mission Control so existing habits keep working.

## The specialist workforce (what each seat is for)

Use this section for feature cards, comparison tables, or “Meet the team” marketing.

### Summary Agent

Gives a fast 360° read on a record and related activity—risks, opportunities, and next actions in under a minute. Ideal for “catch me up” moments before a call.

### Record Creation Agent

Turns natural language into new Platform records. It gathers required fields, validates, explains what will be created, and **waits for confirmation** before writing.

### Record Update Agent

Finds the right existing record, proposes field changes, explains impact, and confirms before saving. Built for safe stage moves, owner changes, and field fixes—not silent edits.

### Search Agent

Natural-language search across Platform modules with ranking and refinement suggestions. Helps when users don’t remember which module holds the record.

### Task & Activity Agent

Creates and manages tasks, meetings, calls, follow-ups, and calendar items. Writes always confirm. Good for “remind me Friday” and “schedule a call with…” flows.

### Email Agent

Drafts, rewrites, and summarizes email grounded in Platform context. **Send always requires confirmation.** Pair this with meeting or deal focus so tone and facts stay accurate.

### Deal Intelligence Agent

Read-only deal risk, stage, and opportunity analysis with evidence-backed next-best-action ideas. Use for pipeline reviews and “why is this stuck?” questions.

### Meeting Intelligence Agent

Meeting prep and post-meeting intelligence from notes, transcripts, and related records. Natural partner for Studio’s meeting preparation canvases.

### Forecast & Pipeline Intelligence Agent

Read-only coverage, slippage, and forecast-style analysis from deals and reports. Aimed at managers who need narrative over raw charts.

### Customer 360 Intelligence Agent

Account health across deals, cases, activity, and relationships. The narrative backbone for customer success and account planning.

### Conversation Intelligence Agent

Looks across emails, chats, and conversations for sentiment, commitments, and relationship signals. Useful after a busy inbox week.

### Case Intelligence Agent

Case triage insight, similar-case patterns, knowledge matches, and resolution recommendations—without auto-closing tickets.

### Knowledge Intelligence Agent

Answers from knowledge base and documentation with Platform context. Does not publish content; it retrieves and explains.

### Process Intelligence Agent

Helps design and optimize processes and automations. Publishing or activating changes requires confirmation.

### Analytics & Decision Intelligence Agent

KPI, trend, anomaly, and decision support from reports and analytics—read-only decision support, not a second BI tool.

### Relationship Intelligence Agent

Stakeholder mapping, influence, multi-threading, and relationship-risk analysis. Strong fit for complex enterprise deals.

### Data Quality Intelligence Agent

Surfaces duplicates, incompleteness, and stale data; recommends fixes. Cleanup writes require confirmation.

### Integration Intelligence Agent

Analyzes integration health, mapping, and sync issues. Configuration changes require confirmation.

### Workday Orchestrator Agent

Builds a personal daily plan from tasks, calendar, and priorities. Recommend-only—no silent rescheduling of your day.

Together these seats are the **Platform default workforce**: twenty agents (Mission Control plus nineteen specialists), seeded for every tenant so teams start productive on day one.

## Conversations that remember

Astra conversations are real threads—not one-shot prompts.

- Continue a topic across a workday  
- Rename or delete threads  
- Clear history when needed  
- Carry **focus** (the deal, person, or organization you’re talking about) so follow-ups like “draft the email” know which record you mean  

Help articles can cover: starting a new chat vs continuing, focusing from a record page, and cleaning up old threads.

## Memory — personal and organizational

Beyond a single chat, Astra can use:

- **Personal memory** — durable preferences and facts about how *you* like to work  
- **Organization memory** — shared glossary, grounding notes, and team playbooks  

Position this carefully: memory helps Astra sound like a teammate who was in last week’s standup—not a black box storing secrets. Admin docs should explain what is stored and how it stays tenant-scoped.

## Goals and next-best actions

Astra can track **goals** (objectives the team cares about) and surface **next-best-action** cards on surfaces like home, deals, or inbox. These cards are meant to be grounded and actionable—not generic motivational tips.

**Article ideas**

- “Turn pipeline goals into daily Astra nudges”  
- “What ‘next best action’ means in Arivu”  

## Knowledge — answers from your content

Astra’s knowledge fabric lets the Platform search curated internal and public sources. The same grounding approach powers:

- Astra answers in chat  
- Suggested replies when cases are created  
- Live Chat bots that stay on your public corpus  

Admins configure **Knowledge sources** under Settings → AI (including curated website pages). v1 is intentional: curated URLs or paste—not a full-site crawl.

**Website content angle:** “Teach Astra your playbooks and help articles—then ask in the tools your team already uses.”

## Universal fabric — one way to work every module

Under the hood, Astra uses a consistent fabric to search, open, create, and update Platform modules—plus domain actions such as sending quotes, recording payments, assigning cases, and more. Users don’t see “module fabric”; they feel:

- “List my open deals”  
- “Create a task for this case”  
- “Draft a quote follow-up”  

When a capability isn’t fully wired yet, Astra should fail honestly and point people back into Arivu’s screens—never silently substitute the wrong module.

## CapIndex and Master (for admins and advanced docs)

**CapIndex** is the org’s map of what Astra can bind to: ready, read-only, or unavailable.  

**Master** is an admin flow to propose and create **extra** agents in plain English, tightly bound to CapIndex. It does **not** replace Mission Control as the default Ask entry. Near-duplicate agents are merged; creation is rate-limited so catalogs don’t explode.

Most customer-facing docs can skip Master. Keep it in admin / enterprise advanced guides.

## Workforce playbooks (multi-step stories)

For longer jobs, Astra can run **thin playbooks**—multi-seat plans with handoffs and a reviewer step. Examples:

- Qualify → Research → Outreach  
- Qualify → Enrich → Propose → Task → Review (canonical sales path)  
- Case triage → reply draft  
- Studio meeting prep / war room / customer 360 generation  

**Narrative for articles:** “Astra doesn’t just answer—it can run a short team play, seat by seat, and still wait for you before anything irreversible.”

---

# Part IV — Where people meet Astra (surfaces)

Write UI tours from this section.

## Full Astra experience (`/astra`)

The primary Astra home: conversations, answers with visual blocks, and access to canvas/Studio views. This is the hero surface for screenshots and product videos.

## Side panel

Ask without leaving the page you’re on. Ideal for “quick question while looking at a deal.” Focus can come from the current record.

## Command palette

Keyboard-first entry for power users who already live in Arivu navigation.

## Record AI panel

Astra beside a specific person, organization, deal, case, or other record—so questions inherit that focus automatically.

## Email & meeting assist

Specialized helpers for drafting outreach and preparing for (or wrapping) meetings, still grounded in Platform context.

## Settings → AI / Astra

Where admins manage access, knowledge sources, agent seats, and related AI suite configuration. Entitlements control whether Astra appears in navigation.

---

# Part V — Astra Studio and the Living Canvas

## What Studio is for

Astra Studio is for work that doesn’t fit in a single chat bubble: preparing a meeting with stakeholders, running an opportunity war room, building a QBR, investigating a support issue, or designing a process with colleagues.

Users describe intent in natural language. Mission Control generates a **Living Canvas**—an infinite multiplayer board filled with widgets bound to live Platform data. Modules in Arivu remain the system of record; the canvas is the collaborative layer on top.

## Living Canvas in everyday language

A Living Canvas is:

- **Infinite** — pan and zoom like a modern whiteboard  
- **Live** — widgets refresh against real records and metrics  
- **Multiplayer** — teammates see cursors and edits together  
- **Versioned** — checkpoints and restores for safe iteration  
- **Shareable** — owners, editors, viewers, and optional link share  
- **Exportable** — HTML/PDF snapshots and office formats for stakeholders outside Arivu  

## Canvas types (story starters for content)

Each type is a ready-made narrative your docs can illustrate with screenshots:

| Canvas type | Story to tell |
|-------------|----------------|
| Meeting preparation | Walk into the call already briefed |
| Opportunity war room | Assemble risk, stakeholders, and win strategy |
| Customer 360 | One board for the whole account relationship |
| Executive report | Leadership-ready pipeline and revenue narrative |
| Account planning | Expansion, risks, and action plans |
| Quarterly business review | Achievements, issues, roadmap, actions |
| Customer success plan | Goals, adoption, health, milestones |
| Renewal workspace | Contract context, usage, risks, renewal strategy |
| Support investigation | Case timeline, root cause, resolution plan |
| Project workspace | Milestones, board, deliverables, status |
| Workflow design | Process diagram plus description |
| Brainstorming | Stickies, SWOT, mind map |
| Strategy workspace | Goals, KPIs, risks, alternatives |
| Blank | Start empty; let Astra or the team fill it |

## Widgets — the building blocks

Widgets are how canvases show work. Content teams can group them for website feature grids:

**Platform records** — deals, contacts, organizations, cases, quotes, invoices, products, campaigns, projects, tasks  

**AI panels** — summaries, insights, recommendations, risks, next-best actions (filled by the matching specialist)  

**Analytics** — charts, KPIs, funnels, forecasts, heatmaps, leaderboards  

**Visual thinking** — timelines, kanban, whiteboards, process graphs, relationship maps  

**Content** — rich text, checklists, tables, stickies, embeds  

**Communication** — email, meeting notes, conversation timelines, call summaries  

Astra fills narrative panels with specialist help (for example, deal risk from Deal Intelligence, checklists from Task & Activity). If AI fill fails, deterministic fallbacks keep the board usable.

## Creating and hydrating a canvas

In human terms:

1. Describe what you need (“Prepare me for tomorrow’s Acme QBR”).  
2. Astra classifies the canvas type and scope (org, party, deal, case, project, or abstract).  
3. A template layout appears—sections and widgets placed for that job.  
4. Briefs pull live situation context (related records, activity, emails where relevant).  
5. Specialists fill insight panels asynchronously so the board doesn’t freeze.  
6. You and your teammates edit, comment, accept suggestions, and export when ready.

**Accuracy promise for docs:** Astra is not allowed to invent revenue or pipeline numbers when the brief has none. Prose comes after the data packet—not before.

## Collaboration features worth naming

- **Comments** anchored on the canvas for approvals and discussion  
- **Suggestions** from AI or automation that can be resolved (accept/dismiss)  
- **Revisions** for manual, AI, or checkpoint restores  
- **Automation hooks** that refresh widgets and propose smart suggestions when domain events fire  
- **Web research** (when enabled) for competitor-style panels using public sources  

## Studio and Ask together

Studio chat still runs through Astra’s Ask API with a Studio surface and canvas id—so the same grounding, confirmation, and specialist rules apply. The canvas is the artifact; Ask is the conversation that shapes it.

---

# Part VI — Trust, safety, and administration

## Permissions and entitlement

Astra only appears and works when:

- The Astra platform is enabled for the environment  
- The user’s role (or ownership / privilege) includes AI access  
- The organization’s AI suite entitlement allows use  

There is **no “dev mode” bypass** that weakens access checks. That is intentional for SaaS trust.

## Confirmation culture

Anything above a read—creates, updates, sends, assigns, fulfills—surfaces a confirmation contract. Product copy should celebrate this as a feature, not a friction apology: “Astra proposes; your team disposes.”

## Privacy and audit

- Model input/output can be PII-redacted  
- Turns and settings changes can be audited  
- Credits / usage metering can apply per tenant policy  

Help Center articles should link to your broader privacy and data-processing pages rather than inventing new promises here.

## Admin levers (keep in admin docs)

- Enable/disable Astra and Studio via configuration flags  
- Knowledge sources and website pages  
- Agent seat customization and revert-to-platform-default  
- Tool overrides (advanced)  
- CapIndex visibility and Master for extras  
- Studio canvas sharing policies  

---

# Part VII — Example journeys (ready for articles)

## Journey A — Seller before a customer call

Maya opens the Acme deal and asks Astra: “Catch me up and list open tasks.”  
Astra’s Summary and Task seats return a short briefing and a linked task list.  
She switches to Studio: “Meeting prep for Acme tomorrow.”  
A meeting preparation canvas appears with stakeholders, risks, talking points, and a checklist.  
Her manager joins as a viewer five minutes before the call.

**Article title ideas:** “Meeting prep in five minutes with Astra Studio”

## Journey B — Support agent on a tough case

Sam asks: “Similar cases to this one and a draft reply.”  
Case Intelligence and Knowledge contribute; Email drafts a reply.  
Sam reviews, edits one paragraph, confirms send.  
Nothing went out without his click.

**Article title ideas:** “Grounded case replies without leaving Arivu”

## Journey C — Manager Monday morning

Priya asks: “Where is this month’s pipeline at risk?”  
Forecast & Pipeline Intelligence returns an evidence-backed narrative with a chart block.  
She pins what she needs for the leadership deck and opens an executive report canvas for the weekly review.

**Article title ideas:** “From question to executive board in one morning”

## Journey D — Admin enabling knowledge

An admin adds three help URLs under Knowledge sources.  
Live Chat and Astra both start answering from that corpus.  
The team stops pasting the same FAQ into tickets.

**Article title ideas:** “Teach Astra your help center once”

---

# Part VIII — Messaging bank (copy you can reuse)

### Short hero lines

- “Astra is your Platform coworker—grounded in Arivu, careful with every write.”  
- “Ask in plain language. Get answers from live records.”  
- “When chat isn’t enough, open a Living Canvas.”  
- “Mission Control plans the work. Specialists do the deep dive. You stay in control.”  

### Feature blurbs (≈40 words)

**Ask**  
Talk to Astra from anywhere in Arivu. Mission Control routes your question to the right specialists, looks up live Platform data, and answers in a clear coworker voice—then asks before anything is saved or sent.

**Confirm-gated actions**  
Astra can draft emails, create tasks, update deals, and more. Every write shows up as a proposal you review. Confirm to execute; cancel to keep the Platform unchanged.

**Specialist workforce**  
Nineteen specialists cover search, deals, cases, meetings, knowledge, analytics, data quality, and daily planning. You don’t configure a bot army—Astra already ships with one.

**Astra Studio**  
Describe a war room, QBR, or investigation. Astra builds a multiplayer Living Canvas with live widgets, AI insight panels, comments, versions, and export—while Arivu remains the system of record.

**Knowledge fabric**  
Connect curated help and website content. Astra, case drafts, and Live Chat share the same grounded retrieval so answers stay consistent across channels.

### Do / Don’t for writers

| Do | Don’t |
|----|-------|
| Say Platform / Arivu / Astra | Call agents a “CRM chatbot” in agent-facing copy |
| Stress grounding and confirmation | Promise Astra will “auto-close deals” or “send without asking” |
| Show record links and canvases | Imply Astra replaces module permissions |
| Admit honest gaps (“open in Arivu to finish”) | Invent modules or metrics Astra can’t see |

---

# Part IX — Technical appendix (for docs engineers)

Keep this section off consumer marketing pages; use it for Help Center “For admins / developers” or internal wiki.

## Runtime shape

```
Request → Context → Orchestrator (Mission Control) → Agents → Tools → Models → Answer
                 ↘ Governance (risk, audit, credits, PII, confirm)
                 ↘ Memory (personal, org, session, conversations)
```

## Primary HTTP surfaces

- Astra Ask & admin AI: `/api/ai/v2`  
- Astra Studio REST: `/api/astra/studio`  
- Studio realtime: WebSocket `/api/astra/studio/ws`  

Legacy AI under `/api/ai` is deprecated and in cutover; shared provider, credits, PII, audit, and vector primitives are reused by Astra and must remain.

## Flags (environment)

| Flag | Default | Meaning |
|------|---------|---------|
| `ASTRA_V2` | on | Master switch for Astra Ask platform |
| `ASTRA_V2_SHADOW` | off | Compute v2 but still surface legacy |
| `ASTRA_STUDIO` | on | Enable Living Canvas product |
| `ASTRA_WEB_RESEARCH` | on | Public research helpers for Studio panels |

## Client routes

- `/astra` — primary Astra UI  
- `/astra-studio` redirects into the Astra shell with canvas view  

## Canonical architecture sources

If implementation detail changes, trust these first:

1. `docs/ASTRA_V2_ARCHITECTURE.md`  
2. `docs/ASTRA_STUDIO_ARCHITECTURE.md`  
3. `docs/ASTRA_AGENT_TOOL_CATALOG.md`  
4. `docs/ASTRA_WORKFORCE_EXECUTION_PLAN.md`  
5. This consolidated narrative: `server/docs/ASTRA_DOCUMENTATION.md`  

---

# Part X — Suggested content map for the website

Use this as an editorial outline.

1. **Product page: Astra** — pillars (grounded, confirm, specialists, Studio)  
2. **Feature: Ask** — surfaces, conversations, visual answers  
3. **Feature: Workforce** — specialist gallery with journey GIFs  
4. **Feature: Astra Studio** — canvas types gallery + multiplayer  
5. **Feature: Knowledge** — teach Astra your content  
6. **Trust** — permissions, confirmation, tenant isolation  
7. **Help Center cluster**  
   - Getting started with Astra  
   - Using focus and conversations  
   - Confirming actions safely  
   - Creating your first Living Canvas  
   - Sharing and exporting canvases  
   - Admin: knowledge sources  
   - Admin: agents and entitlements  
8. **Blog / launch** — “From chatbot to AI workforce” using Journey A–D  

---

*This document is meant to be rewritten into customer-facing pages. Prefer clarity and proof over feature enumeration. When in doubt, show a journey, then name the capability.*
