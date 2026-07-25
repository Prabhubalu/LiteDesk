# Tally Connector — Pilot Runbook

**Audience:** Solutions, CS, pilot customers, engineering on-call.  
**Goal:** Prove sync safely on a **duplicate** company before production go-live.  
**Architecture:** `docs/TALLY_INTEGRATION_ARCHITECTURE.md`

---

## Prerequisites

- [ ] Addon `tally` entitled on the tenant
- [ ] Windows 10/11 host meeting `docs/TALLY_SUPPORT_MATRIX.md`
- [ ] TallyPrime 3.x or 4.x with XML API enabled (local port, not internet-facing)
- [ ] Dedicated least-privilege Tally user for the Agent
- [ ] Backup storage and named owner for rollback decision
- [ ] Dry-run default left **on** until soak passes (`TALLY_DEFAULT_SETTINGS.dryRunDefault`)

---

## Phase 1 — Backup company

1. In Tally, take a **full company backup** (data folder / backup wizard) of the production company.
2. Verify backup restore works on a scratch machine or alternate folder.
3. Record backup timestamp, path, and checksum/size in the pilot ticket.
4. **Do not** point the Agent at production until Phase 5.

**Rollback trigger (Phase 1):** Backup incomplete or unrestorable → **stop**.

---

## Phase 2 — Pilot duplicate

1. Restore backup as a **new company** (e.g. `Acme Traders — Arivu Pilot`).
2. Confirm FY open, GST masters present, voucher series Automatic Retain preferred.
3. Install `ArivuConnectorSetup.exe` (see `client/public/connectors/README.txt`).
4. Pair Agent via Integration Center / pairing code (`tallyConnectionService`).
5. Discover companies; bind **only** the pilot duplicate GUID.
6. Keep SoT defaults; leave dry-run enabled.
7. Run connection validation checklist (internet, Tally running, XML, company, FY).

**Rollback trigger:** Cannot pair, discover, or validate → uninstall Agent; leave production untouched.

---

## Phase 3 — 50 voucher soak

1. Disable dry-run **only** for the pilot binding after a clean dry-run report.
2. Push / sync a controlled set of **~50 vouchers** covering:
   - Parties / ledgers created as needed
   - Sales invoices (GST fields + IRN preserve if sample has IRN)
   - At least one payment/receipt path if enabled
   - One cancel (not delete) of a synced voucher
3. Confirm Agent heartbeat stays healthy; queue depth returns to zero.
4. Spot-check Tally: `REFERENCE` = Arivu number; `VOUCHERNUMBER` from Tally series.
5. Confirm no hard-deleted vouchers; cancels appear as cancelled in Tally.
6. Confirm IRN (if present) unchanged on sales vouchers.

**Soak duration:** Prefer ≥ 1 business day of Agent uptime with intermittent sync, not only a burst.

**Rollback triggers (Phase 3):**

- Duplicate vouchers or cross-company bleed
- Stock / ledger balance drift beyond agreed tolerance
- IRN altered or GST tax split wrong on B2B samples
- Agent crash loop or persistent queue failures after retries
- Any need to hard-delete vouchers to “fix” sync

→ Pause sync, capture logs/job IDs, restore pilot company from Phase 1 backup if books are contaminated.

---

## Phase 4 — Reconcile

1. Compare Arivu vs Tally for soak set: counts, amounts, GST components, outstanding.
2. Resolve open `ConnectorConflict` rows (use Arivu / use Tally / merge / ignore) with finance owner.
3. Inventory: no dual-deduct; godown/qty match sample SKUs.
4. Sign-off checklist signed by customer finance + Arivu CS.

**Rollback trigger:** Unresolved material mismatches → stay on pilot; do not go live.

---

## Phase 5 — Go-live

1. Fresh production company backup (same as Phase 1).
2. Bind production company GUID; keep pilot binding disabled or revoked.
3. Start with short sync window / low concurrency (`companyWriteConcurrency: 1`).
4. Monitor heartbeat, fail %, queue depth for first 48 hours.
5. Document support contact + rollback owner.

---

## Rollback summary

| Trigger | Action |
|---------|--------|
| Bad backup / unrestorable | Stop before any write |
| Pair/discover/validate fail | Uninstall Agent; no production bind |
| Soak duplicates, GST/IRN errors, stock drift | Pause sync; restore pilot from backup |
| Production post go-live corruption | Disable addon sync / revoke connection; restore production from latest backup; open Sev-1 |

**Never:** Expose Tally `:9000` to the internet as a “fix,” or hard-delete synced vouchers from the connector.

---

## Evidence to retain

- Backup timestamps
- Agent version + device id
- Connection / company GUID
- Sync job IDs for the 50-voucher set
- Reconcile spreadsheet / screenshots
- Sign-off names and dates
