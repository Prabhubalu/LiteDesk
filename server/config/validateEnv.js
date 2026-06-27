/**
 * Environment validation for production. Keep failures loud and early.
 */
function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 24) {
      console.error('❌ FATAL: production requires JWT_SECRET (use a long random string, e.g. openssl rand -base64 48).');
      process.exit(1);
    }
    if (process.env.DISABLE_SECURITY === 'true') {
      console.error('❌ FATAL: DISABLE_SECURITY cannot be true in production.');
      process.exit(1);
    }
    if (process.env.RBAC_V2 === 'true' || process.env.SHARING_V1 === 'true') {
      console.warn(
        '⚠️  RBAC_V2 and/or SHARING_V1 are enabled globally. Prefer per-org flags until migration is complete.'
      );
    }
    if (process.env.PORTAL_FRAMEWORK_V1 === 'true') {
      console.warn(
        '⚠️  PORTAL_FRAMEWORK_V1 is enabled globally. Prefer per-org portalFrameworkV1Enabled until cutover.'
      );
    }
  }
}

module.exports = { validateEnv };
