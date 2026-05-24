const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { requireGmailIntegration } = require('../middleware/emailIntegrationMiddleware');
const { isGmailIntegrationEnabled } = require('../config/emailFeatureFlags');
const controller = require('../controllers/mailboxController');

/** Google OAuth redirect (no Bearer token). */
if (isGmailIntegrationEnabled()) {
  router.get('/inbox-sync/google/callback', controller.gmailOAuthCallback);
} else {
  router.get('/inbox-sync/google/callback', (_req, res) => {
    res.status(503).send('Gmail integration is disabled on this server.');
  });
}

router.use(protect);
router.use(organizationIsolation);

router.get('/', controller.listMailboxes);
router.post('/', controller.createMailbox);
router.post('/:id/inbound-parser/provision', controller.provisionMailboxParserHandler);
router.get('/:id', controller.getMailbox);
router.patch('/:id', controller.updateMailbox);
router.delete('/:id', controller.deleteMailbox);

const gmailRoutes = express.Router({ mergeParams: true });
gmailRoutes.use(requireGmailIntegration);
gmailRoutes.get('/inbox-sync/google/start', controller.gmailInboxSyncGoogleStart);
gmailRoutes.get('/inbox-sync/google/labels', controller.listGmailInboxSyncLabels);
gmailRoutes.patch('/inbox-sync/google/sync-labels', controller.patchGmailInboxSyncSyncLabels);
gmailRoutes.post('/inbox-sync/run', controller.gmailInboxSyncRun);
gmailRoutes.post('/inbox-sync/google/disconnect', controller.gmailInboxSyncDisconnect);
gmailRoutes.post('/outbound/gmail-smtp/connect', controller.connectMailboxGmailSmtpHandler);
gmailRoutes.post('/outbound/gmail-smtp/disconnect', controller.disconnectMailboxGmailSmtpHandler);
router.use('/:id', gmailRoutes);

module.exports = router;
