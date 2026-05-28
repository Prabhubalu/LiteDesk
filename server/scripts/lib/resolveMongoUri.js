const path = require('path');
const { getMongoUris, MASTER_DB } = require('../../lib/mongoConnect');

/**
 * Load server/.env then repo root .env (root does not override existing keys).
 */
function loadEnv() {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
}

/**
 * Raw URI from env (may include /arivu or another default DB name in the path).
 */
function resolveMongoUri() {
  loadEnv();
  const isProduction = process.env.NODE_ENV === 'production';
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    (isProduction ? process.env.MONGO_URI_PRODUCTION : process.env.MONGO_URI_LOCAL) ||
    process.env.MONGO_URI_ATLAS;

  if (!uri) {
    console.error(
      'Missing MongoDB URI. Set one of: MONGODB_URI, MONGO_URI, MONGO_URI_LOCAL, MONGO_URI_ATLAS (or MONGO_URI_PRODUCTION in production) in server/.env or the repo root .env.'
    );
    process.exit(1);
  }

  return uri;
}

/**
 * Always targets the master catalog DB (default: arivu_master), stripping any /arivu
 * (or other) database segment from MONGO_URI_LOCAL — same as server startup.
 */
function resolveMasterMongoUri() {
  loadEnv();
  try {
    const { masterUri, masterDbName } = getMongoUris();
    return { uri: masterUri, dbName: masterDbName };
  } catch (err) {
    if (err.code === 'MONGODB_CONFIG_MISSING') {
      console.error(err.message);
      console.error(
        'Set MONGODB_URI, MONGO_URI, MONGO_URI_LOCAL, or MONGO_URI_ATLAS in server/.env (or repo root .env).'
      );
      process.exit(1);
    }
    throw err;
  }
}

module.exports = {
  loadEnv,
  resolveMongoUri,
  resolveMasterMongoUri,
  MASTER_DB
};
