#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationV2 = require('../models/OrganizationV2');
const People = require('../models/People');

async function run() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('MONGODB_URI/MONGO_URI not set');
  await mongoose.connect(MONGO_URI);
  console.log('Connected. Seeding sample People and linking OrganizationV2 primary contact...');

  const admin = await User.findOne({ email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@litedesk.com' });
  if (!admin) throw new Error('Default admin user not found. Run createDefaultAdmin.js first.');

  const org = await Organization.findById(admin.organizationId);
  if (!org) throw new Error('Organization not found for admin');

  // Ensure OrgV2 exists
  let orgV2 = await OrganizationV2.findOne({ legacyOrganizationId: org._id });
  if (!orgV2) {
    orgV2 = await OrganizationV2.create({ legacyOrganizationId: org._id, name: org.name, types: [] });
  }

  // Create a sample People record
  const person = await People.create({
    organizationId: org._id,
    createdBy: admin._id,
    assignedTo: admin._id,
    type: 'Lead',
    first_name: 'Sample',
    last_name: 'Person',
    email: 'sample.person@example.com',
    source: 'seed'
  });

  // Link as primary contact
  orgV2.primaryContact = person._id;
  await orgV2.save();

  console.log('Seeded People id:', person._id.toString());
  console.log('Linked as primaryContact in OrganizationV2 id:', orgV2._id.toString());
  await mongoose.connection.close();
}

run().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});


