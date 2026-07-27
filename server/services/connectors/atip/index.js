'use strict';

/**
 * ERP-agnostic ATIP platform surface.
 * Tally is the first connector adapter (`connectorKey = 'tally'`).
 * Future ERPs implement the same engine contracts under services/connectors/<erp>/engines.
 */

const tallyEngines = require('../tally/engines');

module.exports = {
  connectorKey: 'tally',
  engines: tallyEngines,
  /** Resolve engine bundle by connector key (extensibility hook). */
  forConnector(connectorKey = 'tally') {
    if (String(connectorKey).toLowerCase() === 'tally') return tallyEngines;
    const err = new Error(`No ATIP engines registered for connector=${connectorKey}`);
    err.code = 'CONNECTOR_UNSUPPORTED';
    throw err;
  },
};
