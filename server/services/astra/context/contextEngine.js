'use strict';

/**
 * contextEngine — assembles a ContextPacket by hydrating request inputs with
 * personal + org memory. Memory loads are best-effort: a memory outage must
 * never block an answer.
 */

const { buildContextPacket } = require('./contextPacket');
const personalMemoryService = require('../memory/personalMemoryService');
const orgMemoryService = require('../memory/orgMemoryService');

/**
 * @param {Object} request  loosely-typed request (see buildContextPacket).
 * @param {Object} [deps]   injectable services for tests.
 * @returns {Promise<import('./contextPacket').ContextPacket>}
 */
async function assembleContext(request = {}, deps = {}) {
  const personalSvc = deps.personalMemoryService || personalMemoryService;
  const orgSvc = deps.orgMemoryService || orgMemoryService;

  let personal = request.memory?.personal || {};
  let org = request.memory?.org || [];

  if (request.organizationId && !deps.skipMemory) {
    try {
      if (request.userId && personalSvc?.getPersonalMemory) {
        personal = await personalSvc.getPersonalMemory({
          organizationId: request.organizationId,
          userId: request.userId,
        });
      }
      if (orgSvc?.listOrgMemory) {
        org = await orgSvc.listOrgMemory({
          organizationId: request.organizationId,
          scope: 'grounding',
        });
      }
    } catch (error) {
      console.error('[astra.contextEngine] memory hydration failed:', error.message);
    }
  }

  return buildContextPacket({
    ...request,
    memory: { personal: personal || {}, org: org || [] },
  });
}

module.exports = { assembleContext };
