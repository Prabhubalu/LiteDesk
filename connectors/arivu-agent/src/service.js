'use strict';

/**
 * Windows service install/uninstall hooks via node-windows (optionalDependency).
 *
 * Usage (after packaging EXE or with node):
 *   node src/service.js install
 *   node src/service.js uninstall
 *
 * Inno Setup installs the packaged binary and can call these, or register the
 * service directly with sc.exe. This module is the Node-side helper.
 */

const path = require('path');
const { defaultDataDir, writeConfigTemplate } = require('./config');

const SERVICE_NAME = 'ArivuConnectorAgent';
const SERVICE_DISPLAY = 'Arivu Connector Agent';
const SERVICE_DESCRIPTION = 'Bridges local Tally XML API to Arivu cloud for sync and discovery.';

function getScriptPath() {
  // When packaged with pkg/nexe, process.execPath is the EXE.
  if (process.pkg || path.basename(process.execPath).toLowerCase().includes('arivu')) {
    return process.execPath;
  }
  return path.join(__dirname, 'index.js');
}

function loadNodeWindows() {
  try {
    // Optional — only present on Windows build agents / installed hosts.
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    return require('node-windows');
  } catch (err) {
    return null;
  }
}

function install() {
  writeConfigTemplate();
  const nw = loadNodeWindows();
  if (!nw) {
    console.log('[service] node-windows not installed; write config only.');
    console.log(`[service] data dir: ${defaultDataDir()}`);
    console.log('[service] Register manually:');
    console.log(`  sc create ${SERVICE_NAME} binPath= "${getScriptPath()}" start= auto`);
    return;
  }

  const { Service } = nw;
  const svc = new Service({
    name: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
    script: getScriptPath(),
    nodeOptions: [],
    env: [
      { name: 'ARIVU_CONFIG_PATH', value: path.join(defaultDataDir(), 'config.json') },
    ],
  });

  svc.on('install', () => {
    console.log(`[service] installed: ${SERVICE_DISPLAY}`);
    svc.start();
  });
  svc.on('alreadyinstalled', () => console.log('[service] already installed'));
  svc.on('error', (err) => console.error('[service] error', err));
  svc.install();
}

function uninstall() {
  const nw = loadNodeWindows();
  if (!nw) {
    console.log(`[service] node-windows missing; run: sc delete ${SERVICE_NAME}`);
    return;
  }
  const { Service } = nw;
  const svc = new Service({
    name: SERVICE_NAME,
    script: getScriptPath(),
  });
  svc.on('uninstall', () => console.log('[service] uninstalled'));
  svc.uninstall();
}

if (require.main === module) {
  const cmd = (process.argv[2] || '').toLowerCase();
  if (cmd === 'install') install();
  else if (cmd === 'uninstall') uninstall();
  else {
    console.log('Usage: node src/service.js [install|uninstall]');
  }
}

module.exports = {
  SERVICE_NAME,
  SERVICE_DISPLAY,
  SERVICE_DESCRIPTION,
  install,
  uninstall,
  getScriptPath,
};
