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

  return {
    host,
    portMin,
    portMax,
    openPorts,
    candidates,
    tallyPort: preferred ? preferred.port : null,
    tallyRunning: Boolean(preferred),
    discoveredAt: new Date().toISOString(),
  };
}

module.exports = {
  probeTcp,
  probeTallyXml,
  discoverTally,
};
