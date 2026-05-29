/**
 * Default Helpdesk canned responses (Phase 1C).
 * Tenants receive these when no custom list is saved.
 */
const DEFAULT_CASE_CANNED_RESPONSES = [
  {
    id: 'ack-receipt',
    name: 'Acknowledge receipt',
    channel: 'email',
    subject: 'Re: {{case.title}}',
    body:
      '<p>Hi {{contact.firstName}},</p>'
      + '<p>Thank you for contacting us. We have received your message regarding case <strong>{{case.caseId}}</strong> and a member of our team will respond shortly.</p>'
      + '<p>Best regards,<br/>{{agent.name}}</p>'
  },
  {
    id: 'need-more-info',
    name: 'Request more information',
    channel: 'email',
    subject: 'Re: {{case.title}} — more details needed',
    body:
      '<p>Hi {{contact.firstName}},</p>'
      + '<p>To help us resolve case <strong>{{case.caseId}}</strong>, could you please share any additional details or screenshots related to your issue?</p>'
      + '<p>Thank you,<br/>{{agent.name}}</p>'
  },
  {
    id: 'resolved-followup',
    name: 'Resolution follow-up',
    channel: 'email',
    subject: 'Re: {{case.title}} — resolved',
    body:
      '<p>Hi {{contact.firstName}},</p>'
      + '<p>We believe your case <strong>{{case.caseId}}</strong> has been resolved. Please reply to this email if you still need assistance.</p>'
      + '<p>Best regards,<br/>{{agent.name}}</p>'
  },
  {
    id: 'internal-escalate',
    name: 'Escalating internally',
    channel: 'internal',
    subject: '',
    body: 'Escalating case {{case.caseId}} to the next tier. Please review when available.'
  },
  {
    id: 'internal-waiting-customer',
    name: 'Waiting on customer',
    channel: 'internal',
    subject: '',
    body: 'Waiting for customer response on {{case.caseId}}. No action needed until they reply.'
  }
];

const ALLOWED_CANNED_CHANNELS = new Set(['email', 'internal', 'all']);

module.exports = {
  DEFAULT_CASE_CANNED_RESPONSES,
  ALLOWED_CANNED_CHANNELS,
  MAX_CANNED_RESPONSES: 50
};
