'use strict';

/**
 * Local mock Tally XML server for agent discovery / xmlClient tests.
 *
 *   node scripts/mock-tally-server.js            # port 9000
 *   node scripts/mock-tally-server.js --port 9005
 */

const http = require('http');

const portArg = process.argv.indexOf('--port');
const PORT = portArg >= 0 ? Number(process.argv[portArg + 1]) || 9000 : 9000;

const SAMPLE_COMPANIES = `<?xml version="1.0"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY>
          <NAME>ABC Traders</NAME>
          <GUID>mock-company-guid-001</GUID>
          <STARTINGFROM>20260401</STARTINGFROM>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

const SAMPLE_OK = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <DATA>OK</DATA>
  </BODY>
</ENVELOPE>`;

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    console.log(`[mock-tally] ${req.method} ${req.url} (${body.length} bytes)`);

    let response = SAMPLE_OK;
    if (/List of Companies/i.test(body) || /Export/i.test(body)) {
      response = SAMPLE_COMPANIES;
    }
    if (/Import/i.test(body) && /VOUCHER/i.test(body)) {
      response = SAMPLE_OK;
    }

    res.writeHead(200, {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(response),
    });
    res.end(response);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-tally] listening on http://127.0.0.1:${PORT}`);
  console.log('[mock-tally] try: npm run discover  (from connectors/arivu-agent)');
});
