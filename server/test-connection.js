// Test MongoDB connection
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

console.log('Testing MongoDB connection...');
console.log('Connection string:', MONGO_URI);
console.log('');

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully!');
    console.log('Database name:', mongoose.connection.db.databaseName);
    console.log('Connection state:', mongoose.connection.readyState); // 1 = connected
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  });

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Connection timed out after 10 seconds');
  process.exit(1);
}, 10000);

