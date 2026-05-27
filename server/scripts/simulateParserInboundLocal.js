#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Simulate Arivu parser → CRM inbound without a remote parser server.
 *
 * Modes:
 *   direct (default) — inject message body, skip webhook + parser API fetch
 *   http             — POST local webhook + mock parser message API
 *
 * Usage:
 *   node scripts/simulateParserInboundLocal.js
 *   node scripts/simulateParserInboundLocal.js --from customer@example.com --subject "Test" --body "Hello"
 *   node scripts/simulateParserInboundLocal.js --org-id <mongoOrgId> --mailbox-id <mongoMailboxId>
 *   node scripts/simulateParserInboundLocal.js --enable-mailroom
 *   node scripts/simulateParserInboundLocal.js --http --crm-url http://localhost:3000
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const http = require('http');
const mongoose = require('mongoose');

const ParserInboundEvent = require('../models/ParserInboundEvent');
const ParserMailboxRegistry = require('../models/ParserMailboxRegistry');
const PlatformInboundParserConfig = require('../models/PlatformInboundParserConfig');
const Mailbox = require('../models/Mailbox');
const TenantMailroomConfig = require('../models/TenantMailroomConfig');
const { getTemplate } = require('../platform/mailroom/policies/templates/defaultTemplates');
const { encryptTenantSecret } = require('../utils/tenantSecretCrypto');
const {
  toParserTenantId,
  toParserMailboxId
} = require('../utils/parserIdCodec');
const {
  processParserInboundEventWithMessage
} = require('../services/inboundParserMessageService');

function parseArgs(argv) {
  const out = {
    mode: 'direct',
    orgId: null,
    mailboxId: null,
    from: 'simulated-customer@example.com',
    subject: `[Simulated] Parser inbound ${new Date().toISOString()}`,
    body: 'This is a simulated inbound email from the local parser simulator.',
    enableMailroom: false,
    crmUrl: process.env.CRM_PUBLIC_API_BASE_URL || 'http://localhost:3000',
    threadId: `sim-thread-${Date.now()}`
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--http') out.mode = 'http';
    else if (a === '--direct') out.mode = 'direct';
    else if (a === '--enable-mailroom') out.enableMailroom = true;
    else if (a === '--org-id') out.orgId = argv[++i];
    else if (a === '--mailbox-id') out.mailboxId = argv[++i];
    else if (a === '--from') out.from = argv[++i];
    else if (a === '--subject') out.subject = argv[++i];
    else if (a === '--body') out.body = argv[++i];
    else if (a === '--crm-url') out.crmUrl = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`
Simulate parser inbound locally (no remote parser required).

  node scripts/simulateParserInboundLocal.js [options]

Options:
  --direct              Inject message directly (default)
  --http                POST webhook to local CRM + mock parser API
  --org-id <id>         Organization ObjectId (auto-picks first mailbox if omitted)
  --mailbox-id <id>     Mailbox ObjectId
  --from <email>        Sender address
  --subject <text>      Email subject
  --body <text>         Email body
  --enable-mailroom     Enable Mailroom for org before simulate
  --crm-url <url>       CRM base URL for --http (default http://localhost:3000)

Examples:
  node scripts/simulateParserInboundLocal.js
  node scripts/simulateParserInboundLocal.js --enable-mailroom
  node scripts/simulateParserInboundLocal.js --http --from support@acme.com
`);
}

async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ariv';
  await mongoose.connect(uri, {
    dbName: process.env.MASTER_DB_NAME || undefined
  });
  console.log('Connected to MongoDB');
}

async function resolveMailboxContext(args) {
  let organizationId = args.orgId;
  let mailboxObjectId = args.mailboxId;

  if (organizationId && mailboxObjectId) {
    return { organizationId, mailboxObjectId };
  }

  const mailboxQuery = {};
  if (mailboxObjectId) mailboxQuery._id = mailboxObjectId;
  if (organizationId) mailboxQuery.organizationId = organizationId;

  const mailbox = await Mailbox.findOne(mailboxQuery).sort({ kind: 1, updatedAt: -1 }).lean();
  if (!mailbox) {
    throw new Error(
      'No mailbox found. Create a mailbox in the app or pass --org-id and --mailbox-id.'
    );
  }

  organizationId = String(mailbox.organizationId);
  mailboxObjectId = String(mailbox._id);
  return { organizationId, mailboxObjectId, mailbox };
}

async function ensureParserRegistry(organizationId, mailboxObjectId, mailbox) {
  const parserTenantId =
    mailbox?.parserTenantId || toParserTenantId(organizationId);
  const parserMailboxId =
    mailbox?.parserMailboxId || toParserMailboxId(mailboxObjectId);

  await ParserMailboxRegistry.findOneAndUpdate(
    { parserTenantId, parserMailboxId },
    {
      $set: {
        organizationId,
        mailboxObjectId
      }
    },
    { upsert: true, new: true }
  );

  return { parserTenantId, parserMailboxId };
}

function buildMessagePayload(args, parserTenantId) {
  const messageId = `<sim-${Date.now()}@local.test>`;
  return {
    tenantId: parserTenantId,
    messageId,
    from: { address: args.from, name: 'Simulated Customer' },
    fromAddress: args.from,
    subject: args.subject,
    textBody: args.body,
    body: args.body,
    to: [{ address: 'support@local.test' }],
    receivedAt: new Date().toISOString(),
    threadId: args.threadId
  };
}

async function maybeEnableMailroom(organizationId, enable) {
  if (!enable) return;
  const template = getTemplate('helpdesk_standard_email');
  await TenantMailroomConfig.findOneAndUpdate(
    { organizationId },
    {
      $set: {
        organizationId,
        enabled: true,
        activeTemplateId: template.id,
        policies: template.policies,
        connectors: template.connectors
      }
    },
    { upsert: true }
  );
  console.log('Mailroom enabled for organization', organizationId);
}

async function ensureInboundParserConfiguredForHttp({ mockParserBaseUrl, crmUrl, apiKey, webhookSecret }) {
  await PlatformInboundParserConfig.findByIdAndUpdate(
    'default',
    {
      $set: {
        enabled: true,
        parserApiBaseUrl: mockParserBaseUrl,
        crmPublicApiBaseUrl: crmUrl.replace(/\/+$/, ''),
        encryptedParserApiKey: encryptTenantSecret(apiKey),
        encryptedWebhookSecret: encryptTenantSecret(webhookSecret)
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  console.log('Updated Control Plane inbound parser config for local HTTP simulation');
}

async function runDirectSimulation(args) {
  const { organizationId, mailboxObjectId, mailbox } = await resolveMailboxContext(args);
  const { parserTenantId, parserMailboxId } = await ensureParserRegistry(
    organizationId,
    mailboxObjectId,
    mailbox
  );

  await maybeEnableMailroom(organizationId, args.enableMailroom);

  const parserMessageId = `sim-msg-${Date.now()}`;
  const eventDoc = await ParserInboundEvent.create({
    parserMessageId,
    parserTenantId,
    parserMailboxId,
    parserThreadId: args.threadId,
    receivedAt: new Date(),
    status: 'received'
  });

  const messagePayload = buildMessagePayload(args, parserTenantId);
  console.log('Simulating parser inbound (direct)...');
  console.log({
    organizationId,
    mailboxObjectId,
    parserTenantId,
    parserMailboxId,
    parserMessageId
  });

  const result = await processParserInboundEventWithMessage(
    eventDoc.toObject(),
    messagePayload
  );

  console.log('Simulation complete:', result);
  return result;
}

function startMockParserServer(messagePayload) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url.includes('/integrations/v1/messages/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: messagePayload }));
        return;
      }
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function runHttpSimulation(args) {
  const { organizationId, mailboxObjectId, mailbox } = await resolveMailboxContext(args);
  const { parserTenantId, parserMailboxId } = await ensureParserRegistry(
    organizationId,
    mailboxObjectId,
    mailbox
  );

  await maybeEnableMailroom(organizationId, args.enableMailroom);

  const parserMessageId = `sim-msg-${Date.now()}`;
  const messagePayload = buildMessagePayload(args, parserTenantId);

  const { server, baseUrl } = await startMockParserServer(messagePayload);
  const apiKey = process.env.PARSER_CRM_API_KEY || 'local-sim-key';
  const secret = process.env.ARIVU_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || 'local-webhook-secret';

  await ensureInboundParserConfiguredForHttp({
    mockParserBaseUrl: baseUrl,
    crmUrl: args.crmUrl,
    apiKey,
    webhookSecret: secret
  });

  const webhookBody = JSON.stringify({
    event: 'email.received',
    messageId: parserMessageId,
    tenantId: parserTenantId,
    mailboxId: parserMailboxId,
    threadId: args.threadId,
    receivedAt: new Date().toISOString()
  });

  const signature =
    `sha256=${crypto.createHmac('sha256', secret).update(webhookBody, 'utf8').digest('hex')}`;

  const url = `${args.crmUrl.replace(/\/+$/, '')}/api/webhooks/arivu/inbound-email`;
  console.log('POST webhook (async background process):', url);
  console.log('Mock parser API:', baseUrl);
  console.log('Ensure the CRM server is running and uses the same MongoDB as this script.');

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-arivu-signature': signature
      },
      body: webhookBody
    });
  } catch (err) {
    server.close();
    throw new Error(
      `Could not reach CRM at ${url}. Start the server (npm run dev) and retry. ${err.message}`
    );
  }

  const json = await res.json().catch(() => ({}));
  console.log('Webhook response:', res.status, json);

  if (res.status === 503 && json.code === 'INBOUND_PARSER_NOT_CONFIGURED') {
    server.close();
    throw new Error(
      'CRM rejected webhook: inbound parser not enabled. '
      + 'Restart the CRM server so it picks up the Control Plane config written by this script, '
      + 'or set INBOUND_PARSER_ENABLED=true and PARSER_API_BASE_URL in server/.env.'
    );
  }

  if (!res.ok) {
    server.close();
    throw new Error(`Webhook failed with status ${res.status}`);
  }

  console.log('Waiting for background processing...');
  await new Promise((r) => setTimeout(r, 2500));

  const event = await ParserInboundEvent.findOne({ parserMessageId }).lean();
  console.log('ParserInboundEvent status:', event?.status, event?.communicationId || '');

  server.close();
  return event;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    await connectMongo();
    if (args.mode === 'http') {
      await runHttpSimulation(args);
    } else {
      await runDirectSimulation(args);
    }
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
