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
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');

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
itemGroupRouter.use(requireAddonEntitlement(ADDON_KEYS.CPQ));

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
    const data = await cpqService.previewItemGroupVariants({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data });
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
    const { configuration, selections, configurationId } = req.body || {};
    if (configurationId) {
      const data = await cpqService.validateProductConfigurationById({
        organizationId: req.user.organizationId,
        id: configurationId,
        selections: selections || {},
        requireActive: false
      });
      return res.json({ success: true, data });
    }
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

/** Product Configuration CRUD + live validate (CPQ) */
const productConfigurationRouter = express.Router();
productConfigurationRouter.use(protect);
productConfigurationRouter.use(resolveAppContext);
productConfigurationRouter.use(requireAppEntitlement);
productConfigurationRouter.use(lazySalesInitialization);
productConfigurationRouter.use(requireSalesApp);
productConfigurationRouter.use(organizationIsolation);
productConfigurationRouter.use(checkTrialStatus);
productConfigurationRouter.use(checkFeatureAccess('items'));
productConfigurationRouter.use(requireAddonEntitlement(ADDON_KEYS.CPQ));

productConfigurationRouter.get('/', checkPermission('items', 'view'), async (req, res) => {
  try {
    const data = await cpqService.listProductConfigurations({
      organizationId: req.user.organizationId,
      itemGroupId: req.query.itemGroupId || undefined,
      status: req.query.status || undefined
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

productConfigurationRouter.post('/', checkPermission('items', 'create'), async (req, res) => {
  try {
    const data = await cpqService.createProductConfiguration({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

productConfigurationRouter.post('/validate', checkPermission('items', 'view'), async (req, res) => {
  try {
    const { configuration, configurationId, selections, requireActive } = req.body || {};
    if (configurationId) {
      const data = await cpqService.validateProductConfigurationById({
        organizationId: req.user.organizationId,
        id: configurationId,
        selections: selections || {},
        requireActive: requireActive !== false
      });
      return res.json({ success: true, data });
    }
    const data = cpqService.validateConfiguration(configuration || {}, selections || {});
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

productConfigurationRouter.get('/:id', checkPermission('items', 'view'), async (req, res) => {
  try {
    const data = await cpqService.getProductConfiguration({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

productConfigurationRouter.put('/:id', checkPermission('items', 'edit'), async (req, res) => {
  try {
    const body = req.body || {};
    const data = await cpqService.updateProductConfiguration({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: body,
      changeNote: body.changeNote || null
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

productConfigurationRouter.patch('/:id/status', checkPermission('items', 'edit'), async (req, res) => {
  try {
    const data = await cpqService.setProductConfigurationStatus({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      status: req.body?.status
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

productConfigurationRouter.delete('/:id', checkPermission('items', 'delete'), async (req, res) => {
  try {
    const data = await cpqService.deleteProductConfiguration({
      organizationId: req.user.organizationId,
      id: req.params.id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

const pricingController = require('../controllers/pricingController');

const pricingRouter = express.Router();
pricingRouter.use(protect);
pricingRouter.use(resolveAppContext);
pricingRouter.use(requireAppEntitlement);
pricingRouter.use(lazySalesInitialization);
pricingRouter.use(requireSalesApp);
pricingRouter.use(organizationIsolation);
pricingRouter.use(checkTrialStatus);
pricingRouter.use(checkFeatureAccess('items'));
pricingRouter.use(requireAddonEntitlement(ADDON_KEYS.CPQ));

pricingRouter.get('/meta', checkPermission('items', 'view'), pricingController.getPricingMeta);
pricingRouter.post('/resolve', checkPermission('items', 'view'), pricingController.resolvePrice);

pricingRouter.get('/rules', checkPermission('items', 'view'), pricingController.listRules);
pricingRouter.post('/rules', checkPermission('items', 'edit'), pricingController.createRule);
pricingRouter.put('/rules/:id', checkPermission('items', 'edit'), pricingController.updateRule);
pricingRouter.delete('/rules/:id', checkPermission('items', 'delete'), pricingController.deleteRule);

pricingRouter.get('/promotions', checkPermission('items', 'view'), pricingController.listPromotions);
pricingRouter.post('/promotions', checkPermission('items', 'edit'), pricingController.createPromotion);
pricingRouter.put('/promotions/:id', checkPermission('items', 'edit'), pricingController.updatePromotion);
pricingRouter.delete('/promotions/:id', checkPermission('items', 'delete'), pricingController.deletePromotion);

const stockroomAddonRouter = express.Router();
stockroomAddonRouter.use(protect);
stockroomAddonRouter.use(resolveAppContext);
stockroomAddonRouter.use(requireAppEntitlement);
stockroomAddonRouter.use(requireInventoryApp);
stockroomAddonRouter.use(organizationIsolation);
stockroomAddonRouter.use(checkTrialStatus);
stockroomAddonRouter.use(requireAddonEntitlement(ADDON_KEYS.STOCKROOM));

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

module.exports = {
  itemGroupRouter,
  productConfigurationRouter,
  pricingRouter,
  stockroomAddonRouter,
};
