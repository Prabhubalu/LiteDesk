const {
  listLocations,
  createLocation,
  getLocationById
} = require('../services/inventoryLocationService');
const { listBalances } = require('../services/inventoryRollupService');
const { listLedgerEntries } = require('../services/inventoryTransactionService');
const {
  createAdjustment,
  postAdjustment,
  getAdjustmentById,
  listAdjustments
} = require('../services/inventoryAdjustmentService');
const {
  createTransfer,
  postTransfer,
  getTransferById,
  listTransfers
} = require('../services/inventoryTransferService');
const {
  createCount,
  startCountSession,
  updateCountLines,
  postCount,
  getCountById,
  listCounts
} = require('../services/inventoryCountService');
const { rebuildAllBalances, detectRollupDrift } = require('../services/inventoryBalanceRebuildService');
const { listReservations } = require('../services/inventoryReservationService');
const { getAtpForVariant } = require('../services/inventoryAtpService');
const { getDefaultLocation } = require('../services/inventoryLocationService');
const { createLot, listLots, listSerials } = require('../services/inventoryTrackingService');
const {
  createIncomingStub,
  cancelIncomingStub,
  receiveIncomingStub,
  listIncomingStubs,
  getIncomingStubById
} = require('../services/inventoryIncomingService');

function getOrganizationId(req) {
  return req.user?.organizationId;
}

function mapErrorStatus(err) {
  const code = err?.code;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'VALIDATION' || code === 'LOCATION_INACTIVE' || code === 'LOT_REQUIRED' || code === 'SERIAL_COUNT_MISMATCH' || code === 'SERIAL_NOT_AVAILABLE') return 400;
  if (code === 'INSUFFICIENT_STOCK' || code === 'INSUFFICIENT_ATP') return 409;
  return 500;
}

async function listLocationsHandler(req, res) {
  try {
    const rows = await listLocations({
      organizationId: getOrganizationId(req),
      status: req.query.status || null
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createLocationHandler(req, res) {
  try {
    const row = await createLocation({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      ...req.body
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getLocationHandler(req, res) {
  try {
    const row = await getLocationById({
      organizationId: getOrganizationId(req),
      inventoryLocationId: req.params.id
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listBalancesHandler(req, res) {
  try {
    const rows = await listBalances({
      organizationId: getOrganizationId(req),
      inventoryLocationId: req.query.inventoryLocationId || null,
      variantId: req.query.variantId || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listLedgerHandler(req, res) {
  try {
    const rows = await listLedgerEntries({
      organizationId: getOrganizationId(req),
      variantId: req.query.variantId || null,
      inventoryLocationId: req.query.inventoryLocationId || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createAdjustmentHandler(req, res) {
  try {
    const row = await createAdjustment({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      ...req.body
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listAdjustmentsHandler(req, res) {
  try {
    const rows = await listAdjustments({
      organizationId: getOrganizationId(req),
      status: req.query.status || null,
      limit: Number(req.query.limit) || 50
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function postAdjustmentHandler(req, res) {
  try {
    const result = await postAdjustment({
      organizationId: getOrganizationId(req),
      inventoryAdjustmentId: req.params.id,
      userId: req.user?._id
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getAdjustmentHandler(req, res) {
  try {
    const row = await getAdjustmentById({
      organizationId: getOrganizationId(req),
      inventoryAdjustmentId: req.params.id
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Adjustment not found' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function rebuildBalancesHandler(req, res) {
  try {
    const result = await rebuildAllBalances({
      organizationId: getOrganizationId(req),
      userId: req.user?._id
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getAtpHandler(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    const variantId = req.query.variantId;
    if (!variantId) {
      return res.status(400).json({ success: false, message: 'variantId is required', code: 'VALIDATION' });
    }

    let inventoryLocationId = req.query.inventoryLocationId || null;
    if (!inventoryLocationId) {
      const location = await getDefaultLocation(organizationId, req.user?._id);
      inventoryLocationId = location.inventoryLocationId;
    }

    const quantity = req.query.quantity != null ? Number(req.query.quantity) : null;
    const data = await getAtpForVariant({
      organizationId,
      variantId,
      inventoryLocationId,
      quantity
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listReservationsHandler(req, res) {
  try {
    const organizationId = getOrganizationId(req);
    let salesOrderId = req.query.salesOrderId || null;

    if (salesOrderId) {
      const SalesOrder = require('../models/SalesOrder');
      const ref = String(salesOrderId).trim();
      const order =
        (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null }).select('_id')) ||
        (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }).select('_id'));
      salesOrderId = order?._id || null;
    }

    const rows = await listReservations({
      organizationId,
      salesOrderId,
      salesOrderLineId: req.query.salesOrderLineId || null,
      variantId: req.query.variantId || null,
      inventoryLocationId: req.query.inventoryLocationId || null,
      status: req.query.status || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createTransferHandler(req, res) {
  try {
    const row = await createTransfer({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      ...req.body
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function postTransferHandler(req, res) {
  try {
    const result = await postTransfer({
      organizationId: getOrganizationId(req),
      inventoryTransferId: req.params.id,
      userId: req.user?._id
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getTransferHandler(req, res) {
  try {
    const row = await getTransferById({
      organizationId: getOrganizationId(req),
      inventoryTransferId: req.params.id
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listTransfersHandler(req, res) {
  try {
    const rows = await listTransfers({
      organizationId: getOrganizationId(req),
      status: req.query.status || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createCountHandler(req, res) {
  try {
    const row = await createCount({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      ...req.body
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function startCountHandler(req, res) {
  try {
    const row = await startCountSession({
      organizationId: getOrganizationId(req),
      inventoryCountId: req.params.id,
      userId: req.user?._id,
      lines: req.body?.lines
    });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function updateCountLinesHandler(req, res) {
  try {
    const row = await updateCountLines({
      organizationId: getOrganizationId(req),
      inventoryCountId: req.params.id,
      userId: req.user?._id,
      lines: req.body?.lines || []
    });
    res.json({ success: true, data: row });
  } catch (err) {
    const status = err?.code === 'LINE_NOT_FOUND' ? 404 : mapErrorStatus(err);
    res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function postCountHandler(req, res) {
  try {
    const result = await postCount({
      organizationId: getOrganizationId(req),
      inventoryCountId: req.params.id,
      userId: req.user?._id
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getCountHandler(req, res) {
  try {
    const row = await getCountById({
      organizationId: getOrganizationId(req),
      inventoryCountId: req.params.id
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Count session not found' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listCountsHandler(req, res) {
  try {
    const rows = await listCounts({
      organizationId: getOrganizationId(req),
      inventoryLocationId: req.query.inventoryLocationId || null,
      status: req.query.status || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function detectDriftHandler(req, res) {
  try {
    const drift = await detectRollupDrift({ organizationId: getOrganizationId(req) });
    res.json({ success: true, data: { count: drift.length, drift } });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createLotHandler(req, res) {
  try {
    const row = await createLot({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      ...req.body
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listLotsHandler(req, res) {
  try {
    const rows = await listLots({
      organizationId: getOrganizationId(req),
      variantId: req.query.variantId || null,
      inventoryLocationId: req.query.inventoryLocationId || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listSerialsHandler(req, res) {
  try {
    const rows = await listSerials({
      organizationId: getOrganizationId(req),
      variantId: req.query.variantId || null,
      inventoryLocationId: req.query.inventoryLocationId || null,
      status: req.query.status || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function createIncomingHandler(req, res) {
  try {
    const row = await createIncomingStub({
      organizationId: getOrganizationId(req),
      userId: req.user?._id,
      ...req.body
    });
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function listIncomingHandler(req, res) {
  try {
    const rows = await listIncomingStubs({
      organizationId: getOrganizationId(req),
      variantId: req.query.variantId || null,
      inventoryLocationId: req.query.inventoryLocationId || null,
      status: req.query.status || null,
      limit: Number(req.query.limit) || 100
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function getIncomingHandler(req, res) {
  try {
    const row = await getIncomingStubById({
      organizationId: getOrganizationId(req),
      inventoryIncomingStubId: req.params.id
    });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Incoming stub not found' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function cancelIncomingHandler(req, res) {
  try {
    const row = await cancelIncomingStub({
      organizationId: getOrganizationId(req),
      inventoryIncomingStubId: req.params.id,
      userId: req.user?._id
    });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

async function receiveIncomingHandler(req, res) {
  try {
    const result = await receiveIncomingStub({
      organizationId: getOrganizationId(req),
      inventoryIncomingStubId: req.params.id,
      userId: req.user?._id,
      unitCostSnapshot: req.body?.unitCostSnapshot
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ success: false, message: err.message, code: err.code });
  }
}

module.exports = {
  listLocationsHandler,
  createLocationHandler,
  getLocationHandler,
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
};
