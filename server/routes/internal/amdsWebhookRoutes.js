'use strict';

const express = require('express');
const router = express.Router();
const { verifyAmdsSignature } = require('../../middleware/verifyAmdsSignature');
const controller = require('../../controllers/amdsWebhookController');

const rawJson = express.raw({ type: 'application/json', limit: '1mb' });

router.get('/health', controller.webhookHealth);
router.post('/', rawJson, verifyAmdsSignature, controller.handleAmdsWebhook);

module.exports = router;
