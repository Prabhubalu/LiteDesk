'use strict';

const express = require('express');
const router = express.Router();
const telephonyWebhookController = require('../controllers/telephonyWebhookController');

// Twilio status callbacks typically post application/x-www-form-urlencoded.
// Parent app already mounts express.urlencoded / express.json; no JWT here.
router.get('/:providerKey/ping', telephonyWebhookController.ping);
router.post('/:providerKey', telephonyWebhookController.handleProviderWebhook);

module.exports = router;
