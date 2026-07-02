'use strict';

const People = require('../../models/People');
const MarketingAudience = require('../../models/MarketingAudience');
const { parseCSV } = require('../import/importCsvParser');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');

function getSegmentQueryService() {
  return require('./marketingSegmentQueryService');
}

const EMAIL_COLUMN_KEYS = ['email', 'e-mail', 'work_email', 'workemail', 'email_address'];
const NAME_COLUMN_KEYS = ['name', 'full_name', 'fullname', 'first_name', 'firstname'];

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  return email;
}

function detectCsvColumn(headers, candidates) {
  const normalized = headers.map((header) => String(header || '').trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index >= 0) return headers[index];
  }
  return null;
}

function parseAudienceCsv(csvText) {
  const { headers, rows } = parseCSV(csvText);
  if (headers.length === 0) {
    return { error: 'CSV file is empty or missing a header row' };
  }

  const emailColumn =
    detectCsvColumn(headers, EMAIL_COLUMN_KEYS) ||
    headers.find((header) => String(header).toLowerCase().includes('email')) ||
    null;
  if (!emailColumn) {
    return { error: 'CSV must include an email column' };
  }

  const nameColumn =
    detectCsvColumn(headers, NAME_COLUMN_KEYS) ||
    headers.find((header) => String(header).toLowerCase().includes('name')) ||
    null;

  const parsedRows = [];
  for (const row of rows) {
    const email = normalizeEmail(row[emailColumn]);
    if (!email) continue;
    const name = nameColumn ? String(row[nameColumn] || '').trim() : '';
    parsedRows.push({ email, name });
  }

  if (parsedRows.length === 0) {
    return { error: 'No valid email addresses found in CSV' };
  }

  return { rows: parsedRows, emailColumn, nameColumn };
}

async function findPeopleByEmails(organizationId, emails) {
  if (!emails.length) return new Map();
  const people = await runWithOrganizationTenantContext(organizationId, async () =>
    People.find({
      organizationId,
      email: { $in: emails }
    })
      .select('_id email first_name last_name')
      .lean()
  );

  const byEmail = new Map();
  for (const person of people) {
    const email = normalizeEmail(person.email);
    if (email) byEmail.set(email, person);
  }
  return byEmail;
}

function buildExistingEmailSet(audience, excludeAudienceId = null) {
  const emails = new Set();
  if (!audience?.members) return emails;
  if (excludeAudienceId && String(audience._id) === String(excludeAudienceId)) {
    for (const member of audience.members) {
      const email = normalizeEmail(member.email);
      if (email) emails.add(email);
    }
  } else if (!excludeAudienceId) {
    for (const member of audience.members) {
      const email = normalizeEmail(member.email);
      if (email) emails.add(email);
    }
  }
  return emails;
}

async function syncMemberCount(audience) {
  audience.memberCount = Array.isArray(audience.members) ? audience.members.length : 0;
  await audience.save();
  return audience;
}

async function loadAudience(organizationId, audienceId) {
  return runWithOrganizationTenantContext(organizationId, async () =>
    MarketingAudience.findOne({ _id: audienceId, organizationId })
  );
}

async function resolveAudienceRecipients(organizationId, audienceId) {
  const audience = await loadAudience(organizationId, audienceId);
  if (!audience) {
    return { error: 'Audience not found' };
  }

  if (audience.type === 'dynamic') {
    if (!audience.segmentId) {
      return { error: 'Dynamic audience has no segment configured.' };
    }
    return getSegmentQueryService().resolveSegmentRecipients(organizationId, audience.segmentId);
  }

  const recipients = (audience.members || [])
    .map((member) => {
      const email = normalizeEmail(member.email);
      if (!email) return null;
      return {
        email,
        name: member.name ? String(member.name).trim() : undefined,
        recipientId: member.personId
          ? String(member.personId)
          : email,
        mergeData: member.personId ? { personId: String(member.personId) } : undefined
      };
    })
    .filter(Boolean);

  if (recipients.length === 0) {
    return { error: 'Audience has no members with valid email addresses' };
  }

  return recipients;
}

async function importMembersIntoAudience({
  organizationId,
  audience,
  rows,
  fileName = null,
  skipDuplicates = true
}) {
  const existingEmails = buildExistingEmailSet(audience);
  const incomingEmails = [...new Set(rows.map((row) => row.email))];
  const peopleByEmail = await findPeopleByEmails(organizationId, incomingEmails);

  const stats = { added: 0, skipped: 0, duplicates: 0 };
  const duplicateMatches = [];

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) {
      stats.skipped += 1;
      continue;
    }

    if (existingEmails.has(email)) {
      stats.duplicates += 1;
      if (skipDuplicates) continue;
    }

    const person = peopleByEmail.get(email);
    if (person && existingEmails.has(email)) {
      stats.duplicates += 1;
      duplicateMatches.push({
        email,
        personId: person._id,
        reason: 'already_in_audience'
      });
      if (skipDuplicates) continue;
    }

    const name =
      row.name ||
      [person?.first_name, person?.last_name].filter(Boolean).join(' ') ||
      '';

    audience.members.push({
      personId: person?._id || null,
      email,
      name,
      source: person ? 'people' : 'import',
      addedAt: new Date()
    });
    existingEmails.add(email);
    stats.added += 1;
  }

  audience.importMetadata = {
    lastImportAt: new Date(),
    lastImportFileName: fileName,
    lastImportStats: stats
  };

  await syncMemberCount(audience);

  return { audience, stats, duplicateMatches };
}

async function addMembersToAudience({
  organizationId,
  audience,
  members = []
}) {
  const existingEmails = buildExistingEmailSet(audience);
  const normalized = members
    .map((member) => ({
      personId: member.personId || null,
      email: normalizeEmail(member.email),
      name: member.name ? String(member.name).trim() : ''
    }))
    .filter((member) => member.email);

  const peopleByEmail = await findPeopleByEmails(
    organizationId,
    normalized.map((member) => member.email)
  );

  const stats = { added: 0, skipped: 0, duplicates: 0 };

  for (const member of normalized) {
    if (existingEmails.has(member.email)) {
      stats.duplicates += 1;
      continue;
    }

    const person = member.personId
      ? null
      : peopleByEmail.get(member.email);

    audience.members.push({
      personId: member.personId || person?._id || null,
      email: member.email,
      name:
        member.name ||
        [person?.first_name, person?.last_name].filter(Boolean).join(' ') ||
        '',
      source: member.personId || person ? 'people' : 'manual',
      addedAt: new Date()
    });
    existingEmails.add(member.email);
    stats.added += 1;
  }

  await syncMemberCount(audience);
  return { audience, stats };
}

async function checkDuplicateEmails(organizationId, emails, audienceId = null) {
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (normalized.length === 0) {
    return { duplicates: [], peopleMatches: [] };
  }

  const peopleByEmail = await findPeopleByEmails(organizationId, normalized);
  const audience =
    audienceId != null ? await loadAudience(organizationId, audienceId) : null;
  const existingEmails = audience ? buildExistingEmailSet(audience) : new Set();

  const duplicates = [];
  const peopleMatches = [];

  for (const email of normalized) {
    if (existingEmails.has(email)) {
      duplicates.push({ email, reason: 'already_in_audience' });
    }
    const person = peopleByEmail.get(email);
    if (person) {
      peopleMatches.push({
        email,
        personId: person._id,
        name: [person.first_name, person.last_name].filter(Boolean).join(' ')
      });
    }
  }

  return { duplicates, peopleMatches };
}

function paginateMembers(members, { page = 1, limit = 50, search = '' } = {}) {
  const query = String(search || '').trim().toLowerCase();
  let filtered = members;
  if (query) {
    filtered = members.filter((member) => {
      const email = String(member.email || '').toLowerCase();
      const name = String(member.name || '').toLowerCase();
      return email.includes(query) || name.includes(query);
    });
  }

  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * safeLimit;
  const items = filtered.slice(skip, skip + safeLimit);

  return {
    items,
    total: filtered.length,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(filtered.length / safeLimit))
  };
}

function buildAudienceExportCsv(audience) {
  const lines = ['email,name,person_id,source,added_at'];
  for (const member of audience.members || []) {
    const email = String(member.email || '').replace(/"/g, '""');
    const name = String(member.name || '').replace(/"/g, '""');
    const personId = member.personId ? String(member.personId) : '';
    const source = String(member.source || 'manual');
    const addedAt = member.addedAt ? new Date(member.addedAt).toISOString() : '';
    lines.push(`"${email}","${name}","${personId}","${source}","${addedAt}"`);
  }
  return `${lines.join('\n')}\n`;
}

async function syncDynamicAudienceFromSegment(audience) {
  if (audience.type !== 'dynamic' || !audience.segmentId) {
    return audience;
  }

  const segment = await getSegmentQueryService().loadSegment(
    audience.organizationId,
    audience.segmentId
  );
  if (!segment) {
    audience.memberCount = 0;
    await audience.save();
    return audience;
  }

  audience.memberCount = segment.memberCount || 0;
  await audience.save();
  return audience;
}

module.exports = {
  normalizeEmail,
  parseAudienceCsv,
  loadAudience,
  resolveAudienceRecipients,
  importMembersIntoAudience,
  addMembersToAudience,
  checkDuplicateEmails,
  paginateMembers,
  buildAudienceExportCsv,
  syncMemberCount,
  syncDynamicAudienceFromSegment
};
