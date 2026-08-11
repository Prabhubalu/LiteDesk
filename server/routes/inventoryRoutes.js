const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireInventoryApp } = require('../middleware/requireInventoryAppMiddleware');
const { requireAddonEntitlement } = require('../middleware/requireAddonEntitlementMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { ADDON_KEYS } = require('../constants/addonKeys');
const {
  listLocationsHandler,
  createLocationHandler,
  getLocationHandler,
  updateLocationHandler,
  listBalancesHandler,
  listLedgerHandler,
  createAdjustmentHandler,
  listAdjustmentsHandler,
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
const requireStockroomAddon = requireAddonEntitlement(ADDON_KEYS.STOCKROOM);

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireInventoryApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

// Location reads stay available under Inventory (primary warehouse for docs/picklists).
// Multi-location write + stockroom workbench APIs require Stockroom addon.
router.get('/locations', checkPermission('inventory', 'view'), listLocationsHandler);
router.post('/locations', requireStockroomAddon, checkPermission('inventory', 'manageLocations'), createLocationHandler);
router.get('/locations/:id', checkPermission('inventory', 'view'), getLocationHandler);
router.put('/locations/:id', requireStockroomAddon, checkPermission('inventory', 'manageLocations'), updateLocationHandler);

router.get('/balances', checkPermission('inventory', 'view'), listBalancesHandler);
router.get('/ledger', checkPermission('inventory', 'view'), listLedgerHandler);
router.get('/atp', checkPermission('inventory', 'view'), getAtpHandler);
router.get('/reservations', checkPermission('inventory', 'view'), listReservationsHandler);

router.post('/adjustments', requireStockroomAddon, checkPermission('inventory', 'adjust'), createAdjustmentHandler);
router.get('/adjustments', requireStockroomAddon, checkPermission('inventory', 'view'), listAdjustmentsHandler);
router.get('/adjustments/:id', requireStockroomAddon, checkPermission('inventory', 'view'), getAdjustmentHandler);
router.post('/adjustments/:id/post', requireStockroomAddon, checkPermission('inventory', 'adjust'), postAdjustmentHandler);

router.post('/rebuild-balances', checkPermission('inventory', 'rebuildBalances'), rebuildBalancesHandler);
router.get('/drift', checkPermission('inventory', 'rebuildBalances'), detectDriftHandler);

router.get('/transfers', requireStockroomAddon, checkPermission('inventory', 'view'), listTransfersHandler);
router.post('/transfers', requireStockroomAddon, checkPermission('inventory', 'transfer'), createTransferHandler);
router.get('/transfers/:id', requireStockroomAddon, checkPermission('inventory', 'view'), getTransferHandler);
router.post('/transfers/:id/post', requireStockroomAddon, checkPermission('inventory', 'transfer'), postTransferHandler);

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
