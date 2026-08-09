const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { requireGmailIntegration } = require('../middleware/emailIntegrationMiddleware');
const { isGmailIntegrationEnabled } = require('../config/emailFeatureFlags');
const { smtpVerifyLimiter } = require('../middleware/rateLimitMiddleware');
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

/** SMTP verify (no mailbox id) — rate limited. */
router.post('/outbound/smtp/verify', smtpVerifyLimiter, controller.verifyMailboxSmtpHandler);

router.post('/:id/inbound-parser/provision', controller.provisionMailboxParserHandler);
router.get('/:id', controller.getMailbox);
router.patch('/:id', controller.updateMailbox);
router.delete('/:id', controller.deleteMailbox);

/** Generic mailbox SMTP connect/disconnect — no Gmail feature-flag gate. */
router.post('/:id/outbound/smtp/connect', smtpVerifyLimiter, controller.connectMailboxSmtpHandler);
router.post('/:id/outbound/smtp/disconnect', controller.disconnectMailboxSmtpHandler);

const gmailRoutes = express.Router({ mergeParams: true });
gmailRoutes.use(requireGmailIntegration);
gmailRoutes.get('/inbox-sync/google/start', controller.gmailInboxSyncGoogleStart);
gmailRoutes.get('/inbox-sync/google/labels', controller.listGmailInboxSyncLabels);
gmailRoutes.patch('/inbox-sync/google/sync-labels', controller.patchGmailInboxSyncSyncLabels);
gmailRoutes.post('/inbox-sync/run', controller.gmailInboxSyncRun);
gmailRoutes.post('/inbox-sync/google/disconnect', controller.gmailInboxSyncDisconnect);
gmailRoutes.post('/outbound/gmail-smtp/connect', smtpVerifyLimiter, controller.connectMailboxGmailSmtpHandler);
gmailRoutes.post('/outbound/gmail-smtp/disconnect', controller.disconnectMailboxGmailSmtpHandler);
router.use('/:id', gmailRoutes);

module.exports = router;
