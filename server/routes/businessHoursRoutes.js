'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const businessHoursController = require('../controllers/businessHoursController');
const holidayCalendarController = require('../controllers/holidayCalendarController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(createSettingsAuditMiddleware({ surface: 'business-hours' }));

router.get('/resolve', businessHoursController.resolve);
router.get('/sets', businessHoursController.listSets);
router.post('/sets', businessHoursController.createSet);
router.get('/sets/:id', businessHoursController.getSet);
router.patch('/sets/:id', businessHoursController.updateSet);
router.delete('/sets/:id', businessHoursController.deleteSet);
router.post('/simulate', businessHoursController.simulate);
router.get('/kpis', businessHoursController.getKpis);
router.post('/kpis/aggregate', businessHoursController.aggregateKpis);

router.get('/holiday-calendars', holidayCalendarController.list);
router.post('/holiday-calendars', holidayCalendarController.create);
router.post('/holiday-calendars/import', holidayCalendarController.importCsv);
router.get('/holiday-calendars/:id', holidayCalendarController.get);
router.patch('/holiday-calendars/:id', holidayCalendarController.update);
router.delete('/holiday-calendars/:id', holidayCalendarController.remove);

module.exports = router;
