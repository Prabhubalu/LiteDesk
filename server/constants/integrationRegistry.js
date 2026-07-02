// Integration registry (metadata-driven, no runtime logic)
// Scope:
// - scope: 'platform' | 'app'
// - apps: array of app keys affected (for app-specific integrations)

module.exports = [
  {
    key: 'email-provider',
    name: 'Email Provider',
    description: 'Configure CRM outbound email (AMDS default, Resend, SMTP, OCI, AWS SES, Gmail SMTP), send policies, Gmail inbox, inbound webhooks, and deliverability.',
    scope: 'platform',
    apps: ['SALES', 'HELPDESK', 'PROJECTS', 'AUDIT', 'PORTAL'],
    category: 'Communication',
    dataSharedSummary: 'Email addresses, message content, and basic delivery status.',
    dataSharedDetails: 'When enabled, the platform sends transactional and notification emails through this provider. Email addresses, email content, and basic delivery status are shared. No SALES records or attachments are deleted if the integration is disabled.',
    recommended: true
  },
  {
    key: 'calendar-sync',
    name: 'Calendar Sync',
    description: 'Sync meetings and events with external calendar tools.',
    scope: 'app',
    apps: ['SALES', 'PROJECTS', 'AUDIT'],
    category: 'Productivity',
    dataSharedSummary: 'Event titles, times, and participants.',
    dataSharedDetails: 'When enabled, the platform shares event titles, times, and participant information with your external calendar. Disabling sync does not delete existing events in your calendar.',
    recommended: false
  },
  {
    key: 'chat-notifications',
    name: 'Chat & Notifications',
    description: 'Send notifications to chat tools like Slack or Teams.',
    scope: 'platform',
    apps: ['SALES', 'HELPDESK', 'PROJECTS', 'AUDIT', 'PORTAL'],
    category: 'Communication',
    dataSharedSummary: 'Notification messages, links, and basic context.',
    dataSharedDetails: 'When enabled, the platform sends notification messages and links to your chat workspace. Only notification content is shared, not full records.',
    recommended: false
  },
  {
    key: 'webhooks',
    name: 'Outgoing Webhooks',
    description: 'Send event notifications to your own systems or middleware.',
    scope: 'platform',
    apps: ['SALES', 'HELPDESK', 'PROJECTS', 'AUDIT', 'PORTAL'],
    category: 'Automation',
    dataSharedSummary: 'Configured event payloads containing record data.',
    dataSharedDetails: 'When enabled, the platform sends configured event payloads to your endpoints. Payloads may include record IDs, basic field values, and timestamps. Disabling webhooks stops new calls but does not delete any existing data in your systems.',
    recommended: false
  }
];
