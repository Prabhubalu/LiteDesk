const express = require('express');
const cpqService = require('../services/cpqService');
const { activateStockroomAddon } = require('../services/stockroomAddonService');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireInventoryApp } = require('../middleware/requireInventoryAppMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { checkFeatureAccess } = require('../middleware/organizationMiddleware');

function sendError(res, err) {
  const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
  return res.status(status).json({ success: false, message: err.message, code: err.code || 'UNKNOWN' });
}

const itemGroupRouter = express.Router();
itemGroupRouter.use(protect);
itemGroupRouter.use(resolveAppContext);
itemGroupRouter.use(requireAppEntitlement);
itemGroupRouter.use(lazySalesInitialization);
itemGroupRouter.use(requireSalesApp);
itemGroupRouter.use(organizationIsolation);
itemGroupRouter.use(checkTrialStatus);
itemGroupRouter.use(checkFeatureAccess('items'));

itemGroupRouter.get('/', checkPermission('items', 'view'), async (req, res) => {
  try {
    const data = await cpqService.listItemGroups({ organizationId: req.user.organizationId });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

itemGroupRouter.post('/', checkPermission('items', 'create'), async (req, res) => {
  try {
    const data = await cpqService.createItemGroup({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

itemGroupRouter.get('/:id', checkPermission('items', 'view'), async (req, res) => {
  try {
    const data = await cpqService.getItemGroup({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

itemGroupRouter.put('/:id', checkPermission('items', 'edit'), async (req, res) => {
  try {
    const data = await cpqService.updateItemGroup({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

itemGroupRouter.post('/:id/preview', checkPermission('items', 'view'), async (req, res) => {
  try {
    const group = await cpqService.getItemGroup({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data: cpqService.previewVariants(group) });
  } catch (err) {
    return sendError(res, err);
  }
});

itemGroupRouter.post('/:id/generate', checkPermission('items', 'create'), async (req, res) => {
  try {
    const data = await cpqService.generateVariants({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

itemGroupRouter.post('/configurations/validate', checkPermission('items', 'view'), async (req, res) => {
  try {
    const { configuration, selections } = req.body || {};
    const data = cpqService.validateConfiguration(configuration || {}, selections || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

itemGroupRouter.post('/pricing/calculate', checkPermission('items', 'view'), async (req, res) => {
  try {
    const data = cpqService.calculatePrice(req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

const stockroomAddonRouter = express.Router();
stockroomAddonRouter.use(protect);
stockroomAddonRouter.use(resolveAppContext);
stockroomAddonRouter.use(requireAppEntitlement);
stockroomAddonRouter.use(requireInventoryApp);
stockroomAddonRouter.use(organizationIsolation);
stockroomAddonRouter.use(checkTrialStatus);

stockroomAddonRouter.post('/activate', checkPermission('inventory', 'manageLocations'), async (req, res) => {
  try {
    const data = await activateStockroomAddon({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      primaryName: req.body?.primaryName || null
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = { itemGroupRouter, stockroomAddonRouter };
