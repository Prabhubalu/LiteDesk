'use strict';

const client = require('./client');
const paths = require('./paths');
const pageShell = require('./pageShell');
const sync = require('./sync');
const syncIncremental = require('./syncIncremental');
const verify = require('./verify');

module.exports = {
  ...client,
  ...paths,
  ...pageShell,
  ...sync,
  ...syncIncremental,
  ...verify,
};
