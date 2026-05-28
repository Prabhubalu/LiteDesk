const express = require('express');
const {
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryAttributes,
  createCategoryAttribute,
  updateCategoryAttribute,
  deleteCategoryAttribute,
  getCatalogVariantById
} = require('../controllers/catalogController');
const {
  listPriceBooks,
  createPriceBook,
  updatePriceBook,
  deletePriceBook,
  getPriceBookEntries,
  createPriceBookEntry,
  updatePriceBookEntry,
  deletePriceBookEntry,
  getVariantPriceEntries,
  resolveCatalogPrice
} = require('../controllers/catalogPriceBookController');
const {
  getBundleComponents,
  putBundleComponents,
  getBundleExpandPreview,
  searchCatalogVariants
} = require('../controllers/catalogBundleController');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('items'));

router.get('/variants/search', checkPermission('items', 'view'), searchCatalogVariants);

router.get('/variants/:variantId', checkPermission('items', 'view'), getCatalogVariantById);
router.get('/variants/:variantId/price-entries', checkPermission('items', 'view'), getVariantPriceEntries);
router.get('/variants/:variantId/bundle-components', checkPermission('items', 'view'), getBundleComponents);
router.put('/variants/:variantId/bundle-components', checkPermission('items', 'edit'), putBundleComponents);
router.get('/variants/:variantId/bundle-expand', checkPermission('items', 'view'), getBundleExpandPreview);

router.post('/price-books/resolve', checkPermission('items', 'view'), resolveCatalogPrice);

router.get('/price-books', checkPermission('items', 'view'), listPriceBooks);
router.post('/price-books', checkPermission('items', 'edit'), createPriceBook);
router.put('/price-books/:id', checkPermission('items', 'edit'), updatePriceBook);
router.delete('/price-books/:id', checkPermission('items', 'edit'), deletePriceBook);
router.get('/price-books/:id/entries', checkPermission('items', 'view'), getPriceBookEntries);
router.post('/price-books/:id/entries', checkPermission('items', 'edit'), createPriceBookEntry);
router.put('/price-books/:id/entries/:entryId', checkPermission('items', 'edit'), updatePriceBookEntry);
router.delete('/price-books/:id/entries/:entryId', checkPermission('items', 'edit'), deletePriceBookEntry);

router.get('/categories/tree', checkPermission('items', 'view'), getCategoryTree);
router.post('/categories', checkPermission('items', 'edit'), createCategory);
router.put('/categories/:id', checkPermission('items', 'edit'), updateCategory);
router.delete('/categories/:id', checkPermission('items', 'edit'), deleteCategory);

router.get('/categories/:id/attributes', checkPermission('items', 'view'), getCategoryAttributes);
router.post('/categories/:id/attributes', checkPermission('items', 'edit'), createCategoryAttribute);
router.put('/categories/:id/attributes/:attrId', checkPermission('items', 'edit'), updateCategoryAttribute);
router.delete('/categories/:id/attributes/:attrId', checkPermission('items', 'edit'), deleteCategoryAttribute);

module.exports = router;
