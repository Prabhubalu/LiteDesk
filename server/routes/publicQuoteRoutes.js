const express = require('express');
const router = express.Router();
const controller = require('../controllers/publicQuoteController');

router.get('/:token/view', controller.view);
router.get('/:token/pdf', controller.latestPdf);
router.post('/:token/accept', express.json(), controller.accept);
router.post('/:token/reject', express.json(), controller.reject);

module.exports = router;

