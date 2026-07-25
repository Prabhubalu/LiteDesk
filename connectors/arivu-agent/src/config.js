'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const AGENT_VERSION = '0.2.0';

/**
 * ProgramData on Windows; fallback to ~/.arivu/connector elsewhere.
 */
function defaultDataDir() {
  if (process.platform === 'win32') {
    const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
    return path.join(programData, 'Arivu', 'Connector');
  }
  return path.join(os.homedir(), '.arivu', 'connector');
}

function defaultConfigPath() {
  return path.join(defaultDataDir(), 'config.json');
}

const DEFAULTS = {
  apiBase: process.env.ARIVU_API_BASE || 'https://api.arivusystems.com',
  agentToken: process.env.ARIVU_AGENT_TOKEN || null,
  connectionId: process.env.ARIVU_CONNECTION_ID || null,
  agentDeviceId: process.env.ARIVU_AGENT_DEVICE_ID || null,
  organizationId: process.env.ARIVU_ORGANIZATION_ID || null,
  tallyHost: '127.0.0.1',
  tallyPortMin: 9000,
  tallyPortMax: 9010,
  tallyPort: null,
  heartbeatIntervalMs: 30_000,
  pollIntervalMs: 5_000,
  updateCheckIntervalMs: 6 * 60 * 60 * 1000,
  queueFlushIntervalMs: 10_000,
  dataDir: defaultDataDir(),
};

function loadConfig(configPath = process.env.ARIVU_CONFIG_PATH || defaultConfigPath()) {
  let fileConfig = {};
  try {
    if (fs.existsSync(configPath)) {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.warn('[config] failed to read config:', err.message);
  }

  const merged = {
    ...DEFAULTS,
    ...fileConfig,
    dataDir: fileConfig.dataDir || DEFAULTS.dataDir,
    configPath,
  };

  if (!merged.agentDeviceId) {
    merged.agentDeviceId = `arivu-${os.hostname()}-${os.platform()}`;
  }

  return merged;
}

function ensureDataDir(cfg) {
  const dir = cfg.dataDir || defaultDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'queue'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
  return dir;
}

function writeConfigTemplate(targetPath = defaultConfigPath()) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const template = {
    apiBase: 'https://api.arivusystems.com',
    agentToken: null,
    connectionId: null,
    agentDeviceId: null,
    organizationId: null,
    tallyHost: '127.0.0.1',
    tallyPortMin: 9000,
    tallyPortMax: 9010,
    tallyPort: null,
    heartbeatIntervalMs: 30000,
    pollIntervalMs: 5000,
    updateCheckIntervalMs: 21600000,
  };
  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
  }
  return targetPath;
}

function saveConfig(cfg, configPath = cfg.configPath || defaultConfigPath()) {
  const { configPath: _cp, ...rest } = cfg;
  ensureDataDir(cfg);
  fs.writeFileSync(configPath, `${JSON.stringify(rest, null, 2)}\n`, 'utf8');
  return configPath;
}

module.exports = {
  AGENT_VERSION,
  DEFAULTS,
  defaultDataDir,
  defaultConfigPath,
  loadConfig,
  ensureDataDir,
  writeConfigTemplate,
  saveConfig,
};
