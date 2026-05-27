# Mailroom Platform Module

Conversation-first ingestion for omnichannel communication. **Business behavior is configured via tenant policies**, not hardcoded in channel services.

## Layout

| Path | Role |
|------|------|
| `domain/` | Normalized message shape, shared types |
| `policies/templates/` | Default policy templates (seed) |
| `policies/validators/` | Config validation |
| `policies/strategies/` | Signal evaluators (code); order/params from config |
| `policies/policyEngine.js` | `evaluate(policyType, context)` |
| `adapters/` | Cases, Communications (M1+) |
| `connectors/` | Email parser, raw MIME (M1+) |
| `pipeline/` | Async stages (M1+) |
| `events/` | Event publisher (M4+) |

## Boundaries

- Mailroom **does not** implement SLA, assignment, or status transitions.
- Case create/append/reopen goes through **adapters** calling Cases APIs.
- See `docs/MAILROOM_ROADMAP.md` for phased delivery.

## Phase status

- **M0** — Policies, models, settings API, Automation UI shell
- **M1** — Email strangler (`emailInboundPipeline.js`): raw payload → policies → legacy handlers
- **M2** — Conversation + message persistence, threading logs, threading policy UI, enriched candidates
- **M3** — `casesAdapter` executes case_link/dedup; Mailroom-enabled email skips legacy helpdesk ingest; channel-rules migration script
- **M3.1** — **Ingest routing** policy (pre-pipeline); tabbed Settings UI (Overview / Routing / Processing / Monitoring / Developer)
- **M4** — Event publishing + dispatcher; processing failures + replay from Settings UI
- **M5+** — Portal/API connectors (M5), live chat (M6), hardening (M7)

## Settings UI (Automation → Mailroom)

| Tab | Purpose |
|-----|---------|
| Overview | Enable, template, pipeline diagram |
| Routing | Ingest rules — which messages enter case flow |
| Processing | Threading → Dedup → Case link |
| Monitoring | Failures + replay; threading logs |
| Developer | Sample policy evaluation |

## Enable M1

- Settings → Automation → Mailroom → **Enable Mailroom for this organization**, or
- `MAILROOM_EMAIL_ENABLED=true` in server `.env` (all tenants)

## Local simulation (no remote parser)

When the parser cannot POST to `localhost`, inject a fake inbound message:

```bash
cd server
npm run simulate:parser-inbound
npm run simulate:parser-inbound -- --from customer@example.com --subject "Test" --body "Hello"
npm run simulate:parser-inbound -- --enable-mailroom
npm run simulate:parser-inbound -- --org-id <mongoOrgId> --mailbox-id <mongoMailboxId>
```

**Direct mode (default)** — creates a `ParserInboundEvent`, upserts `ParserMailboxRegistry`, and calls `processParserInboundEventWithMessage` with a fixture body (no webhook, no parser API fetch).

**HTTP mode** — starts a mock parser message API, writes Control Plane inbound-parser config to Mongo (mock parser URL + secrets), then POSTs a signed webhook to your local CRM (**CRM must be running** and use the same `MONGO_URI`):

```bash
npm run simulate:parser-inbound -- --http --crm-url http://localhost:3000
```

Requires `MONGO_URI` and at least one mailbox in the DB (or pass `--org-id` / `--mailbox-id`).

### Migrate Helpdesk channel rules → Mailroom

```bash
cd server
npm run migrate:helpdesk-channel-rules-mailroom          # dry-run
npm run migrate:helpdesk-channel-rules-mailroom:apply    # persist
npm run migrate:helpdesk-channel-rules-mailroom -- --org-id <mongoOrgId> --apply
```

Maps `helpdeskExecution.channelRules` (Email first) → `dedup.onDuplicate` and `caseLink.defaults`, merging into the active Mailroom template policies.

### Local mailbox setup (no remote parser)

```bash
cd server
npm run simulate:mailbox
npm run simulate:mailbox -- --kind group --label "Support Inbox"
npm run simulate:mailbox -- --list
```

Creates a mailbox with a **simulated routing address** (`*@inbound.local.test`) and `ParserMailboxRegistry` entry. To create mailboxes from the UI without a parser, set `LOCAL_PARSER_PROVISION=true` in `server/.env`.

**Helpdesk routing:** Parser inbound creates/appends Helpdesk cases via `helpdeskChannelIngestionService` (aligned with raw MIME → cases). Set `PARSER_INBOUND_WORKSPACE_ONLY=true` to keep personal mailboxes workspace-only.
