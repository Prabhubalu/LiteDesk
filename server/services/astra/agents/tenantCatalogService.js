'use strict';

/**
 * Tenant-owned Astra agent + tool catalog.
 * Platform builtins seed into the org DB; edits persist; revert restores live defaults.
 */

const AstraTenantAgent = require('../../../models/AstraTenantAgent');
const AstraTenantToolConfig = require('../../../models/AstraTenantToolConfig');
const { BUILTIN_AGENTS, SEED_BUILTIN_AGENTS } = require('./builtinAgents');
const bootstrap = require('../bootstrap');
const toolRegistry = require('../tools/toolRegistry');

const ASTRA_CATALOG_VERSION = 1;

function normalizeOrgId(organizationId) {
  if (!organizationId) return null;
  return organizationId;
}

function slugifyKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function arraysEqual(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function builtinByName(name) {
  return BUILTIN_AGENTS.find((a) => a.name === name) || null;
}

function platformToolByName(name) {
  bootstrap.ensureBootstrapped();
  return toolRegistry.getTool(name);
}

function agentDocToApi(doc, toolsByName) {
  const tools = Array.isArray(doc.toolAllowlist) ? doc.toolAllowlist : [];
  return {
    name: doc.key,
    key: doc.key,
    defaultKey: doc.defaultKey || null,
    title: doc.title,
    description: doc.description || '',
    autonomy: doc.autonomy || 'assist',
    systemHint: doc.systemHint || '',
    tools,
    toolDetails: tools.map((toolName) => {
      const tool = toolsByName.get(toolName);
      if (!tool) {
        return {
          name: toolName,
          family: 'unknown',
          risk: 'read',
          description: '',
          missing: true,
        };
      }
      return {
        name: tool.name,
        family: tool.family,
        risk: tool.risk,
        description: tool.description,
        enabled: tool.enabled !== false,
        title: tool.title || tool.name,
        isCustomized: Boolean(tool.isCustomized),
      };
    }),
    enabled: doc.enabled !== false,
    isCustomized: Boolean(doc.isCustomized),
    canRevert: Boolean(doc.defaultKey),
    catalogVersion: doc.catalogVersion || ASTRA_CATALOG_VERSION,
    updatedAt: doc.updatedAt || null,
  };
}

function toolDocToApi(doc, platform) {
  return {
    name: doc.toolName,
    toolName: doc.toolName,
    defaultToolName: doc.defaultToolName || doc.toolName,
    title: doc.title || platform?.name || doc.toolName,
    family: platform?.family || 'misc',
    risk: platform?.risk || 'read',
    description: doc.description || platform?.description || '',
    enabled: doc.enabled !== false,
    isCustomized: Boolean(doc.isCustomized),
    canRevert: Boolean(doc.defaultToolName || platform),
    catalogVersion: doc.catalogVersion || ASTRA_CATALOG_VERSION,
    updatedAt: doc.updatedAt || null,
  };
}

/**
 * Seed missing platform agents/tools into the tenant DB (never overwrite customized rows).
 */
async function ensureTenantAstraCatalog(organizationId) {
  const orgId = normalizeOrgId(organizationId);
  if (!orgId) {
    const err = new Error('organizationId is required');
    err.statusCode = 400;
    err.code = 'ASTRA_ORG_REQUIRED';
    throw err;
  }

  bootstrap.ensureBootstrapped();

  const [existingAgents, existingTools] = await Promise.all([
    AstraTenantAgent.find({ organizationId: orgId }).select('key').lean(),
    AstraTenantToolConfig.find({ organizationId: orgId }).select('toolName').lean(),
  ]);

  const agentKeys = new Set(existingAgents.map((a) => a.key));
  const toolNames = new Set(existingTools.map((t) => t.toolName));

  const agentInserts = [];
  for (const builtin of SEED_BUILTIN_AGENTS) {
    if (agentKeys.has(builtin.name)) continue;
    agentInserts.push({
      organizationId: orgId,
      key: builtin.name,
      defaultKey: builtin.name,
      title: builtin.title || builtin.name,
      description: builtin.description || '',
      systemHint: builtin.systemHint || '',
      autonomy: builtin.autonomy || 'assist',
      toolAllowlist: Array.isArray(builtin.tools) ? [...builtin.tools] : [],
      enabled: true,
      catalogVersion: ASTRA_CATALOG_VERSION,
      isCustomized: false,
      source: 'builtin',
    });
  }

  // Disable legacy seeded zoo (non-customized platform seats except coworker)
  const seedKeys = new Set(SEED_BUILTIN_AGENTS.map((a) => a.name));
  await AstraTenantAgent.updateMany(
    {
      organizationId: orgId,
      defaultKey: { $ne: null },
      isCustomized: false,
      key: { $nin: [...seedKeys] },
      enabled: true,
    },
    { $set: { enabled: false } },
  );

  const platformTools = toolRegistry.listTools();
  const toolInserts = [];
  for (const tool of platformTools) {
    if (toolNames.has(tool.name)) continue;
    toolInserts.push({
      organizationId: orgId,
      toolName: tool.name,
      defaultToolName: tool.name,
      title: tool.name,
      description: tool.description || '',
      enabled: true,
      catalogVersion: ASTRA_CATALOG_VERSION,
      isCustomized: false,
    });
  }

  if (agentInserts.length) {
    try {
      await AstraTenantAgent.insertMany(agentInserts, { ordered: false });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  if (toolInserts.length) {
    try {
      await AstraTenantToolConfig.insertMany(toolInserts, { ordered: false });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  return {
    seededAgents: agentInserts.length,
    seededTools: toolInserts.length,
  };
}

async function buildToolsByNameMap(organizationId) {
  bootstrap.ensureBootstrapped();
  const orgId = normalizeOrgId(organizationId);
  const platform = toolRegistry.listTools();
  const platformByName = new Map(platform.map((t) => [t.name, t]));
  const docs = orgId
    ? await AstraTenantToolConfig.find({ organizationId: orgId }).lean()
    : [];
  const byName = new Map();
  for (const p of platform) {
    byName.set(p.name, {
      name: p.name,
      family: p.family,
      risk: p.risk,
      description: p.description,
      title: p.name,
      enabled: true,
      isCustomized: false,
    });
  }
  for (const doc of docs) {
    const base = platformByName.get(doc.toolName) || {
      name: doc.toolName,
      family: 'misc',
      risk: 'read',
      description: '',
    };
    byName.set(doc.toolName, {
      name: doc.toolName,
      family: base.family,
      risk: base.risk,
      description: doc.description || base.description || '',
      title: doc.title || doc.toolName,
      enabled: doc.enabled !== false,
      isCustomized: Boolean(doc.isCustomized),
    });
  }
  return byName;
}

async function listAgentsForOrg(organizationId) {
  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  const [docs, toolsByName] = await Promise.all([
    AstraTenantAgent.find({ organizationId: orgId }).sort({ title: 1 }).lean(),
    buildToolsByNameMap(orgId),
  ]);
  const visible = docs.filter((doc) => {
    if (doc.key === 'coworker') return true;
    if (doc.isCustomized || doc.source === 'master' || doc.source === 'runtime' || doc.source === 'custom') {
      return true;
    }
    // Hide legacy seeded zoo from Settings
    if (doc.defaultKey && doc.defaultKey !== 'coworker') return false;
    return doc.enabled !== false;
  });
  return visible.map((doc) => agentDocToApi(doc, toolsByName));
}

async function getAgentForOrg(organizationId, key) {
  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  const doc = await AstraTenantAgent.findOne({
    organizationId: orgId,
    key: String(key || '').trim(),
  }).lean();
  if (!doc) return null;
  const toolsByName = await buildToolsByNameMap(orgId);
  return agentDocToApi(doc, toolsByName);
}

async function listToolsForOrg(organizationId) {
  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  bootstrap.ensureBootstrapped();
  const platformByName = new Map(toolRegistry.listTools().map((t) => [t.name, t]));
  const docs = await AstraTenantToolConfig.find({ organizationId: orgId })
    .sort({ toolName: 1 })
    .lean();
  return docs.map((doc) => toolDocToApi(doc, platformByName.get(doc.toolName)));
}

function fieldsDifferFromBuiltin(doc, builtin) {
  if (!builtin) return true;
  if (doc.title !== (builtin.title || builtin.name)) return true;
  if ((doc.description || '') !== (builtin.description || '')) return true;
  if ((doc.systemHint || '') !== (builtin.systemHint || '')) return true;
  if ((doc.autonomy || 'assist') !== (builtin.autonomy || 'assist')) return true;
  if (doc.enabled === false) return true;
  if (!arraysEqual(doc.toolAllowlist, builtin.tools || [])) return true;
  return false;
}

async function updateAgentForOrg(organizationId, key, patch, userId = null) {
  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  const agentKey = String(key || '').trim();
  const doc = await AstraTenantAgent.findOne({ organizationId: orgId, key: agentKey });
  if (!doc) {
    const err = new Error(`Agent not found: ${agentKey}`);
    err.statusCode = 404;
    err.code = 'ASTRA_AGENT_NOT_FOUND';
    throw err;
  }

  const before = doc.toObject();
  if (patch.title !== undefined) doc.title = String(patch.title).trim().slice(0, 120) || doc.key;
  if (patch.description !== undefined) {
    doc.description = String(patch.description || '').trim().slice(0, 500);
  }
  if (patch.systemHint !== undefined) {
    doc.systemHint = String(patch.systemHint || '').trim().slice(0, 8000);
  }
  if (patch.autonomy !== undefined) {
    doc.autonomy = patch.autonomy === 'confirm' ? 'confirm' : 'assist';
  }
  if (patch.enabled !== undefined) doc.enabled = Boolean(patch.enabled);
  if (patch.tools !== undefined || patch.toolAllowlist !== undefined) {
    const list = patch.tools !== undefined ? patch.tools : patch.toolAllowlist;
    doc.toolAllowlist = Array.isArray(list)
      ? [...new Set(list.map((t) => String(t).trim()).filter(Boolean))]
      : [];
  }
  doc.updatedBy = userId || null;

  if (doc.defaultKey) {
    const builtin = builtinByName(doc.defaultKey);
    doc.isCustomized = fieldsDifferFromBuiltin(doc, builtin);
  } else {
    doc.isCustomized = true;
  }

  await doc.save();
  const toolsByName = await buildToolsByNameMap(orgId);
  return {
    before,
    agent: agentDocToApi(doc.toObject(), toolsByName),
  };
}

async function createAgentForOrg(organizationId, body, userId = null) {
  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  const title = String(body?.title || body?.name || '').trim().slice(0, 120);
  if (!title) {
    const err = new Error('title is required');
    err.statusCode = 400;
    err.code = 'ASTRA_AGENT_TITLE_REQUIRED';
    throw err;
  }

  let key = slugifyKey(body?.key || body?.name || title);
  if (!key) key = `agent-${Date.now().toString(36)}`;

  const templateKey = body?.templateKey ? String(body.templateKey).trim() : '';
  let template = templateKey ? await AstraTenantAgent.findOne({ organizationId: orgId, key: templateKey }).lean() : null;
  if (!template && templateKey) {
    const builtin = builtinByName(templateKey);
    if (builtin) {
      template = {
        description: builtin.description,
        systemHint: builtin.systemHint,
        autonomy: builtin.autonomy,
        toolAllowlist: builtin.tools,
      };
    }
  }

  const existing = await AstraTenantAgent.findOne({ organizationId: orgId, key }).lean();
  if (existing) {
    const err = new Error(`Agent key already exists: ${key}`);
    err.statusCode = 409;
    err.code = 'ASTRA_AGENT_KEY_EXISTS';
    throw err;
  }

  const tools = Array.isArray(body?.tools || body?.toolAllowlist)
    ? [...new Set((body.tools || body.toolAllowlist).map((t) => String(t).trim()).filter(Boolean))]
    : Array.isArray(template?.toolAllowlist)
      ? [...template.toolAllowlist]
      : ['search.crm'];

  const doc = await AstraTenantAgent.create({
    organizationId: orgId,
    key,
    defaultKey: null,
    title,
    description: String(body?.description ?? template?.description ?? '').trim().slice(0, 500),
    systemHint: String(body?.systemHint ?? template?.systemHint ?? '').trim().slice(0, 8000),
    autonomy: body?.autonomy === 'confirm' || template?.autonomy === 'confirm' ? 'confirm' : 'assist',
    toolAllowlist: tools,
    enabled: body?.enabled !== false,
    catalogVersion: ASTRA_CATALOG_VERSION,
    isCustomized: true,
    createdBy: userId || null,
    updatedBy: userId || null,
  });

  const toolsByName = await buildToolsByNameMap(orgId);
  return agentDocToApi(doc.toObject(), toolsByName);
}

async function deleteAgentForOrg(organizationId, key) {
  const orgId = normalizeOrgId(organizationId);
  const agentKey = String(key || '').trim();
  const doc = await AstraTenantAgent.findOne({ organizationId: orgId, key: agentKey });
  if (!doc) {
    const err = new Error(`Agent not found: ${agentKey}`);
    err.statusCode = 404;
    err.code = 'ASTRA_AGENT_NOT_FOUND';
    throw err;
  }
  if (doc.defaultKey) {
    const err = new Error('Seeded agents cannot be deleted; disable or revert instead');
    err.statusCode = 400;
    err.code = 'ASTRA_AGENT_SEEDED_NO_DELETE';
    throw err;
  }
  const before = doc.toObject();
  await doc.deleteOne();
  return before;
}

async function revertAgentForOrg(organizationId, key, userId = null) {
  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  const agentKey = String(key || '').trim();
  const doc = await AstraTenantAgent.findOne({ organizationId: orgId, key: agentKey });
  if (!doc) {
    const err = new Error(`Agent not found: ${agentKey}`);
    err.statusCode = 404;
    err.code = 'ASTRA_AGENT_NOT_FOUND';
    throw err;
  }
  if (!doc.defaultKey) {
    const err = new Error('Custom agents have no platform default; delete instead');
    err.statusCode = 400;
    err.code = 'ASTRA_AGENT_NO_DEFAULT';
    throw err;
  }
  const builtin = builtinByName(doc.defaultKey);
  if (!builtin) {
    const err = new Error(`Platform default missing for ${doc.defaultKey}`);
    err.statusCode = 404;
    err.code = 'ASTRA_BUILTIN_MISSING';
    throw err;
  }
  const before = doc.toObject();
  doc.title = builtin.title || builtin.name;
  doc.description = builtin.description || '';
  doc.systemHint = builtin.systemHint || '';
  doc.autonomy = builtin.autonomy || 'assist';
  doc.toolAllowlist = Array.isArray(builtin.tools) ? [...builtin.tools] : [];
  doc.enabled = true;
  doc.isCustomized = false;
  doc.catalogVersion = ASTRA_CATALOG_VERSION;
  doc.updatedBy = userId || null;
  await doc.save();
  const toolsByName = await buildToolsByNameMap(orgId);
  return {
    before,
    agent: agentDocToApi(doc.toObject(), toolsByName),
  };
}

async function updateToolForOrg(organizationId, toolName, patch, userId = null) {
  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  const name = String(toolName || '').trim();
  const doc = await AstraTenantToolConfig.findOne({ organizationId: orgId, toolName: name });
  if (!doc) {
    const err = new Error(`Tool not found: ${name}`);
    err.statusCode = 404;
    err.code = 'ASTRA_TOOL_NOT_FOUND';
    throw err;
  }
  const before = doc.toObject();
  const platform = platformToolByName(name);
  if (patch.title !== undefined) doc.title = String(patch.title || '').trim().slice(0, 160);
  if (patch.description !== undefined) {
    doc.description = String(patch.description || '').trim().slice(0, 1000);
  }
  if (patch.enabled !== undefined) doc.enabled = Boolean(patch.enabled);
  doc.updatedBy = userId || null;

  const defaultTitle = name;
  const defaultDesc = platform?.description || '';
  doc.isCustomized = !(
    (doc.title || defaultTitle) === defaultTitle
    && (doc.description || '') === defaultDesc
    && doc.enabled !== false
  );

  await doc.save();
  return {
    before,
    tool: toolDocToApi(doc.toObject(), platform),
  };
}

async function revertToolForOrg(organizationId, toolName, userId = null) {
  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  const name = String(toolName || '').trim();
  const doc = await AstraTenantToolConfig.findOne({ organizationId: orgId, toolName: name });
  if (!doc) {
    const err = new Error(`Tool not found: ${name}`);
    err.statusCode = 404;
    err.code = 'ASTRA_TOOL_NOT_FOUND';
    throw err;
  }
  const platform = platformToolByName(name);
  if (!platform) {
    const err = new Error(`Platform tool missing: ${name}`);
    err.statusCode = 404;
    err.code = 'ASTRA_PLATFORM_TOOL_MISSING';
    throw err;
  }
  const before = doc.toObject();
  doc.title = name;
  doc.description = platform.description || '';
  doc.enabled = true;
  doc.isCustomized = false;
  doc.defaultToolName = name;
  doc.catalogVersion = ASTRA_CATALOG_VERSION;
  doc.updatedBy = userId || null;
  await doc.save();
  return {
    before,
    tool: toolDocToApi(doc.toObject(), platform),
  };
}

/**
 * In-memory agent registry view for orchestrator (enabled seats only).
 * Filters allow-list against tenant-disabled tools.
 */
async function resolveAgentRegistryForOrg(organizationId) {
  if (!organizationId) {
    bootstrap.ensureBootstrapped();
    const agentRegistry = require('./agentRegistry');
    return agentRegistry;
  }

  await ensureTenantAstraCatalog(organizationId);
  const orgId = normalizeOrgId(organizationId);
  const [docs, toolsByName] = await Promise.all([
    AstraTenantAgent.find({ organizationId: orgId, enabled: true }).lean(),
    buildToolsByNameMap(orgId),
  ]);

  /** @type {Map<string, object>} */
  const map = new Map();
  for (const doc of docs) {
    const allow = (Array.isArray(doc.toolAllowlist) ? doc.toolAllowlist : []).filter((name) => {
      const tool = toolsByName.get(name);
      return !tool || tool.enabled !== false;
    });
    map.set(doc.key, {
      name: doc.key,
      title: doc.title || doc.key,
      description: doc.description || '',
      tools: allow,
      systemHint: [
        doc.basePrompt || doc.systemHint || '',
        doc.learnedProfile && Object.keys(doc.learnedProfile).length
          ? `LearnedProfile: ${JSON.stringify(doc.learnedProfile).slice(0, 800)}`
          : '',
      ].filter(Boolean).join('\n'),
      autonomy: doc.autonomy || 'assist',
      triggerPhrases: doc.triggerPhrases || [],
      toolRecipes: doc.toolRecipes || [],
      learnedProfile: doc.learnedProfile || {},
    });
  }

  // Ephemeral Astra if no agents
  if (!map.size) {
    const coworker = builtinByName('coworker');
    if (coworker) {
      map.set('coworker', {
        name: 'coworker',
        title: coworker.title,
        description: coworker.description,
        tools: coworker.tools || [],
        systemHint: coworker.systemHint || '',
        autonomy: 'assist',
      });
    }
  }

  return {
    getAgent(name) {
      return map.get(name) || null;
    },
    hasAgent(name) {
      return map.has(name);
    },
    listAgents() {
      return Array.from(map.values());
    },
  };
}

async function isToolEnabledForOrg(organizationId, toolName) {
  if (!organizationId) return true;
  await ensureTenantAstraCatalog(organizationId);
  const doc = await AstraTenantToolConfig.findOne({
    organizationId: normalizeOrgId(organizationId),
    toolName: String(toolName || '').trim(),
  })
    .select('enabled')
    .lean();
  if (!doc) return true;
  return doc.enabled !== false;
}

module.exports = {
  ASTRA_CATALOG_VERSION,
  ensureTenantAstraCatalog,
  listAgentsForOrg,
  getAgentForOrg,
  listToolsForOrg,
  updateAgentForOrg,
  createAgentForOrg,
  deleteAgentForOrg,
  revertAgentForOrg,
  updateToolForOrg,
  revertToolForOrg,
  resolveAgentRegistryForOrg,
  isToolEnabledForOrg,
  slugifyKey,
};
