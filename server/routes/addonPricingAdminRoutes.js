const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin, requireMasterOrganization } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/addonPricingAdminController');

const router = express.Router();

router.use(protect);
router.use(requireAdmin());
router.use(requireMasterOrganization());

router.get('/', controller.listAddonPricing);
router.get('/:addonKey', controller.getAddonPricing);
router.put('/:addonKey', controller.upsertAddonPricing);

module.exports = router;
