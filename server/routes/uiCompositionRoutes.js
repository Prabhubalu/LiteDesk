/**
 * ============================================================================
 * PLATFORM CORE: UI Composition Routes (Phase 0D)
 * ============================================================================
 * 
 * Routes for UI composition endpoints:
 * - GET /api/ui/apps - Get enabled apps
 * - GET /api/ui/sidebar - Get sidebar definition
 * - GET /api/ui/routes - Get route definitions
 * - GET /api/ui/apps/:appKey/modules - Get modules for an app
 * 
 * Middleware:
 * - protect: Authentication required
 * - organizationIsolation: Organization-scoped access
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { sessionBootstrapLimiter } = require('../middleware/rateLimitMiddleware');
const {
  getApps,
  getRegistry,
  getSidebar,
  getRoutes,
  getModulesForApp,
  getEntityModules,
  getProjectionMetadata,
  getAllAppDefinitions,
  getAddonNavigation,
} = require('../controllers/uiCompositionController');

// Apply auth and organization middleware to all routes
router.use(protect);
router.use(organizationIsolation);
router.use(sessionBootstrapLimiter);

// UI Composition Routes
router.get('/registry', getRegistry);
router.get('/addon-navigation', getAddonNavigation);
router.get('/apps', getApps);
router.get('/sidebar', getSidebar);
router.get('/routes', getRoutes);
router.get('/apps/:appKey/modules', getModulesForApp);
router.get('/entities', getEntityModules); // Platform/entity modules (navigationEntity: true)
// Phase 2B: Projection metadata for create forms
router.get('/projection/:appKey/:moduleKey', getProjectionMetadata);
// Phase 2F: App definitions for marketplace discovery
router.get('/app-definitions', getAllAppDefinitions);

module.exports = router;
