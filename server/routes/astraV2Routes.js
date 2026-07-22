'use strict';

const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { aiLimiter } = require('../middleware/rateLimitMiddleware');
const { requireAiSuiteEntitlement } = require('../middleware/requireAiSuiteEntitlementMiddleware');
const {
  requireAstraV2Enabled,
  requireAstraV2Access,
} = require('../middleware/requireAstraV2AccessMiddleware');
const controller = require('../controllers/astraV2Controller');

router.use(protect);
router.use(resolveAppContext);
router.use(organizationIsolation);
router.use(requireAstraV2Enabled);

// Read surface
router.get('/status', requireAstraV2Access('view'), controller.getStatus);
router.get('/tools', requireAstraV2Access('view'), controller.listTools);
router.get('/agents', requireAstraV2Access('view'), controller.listAgents);
router.get('/next-best-actions', requireAstraV2Access('use'), controller.getNextBestActions);
router.get('/memory', requireAstraV2Access('use'), controller.getMemory);
router.put('/memory', requireAstraV2Access('use'), controller.putMemory);

router.get('/goals', requireAstraV2Access('view'), controller.listGoals);
router.post('/goals', requireAstraV2Access('use'), controller.createGoal);
router.put('/goals/:goalId', requireAstraV2Access('use'), controller.updateGoal);

router.get('/conversations', requireAstraV2Access('use'), controller.listConversations);
router.delete('/conversations', requireAstraV2Access('use'), controller.deleteAllConversations);
router.get('/conversations/:conversationId', requireAstraV2Access('use'), controller.getConversation);
router.patch('/conversations/:conversationId', requireAstraV2Access('use'), controller.renameConversation);
router.delete('/conversations/:conversationId', requireAstraV2Access('use'), controller.deleteConversation);

// Turn surface (rate-limited + entitlement-gated, matching legacy AI)
router.post(
  '/ask',
  aiLimiter,
  requireAstraV2Access('use'),
  requireAiSuiteEntitlement(),
  controller.ask,
);
router.post(
  '/actions/confirm',
  aiLimiter,
  requireAstraV2Access('use'),
  requireAiSuiteEntitlement(),
  controller.confirmAction,
);
router.get(
  '/ask/stream',
  aiLimiter,
  requireAstraV2Access('use'),
  requireAiSuiteEntitlement(),
  controller.askStream,
);

module.exports = router;
