const express = require('express');
const controller = require('../controllers/publicQuoteController');
const {
  publicQuoteViewLimiter,
  publicQuoteActionLimiter
} = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.get('/:token/view', publicQuoteViewLimiter, controller.view);
router.get('/:token/pdf', publicQuoteViewLimiter, controller.latestPdf);
router.post('/:token/accept', express.json(), publicQuoteActionLimiter, controller.accept);
router.post('/:token/reject', express.json(), publicQuoteActionLimiter, controller.reject);
router.get('/:token/comments', publicQuoteViewLimiter, controller.listComments);
router.post('/:token/comments', express.json(), publicQuoteActionLimiter, controller.postComment);

module.exports = router;
