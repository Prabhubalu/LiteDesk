# Arivu Test Platform (ATP) — User Guide

## Overview

ATP orchestrates automated tests from `Automation_Testing.md`, runs suites against your SUT (System Under Test), stores results in MongoDB, and surfaces them in the dashboard.

| Component | Default URL |
|-----------|-------------|
| Dashboard | http://localhost:3100 |
| Control plane API | http://localhost:3099 |
| SUT API | http://localhost:3000 |
| SUT client | http://localhost:5173 |

## Quick start

```bash
cd atp
cp .env.example .env
# Set ATP_PERSONA_OWNER_EMAIL / ATP_PERSONA_OWNER_PASSWORD

npm install
npm run catalog:sync

# Option A — local processes
npm run control-plane    # terminal 1
npm run dashboard:dev    # terminal 2
npm run run:smoke        # terminal 3 (SUT must be up)

# Option B — Docker stack (Mongo + CP + dashboard)
npm run stack:up
```

Copy `fixtures/personas.example.json` → `fixtures/personas.json` for API/UI login.

## Running suites

```bash
npm run run:smoke
npm run run:e2e
npm run run:security
npm run run:full          # all automated cases (long)
node runner/cli.mjs suites
```

Set `ATP_SKIP_HEALTH_GATE=1` to bypass `/health/ready` check.

## Dashboard

- **Home** — trigger suites, **Go/No-Go** gate (smoke + e2e-critical rules)
- **Catalog** — synced test cases; expand a row for summary, steps, request, expected behavior, and failure remediation
- **Runs** — history and live progress
- **Schedules** — cron jobs + optional Slack webhook on failure
- **Compare** — diff two runs (e.g. local vs UAT)

## Reports (HTML → PDF)

Open from run detail or directly:

```
/atp/runs/{runId}/report?template=executive&key={ATP_API_KEY}
/atp/runs/{runId}/report?template=sprint&key={ATP_API_KEY}
```

Use browser **Print → Save as PDF** for executive packs.

## Compare runs

```
GET /atp/runs/compare?runA={id}&runB={id}
GET /atp/runs/compare?runA={id}&runB={id}&format=html&key={key}
```

## Schedules & Slack

1. Dashboard → **Schedules** → create (cron UTC, suite, env).
2. Set `ATP_SLACK_WEBHOOK_URL` in `.env` or per-schedule webhook.
3. Failed scheduled runs post a Slack summary automatically.

Example cron: `0 2 * * *` (02:00 UTC nightly).

## Go / No-Go rules

| Check | Rule |
|-------|------|
| Smoke | Latest `smoke` run: 0 failures, 100% pass (excl. skipped) |
| E2E Critical | Latest `e2e-critical`: ≥95% pass, 0 failures |

`GET /atp/go-no-go` returns `status: "go" | "no-go"`.

## Quarantine flaky cases

```bash
cp fixtures/quarantine.example.json fixtures/quarantine.json
# Add case IDs to caseIds[]
```

Excluded from all suites unless `ATP_IGNORE_QUARANTINE=1`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ATP_SUT_API_URL` | Product API base |
| `ATP_PERSONA_OWNER_*` | Login for tests |
| `ATP_SLACK_WEBHOOK_URL` | Failure notifications |
| `ATP_RETRY_ON_FAIL=1` | One retry (non-security) |
| `REDIS_URL` | Optional Bull queue |

## CI

```bash
npm run catalog:check
npm run run:smoke -- --env ci
```

See `.github/workflows` for ATP smoke stub.

## Adding tests

1. Implement in `atp/runner/definitions/*.mjs`
2. Register in `definitions/index.mjs`
3. Add to `catalog/suites.json`
4. `npm run catalog:sync`
