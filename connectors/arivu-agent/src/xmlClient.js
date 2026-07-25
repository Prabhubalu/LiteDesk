'use strict';

const http = require('http');

/**
 * Build a Tally XML Export envelope (masters / reports).
 * @param {{ id: string, type?: string, company?: string, extraDesc?: string }} opts
 */
function buildExportEnvelope(opts = {}) {
  const id = opts.id || 'List of Companies';
  const type = opts.type || 'Data';
  const companyTag = opts.company
    ? `    <STATICVARIABLES>\n      <SVCURRENTCOMPANY>${escapeXml(opts.company)}</SVCURRENTCOMPANY>\n    </STATICVARIABLES>\n`
    : '';
  return [
    '<ENVELOPE>',
    '  <HEADER>',
    '    <VERSION>1</VERSION>',
    '    <TALLYREQUEST>Export</TALLYREQUEST>',
    `    <TYPE>${escapeXml(type)}</TYPE>`,
    `    <ID>${escapeXml(id)}</ID>`,
    '  </HEADER>',
    '  <BODY>',
    '    <DESC>',
    companyTag + (opts.extraDesc || ''),
    '    </DESC>',
    '  </BODY>',
    '</ENVELOPE>',
  ].join('\n');
}

/**
 * Build a Tally XML Import voucher skeleton (stub for push path).
 * @param {{ voucherType?: string, date?: string, narration?: string, ledgerEntries?: Array<{ledger:string, amount:number, isDeemedPositive?: boolean}> }} opts
 */
function buildImportVoucherEnvelope(opts = {}) {
  const voucherType = opts.voucherType || 'Sales';
  const date = opts.date || formatTallyDate(new Date());
  const narration = opts.narration || '';
  const entries = Array.isArray(opts.ledgerEntries) ? opts.ledgerEntries : [];

  const ledgerXml = entries
    .map((e) => {
      const amount = Number(e.amount) || 0;
      const deemed = e.isDeemedPositive === false ? 'No' : 'Yes';
      return [
        '      <ALLLEDGERENTRIES.LIST>',
        `        <LEDGERNAME>${escapeXml(e.ledger || '')}</LEDGERNAME>`,
        `        <ISDEEMEDPOSITIVE>${deemed}</ISDEEMEDPOSITIVE>`,
        `        <AMOUNT>${amount}</AMOUNT>`,
        '      </ALLLEDGERENTRIES.LIST>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<ENVELOPE>',
    '  <HEADER>',
    '    <VERSION>1</VERSION>',
    '    <TALLYREQUEST>Import</TALLYREQUEST>',
    '    <TYPE>Data</TYPE>',
    '    <ID>Vouchers</ID>',
    '  </HEADER>',
    '  <BODY>',
    '    <DATA>',
    '      <TALLYMESSAGE>',
    '        <VOUCHER>',
    `          <DATE>${escapeXml(date)}</DATE>`,
    `          <VOUCHERTYPENAME>${escapeXml(voucherType)}</VOUCHERTYPENAME>`,
    `          <NARRATION>${escapeXml(narration)}</NARRATION>`,
    ledgerXml,
    '        </VOUCHER>',
    '      </TALLYMESSAGE>',
    '    </DATA>',
    '  </BODY>',
    '</ENVELOPE>',
  ].join('\n');
}

/** Export masters stub — Ledgers / Stock Items / Godowns. */
function buildExportMastersEnvelope(masterType = 'Ledger', company = null) {
  const idMap = {
    Ledger: 'List of Ledgers',
    StockItem: 'List of Stock Items',
    Godown: 'List of Godowns',
    Company: 'List of Companies',
  };
  return buildExportEnvelope({
    id: idMap[masterType] || masterType,
    type: 'Data',
    company,
  });
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTallyDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * POST XML to local Tally XML port.
 * @param {{ host?: string, port: number, xml: string, timeoutMs?: number }} opts
 */
function postXml(opts) {
  const host = opts.host || '127.0.0.1';
  const port = opts.port;
  const xml = opts.xml;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(xml, 'utf8'),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            body,
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Tally XML timeout after ${timeoutMs}ms on ${host}:${port}`));
    });
    req.on('error', reject);
    req.write(xml, 'utf8');
    req.end();
  });
}

module.exports = {
  buildExportEnvelope,
  buildImportVoucherEnvelope,
  buildExportMastersEnvelope,
  postXml,
  escapeXml,
  formatTallyDate,
};
