'use strict';

const net = require('net');
const http = require('http');
const { companiesListEnvelope, metaEnvelope, ARIVU_TDL_PACK_VERSION } = require('./arivuTdlXml');

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
 * Handles COMPANY blocks, NAME attrs, COMPANYNAME tags, and COLLECTION dumps.
 */
function parseCompaniesFromXml(body, port = null) {
  const xml = String(body || '');
  const companies = [];
  const seen = new Set();

  const push = (name, guidHint = null, fy = null) => {
    const companyName = String(name || '').trim();
    if (!companyName || companyName.length < 2) return;
    // Skip noise from nested NAME tags (e.g. "Primary", "Yes", dates)
    if (/^(yes|no|primary|null|undefined|\d+)$/i.test(companyName)) return;
    const companyGuid = String(
      guidHint || `tally:${companyName.toLowerCase()}`
    ).trim();
    const key = companyGuid.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    companies.push({
      companyGuid,
      companyName,
      financialYear: fy,
      port,
      xmlEnabled: true,
    });
  };

  // <COMPANY NAME="Acme">…</COMPANY> or <COMPANY>…<NAME>Acme</NAME>
  const companyBlocks = xml.match(/<COMPANY\b[^>]*>[\s\S]*?<\/COMPANY>/gi) || [];
  for (const block of companyBlocks) {
    const attrName = (block.match(/<COMPANY\b[^>]*\bNAME\s*=\s*"([^"]+)"/i) || [])[1];
    const name =
      attrName ||
      matchTag(block, 'NAME') ||
      matchTag(block, 'COMPANYNAME') ||
      matchTag(block, 'BASICCOMPANYFORMALNAME');
    const guid =
      matchTag(block, 'REMOTECMPGUID') ||
      matchTag(block, 'GUID') ||
      matchTag(block, 'COMPANYNUMBER') ||
      null;
    const fy = matchTag(block, 'STARTINGFROM') || matchTag(block, 'BOOKSFROM') || null;
    push(name, guid, fy);
  }

  if (!companies.length) {
    const nameTags = xml.match(/<COMPANYNAME[^>]*>([^<]+)<\/COMPANYNAME>/gi) || [];
    for (const tag of nameTags) {
      push(String(tag.replace(/<\/?COMPANYNAME[^>]*>/gi, '')).trim());
    }
  }

  // <COMPANY.LIST>…<NAME>…  (Tally.NET / some exports)
  if (!companies.length) {
    const listBlocks = xml.match(/<COMPANY\.LIST\b[^>]*>[\s\S]*?<\/COMPANY\.LIST>/gi) || [];
    for (const block of listBlocks) {
      const names = extractAllTags(block, 'NAME');
      for (const n of names) push(n);
      const attrNames = block.match(/\bNAME\s*=\s*"([^"]+)"/gi) || [];
      for (const a of attrNames) {
        const m = a.match(/"([^"]+)"/);
        if (m) push(m[1]);
      }
    }
  }

  // Bare repeating <COMPANY.LIST><NAME>x</NAME></COMPANY.LIST> without outer match
  if (!companies.length && /COMPANY\.LIST/i.test(xml)) {
    const names = extractAllTags(xml, 'NAME').filter((n) => n.length >= 2 && /[A-Za-z]/.test(n));
    for (const n of names) {
      if (!/^(yes|no|primary|name|company|guid)$/i.test(n)) push(n);
    }
  }

  return companies;
}

function extractAllTags(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(String(xml || ''))) !== null) {
    const v = String(m[1] || '').trim();
    if (v) out.push(v);
  }
  return out;
}

function matchTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const m = String(xml).match(re);
  return m ? String(m[1]).trim() : null;
}

/**
 * Export List of Companies from a live Tally XML port.
 * Tries several envelope shapes used across TallyPrime / ERP 9 releases.
 * @returns {Promise<{ companies: object[], diagnostics: object }>}
 */
async function listCompanies({ host = '127.0.0.1', port } = {}) {
  if (!port) return { companies: [], diagnostics: { reason: 'no_port' } };

  const envelopes = [
    // Arivu TDL collection (file TDL + inline fallback) — preferred
    companiesListEnvelope(),
    // Official-style Collection + TDL (works when company list is empty for simple Export)
    [
      '<ENVELOPE>',
      '  <HEADER>',
      '    <VERSION>1</VERSION>',
      '    <TALLYREQUEST>Export</TALLYREQUEST>',
      '    <TYPE>Collection</TYPE>',
      '    <ID>List of Companies</ID>',
      '  </HEADER>',
      '  <BODY>',
      '    <DESC>',
      '      <STATICVARIABLES>',
      '        <SVIsSimpleCompany>No</SVIsSimpleCompany>',
      '      </STATICVARIABLES>',
      '      <TDL>',
      '        <TDLMESSAGE>',
      '          <COLLECTION NAME="List of Companies" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="Yes" ISOPTION="No" ISINTERNAL="No">',
      '            <TYPE>Company</TYPE>',
      '            <NATIVEMETHOD>Name</NATIVEMETHOD>',
      '            <NATIVEMETHOD>GUID</NATIVEMETHOD>',
      '            <NATIVEMETHOD>StartingFrom</NATIVEMETHOD>',
      '          </COLLECTION>',
      '        </TDLMESSAGE>',
      '      </TDL>',
      '    </DESC>',
      '  </BODY>',
      '</ENVELOPE>',
    ].join('\n'),
    // Modern EXPORTDATA (TallyPrime)
    [
      '<ENVELOPE>',
      ' <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>',
      ' <BODY>',
      '  <EXPORTDATA>',
      '   <REQUESTDESC>',
      '    <REPORTNAME>List of Companies</REPORTNAME>',
      '    <STATICVARIABLES>',
      '     <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>',
      '    </STATICVARIABLES>',
      '   </REQUESTDESC>',
      '  </EXPORTDATA>',
      ' </BODY>',
      '</ENVELOPE>',
    ].join('\n'),
    // Classic Data / ID
    [
      '<ENVELOPE>',
      '  <HEADER>',
      '    <VERSION>1</VERSION>',
      '    <TALLYREQUEST>Export</TALLYREQUEST>',
      '    <TYPE>Data</TYPE>',
      '    <ID>List of Companies</ID>',
      '  </HEADER>',
      '  <BODY><DESC></DESC></BODY>',
      '</ENVELOPE>',
    ].join('\n'),
    // Collection without TDL
    [
      '<ENVELOPE>',
      '  <HEADER>',
      '    <VERSION>1</VERSION>',
      '    <TALLYREQUEST>Export</TALLYREQUEST>',
      '    <TYPE>Collection</TYPE>',
      '    <ID>List of Companies</ID>',
      '  </HEADER>',
      '  <BODY><DESC></DESC></BODY>',
      '</ENVELOPE>',
    ].join('\n'),
  ];

  const attempts = [];
  for (let i = 0; i < envelopes.length; i += 1) {
    const xml = envelopes[i];
    // eslint-disable-next-line no-await-in-loop
    const result = await postTallyXml(host, port, xml);
    const companies = parseCompaniesFromXml(result.body, port);
    attempts.push({
      index: i,
      statusCode: result.statusCode,
      bodyLen: (result.body || '').length,
      sample: String(result.body || '').slice(0, 600),
      parsed: companies.length,
      error: result.error || null,
    });
    if (companies.length) {
      return { companies, diagnostics: { attempts, matchedEnvelope: i } };
    }
  }

  return {
    companies: [],
    diagnostics: {
      attempts,
      reason: 'empty_company_list',
      hint:
        'Tally XML port answered but returned no company names. Ensure a company data folder exists, Tally HTTP is on (F12), and Arivu Connector (--tray) is running in your Windows user session (not only the service).',
    },
  };
}

/**
 * Probe whether Arivu TDL pack is loaded (Meta collection / version compute).
 */
async function probeTdlPack({ host = '127.0.0.1', port } = {}) {
  if (!port) {
    return {
      loaded: false,
      packVersion: null,
      expectedVersion: ARIVU_TDL_PACK_VERSION,
      reason: 'no_port',
    };
  }
  const result = await postTallyXml(host, port, metaEnvelope());
  const body = String(result.body || '');
  const hasEnvelope = /<ENVELOPE/i.test(body);
  const versionMatch =
    body.match(/ArivuTdlPackVersion[^>]*>\s*([^<\s]+)/i) ||
    body.match(/<ARIVUTDLPACKVERSION[^>]*>\s*([^<\s]+)/i) ||
    body.match(/TDL Pack Version:\s*([0-9.]+)/i);
  const packVersion = versionMatch ? String(versionMatch[1]).trim() : null;
  // Meta collection responding with company-ish XML is enough to prove TDL collections resolve
  const collectionHit =
    /Arivu Connector Meta/i.test(body) ||
    /ARIVUTDLPACK/i.test(body) ||
    Boolean(packVersion) ||
    (hasEnvelope && result.statusCode === 200 && body.length > 80 && !/unknown|does not exist|LINEERROR/i.test(body));

  return {
    loaded: Boolean(collectionHit),
    packVersion: packVersion || (collectionHit ? ARIVU_TDL_PACK_VERSION : null),
    expectedVersion: ARIVU_TDL_PACK_VERSION,
    statusCode: result.statusCode,
    sample: body.slice(0, 400),
    error: result.error || null,
  };
}

function postTallyXml(host, port, xml) {
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
  let companyListError = null;
  let companyDiagnostics = null;
  let tdlPack = {
    loaded: false,
    packVersion: null,
    expectedVersion: ARIVU_TDL_PACK_VERSION,
  };
  if (preferred?.port) {
    try {
      const listed = await listCompanies({ host, port: preferred.port });
      // Back-compat: listCompanies used to return an array
      if (Array.isArray(listed)) {
        companies = listed;
      } else {
        companies = listed.companies || [];
        companyDiagnostics = listed.diagnostics || null;
      }
    } catch (err) {
      companies = [];
      companyListError = err.message;
    }
    try {
      tdlPack = await probeTdlPack({ host, port: preferred.port });
    } catch (err) {
      tdlPack = {
        loaded: false,
        packVersion: null,
        expectedVersion: ARIVU_TDL_PACK_VERSION,
        error: err.message,
      };
    }
    // Prefer Arivu companies envelope success as hard proof TDL collections resolve
    if (companyDiagnostics?.matchedEnvelope === 0) {
      tdlPack = {
        ...tdlPack,
        loaded: true,
        packVersion: tdlPack.packVersion || ARIVU_TDL_PACK_VERSION,
        via: 'arivu_companies_collection',
      };
    }
  }

  const hint =
    preferred && !tdlPack.loaded
      ? 'Arivu TDL pack not detected. Load ArivuConnector.tdl (or ArivuConnector.All.tdl) via F1 → TDL & Add-On → Manage Local TDLs, restart Tally until Gateway shows Arivu Connector v1.0.0, enable HTTP 9000.'
      : preferred && companies.length === 0
        ? 'Tally XML answered but no companies. Open a company in Tally, keep Desktop → Arivu Connector open, then Dry run again.'
        : !preferred
          ? 'Tally XML port not found on 9000–9010. Load Arivu TDL + enable HTTP (F12).'
          : null;

  return {
    host,
    portMin,
    portMax,
    openPorts,
    candidates: candidates.map((c) => ({
      port: c.port,
      xmlOk: c.xmlOk,
      statusCode: c.statusCode,
      sample: c.sample,
      error: c.error,
    })),
    companies,
    companyListError,
    companyDiagnostics,
    tdlPack,
    tdlLoaded: Boolean(tdlPack.loaded),
    tdlPackVersion: tdlPack.packVersion || null,
    tallyPort: preferred ? preferred.port : null,
    tallyRunning: Boolean(preferred && preferred.xmlOk !== false),
    tallyVersion: preferred?.sample?.match(/Tally[^<\s]*/i)?.[0] || null,
    discoveredAt: new Date().toISOString(),
    hint,
  };
}

module.exports = {
  probeTcp,
  probeTallyXml,
  probeTdlPack,
  discoverTally,
  listCompanies,
  parseCompaniesFromXml,
};
