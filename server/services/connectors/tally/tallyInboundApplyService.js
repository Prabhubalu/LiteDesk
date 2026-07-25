'use strict';

/**
 * Apply inbound Tally export XML (from agent ack) into Arivu external-object catalog.
 * Creates pending links (arivuId = pending:…) until mapping review binds them.
 */

const ConnectorExternalObject = require('../../../models/ConnectorExternalObject');
const { CONNECTOR_KEYS } = require('../connectorConstants');
const partyMapper = require('./mappers/partyMapper');

function extractTagValues(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
  const values = [];
  let m;
  while ((m = re.exec(String(xml || ''))) !== null) {
    const v = String(m[1] || '').trim();
    if (v) values.push(v);
  }
  return values;
}

function parseNames(xml) {
  const names = extractTagValues(xml, 'NAME');
  return [...new Set(names)].filter((n) => n.length > 1 && n.length < 200).slice(0, 500);
}

async function upsertExternal({
  organizationId,
  entityType,
  externalId,
  companyGuid,
  remotePayload,
  jobId,
}) {
  const pendingArivuId = `pending:${externalId}`;
  const existing = await ConnectorExternalObject.findOne({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    externalId,
  });
  if (existing) {
    existing.lastSyncedAt = new Date();
    existing.lastDirection = 'inbound';
    existing.metadata = {
      ...(existing.metadata || {}),
      remotePayload,
      lastJobId: jobId,
    };
    await existing.save();
    return { upserted: false };
  }

  await ConnectorExternalObject.create({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    arivuId: pendingArivuId,
    externalId,
    companyGuid,
    lastSyncedAt: new Date(),
    lastDirection: 'inbound',
    metadata: { remotePayload, source: 'inbound_export', jobId },
  });
  return { upserted: true };
}

async function applyInboundExport({
  organizationId,
  companyGuid = null,
  masterType = 'Ledger',
  body = '',
  jobId = null,
} = {}) {
  const xml = String(body || '');
  if (!xml || xml.length < 20) {
    return { applied: 0, created: 0, skipped: true };
  }

  let applied = 0;
  let created = 0;
  const mt = String(masterType || '');

  if (mt === 'Ledger' || /ledger/i.test(mt)) {
    for (const name of parseNames(xml)) {
      const externalId = `tally:ledger:${name.toLowerCase()}`;
      const patch = partyMapper.fromTally({ name, NAME: name });
      // eslint-disable-next-line no-await-in-loop
      const r = await upsertExternal({
        organizationId,
        entityType: 'party',
        externalId,
        companyGuid,
        remotePayload: patch,
        jobId,
      });
      applied += 1;
      if (r.upserted) created += 1;
    }
  }

  if (mt === 'StockItem' || /stock/i.test(mt)) {
    for (const name of parseNames(xml).slice(0, 300)) {
      const externalId = `tally:item:${name.toLowerCase()}`;
      // eslint-disable-next-line no-await-in-loop
      const r = await upsertExternal({
        organizationId,
        entityType: 'item',
        externalId,
        companyGuid,
        remotePayload: { name },
        jobId,
      });
      applied += 1;
      if (r.upserted) created += 1;
    }
  }

  if (mt === 'Godown' || /godown/i.test(mt)) {
    for (const name of parseNames(xml).slice(0, 100)) {
      const externalId = `tally:godown:${name.toLowerCase()}`;
      // eslint-disable-next-line no-await-in-loop
      const r = await upsertExternal({
        organizationId,
        entityType: 'godown',
        externalId,
        companyGuid,
        remotePayload: { name },
        jobId,
      });
      applied += 1;
      if (r.upserted) created += 1;
    }
  }

  return { applied, created, masterType: mt };
}

module.exports = {
  applyInboundExport,
  parseNames,
};
