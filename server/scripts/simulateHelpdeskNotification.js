#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Simulate helpdesk realtime notifications (dev / ENABLE_NOTIFICATION_SIMULATE).
 *
 * Usage:
 *   npm run simulate:helpdesk-notification
 *   npm run simulate:helpdesk-notification -- --event CASE_EMAIL_RECEIVED
 *   npm run simulate:helpdesk-notification -- --user-email admin@example.com --mode pipeline --case-id <mongoId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const domainEvents = require('../constants/domainEvents');
const {
  isSimulationEnabled,
  SIMULATABLE_EVENTS,
  simulateHelpdeskNotification
} = require('../services/notificationDevSimulator');

function parseArgs(argv) {
  const out = {
    eventType: domainEvents.CASE_EMAIL_RECEIVED,
    mode: 'self',
    userEmail: null,
    userId: null,
    caseId: null,
    help: false
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--event') out.eventType = argv[++i];
    else if (a === '--mode') out.mode = argv[++i];
    else if (a === '--user-email') out.userEmail = argv[++i];
    else if (a === '--user-id') out.userId = argv[++i];
    else if (a === '--case-id') out.caseId = argv[++i];
  }
  return out;
}

function printHelp() {
  console.log(`
Simulate helpdesk notifications locally.

  npm run simulate:helpdesk-notification [options]

Options:
  --event <TYPE>       ${SIMULATABLE_EVENTS.join(' | ')}  (default: CASE_EMAIL_RECEIVED)
  --mode self|pipeline self = deliver to user directly; pipeline = real rules (default: self)
  --user-email <email> Target user (default: first active user with HELPDESK)
  --user-id <id>       Target user ObjectId
  --case-id <id>       Case ObjectId (required for pipeline mode)

Examples:
  npm run simulate:helpdesk-notification
  npm run simulate:helpdesk-notification -- --event CASE_CHAT_MESSAGE_RECEIVED
  npm run simulate:helpdesk-notification -- --user-email you@company.com --event CASE_CREATED
`);
}

async function resolveUser({ userEmail, userId }) {
  if (userId) {
    return User.findById(userId).select('_id email organizationId allowedApps').lean();
  }
  if (userEmail) {
    return User.findOne({ email: userEmail.toLowerCase().trim() })
      .select('_id email organizationId allowedApps')
      .lean();
  }
  return User.findOne({
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
    allowedApps: { $in: ['HELPDESK'] }
  })
    .select('_id email organizationId allowedApps')
    .lean();
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!isSimulationEnabled()) {
    console.error('Simulation disabled. Use development NODE_ENV or ENABLE_NOTIFICATION_SIMULATE=true');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const user = await resolveUser(args);
  if (!user) {
    console.error('No user found. Pass --user-email or --user-id');
    process.exit(1);
  }

  const result = await simulateHelpdeskNotification({
    userId: user._id,
    organizationId: user.organizationId,
    eventType: args.eventType,
    mode: args.mode,
    caseId: args.caseId
  });

  console.log('\nSimulation complete');
  console.log('  User:', user.email, String(user._id));
  console.log('  Event:', args.eventType);
  console.log('  Mode:', result.mode);
  if (result.notificationId) console.log('  Notification id:', result.notificationId);
  console.log('\nIn the app: open /helpdesk/cases (logged in as this user) and watch the bell + toast + sound.');
  console.log('SSE only delivers while the browser tab is on a /helpdesk/ route.\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
