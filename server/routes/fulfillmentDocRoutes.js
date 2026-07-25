const express = require('express');
const fulfillmentDocsService = require('../services/fulfillmentDocsService');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireInventoryApp } = require('../middleware/requireInventoryAppMiddleware');

function sendError(res, err) {
  const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
  return res.status(status).json({ success: false, message: err.message, code: err.code || 'UNKNOWN' });
}

function mount(router, handlers) {
  router.use(protect);
  router.use(resolveAppContext);
  router.use(requireAppEntitlement);
  router.use(requireInventoryApp);
  router.use(organizationIsolation);
  router.use(checkTrialStatus);
  for (const h of handlers) {
    router[h.method](h.path, checkPermission('inventory', h.perm || 'view'), h.fn);
  }
  return router;
}

const dnRouter = mount(express.Router(), [
  {
    method: 'get',
    path: '/',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.listDeliveryNotes({
          organizationId: req.user.organizationId,
          salesOrderId: req.query.salesOrderId || null
        });
        return res.json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  },
  {
    method: 'post',
    path: '/',
    perm: 'adjust',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.createDeliveryNote({
          organizationId: req.user.organizationId,
          userId: req.user._id,
          payload: req.body || {}
        });
        return res.status(201).json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  },
  {
    method: 'get',
    path: '/:id',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.getDeliveryNote({
          organizationId: req.user.organizationId,
          id: req.params.id
        });
        return res.json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  },
  {
    method: 'post',
    path: '/:id/confirm',
    perm: 'adjust',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.confirmDeliveryNote({
          organizationId: req.user.organizationId,
          id: req.params.id,
          userId: req.user._id
        });
        return res.json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  }
]);

const drRouter = mount(express.Router(), [
  {
    method: 'get',
    path: '/',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.listDeliveryReturns({
          organizationId: req.user.organizationId
        });
        return res.json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  },
  {
    method: 'post',
    path: '/',
    perm: 'adjust',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.createDeliveryReturn({
          organizationId: req.user.organizationId,
          userId: req.user._id,
          payload: req.body || {}
        });
        return res.status(201).json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  },
  {
    method: 'post',
    path: '/:id/approve',
    perm: 'adjust',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.approveDeliveryReturn({
          organizationId: req.user.organizationId,
          id: req.params.id,
          userId: req.user._id
        });
        return res.json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  }
]);

const srRouter = mount(express.Router(), [
  {
    method: 'get',
    path: '/',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.listSalesReturns({
          organizationId: req.user.organizationId
        });
        return res.json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  },
  {
    method: 'post',
    path: '/',
    perm: 'adjust',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.createSalesReturn({
          organizationId: req.user.organizationId,
          userId: req.user._id,
          payload: req.body || {}
        });
        return res.status(201).json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  },
  {
    method: 'post',
    path: '/:id/approve',
    perm: 'adjust',
    fn: async (req, res) => {
      try {
        const data = await fulfillmentDocsService.approveSalesReturn({
          organizationId: req.user.organizationId,
          id: req.params.id,
          userId: req.user._id
        });
        return res.json({ success: true, data });
      } catch (err) {
        return sendError(res, err);
      }
    }
  }
]);

module.exports = { dnRouter, drRouter, srRouter };
