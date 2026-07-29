'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const AGENT_VERSION = '0.3.1';

/**
 * Prefer LocalAppData (user-writable, no admin). Fall back to ProgramData only
 * when explicitly requested or when an existing ProgramData install is present
 * and LocalAppData has no config yet (migration).
 */
function programDataDir() {
  if (process.platform === 'win32') {
    const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
    return path.join(programData, 'Arivu', 'Connector');
  }
  return path.join(os.homedir(), '.arivu', 'connector');
}

function localAppDataDir() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, 'Arivu', 'Connector');
  }
  return path.join(os.homedir(), '.arivu', 'connector');
}

function defaultDataDir() {
  if (process.env.ARIVU_DATA_DIR) return process.env.ARIVU_DATA_DIR;
  // Session-0 Windows service may still use ProgramData
  if (String(process.env.ARIVU_USE_PROGRAMDATA || '').trim() === '1') {
    return programDataDir();
  }
  const local = localAppDataDir();
  const program = programDataDir();
  try {
    const localCfg = path.join(local, 'config.json');
    const programCfg = path.join(program, 'config.json');
    if (fs.existsSync(localCfg)) return local;
    if (fs.existsSync(programCfg) && !fs.existsSync(localCfg)) {
      // Migrate once: copy config into LocalAppData so daily use needs no admin
      try {
        fs.mkdirSync(local, { recursive: true });
        fs.copyFileSync(programCfg, localCfg);
        return local;
      } catch (_) {
        return program;
      }
    }
  } catch (_) {
    /* prefer local */
  }
  return local;
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
  /** Heartbeat to cloud */
  heartbeatIntervalMs: 30_000,
  /** Job poll */
  pollIntervalMs: 5_000,
  /** When Tally is offline, re-probe this often (user opens Tally later) */
  tallyOfflineDiscoverMs: 15_000,
  /** When Tally is online, full re-probe this often */
  tallyOnlineDiscoverMs: 60_000,
  updateCheckIntervalMs: 6 * 60 * 60 * 1000,
  queueFlushIntervalMs: 10_000,
  dataDir: null,
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

  const dataDir = fileConfig.dataDir || defaultDataDir();
  const merged = {
    ...DEFAULTS,
    ...fileConfig,
    dataDir,
    configPath: configPath || path.join(dataDir, 'config.json'),
  };

  // Env always wins for local LAN / dual-machine debug (file often still has prod).
  if (process.env.ARIVU_API_BASE && String(process.env.ARIVU_API_BASE).trim()) {
    merged.apiBase = String(process.env.ARIVU_API_BASE).trim().replace(/\/$/, '');
  }

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
    tallyOfflineDiscoverMs: 15000,
    tallyOnlineDiscoverMs: 60000,
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
  programDataDir,
  localAppDataDir,
  loadConfig,
  ensureDataDir,
  writeConfigTemplate,
  saveConfig,
};
