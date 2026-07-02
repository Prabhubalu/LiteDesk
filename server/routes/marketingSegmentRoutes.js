const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireMarketingApp } = require('../middleware/requireMarketingAppMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/marketingSegmentController');

const router = express.Router();

const RESERVED_SEGMENT_PATHS = new Set(['metadata', 'preview', 'explain', 'field-options']);

function skipReservedSegmentPath(req, res, next) {
  if (RESERVED_SEGMENT_PATHS.has(String(req.params.id || '').toLowerCase())) {
    return next('route');
  }
  return next();
}

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireMarketingApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

router.get('/metadata', checkPermission('segments', 'view'), controller.getSegmentMetadata);
router.get('/field-options', checkPermission('segments', 'view'), controller.getSegmentFieldOptions);
router.post('/explain', checkPermission('segments', 'view'), controller.explainSegmentFilter);

router.get('/', checkPermission('segments', 'view'), controller.listSegments);
router.post('/', checkPermission('segments', 'create'), controller.createSegment);
router.post('/preview', checkPermission('segments', 'view'), controller.previewSegmentFilter);

router.get('/:id', skipReservedSegmentPath, checkPermission('segments', 'view'), controller.getSegment);
router.put('/:id', skipReservedSegmentPath, checkPermission('segments', 'edit'), controller.updateSegment);
router.delete('/:id', skipReservedSegmentPath, checkPermission('segments', 'delete'), controller.deleteSegment);
router.post('/:id/preview', skipReservedSegmentPath, checkPermission('segments', 'view'), controller.previewSegment);
router.get('/:id/members', skipReservedSegmentPath, checkPermission('segments', 'view'), controller.listSegmentMembers);
router.post('/:id/refresh', skipReservedSegmentPath, checkPermission('segments', 'edit'), controller.refreshSegment);

module.exports = router;
