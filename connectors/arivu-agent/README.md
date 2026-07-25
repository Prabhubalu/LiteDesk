# Arivu Connector Agent (GTM-4)

Windows **service + tray** that bridges a local **TallyPrime XML API** to Arivu cloud.

Customers pair via the **tray / browser UI** (no terminal). Support can still use `--pair`.

## What it does

| Capability | Module |
|---|---|
| System tray + localhost pairing UI (`127.0.0.1:17932`) | `src/tray.js`, `src/localUi.js`, `src/ui/` |
| Discover Tally on `localhost:9000–9010` + companies | `src/discovery.js` |
| POST Tally XML (export masters / import vouchers) | `src/xmlClient.js` |
| Offline JSONL queue under ProgramData | `src/offlineQueue.js` |
| Heartbeat + job poll / ack | `src/heartbeat.js` |
| Device-code pairing | `src/pairing.js` |
| Update check | `src/updater.js` |
| Windows service hooks | `src/service.js` |

Cloud API base: `ARIVU_API_BASE` (default `https://api.arivusystems.com`)

Customer modes:

- `arivu-connector-agent.exe --tray` — tray icon + pairing UI (default after install)
- (no args / service) — silent sync loop (heartbeat, poll, XML)

Support-only: `--pair`, `--discover`, `--console`

## Layout

```
connectors/arivu-agent/
  README.md
  package.json
  src/
    index.js
    service.js
    discovery.js
    xmlClient.js
    offlineQueue.js
    heartbeat.js
    pairing.js
    updater.js
    config.js
  installer/
    arivu-connector.iss
    config.template.json
    build.sh
    build.ps1
  scripts/
    mock-tally-server.js
```

## No Windows PC? Use GitHub Actions

You do **not** need a local Windows machine for the customer installer.

1. Push this repo to GitHub (if not already).
2. Open **Actions** → **Tally Connector Installer** → **Run workflow**.
3. Wait for the green check on `windows-latest`.
4. Download the artifact **`arivu-connector-setup`** — it contains:
   - `ArivuConnectorSetup.exe` (full installer + VC++ + service)
   - `arivu-connector-agent.exe` (agent only)
5. Copy Setup EXE into your app so **Download EXE** works:

```bash
mkdir -p client/public/connectors
cp ~/Downloads/ArivuConnectorSetup.exe client/public/connectors/
```

(Or set server env `TALLY_CONNECTOR_INSTALLER_PATH` to the absolute path of the Setup EXE.)

### Optional: agent-only on your Mac (no installer wizard)

```bash
cd connectors/arivu-agent
./installer/build.sh
# → dist/arivu-connector-agent.exe
```

That file is the Windows agent binary, but customers should use **ArivuConnectorSetup.exe** from CI (installs service + runtimes).

## Build (Mac vs Windows)


| Artifact | Build on Mac? | How |
|---|---|---|
| `arivu-connector-agent.exe` (agent) | **Yes** | `pkg` cross-compiles `node18-win-x64` from macOS |
| `ArivuConnectorSetup.exe` (installer) | **No (native)** | Needs **Inno Setup / ISCC** on Windows (or Wine / Windows CI) |

```bash
# On Mac — agent binary only (Windows .exe via pkg)
cd connectors/arivu-agent
./installer/build.sh
# → dist/arivu-connector-agent.exe

# On Windows — full customer installer (includes deps)
.\installer\build.ps1
# → dist\installer\ArivuConnectorSetup.exe
# Optional: copy to client\public\connectors\ for Download EXE button
```

### What the installer bundles (dependencies)

| Included | How |
|---|---|
| Node.js runtime | Embedded in agent via `pkg` — **no separate Node install** |
| Visual C++ 2015–2022 x64 | Optional: put `installer/redist/VC_redist.x64.exe` before compile — installer runs it quietly |
| Windows service registration | `sc.exe create/start` during setup |
| Config + queue folders | `%ProgramData%\Arivu\Connector\` |

**Not bundled (by design):** TallyPrime itself (customer license).

## Local development

```bash
cd connectors/arivu-agent
npm install

# Terminal A — mock Tally XML
npm run mock-tally

# Terminal B — discover / run
npm run discover
npm run start:console
npm run pair
```

Config + queue directory:

- Windows: `%ProgramData%\Arivu\Connector\`
- Other: `~/.arivu/connector/`

Override with `ARIVU_CONFIG_PATH` / `ARIVU_API_BASE` / `ARIVU_AGENT_TOKEN`.

## Install UX (end user)

1. In Arivu: **Download EXE** (entitled API → `ArivuConnectorSetup.exe`)
2. Run installer (admin) → installs VC++ if bundled, agent binary, service, ProgramData folders
3. Pair with device code from Integration Center
4. Agent discovers Tally, heartbeats, polls jobs

## Build (CI)

```bash
# macOS/Linux — agent EXE only
./installer/build.sh

# Windows — full Setup EXE
.\installer\build.ps1

# After Windows build, publish for Download button:
copy dist\installer\ArivuConnectorSetup.exe ..\..\client\public\connectors\
```

Or set `TALLY_CONNECTOR_INSTALLER_PATH` on the API server to the absolute path of the Setup EXE.

Outputs:

- `dist/arivu-connector-agent.exe` — packaged Node binary (Mac or Windows)
- `dist/installer/ArivuConnectorSetup.exe` — Inno Setup installer (**Windows ISCC required**)

## Service registration (manual)

```powershell
sc create ArivuConnectorAgent binPath= "C:\Program Files\Arivu\Connector\arivu-connector-agent.exe" start= auto
sc start ArivuConnectorAgent
```

Or: `node src/service.js install` (uses optional `node-windows` when present).

## Notes

- Runtime is **plain Node 18+ JS** (no TypeScript compile step) so `pkg`/`nexe` packaging stays simple. Structure is ready to migrate to `.ts` later if desired.
- Go was considered for native Windows services; Node was chosen for faster iteration and shared XML/JSON tooling with the Arivu stack.
- Cloud routes for `/agent/poll`, `/agent/ack`, `/agent/pair`, `/agent/update` may be thin wrappers over existing `/api/connectors/tally/*` handlers — agent already targets the `/agent/*` surface.
