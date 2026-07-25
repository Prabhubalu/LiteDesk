'use strict';

const net = require('net');
const http = require('http');

/**
 * Probe a single TCP port on host.
 * @returns {Promise<boolean>}
 */
function probeTcp(host, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch (_) {
        /* ignore */
      }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/**
 * Lightweight Tally XML ping — POST empty company list request.
 * Accepts any HTTP response from a listening Tally XML port.
 */
function probeTallyXml(host, port, timeoutMs = 1500) {
  const xml = [
    '<ENVELOPE>',
    '  <HEADER>',
    '    <VERSION>1</VERSION>',
    '    <TALLYREQUEST>Export</TALLYREQUEST>',
    '    <TYPE>Data</TYPE>',
    '    <ID>List of Companies</ID>',
    '  </HEADER>',
    '  <BODY><DESC></DESC></BODY>',
    '</ENVELOPE>',
  ].join('\n');

  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(xml),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 64_000) res.destroy();
        });
        res.on('end', () => {
          const looksLikeTally =
            res.statusCode === 200 ||
            /<ENVELOPE/i.test(body) ||
            /TALLY/i.test(body) ||
            /COMPANY/i.test(body);
          resolve({
            port,
            open: true,
            xmlOk: looksLikeTally,
            statusCode: res.statusCode,
            sample: body.slice(0, 200),
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ port, open: true, xmlOk: false, error: 'timeout' });
    });
    req.on('error', (err) => {
      resolve({ port, open: false, xmlOk: false, error: err.message });
    });
    req.write(xml);
    req.end();
  });
}

/**
 * Parse company rows from Tally "List of Companies" XML export.
 */
function parseCompaniesFromXml(body, port = null) {
  const xml = String(body || '');
  const companies = [];
  const seen = new Set();

  const companyBlocks = xml.match(/<COMPANY\b[^>]*>[\s\S]*?<\/COMPANY>/gi) || [];
  for (const block of companyBlocks) {
    const name =
      matchTag(block, 'NAME') ||
      matchTag(block, 'COMPANYNAME') ||
      matchTag(block, 'BASICCOMPANYFORMALNAME');
    if (!name) continue;
    const guid =
      matchTag(block, 'REMOTECMPGUID') ||
      matchTag(block, 'GUID') ||
      matchTag(block, 'COMPANYNUMBER') ||
      `tally:${name.toLowerCase()}`;
    const key = `${guid}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    companies.push({
      companyGuid: guid,
      companyName: name,
      financialYear: matchTag(block, 'STARTINGFROM') || matchTag(block, 'BOOKSFROM') || null,
      port,
      xmlEnabled: true,
    });
  }

  if (!companies.length) {
    const nameTags = xml.match(/<COMPANYNAME[^>]*>([^<]+)<\/COMPANYNAME>/gi) || [];
    for (const tag of nameTags) {
      const name = String(tag.replace(/<\/?COMPANYNAME[^>]*>/gi, '')).trim();
      if (!name) continue;
      const guid = `tally:${name.toLowerCase()}`;
      if (seen.has(guid)) continue;
      seen.add(guid);
      companies.push({
        companyGuid: guid,
        companyName: name,
        financialYear: null,
        port,
        xmlEnabled: true,
      });
    }
  }

  return companies;
}

function matchTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const m = String(xml).match(re);
  return m ? String(m[1]).trim() : null;
}

/**
 * Export List of Companies from a live Tally XML port.
 */
async function listCompanies({ host = '127.0.0.1', port } = {}) {
  if (!port) return [];
  const xml = [
    '<ENVELOPE>',
    '  <HEADER>',
    '    <VERSION>1</VERSION>',
    '    <TALLYREQUEST>Export</TALLYREQUEST>',
    '    <TYPE>Data</TYPE>',
    '    <ID>List of Companies</ID>',
    '  </HEADER>',
    '  <BODY><DESC></DESC></BODY>',
    '</ENVELOPE>',
  ].join('\n');

  const result = await new Promise((resolve) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(xml),
        },
        timeout: 8000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
          if (body.length > 2_000_000) res.destroy();
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, body: '', error: 'timeout' });
    });
    req.on('error', (err) => resolve({ statusCode: 0, body: '', error: err.message }));
    req.write(xml);
    req.end();
  });

  return parseCompaniesFromXml(result.body, port);
}

/**
 * Scan localhost ports [portMin, portMax] for a live Tally XML endpoint.
 * @param {{ host?: string, portMin?: number, portMax?: number }} opts
 */
async function discoverTally(opts = {}) {
  const host = opts.host || '127.0.0.1';
  const portMin = opts.portMin ?? 9000;
  const portMax = opts.portMax ?? 9010;
  const openPorts = [];

  for (let port = portMin; port <= portMax; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const open = await probeTcp(host, port);
    if (open) openPorts.push(port);
  }

  const candidates = [];
  for (const port of openPorts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await probeTallyXml(host, port);
    if (result.open) candidates.push(result);
  }

  const preferred = candidates.find((c) => c.xmlOk) || candidates[0] || null;
  let companies = [];
  if (preferred?.port) {
    try {
      companies = await listCompanies({ host, port: preferred.port });
    } catch (_) {
      companies = [];
    }
  }

  return {
    host,
    portMin,
    portMax,
    openPorts,
    candidates,
    companies,
    tallyPort: preferred ? preferred.port : null,
    tallyRunning: Boolean(preferred && preferred.xmlOk !== false),
    tallyVersion: preferred?.sample?.match(/Tally[^<\s]*/i)?.[0] || null,
    discoveredAt: new Date().toISOString(),
  };
}

module.exports = {
  probeTcp,
  probeTallyXml,
  discoverTally,
  listCompanies,
  parseCompaniesFromXml,
};
