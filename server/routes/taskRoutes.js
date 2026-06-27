const express = require('express');
const router = express.Router();
const { performance } = require('perf_hooks');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission, filterByOwnership } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
  createTask,
  getTasks,
  getTasksListMeta,
  getTaskRecordMeta,
  getTaskSummary,
  getTaskById,
  updateTask,
  updateTaskTags,
  deleteTask,
  updateTaskStatus,
  toggleSubtask,
  getTaskStats,
  getTaskActivityLogs,
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  toggleTaskCommentReaction,
  deleteTaskComment,
  uploadTaskCommentAttachment,
  getTaskCustomFields,
  getDescriptionVersions,
  restoreDescriptionVersion
} = require('../controllers/taskController');

const timeSummaryMiddleware = (name, middleware) => {
  return (req, res, next) => {
    if (req.path !== '/summary') {
      return middleware(req, res, next);
    }

    const startedAt = performance.now();
    let recorded = false;

    const recordTiming = () => {
      if (recorded) return;
      recorded = true;
      req.taskSummaryTimings = req.taskSummaryTimings || [];
      req.taskSummaryTimings.push({
        name,
        duration: performance.now() - startedAt,
        description: `${name} middleware`
      });
    };

    const timedNext = (error) => {
      recordTiming();
      next(error);
    };

    try {
      const result = middleware(req, res, timedNext);
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          recordTiming();
          next(error);
        });
      }
      return result;
    } catch (error) {
      recordTiming();
      return next(error);
    }
  };
};

// Apply middleware to all task routes
router.use((req, res, next) => {
  if (req.path === '/summary') {
    req.taskSummaryRequestStartedAt = performance.now();
    req.taskSummaryTimings = [];
  }
  next();
});
router.use(timeSummaryMiddleware('mw_auth', protect));
router.use(timeSummaryMiddleware('mw_app_context', resolveAppContext)); // After auth, resolve appKey from URL
router.use(timeSummaryMiddleware('mw_app_entitlement', requireAppEntitlement)); // Check user's app entitlements
router.use(timeSummaryMiddleware('mw_lazy_sales_init', lazySalesInitialization)); // Lazy initialize CRM if needed
router.use(timeSummaryMiddleware('mw_sales_app', requireSalesApp)); // Enforce Sales-only access
router.use(timeSummaryMiddleware('mw_org_isolation', organizationIsolation));
router.use(timeSummaryMiddleware('mw_trial_status', checkTrialStatus));
router.use(timeSummaryMiddleware('mw_feature_tasks', checkFeatureAccess('tasks'))); // Ensure 'tasks' module is enabled

// Task statistics
router.get('/stats/summary', checkPermission('tasks', 'view'), getTaskStats);
router.get('/summary', timeSummaryMiddleware('mw_permission_tasks_view', checkPermission('tasks', 'view')), getTaskSummary);

router.get('/meta', filterByOwnership('tasks'), checkPermission('tasks', 'view'), getTasksListMeta);

// Task CRUD routes
router.route('/')
  .post(checkPermission('tasks', 'create'), createTask)
  .get(filterByOwnership('tasks'), checkPermission('tasks', 'view'), getTasks);

// Comment, activity, and custom fields routes (more specific - must be before /:id)
router.get('/:id/meta', checkPermission('tasks', 'view'), getTaskRecordMeta);
router.get('/:id/activity-logs', checkPermission('tasks', 'view'), getTaskActivityLogs);
router.get('/:id/description-versions', checkPermission('tasks', 'view'), getDescriptionVersions);
router.post('/:id/description-versions/restore', checkPermission('tasks', 'edit'), restoreDescriptionVersion);
router.get('/:id/comments', checkPermission('tasks', 'view'), getTaskComments);
router.get('/:id/custom-fields', checkPermission('tasks', 'view'), getTaskCustomFields);
router.post('/:id/comment-attachments', checkPermission('tasks', 'edit'), uploadSingle('file'), uploadTaskCommentAttachment);
router.post('/:id/comments', checkPermission('tasks', 'edit'), createTaskComment);
router.put('/:id/comments/:commentId', checkPermission('tasks', 'edit'), updateTaskComment);
router.post('/:id/comments/:commentId/reactions', checkPermission('tasks', 'edit'), toggleTaskCommentReaction);
router.delete('/:id/comments/:commentId', checkPermission('tasks', 'edit'), deleteTaskComment);

router.route('/:id')
  .get(checkPermission('tasks', 'view'), getTaskById)
  .put(checkPermission('tasks', 'edit'), updateTask)
  .delete(checkPermission('tasks', 'delete'), deleteTask);
router.put('/:id/tags', checkPermission('tasks', 'edit'), updateTaskTags);
router.patch('/:id/tags', checkPermission('tasks', 'edit'), updateTaskTags);

// Quick actions
router.patch('/:id/status', checkPermission('tasks', 'edit'), updateTaskStatus);
router.patch('/:id/subtasks/:subtaskId', checkPermission('tasks', 'edit'), toggleSubtask);

module.exports = router;
