const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireInventoryApp } = require('../middleware/requireInventoryAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const {
  listLocationsHandler,
  createLocationHandler,
  getLocationHandler,
  listBalancesHandler,
  listLedgerHandler,
  createAdjustmentHandler,
  postAdjustmentHandler,
  getAdjustmentHandler,
  rebuildBalancesHandler,
  getAtpHandler,
  listReservationsHandler,
  createTransferHandler,
  postTransferHandler,
  getTransferHandler,
  listTransfersHandler,
  createCountHandler,
  startCountHandler,
  updateCountLinesHandler,
  postCountHandler,
  getCountHandler,
  listCountsHandler,
  detectDriftHandler,
  createLotHandler,
  listLotsHandler,
  listSerialsHandler,
  createIncomingHandler,
  listIncomingHandler,
  getIncomingHandler,
  cancelIncomingHandler,
  receiveIncomingHandler
} = require('../controllers/inventoryController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireInventoryApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/locations', checkPermission('inventory', 'view'), listLocationsHandler);
router.post('/locations', checkPermission('inventory', 'manageLocations'), createLocationHandler);
router.get('/locations/:id', checkPermission('inventory', 'view'), getLocationHandler);

router.get('/balances', checkPermission('inventory', 'view'), listBalancesHandler);
router.get('/ledger', checkPermission('inventory', 'view'), listLedgerHandler);
router.get('/atp', checkPermission('inventory', 'view'), getAtpHandler);
router.get('/reservations', checkPermission('inventory', 'view'), listReservationsHandler);

router.post('/adjustments', checkPermission('inventory', 'adjust'), createAdjustmentHandler);
router.get('/adjustments/:id', checkPermission('inventory', 'view'), getAdjustmentHandler);
router.post('/adjustments/:id/post', checkPermission('inventory', 'adjust'), postAdjustmentHandler);

router.post('/rebuild-balances', checkPermission('inventory', 'rebuildBalances'), rebuildBalancesHandler);
router.get('/drift', checkPermission('inventory', 'rebuildBalances'), detectDriftHandler);

router.get('/transfers', checkPermission('inventory', 'view'), listTransfersHandler);
router.post('/transfers', checkPermission('inventory', 'transfer'), createTransferHandler);
router.get('/transfers/:id', checkPermission('inventory', 'view'), getTransferHandler);
router.post('/transfers/:id/post', checkPermission('inventory', 'transfer'), postTransferHandler);

router.get('/counts', checkPermission('inventory', 'view'), listCountsHandler);
router.post('/counts', checkPermission('inventory', 'count'), createCountHandler);
router.get('/counts/:id', checkPermission('inventory', 'view'), getCountHandler);
router.post('/counts/:id/start', checkPermission('inventory', 'count'), startCountHandler);
router.patch('/counts/:id/lines', checkPermission('inventory', 'count'), updateCountLinesHandler);
router.post('/counts/:id/post', checkPermission('inventory', 'count'), postCountHandler);

router.get('/lots', checkPermission('inventory', 'view'), listLotsHandler);
router.post('/lots', checkPermission('inventory', 'adjust'), createLotHandler);
router.get('/serials', checkPermission('inventory', 'view'), listSerialsHandler);

router.get('/incoming', checkPermission('inventory', 'view'), listIncomingHandler);
router.post('/incoming', checkPermission('inventory', 'adjust'), createIncomingHandler);
router.get('/incoming/:id', checkPermission('inventory', 'view'), getIncomingHandler);
router.post('/incoming/:id/cancel', checkPermission('inventory', 'adjust'), cancelIncomingHandler);
router.post('/incoming/:id/receive', checkPermission('inventory', 'adjust'), receiveIncomingHandler);

module.exports = router;
