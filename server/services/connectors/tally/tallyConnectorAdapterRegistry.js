'use strict';

const { tallyConnectorAdapter } = require('./tallyConnectorAdapter');

let overrideAdapter = null;

function getTallyConnectorAdapter() {
  return overrideAdapter || tallyConnectorAdapter;
}

function setTallyConnectorAdapterForTests(adapter) {
  overrideAdapter = adapter || null;
}

module.exports = {
  getTallyConnectorAdapter,
  setTallyConnectorAdapterForTests,
};
