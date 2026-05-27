#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Create mailboxes locally without a remote Arivu parser.
 *
 * Usage:
 *   npm run simulate:mailbox
 *   npm run simulate:mailbox -- --kind group --label "Support"
 *   npm run simulate:mailbox -- --kind personal --label "My Inbox"
 *   npm run simulate:mailbox -- --list
 *   npm run simulate:mailbox -- --org-id <id> --user-email admin@example.com
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const {
  resolveOrganizationContext,
  createSimulatedMailbox,
  listSimulatedMailboxes
} = require('../services/localParserProvisioningService');

function parseArgs(argv) {
  const out = {
    kind: 'group',
    label: 'Local Support',
    emailAddress: '',
    orgId: null,
    userId: null,
    userEmail: process.env.DEFAULT_ADMIN_EMAIL || null,
    list: false
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') out.list = true;
    else if (a === '--kind') out.kind = argv[++i];
    else if (a === '--label') out.label = argv[++i];
    else if (a === '--email') out.emailAddress = argv[++i];
    else if (a === '--org-id') out.orgId = argv[++i];
    else if (a === '--user-id') out.userId = argv[++i];
    else if (a === '--user-email') out.userEmail = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`
Create a mailbox locally (parser provisioning simulated — no remote parser).

  npm run simulate:mailbox [options]

Options:
  --kind group|personal   Mailbox type (default: group)
  --label <text>          Display label (default: "Local Support")
  --email <address>       Optional email address on the mailbox
  --org-id <id>           Organization ObjectId (auto-detect if omitted)
  --user-id <id>          Creator / personal owner user id
  --user-email <email>    Resolve org user by email (default: DEFAULT_ADMIN_EMAIL)
  --list                  List mailboxes for the org

Examples:
  npm run simulate:mailbox
  npm run simulate:mailbox -- --kind group --label "Support Inbox"
  npm run simulate:mailbox -- --list
  npm run simulate:parser-inbound -- --mailbox-id <id from output>
`);
}

async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ariv';
  await mongoose.connect(uri, {
    dbName: process.env.MASTER_DB_NAME || undefined
  });
  console.log('Connected to MongoDB');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    await connectMongo();
    const { organization, user } = await resolveOrganizationContext({
      organizationId: args.orgId,
      userEmail: args.userEmail
    });

    if (args.list) {
      const rows = await listSimulatedMailboxes(organization._id);
      console.log(`Mailboxes for org ${organization._id} (${organization.name || 'unnamed'}):`);
      if (!rows.length) {
        console.log('  (none)');
        return;
      }
      for (const mb of rows) {
        console.log({
          id: String(mb._id),
          kind: mb.kind,
          label: mb.label,
          routingAddress: mb.routingAddress || '',
          parserProvisionStatus: mb.parserProvisionStatus,
          status: mb.status
        });
      }
      return;
    }

    const userId = args.userId || user._id;
    console.log('Creating simulated mailbox...');
    console.log({
      organizationId: String(organization._id),
      userId: String(userId),
      kind: args.kind,
      label: args.label
    });

    const result = await createSimulatedMailbox({
      organizationId: organization._id,
      userId,
      kind: args.kind,
      label: args.label,
      emailAddress: args.emailAddress,
      memberUserIds: args.kind === 'group' ? [userId] : []
    });

    const mb = result.mailbox;
    console.log(result.created ? 'Mailbox created.' : 'Existing personal mailbox re-provisioned locally.');
    console.log({
      mailboxId: String(mb._id),
      kind: mb.kind,
      label: mb.label,
      routingAddress: mb.routingAddress,
      parserTenantId: mb.parserTenantId,
      parserMailboxId: mb.parserMailboxId,
      parserProvisionStatus: mb.parserProvisionStatus
    });
    console.log('\nNext: refresh Inbox in the app, or simulate inbound:');
    console.log(
      `  npm run simulate:parser-inbound -- --mailbox-id ${String(mb._id)}`
    );
  } catch (err) {
    console.error('Simulation failed:', err.message);
    process.exitCode = 1;
  } finally {
    try {
      const dbConnectionManager = require('../utils/databaseConnectionManager');
      await dbConnectionManager.closeAllConnections();
    } catch {
      await mongoose.disconnect().catch(() => {});
    }
    process.exit(process.exitCode || 0);
  }
}

main();
