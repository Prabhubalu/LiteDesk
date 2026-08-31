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
| User-session startup | Desktop + Startup folder launch `--tray` (no Windows service) |
| Config + queue folders | `%LOCALAPPDATA%\Arivu\Connector\` (no admin for daily use) |

**Not bundled (by design):** TallyPrime itself (customer license).

**Do not "Run as administrator"** — the agent must stay in your Windows user session so it can reach Tally’s XML port. Installer may ask for admin once; after that, never elevate.

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

- Windows: `%LOCALAPPDATA%\Arivu\Connector\` (migrates from ProgramData if needed)
- Other: `~/.arivu/connector/`

Override with `ARIVU_CONFIG_PATH` / `ARIVU_API_BASE` / `ARIVU_AGENT_TOKEN`.

## Local dual-machine debug (same LAN)

Use this to test against a **local** Arivu API on another machine (e.g. Mac) without pushing to main or using production.

```text
[ Windows: Agent + TallyPrime ]  --HTTP-->  http://<MAC_LAN_IP>:5000  [ Mac: Arivu server ]
```

### Mac

1. Start Arivu server (default port **5000**) + client.
2. Note LAN IP: `ipconfig getifaddr en0` (example `192.168.1.42`).
3. Confirm Windows can reach `http://192.168.1.42:5000` (allow Node/port 5000 in Mac firewall if needed).
4. Open **local** Integration Center → create a Tally pairing code.
5. Use **Live catalog** tab → Discover metadata after the agent is paired.

### Windows agent laptop

1. Stop the agent.
2. Edit `%LOCALAPPDATA%\Arivu\Connector\config.json`:
   ```json
   {
     "apiBase": "http://192.168.1.42:5000",
     "agentToken": null,
     "connectionId": null
   }
   ```
   (No trailing slash, no `/api`. Clear token/connection when leaving production.)
3. For feature-branch agent code: copy `connectors/arivu-agent` from the repo, `npm install`, run `npm run start:console` (or tray). Or replace installed `.exe` after `./installer/build.sh` on Mac.
4. Pair with the **local** Center pairing code.
5. Switch back to prod later: `"apiBase": "https://api.arivusystems.com"` + re-pair with a production code.

OTA update is not required for this loop (scaffold only downloads a published installer URL).

## Install UX (end user)

1. In Arivu: **Download EXE** (entitled API → `ArivuConnectorSetup.exe`)
2. Run installer **once** (admin only for Program Files) → agent binary, TDL, user Startup shortcut
3. Desktop → **Arivu Connector** (normal user — not Run as admin)
4. Open TallyPrime + load TDL + enable HTTP 9000 — agent auto-detects within ~15s
5. Paste pairing code — sync starts immediately (no restart)

Upgrade from older agents: `sc stop/delete ArivuConnectorAgent`, then install 0.3.1. Do not re-register the Windows service — user-session `--tray` is the supported path.

## Build (CI)

```bash
# macOS/Linux — agent EXE only
./installer/build.sh
# or: npx pkg . --targets node18-win-x64 --output dist/arivu-connector-agent.exe

# Windows — full Setup EXE
.\installer\build.ps1

# After Windows build, publish for Download button:
copy dist\installer\ArivuConnectorSetup.exe ..\..\client\public\connectors\
```

Or set `TALLY_CONNECTOR_INSTALLER_PATH` on the API server to the absolute path of the Setup EXE.

Outputs:

- `dist/arivu-connector-agent.exe` — packaged Node binary (Mac or Windows) — **0.3.1 built**
- `dist/installer/ArivuConnectorSetup.exe` — Inno Setup installer (**Windows ISCC required**)

## Legacy service (not recommended)

Session-0 Windows services cannot reliably reach Tally in the user desktop. Prefer Startup `--tray` only. If you must clean up an old service:

```powershell
sc stop ArivuConnectorAgent
sc delete ArivuConnectorAgent
```

## Notes

- Runtime is **plain Node 18+ JS** (no TypeScript compile step) so `pkg`/`nexe` packaging stays simple.
- Cloud routes for `/agent/poll`, `/agent/ack`, `/agent/pair`, `/agent/update` target the `/agent/*` surface.
