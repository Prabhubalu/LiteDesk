#!/usr/bin/env bash
# Build Arivu Connector Agent Windows artifacts.
#
# On macOS / Linux:
#   - pkg CAN cross-compile → dist/arivu-connector-agent.exe (Windows agent binary)
#   - Inno Setup (ArivuConnectorSetup.exe) CANNOT run natively — use Windows CI/VM or Wine
#
# On Windows:
#   - Full pipeline: pkg + ISCC → dist/installer/ArivuConnectorSetup.exe
#
# Optional: PUBLISH=1 copies installer into client/public/connectors/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"

mkdir -p dist dist/installer installer/redist

echo "==> Installing deps"
if [[ -f package-lock.json ]]; then
  npm ci --ignore-scripts
else
  npm install --ignore-scripts
fi

echo "==> Packaging Windows agent binary with pkg (cross-compile OK on Mac)"
if npx --yes pkg --version >/dev/null 2>&1; then
  npx --yes pkg . --targets node18-win-x64 --output dist/arivu-connector-agent.exe
  echo "OK: dist/arivu-connector-agent.exe"
else
  echo "ERROR: pkg not available"
  exit 1
fi

echo "==> Compiling Inno Setup installer (Windows / Wine only)"
if command -v ISCC >/dev/null 2>&1; then
  ISCC installer/arivu-connector.iss
elif command -v iscc >/dev/null 2>&1; then
  iscc installer/arivu-connector.iss
elif [[ -x "/c/Program Files (x86)/Inno Setup 6/ISCC.exe" ]]; then
  "/c/Program Files (x86)/Inno Setup 6/ISCC.exe" installer/arivu-connector.iss
else
  echo "WARN: ISCC not found on this machine."
  echo "      On Mac you successfully built the agent EXE above."
  echo "      Build ArivuConnectorSetup.exe on Windows: .\\installer\\build.ps1"
fi

if [[ "${PUBLISH:-0}" == "1" ]]; then
  DEST="$REPO_ROOT/client/public/connectors"
  mkdir -p "$DEST"
  if [[ -f dist/installer/ArivuConnectorSetup.exe ]]; then
    cp -f dist/installer/ArivuConnectorSetup.exe "$DEST/"
    echo "Published: $DEST/ArivuConnectorSetup.exe"
  else
    echo "WARN: Full installer missing — not publishing Setup EXE"
  fi
fi

echo "==> Done"
ls -la dist/ dist/installer/ 2>/dev/null || true
