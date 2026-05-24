'use strict';

/**
 * Cross-tenant scheduler: resume process executions paused on wait nodes.
 */

const Organization = require('../models/Organization');
const ProcessExecution = require('../models/ProcessExecution');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { resumeProcessFromWait } = require('./processInvocation');

const BATCH_PER_TENANT = Math.max(1, parseInt(process.env.PROCESS_WAIT_RESUME_BATCH || '25', 10));
const DEBUG = process.env.PROCESS_WAIT_RESUME_DEBUG === 'true';

/**
 * @returns {Promise<{ tenantsProcessed: number, due: number, resumed: number, failed: number }>}
 */
async function tickProcessWaitResume() {
  const now = new Date();

  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id database.name')
    .lean();

  let tenantsProcessed = 0;
  let due = 0;
  let resumed = 0;
  let failed = 0;

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    let conn;
    try {
      conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
    } catch (err) {
      failed += 1;
      console.error(`[processWaitResume] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const executions = await ProcessExecution.find({
            status: 'waiting_until',
            resumeAt: { $lte: now }
          })
            .select('_id executionId resumeAt')
            .limit(BATCH_PER_TENANT)
            .lean();

          if (executions.length === 0) return;

          tenantsProcessed += 1;
          due += executions.length;

          for (const ex of executions) {
            try {
              const result = await resumeProcessFromWait({ executionMongoId: ex._id });
              if (result.ok) {
                resumed += 1;
              } else if (!result.skipped) {
                failed += 1;
                if (DEBUG) {
                  console.warn(`[processWaitResume] resume failed ${ex.executionId}:`, result.error);
                }
              }
            } catch (err) {
              failed += 1;
              console.error(`[processWaitResume] execution ${ex._id}:`, err.message);
            }
          }
        }
      );
    } catch (err) {
      failed += 1;
      console.error(`[processWaitResume] tenant ${tenant._id} tick failed:`, err.message);
    }
  }

  return { tenantsProcessed, due, resumed, failed };
}

module.exports = { tickProcessWaitResume };
