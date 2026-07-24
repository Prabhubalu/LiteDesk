'use strict';

/**
 * CapIndex — Master’s only menu of bindable capabilities for an org.
 * = ModuleDefinition entitlements ∪ module registry ∪ listTools ∪ knowledge corpora.
 */

const ModuleDefinition = require('../../../models/ModuleDefinition');
const { listModules, getModule } = require('./moduleCatalog');
const { WRITE_DENYLIST, mutabilityOf } = require('./moduleFabric');
const bootstrap = require('../bootstrap');
const toolRegistry = require('./toolRegistry');

const KNOWLEDGE_CAPABILITIES = [
  {
    id: 'knowledge.search.internal',
    kind: 'action',
    capabilityName: 'knowledge.search',
    audience: 'internal',
    title: 'Search internal knowledge',
    status: 'ready',
    risk: 'read',
  },
  {
    id: 'knowledge.search.public',
    kind: 'action',
    capabilityName: 'knowledge.search',
    audience: 'public',
    title: 'Search public knowledge (customer-facing)',
    status: 'ready',
    risk: 'read',
  },
];

async function loadEntitledModuleKeys(organizationId) {
  if (!organizationId) {
    return new Set(listModules().map((m) => m.moduleKey));
  }
  try {
    const defs = await ModuleDefinition.find({
      $or: [
        { organizationId },
        { organizationId: null },
      ],
      status: { $ne: 'disabled' },
    })
      .select('moduleKey organizationId')
      .lean();
    const keys = new Set();
    for (const d of defs) {
      if (d.moduleKey) keys.add(String(d.moduleKey));
    }
    // Always include commercial modules even if not in ModuleDefinition seed yet
    for (const k of ['invoices', 'payments', 'refunds']) keys.add(k);
    return keys.size ? keys : new Set(listModules().map((m) => m.moduleKey));
  } catch {
    return new Set(listModules().map((m) => m.moduleKey));
  }
}

function virtualModuleCaps(mod, entitled) {
  const moduleKey = mod.moduleKey;
  if (WRITE_DENYLIST.has(moduleKey)) return [];
  if (!entitled.has(moduleKey)) {
    return [{
      id: `${moduleKey}.search`,
      kind: 'module',
      op: 'search',
      moduleKey,
      title: `Search ${mod.label}`,
      status: 'unavailable',
      reason: 'Not entitled for this organization',
      risk: 'read',
    }];
  }

  const mut = mutabilityOf(getModule(moduleKey) || mod);
  let status = 'ready';
  if (mod.support !== 'ready') {
    status = 'unavailable';
  } else if (mut === 'read_only') {
    status = 'read_only';
  }

  const caps = [
    {
      id: `${moduleKey}.search`,
      kind: 'module',
      op: 'search',
      moduleKey,
      title: `Search ${mod.label}`,
      status: status === 'unavailable' ? 'unavailable' : 'ready',
      reason: status === 'unavailable' ? (mod.unavailableReason || 'No model binding') : null,
      risk: 'read',
      bind: { kind: 'module', op: 'search', moduleKey },
    },
    {
      id: `${moduleKey}.get`,
      kind: 'module',
      op: 'get',
      moduleKey,
      title: `Get ${mod.label} record`,
      status: status === 'unavailable' ? 'unavailable' : 'ready',
      reason: status === 'unavailable' ? (mod.unavailableReason || 'No model binding') : null,
      risk: 'read',
      bind: { kind: 'module', op: 'get', moduleKey },
    },
  ];

  if (status === 'ready' && mut === 'write') {
    caps.push(
      {
        id: `${moduleKey}.create`,
        kind: 'module',
        op: 'create',
        moduleKey,
        title: `Create ${mod.label}`,
        status: 'ready',
        risk: 'write',
        bind: { kind: 'module', op: 'create', moduleKey },
      },
      {
        id: `${moduleKey}.update`,
        kind: 'module',
        op: 'update',
        moduleKey,
        title: `Update ${mod.label}`,
        status: 'ready',
        risk: 'write',
        bind: { kind: 'module', op: 'update', moduleKey },
      },
    );
  } else if (status === 'read_only' || mut === 'read_only') {
    // search/get only
  }

  return caps;
}

function domainActionCaps() {
  bootstrap.ensureBootstrapped();
  const tools = toolRegistry.listTools();
  const skip = new Set(['module.search', 'module.get', 'module.create', 'module.update', 'search.crm']);
  return tools
    .filter((t) => !skip.has(t.name))
    .map((t) => ({
      id: t.name,
      kind: 'action',
      capabilityName: t.name,
      title: t.name,
      description: t.description || '',
      status: 'ready',
      risk: t.risk || 'read',
      family: t.family || 'misc',
      bind: { kind: 'action', capabilityName: t.name },
    }));
}

/**
 * @param {string|null} organizationId
 * @param {{ knowledgeSources?: object|null }} [opts]
 */
async function buildCapIndex(organizationId, opts = {}) {
  const entitled = await loadEntitledModuleKeys(organizationId);
  const modules = listModules();
  const moduleCaps = modules.flatMap((m) => virtualModuleCaps(m, entitled));
  const actions = domainActionCaps();

  let knowledge = [...KNOWLEDGE_CAPABILITIES];
  const ks = opts.knowledgeSources;
  if (ks) {
    if (ks.articlesEnabled === false && ks.documentsEnabled === false && ks.websiteEnabled === false) {
      knowledge = knowledge.map((k) => ({ ...k, status: 'unavailable', reason: 'All knowledge sources disabled' }));
    }
  }

  const all = [...moduleCaps, ...actions, ...knowledge];
  const bindable = all.filter((c) => c.status === 'ready' || c.status === 'read_only');

  return {
    organizationId: organizationId || null,
    generatedAt: new Date().toISOString(),
    capabilities: all,
    bindable,
    summary: {
      total: all.length,
      ready: all.filter((c) => c.status === 'ready').length,
      readOnly: all.filter((c) => c.status === 'read_only').length,
      unavailable: all.filter((c) => c.status === 'unavailable').length,
      modules: modules.length,
    },
  };
}

function findCapability(capIndex, idOrName) {
  const key = String(idOrName || '');
  return (capIndex?.capabilities || []).find(
    (c) => c.id === key || c.capabilityName === key || `${c.moduleKey}.${c.op}` === key,
  ) || null;
}

module.exports = {
  buildCapIndex,
  findCapability,
  KNOWLEDGE_CAPABILITIES,
  loadEntitledModuleKeys,
};
