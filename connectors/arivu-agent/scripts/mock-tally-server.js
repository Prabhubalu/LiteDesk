'use strict';

/**
 * Local mock Tally XML server for agent discovery / metadata probes.
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

const SAMPLE_LEDGER = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <LEDGER>
          <NAME>Acme Debtor</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <GUID>mock-ledger-guid-001</GUID>
          <MASTERID>101</MASTERID>
          <ALTERID>55</ALTERID>
          <EMAIL>acme@example.com</EMAIL>
          <GSTIN>27AABCU9603R1ZM</GSTIN>
          <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
          <LEDGERPHONE>9999999999</LEDGERPHONE>
          <PINCODE>560001</PINCODE>
          <ADDRESS>MG Road</ADDRESS>
        </LEDGER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

const SAMPLE_STOCK_ITEM = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <STOCKITEM>
          <NAME>Widget</NAME>
          <PARENT>Primary</PARENT>
          <GUID>mock-stock-guid-001</GUID>
          <MASTERID>201</MASTERID>
          <ALTERID>12</ALTERID>
          <BASEUNITS>Nos</BASEUNITS>
          <HSNCODE>8471</HSNCODE>
          <GSTAPPLICABLE>Yes</GSTAPPLICABLE>
        </STOCKITEM>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

const SAMPLE_VOUCHER = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <VOUCHER>
          <VOUCHERNUMBER>INV-1</VOUCHERNUMBER>
          <DATE>20260401</DATE>
          <GUID>mock-voucher-guid-001</GUID>
          <MASTERID>301</MASTERID>
          <ALTERID>9</ALTERID>
          <PARTYLEDGERNAME>Acme Debtor</PARTYLEDGERNAME>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <REFERENCE>SO-1</REFERENCE>
          <NARRATION>Mock sale</NARRATION>
        </VOUCHER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

const SAMPLE_GODOWN = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <GODOWN>
          <NAME>Main Godown</NAME>
          <PARENT>Primary</PARENT>
          <GUID>mock-godown-guid-001</GUID>
          <MASTERID>401</MASTERID>
          <ALTERID>3</ALTERID>
          <ADDRESS>Warehouse 1</ADDRESS>
        </GODOWN>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

const SAMPLE_GENERIC_MASTER = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <GROUP>
          <NAME>Primary</NAME>
          <PARENT></PARENT>
          <GUID>mock-group-guid-001</GUID>
          <MASTERID>1</MASTERID>
          <ALTERID>1</ALTERID>
        </GROUP>
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

function pickResponse(body) {
  if (/Import/i.test(body) && /VOUCHER/i.test(body)) return SAMPLE_OK;
  if (/List of Companies|Arivu List of Companies/i.test(body)) return SAMPLE_COMPANIES;
  if (/Arivu List of Ledgers|List of Ledgers/i.test(body)) return SAMPLE_LEDGER;
  if (/Arivu List of Stock Items|List of Stock Items/i.test(body)) return SAMPLE_STOCK_ITEM;
  if (/Arivu List of Godowns|List of Godowns/i.test(body)) return SAMPLE_GODOWN;
  if (/Arivu Sales Vouchers|Arivu Purchase Vouchers|Arivu .* Vouchers|Arivu List of Vouchers/i.test(body)) {
    return SAMPLE_VOUCHER;
  }
  if (/Arivu List of /i.test(body) || /NATIVEMETHOD/i.test(body)) return SAMPLE_GENERIC_MASTER;
  if (/List of Companies/i.test(body) || /Export/i.test(body)) return SAMPLE_COMPANIES;
  return SAMPLE_OK;
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    console.log(`[mock-tally] ${req.method} ${req.url} (${body.length} bytes)`);

    const response = pickResponse(body);

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
