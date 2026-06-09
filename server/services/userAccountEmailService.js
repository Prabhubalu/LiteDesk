'use strict';

const emailProviderGateway = require('../platform/communication/providers/emailProviderGateway');
const { escapeHtml, buildEmailShell } = require('../utils/appointmentEmailUtils');
const { buildInviteUrl, buildVerifyEmailUrl } = require('../utils/userAuthTokens');

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

async function sendInviteEmail({ to, invitee, organizationName, inviterName, inviteToken, welcomeNote = null }) {
  if (!emailProviderGateway.isSystemConfigured()) {
    return { success: false, skipped: true, reason: 'system_email_not_configured' };
  }

  const inviteUrl = buildInviteUrl(inviteToken);
  const content = buildInviteEmailContent({
    invitee,
    organizationName,
    inviterName,
    inviteUrl,
    welcomeNote
  });

  return emailProviderGateway.sendSystemEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
  });
}

async function sendVerificationEmail({ to, user, organizationName, verificationToken }) {
  if (!emailProviderGateway.isSystemConfigured()) {
    return { success: false, skipped: true, reason: 'system_email_not_configured' };
  }

  const verifyUrl = buildVerifyEmailUrl(verificationToken);
  const content = buildVerificationEmailContent({
    user,
    organizationName,
    verifyUrl
  });

  return emailProviderGateway.sendSystemEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO
  });
}

module.exports = {
  sendInviteEmail,
  sendVerificationEmail,
  buildInviteEmailContent,
  buildVerificationEmailContent
};
