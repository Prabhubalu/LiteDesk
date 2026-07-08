'use strict';

const client = require('./client');
const paths = require('./paths');
const sync = require('./sync');
const verify = require('./verify');

module.exports = {
  ...client,
  ...paths,
  ...sync,
  ...verify,
};
