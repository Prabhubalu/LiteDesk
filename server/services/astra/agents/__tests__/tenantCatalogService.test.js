'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const tenantCatalog = require('../tenantCatalogService');
const AstraTenantAgent = require('../../../../models/AstraTenantAgent');
const AstraTenantToolConfig = require('../../../../models/AstraTenantToolConfig');
const { BUILTIN_AGENTS, SEED_BUILTIN_AGENTS } = require('../builtinAgents');

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI || '';

describe('tenantCatalogService', { skip: !MONGO }, () => {
  const orgId = new mongoose.Types.ObjectId();

  before(async () => {
    await mongoose.connect(MONGO);
    await AstraTenantAgent.deleteMany({ organizationId: orgId });
    await AstraTenantToolConfig.deleteMany({ organizationId: orgId });
  });

  after(async () => {
    await AstraTenantAgent.deleteMany({ organizationId: orgId });
    await AstraTenantToolConfig.deleteMany({ organizationId: orgId });
    await mongoose.disconnect();
  });

  it('seeds coworker only and does not overwrite customized rows', async () => {
    const first = await tenantCatalog.ensureTenantAstraCatalog(orgId);
    assert.ok(first.seededAgents >= SEED_BUILTIN_AGENTS.length);
    assert.ok(first.seededTools > 0);

    const agents = await tenantCatalog.listAgentsForOrg(orgId);
    assert.ok(agents.length >= SEED_BUILTIN_AGENTS.length);
    assert.ok(agents.length < BUILTIN_AGENTS.length);
    const coworker = agents.find((a) => a.key === 'coworker');
    assert.ok(coworker);
    assert.equal(coworker.isCustomized, false);

    await tenantCatalog.updateAgentForOrg(orgId, 'coworker', {
      systemHint: 'Custom hint for tests',
    });
    const customized = await tenantCatalog.getAgentForOrg(orgId, 'coworker');
    assert.equal(customized.isCustomized, true);
    assert.match(customized.systemHint, /Custom hint/);

    const second = await tenantCatalog.ensureTenantAstraCatalog(orgId);
    assert.equal(second.seededAgents, 0);
    const still = await tenantCatalog.getAgentForOrg(orgId, 'coworker');
    assert.match(still.systemHint, /Custom hint/);

    const reverted = await tenantCatalog.revertAgentForOrg(orgId, 'coworker');
    assert.equal(reverted.agent.isCustomized, false);
    assert.ok(reverted.agent.systemHint.length > 0);
  });

  it('creates custom agent and resolves registry', async () => {
    const created = await tenantCatalog.createAgentForOrg(orgId, {
      title: 'My Test Seat',
      description: 'Custom',
      tools: ['search.crm'],
      templateKey: 'coworker',
    });
    assert.equal(created.defaultKey, null);
    assert.equal(created.canRevert, false);
    assert.ok(created.key);

    const registry = await tenantCatalog.resolveAgentRegistryForOrg(orgId);
    assert.ok(registry.hasAgent(created.key));
    assert.ok(registry.hasAgent('coworker'));
    assert.deepEqual(registry.getAgent(created.key).tools, ['search.crm']);

    await tenantCatalog.deleteAgentForOrg(orgId, created.key);
    assert.equal(await tenantCatalog.getAgentForOrg(orgId, created.key), null);
  });
});
