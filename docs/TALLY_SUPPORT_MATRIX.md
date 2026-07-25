# Tally Connector — Support Matrix

**Status:** Target support for GTM. Live certification expands with XML fixture regression (`server/services/connectors/tally/__tests__/tallyXmlRegression.test.js`).  
**Canonical version helper:** `server/constants/tallyVersionMatrix.js`

---

## 1. Supported platforms

| Component | Supported | Notes |
|-----------|-----------|--------|
| **TallyPrime 4.x** | Yes (primary) | Default target for GA regression |
| **TallyPrime 3.x** | Yes | GST Rel 3+ XML tags assumed for India GST vouchers |
| **TallyPrime Server** | Yes (supported topology) | Agent on host with LAN access to company data; same XML port rules |
| **Tally.ERP 9** | Not committed | Only if explicitly added to `SUPPORTED_TALLY_VERSIONS` later |
| **Windows 10** | Yes | Agent host OS |
| **Windows 11** | Yes | Agent host OS |
| **Cloud-hosted Tally** | Yes (topology) | Install Agent on the **same Windows host** as Tally, or a bastion with private LAN to Tally XML — cloud Arivu still never opens `:9000` |

---

## 2. Connectivity model

| Capability | Supported? | Detail |
|------------|------------|--------|
| Tally REST API | **No** | Tally exposes XML over HTTP, not a public REST/webhook model |
| Push webhooks from Tally | **No** | Agent is **poll-based** (`pollIntervalMs` default 5s) + heartbeat |
| Cloud → Tally direct | **No** | Forbidden; Agent only |
| Agent → Arivu cloud | **Yes** | HTTPS/TLS |
| Agent → Tally XML | **Yes** | Localhost / private LAN, ports **9000–9010** by default |
| Offline queue on Agent | **Yes (design)** | Local queue flush when cloud returns |

---

## 3. Known limitations

1. **No REST / no Tally webhooks** — all sync is Agent poll + job pull.
2. **Single-flight XML writes per company** — throughput limited; do not raise `companyWriteConcurrency` without Tally contention testing.
3. **Edit Log editions** — prefer Automatic Retain numbering; avoid mass renumber imports (MCA audit noise).
4. **Licence contention** — single-user Tally may block while UI is busy; serialize and surface “Tally busy” (ops UX TBD).
5. **IRN** — preserve-only in v1; no IRP generation in-product.
6. **Draft vouchers** — not synced; Posted/Approved only.
7. **Mock mode** — `TALLY_CONNECTOR_MODE=mock` is the default cloud adapter path until live agent XML is certified per matrix row.

---

## 4. Version check API

```js
const { isSupportedTallyVersion, SUPPORTED_TALLY_VERSIONS } =
  require('../constants/tallyVersionMatrix');
```

Discovery / heartbeat should report `tallyVersion` strings compatible with `isSupportedTallyVersion()` (e.g. `TallyPrime 4.0`, `TallyPrime Release 3.0`).

---

## 5. Regression

- Fixture: `server/services/connectors/tally/__fixtures__/salesVoucher.xml`
- Test: `node --test services/connectors/tally/__tests__/tallyXmlRegression.test.js` (from `server/`)
- Expand fixtures per supported major release before GA claims.

---

## 6. Explicitly out of support (v1)

- Non-Windows Agent hosts as primary GTM path
- Public exposure of Tally XML ports
- Tally.ERP 9 unless product commits and matrix is updated
