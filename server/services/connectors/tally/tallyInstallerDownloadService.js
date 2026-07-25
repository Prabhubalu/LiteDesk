'use strict';

/**
 * Resolve pre-built ArivuConnectorSetup.exe for entitled download.
 * Never compiles on request — CI/Windows (or Mac pkg for agent-only) publishes the file.
 */

const fs = require('fs');
const path = require('path');

const INSTALLER_NAME = 'ArivuConnectorSetup.exe';

function candidatePaths() {
  const fromEnv = String(process.env.TALLY_CONNECTOR_INSTALLER_PATH || '').trim();
  const roots = [
    fromEnv || null,
    path.join(process.cwd(), 'client', 'public', 'connectors', INSTALLER_NAME),
    path.join(process.cwd(), 'connectors', 'arivu-agent', 'dist', 'installer', INSTALLER_NAME),
    path.join(__dirname, '..', '..', '..', 'client', 'public', 'connectors', INSTALLER_NAME),
    path.join(__dirname, '..', '..', '..', 'connectors', 'arivu-agent', 'dist', 'installer', INSTALLER_NAME),
  ].filter(Boolean);

  return roots;
}

function resolveInstallerPath() {
  for (const candidate of candidatePaths()) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const size = fs.statSync(candidate).size;
        // Reject tiny placeholders
        if (size > 1024) {
          return { path: candidate, size, available: true };
        }
      }
    } catch {
      // continue
    }
  }
  return { path: null, size: 0, available: false };
}

function getInstallerStatus() {
  const resolved = resolveInstallerPath();
  return {
    available: resolved.available,
    filename: INSTALLER_NAME,
    sizeBytes: resolved.size || 0,
    buildOnMac: {
      agentExe: true,
      fullInstaller: false,
      note:
        'On macOS you can cross-compile arivu-connector-agent.exe with pkg. ArivuConnectorSetup.exe (Inno Setup) requires Windows, Wine, or CI.',
    },
  };
}

module.exports = {
  INSTALLER_NAME,
  resolveInstallerPath,
  getInstallerStatus,
};
