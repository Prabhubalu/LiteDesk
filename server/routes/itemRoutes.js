const express = require('express');
const { 
    createItem, 
    getItems, 
    getItemById, 
    updateItem, 
    deleteItem,
    updateStock,
    getLowStockItems,
    getItemsByType,
    getItemStatistics,
    linkDeal,
    unlinkDeal
} = require('../controllers/itemController');
const {
    getItemMedia,
    addItemMedia,
    patchItemMedia,
    deleteItemMedia,
    getItemVariants,
    createItemVariant,
    updateItemVariant
} = require('../controllers/itemCatalogController');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission, filterByOwnership } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize CRM if needed
router.use(requireSalesApp); // Enforce CRM-only access
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('items'));

// Statistics route (must come before /:id routes)
router.get('/statistics', checkPermission('items', 'view'), getItemStatistics);

// Low stock route (must come before /:id routes)
router.get('/low-stock', checkPermission('items', 'view'), getLowStockItems);

// Items by type route (must come before /:id routes)
router.get('/type/:type', checkPermission('items', 'view'), getItemsByType);

// Catalog media (C1 — before /:id)
router.get('/:id/media', checkPermission('items', 'view'), getItemMedia);
router.post('/:id/media', checkPermission('items', 'edit'), uploadSingle('file'), addItemMedia);
router.patch('/:id/media/:mediaId', checkPermission('items', 'edit'), patchItemMedia);
router.delete('/:id/media/:mediaId', checkPermission('items', 'edit'), deleteItemMedia);

// Catalog variants scaffold (C1)
router.get('/:id/variants', checkPermission('items', 'view'), getItemVariants);
router.post('/:id/variants', checkPermission('items', 'edit'), createItemVariant);
router.put('/:id/variants/:variantId', checkPermission('items', 'edit'), updateItemVariant);

// Routes that handle collections (GET all, POST new)
router.route('/')
    .get(filterByOwnership('items'), checkPermission('items', 'view'), getItems)
    .post(checkPermission('items', 'create'), createItem);

// Routes that handle single resources (GET by ID, PUT, DELETE)
router.route('/:id')
    .get(checkPermission('items', 'view'), getItemById)
    .put(checkPermission('items', 'edit'), updateItem)
    .delete(checkPermission('items', 'delete'), deleteItem);

// Update stock quantity
router.patch('/:id/stock', checkPermission('items', 'edit'), updateStock);

// Link/unlink deal
router.post('/:id/link-deal', checkPermission('items', 'edit'), linkDeal);
router.delete('/:id/unlink-deal/:dealId', checkPermission('items', 'edit'), unlinkDeal);

module.exports = router;

