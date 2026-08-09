'use strict';

/**
 * Back-compat wrappers around mailboxSmtpService (direct Gmail SMTP, no org relay).
 */

const {
  isMailboxSmtpReady,
  connectMailboxSmtp,
  disconnectMailboxSmtp,
  sendViaMailboxSmtp,
  verifySmtpCredentials,
  resolveSmtpPreset
} = require('./mailboxSmtpService');
const { GMAIL_SMTP_PROVIDER } = require('../constants/gmailSmtpDefaults');

/** @deprecated Org relay no longer required; kept for flag responses. Always null-ish unused. */
async function getOrganizationGmailSmtpRelay(_organizationId) {
  // Direct mailbox SMTP — org gmail-smtp relay is no longer required.
  // Return a synthetic "configured" marker so legacy UI flags stay green when Gmail integration is on.
  return {
    provider: GMAIL_SMTP_PROVIDER,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    direct: true
  };
}

function isMailboxGmailSmtpReady(mailboxLean) {
  return isMailboxSmtpReady(mailboxLean);
}

async function verifyGmailSmtpCredentials(relayConfig, user, pass) {
  const transport = {
    host: relayConfig?.smtpHost || 'smtp.gmail.com',
    port: Number(relayConfig?.smtpPort) || 587,
    secure: relayConfig?.smtpSecure === true
  };
  return verifySmtpCredentials(transport, user, pass);
}

async function connectMailboxGmailSmtp({ organizationId, mailboxId, emailAddress, appPassword }) {
  return connectMailboxSmtp({
    organizationId,
    mailboxId,
    emailAddress,
    password: appPassword,
    provider: 'gmail'
  });
}

async function disconnectMailboxGmailSmtp(mailboxId, organizationId) {
  return disconnectMailboxSmtp(mailboxId, organizationId);
}

async function sendViaMailboxGmailSmtp(doc, mailboxLean, extras = {}) {
  const result = await sendViaMailboxSmtp(doc, mailboxLean, extras);
  if (result.success) {
    return { ...result, provider: result.provider || GMAIL_SMTP_PROVIDER };
  }
  return result;
}

module.exports = {
  GMAIL_SMTP_PROVIDER,
  getOrganizationGmailSmtpRelay,
  isMailboxGmailSmtpReady,
  connectMailboxGmailSmtp,
  disconnectMailboxGmailSmtp,
  sendViaMailboxGmailSmtp,
  verifyGmailSmtpCredentials,
  resolveSmtpPreset
};
