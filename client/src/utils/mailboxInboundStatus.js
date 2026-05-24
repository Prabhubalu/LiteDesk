/**
 * When the workspace Inbox shell should be available (vs full-page Get Started).
 */

export function isMailboxInboundReady(mailbox, flags = {}) {
  if (!mailbox) return false;
  if (flags.gmailIntegrationEnabled) {
    return (
      mailbox.gmailInboxSync?.connected === true
      || mailbox.gmailSmtpOutbound?.connected === true
    );
  }
  const routing = String(mailbox.inboundParser?.routingAddress || '').trim();
  if (routing) return true;
  return mailbox.inboundParser?.provisionStatus === 'provisioned';
}

/** User can use Inbox if they belong to a shared mailbox or have a connected personal mailbox. */
export function isInboxShellUnblocked(mailboxes, flags = {}) {
  if (!Array.isArray(mailboxes) || mailboxes.length === 0) return false;

  const hasSharedAccess = mailboxes.some((m) => m.kind === 'group');
  if (hasSharedAccess) return true;

  const personal = mailboxes.find((m) => m.kind === 'personal');
  return isMailboxInboundReady(personal, flags);
}

export function formatMailboxInboundStatus(mailbox, flags = {}) {
  if (!mailbox) return '';
  if (flags.gmailIntegrationEnabled) {
    if (mailbox.gmailInboxSync?.connected) return 'Gmail sync';
    if (mailbox.gmailSmtpOutbound?.connected) return 'Gmail SMTP';
    return 'Not connected';
  }
  const routing = mailbox.inboundParser?.routingAddress;
  if (routing) return 'Forwarding ready';
  if (mailbox.inboundParser?.provisioningError) return 'Setup pending';
  return 'Not connected';
}
