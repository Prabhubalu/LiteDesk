'use strict';

const { buildOperationalMetricsPatch } = require('./liveChatSessionOperationalService');
const { buildIntelligencePatchForSessionClose } = require('./liveChatSessionIntelligenceService');

async function buildSessionCloseFieldPatches({ organizationId, sessionId, session }) {
  const [operationalPatch, intelligencePatch] = await Promise.all([
    buildOperationalMetricsPatch(sessionId, session),
    buildIntelligencePatchForSessionClose({ organizationId, sessionId, session }),
  ]);

  return {
    ...operationalPatch,
    ...intelligencePatch,
  };
}

module.exports = {
  buildSessionCloseFieldPatches,
};
