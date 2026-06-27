'use strict';

const emailProviderGateway = require('../platform/communication/providers/emailProviderGateway');
const emailService = require('./emailService');
const { escapeHtml, buildEmailShell } = require('../utils/appointmentEmailUtils');
const { buildInviteUrl, buildVerifyEmailUrl, buildResetPasswordUrl } = require('../utils/userAuthTokens');

/**
 * Send account lifecycle mail (invite, verification).
 * Tries system channel first, then tenant CRM integration, then global CRM env.
 */
async function sendAccountEmail({ organizationId, to, subject, text, html, replyTo }) {
  const payload = { to, subject, text, html, replyTo };

  if (emailProviderGateway.isSystemConfigured()) {
    const systemResult = await emailProviderGateway.sendSystemEmail(payload);
    if (systemResult.success) {
      return { ...systemResult, channel: 'system' };
    }
    console.warn('[userAccountEmailService] System email send failed:', systemResult.error);
  }

  if (organizationId && (await emailService.isConfiguredForOrganization(organizationId))) {
    const orgResult = await emailProviderGateway.sendCrmEmail({
      ...payload,
      organizationId
    });
    if (orgResult.success) {
      return { ...orgResult, channel: 'crm-tenant' };
    }
    console.warn('[userAccountEmailService] Tenant CRM email send failed:', orgResult.error);
    return {
      success: false,
      skipped: false,
      reason: orgResult.error || 'tenant_email_send_failed',
      channel: 'crm-tenant'
    };
  }

  if (emailService.isConfigured()) {
    const envResult = await emailProviderGateway.sendCrmEmail(payload);
    if (envResult.success) {
      return { ...envResult, channel: 'crm-env' };
    }
    console.warn('[userAccountEmailService] Env CRM email send failed:', envResult.error);
    return {
      success: false,
      skipped: false,
      reason: envResult.error || 'crm_email_send_failed',
      channel: 'crm-env'
    };
  }

  return {
    success: false,
    skipped: true,
    reason: 'email_not_configured',
    error: 'No email provider configured. Set SYSTEM_EMAIL_* or configure Email Provider in Settings > Integrations.'
  };
}

function displayName(user) {
  const full = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return full || user?.username || user?.email || 'there';
}

function buildInviteEmailContent({
  invitee,
  organizationName,
  inviterName,
  inviteUrl,
  welcomeNote = null
}) {
  const name = displayName(invitee);
  const org = organizationName || 'your organization';
  const inviter = inviterName || 'Your administrator';
  const subject = `You're invited to join ${org} on Arivu`;

  const noteHtml = welcomeNote
    ? `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #4f46e5;background:#f4f4f5;font-size:14px;color:#3f3f46;line-height:1.6;">
        ${escapeHtml(welcomeNote)}
      </blockquote>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(name)}, ${escapeHtml(inviter)} has invited you to join
      <strong>${escapeHtml(org)}</strong> on Arivu.
    </p>
    ${noteHtml}
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
      Accept your invitation to set your password and get started. Accepting also verifies your email address.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
        Accept invitation
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      This link expires in 72 hours. If you did not expect this invitation, you can ignore this email.
    </p>`;

  const text = [
    `Hi ${name},`,
    '',
    `${inviter} has invited you to join ${org} on Arivu.`,
    '',
    'Accept your invitation to set your password and get started.',
    'Accepting also verifies your email address.',
    '',
    `Accept invitation: ${inviteUrl}`,
    '',
    'This link expires in 72 hours.'
  ].join('\n');

  return {
    subject,
    text,
    html: buildEmailShell({
      title: `Join ${org}`,
      bodyHtml,
      accentColor: '#4f46e5'
    })
  };
}

function buildVerificationEmailContent({ user, organizationName, verifyUrl }) {
  const name = displayName(user);
  const org = organizationName || 'Arivu';
  const subject = `Verify your email for ${org}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(name)}, please verify your email address to secure your account.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
        Verify email
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      You can continue using Arivu while your email is unverified. This link expires in 7 days.
    </p>`;

  const text = [
    `Hi ${name},`,
    '',
    'Please verify your email address to secure your account.',
    '',
    `Verify email: ${verifyUrl}`,
    '',
    'You can continue using Arivu while your email is unverified.'
  ].join('\n');

  return {
    subject,
    text,
    html: buildEmailShell({
      title: 'Verify your email',
      bodyHtml,
      accentColor: '#4f46e5'
    })
  };
}

async function sendInviteEmail({
  to,
  invitee,
  organizationId,
  organizationName,
  inviterName,
  inviteToken,
  welcomeNote = null
}) {
  const inviteUrl = buildInviteUrl(inviteToken);
  const content = buildInviteEmailContent({
    invitee,
    organizationName,
    inviterName,
    inviteUrl,
    welcomeNote
  });

  return sendAccountEmail({
    organizationId,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
  });
}

function buildPasswordResetEmailContent({ user, organizationName, resetUrl }) {
  const name = displayName(user);
  const org = organizationName || 'Arivu';
  const subject = `Reset your ${org} password`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(name)}, we received a request to reset your password for your Arivu account.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
      Click the button below to choose a new password. This link expires in 1 hour.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
        Reset password
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      If you did not request a password reset, you can ignore this email. Your password will not change.
    </p>`;

  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset your password for your Arivu account.',
    '',
    'Choose a new password using this link (expires in 1 hour):',
    resetUrl,
    '',
    'If you did not request a password reset, you can ignore this email.'
  ].join('\n');

  return {
    subject,
    text,
    html: buildEmailShell({
      title: 'Reset your password',
      bodyHtml,
      accentColor: '#4f46e5'
    })
  };
}

async function sendPasswordResetEmail({
  to,
  user,
  organizationId,
  organizationName,
  resetToken
}) {
  const resetUrl = buildResetPasswordUrl(resetToken);
  const content = buildPasswordResetEmailContent({
    user,
    organizationName,
    resetUrl
  });

  return sendAccountEmail({
    organizationId,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
  });
}

async function sendVerificationEmail({
  to,
  user,
  organizationId,
  organizationName,
  verificationToken
}) {
  const verifyUrl = buildVerifyEmailUrl(verificationToken);
  const content = buildVerificationEmailContent({
    user,
    organizationName,
    verifyUrl
  });

  return sendAccountEmail({
    organizationId,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
  });
}

function buildPortalInviteEmailContent({
  invitee,
  organizationName,
  portalUrl,
  username,
  temporaryPassword,
  inviterName
}) {
  const name = displayName(invitee);
  const org = organizationName || 'Arivu';
  const subject = `Your ${org} portal access`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
      Hi ${escapeHtml(name)}, ${escapeHtml(inviterName)} has enabled portal access for you on ${escapeHtml(org)}.
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:#52525b;line-height:1.6;">
      <strong>Portal URL:</strong> <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a><br/>
      <strong>Username:</strong> ${escapeHtml(username)}<br/>
      <strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
        Sign in to portal
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
      You will be asked to set a new password on first sign-in. This temporary password expires after first use.
    </p>`;

  const text = [
    `Hi ${name},`,
    '',
    `${inviterName} has enabled portal access for you on ${org}.`,
    '',
    `Portal URL: ${portalUrl}`,
    `Username: ${username}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    'You will be asked to set a new password on first sign-in.'
  ].join('\n');

  return {
    subject,
    text,
    html: buildEmailShell({
      title: 'Portal access',
      bodyHtml,
      accentColor: '#4f46e5'
    })
  };
}

async function sendPortalInviteEmail({
  to,
  invitee,
  organizationId,
  organizationName,
  inviterName,
  portalUrl,
  username,
  temporaryPassword
}) {
  const content = buildPortalInviteEmailContent({
    invitee,
    organizationName,
    portalUrl,
    username,
    temporaryPassword,
    inviterName
  });

  return sendAccountEmail({
    organizationId,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
  });
}

module.exports = {
  sendAccountEmail,
  sendInviteEmail,
  sendPortalInviteEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  buildInviteEmailContent,
  buildVerificationEmailContent,
  buildPasswordResetEmailContent
};
