const hub = require('../services/dataChangeSSEHub');
const { applySseCors } = require('../utils/sseCors');
const { resolveUserFromToken } = require('../utils/resolveUserFromToken');

async function validateTokenFromQuery(req) {
  let token = req.query.token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return null;
  return resolveUserFromToken(token, { lean: true });
}

exports.streamDataChanges = async (req, res) => {
  applySseCors(req, res);

  const user = await validateTokenFromQuery(req);
  if (!user?._id || !user.organizationId) {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Unauthorized');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  hub.subscribe(res, user._id, user.organizationId);
};
