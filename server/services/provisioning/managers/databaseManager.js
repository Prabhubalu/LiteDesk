const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const { generateDatabasePassword } = require('../utils/passwordGenerator');

class DatabaseManager {
  constructor() {
    // For MongoDB Atlas or managed MongoDB
    this.atlasApiKey = process.env.MONGODB_ATLAS_API_KEY;
    this.atlasProjectId = process.env.MONGODB_ATLAS_PROJECT_ID;
    
    // For self-hosted MongoDB
    this.adminConnectionString = process.env.MONGODB_ADMIN_URI || 'mongodb://admin:password@mongodb:27017/admin';
  }
  
  /**
   * Provision a new MongoDB database for an instance
   * @param {object} options - Database options
   * @returns {Promise<object>} - Database connection details
   */
  async provisionDatabase(options) {
    const {
      instanceName,
      subdomain,
      databaseName = `litedesk_${subdomain}`,
      username = `user_${subdomain}`
    } = options;
    
    console.log(`📦 Provisioning database: ${databaseName}`);
    
    try {
      // Generate secure password
      const password = generateDatabasePassword();
      
      // Create database and user
      const result = await this.createDatabaseAndUser({
        databaseName,
        username,
        password
      });
      
      // Build connection string
      const connectionString = this.buildConnectionString({
        username,
        password,
        databaseName,
        host: result.host,
        port: result.port
      });
      
      // Initialize database with schema
      await this.initializeDatabase(connectionString, databaseName);
      
      console.log(`✅ Database provisioned: ${databaseName}`);
      
      return {
        host: result.host,
        port: result.port,
        database: databaseName,
        username: username,
        password: password,
        connectionString: connectionString,
        adminConnectionString: this.buildAdminConnectionString({
          username,
          password,
          databaseName,
          host: result.host,
          port: result.port
        })
      };
    } catch (error) {
      console.error(`❌ Database provisioning failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create database and user using MongoDB admin connection
   * @param {object} params - Database parameters
   * @returns {Promise<object>} - Creation result
   */
  async createDatabaseAndUser({ databaseName, username, password }) {
    const client = new MongoClient(this.adminConnectionString);
    
    try {
      await client.connect();
      console.log(`🔌 Connected to MongoDB admin`);
      
      const adminDb = client.db('admin');
      
      // Check if user already exists
      const existingUsers = await adminDb.command({
        usersInfo: { user: username, db: databaseName }
      });
      
      if (existingUsers.users && existingUsers.users.length > 0) {
        console.log(`⚠️ User already exists: ${username}`);
        // Update password
        await adminDb.command({
          updateUser: username,
          pwd: password,
          roles: [
            { role: 'readWrite', db: databaseName },
            { role: 'dbAdmin', db: databaseName }
          ]
        });
      } else {
        // Create new user
        await adminDb.command({
          createUser: username,
          pwd: password,
          roles: [
            { role: 'readWrite', db: databaseName },
            { role: 'dbAdmin', db: databaseName }
          ]
        });
        console.log(`✅ User created: ${username}`);
      }
      
      // Create the database (MongoDB creates it on first write)
      const db = client.db(databaseName);
      await db.collection('_init').insertOne({ initialized: true, createdAt: new Date() });
      await db.collection('_init').deleteOne({ initialized: true });
      
      console.log(`✅ Database created: ${databaseName}`);
      
      // Get host and port from connection
      const parsedUri = new URL(this.adminConnectionString.replace('mongodb://', 'http://'));
      
      return {
        host: parsedUri.hostname,
        port: parseInt(parsedUri.port) || 27017,
        database: databaseName
      };
    } finally {
      await client.close();
    }
  }
  
  /**
   * Initialize database with collections and indexes
   * @param {string} connectionString - Database connection string
   * @param {string} databaseName - Database name
   */
  async initializeDatabase(connectionString, databaseName) {
    const client = new MongoClient(connectionString);
    
    try {
      await client.connect();
      const db = client.db(databaseName);
      
      console.log(`🔧 Initializing database schema...`);
      
      // Create collections
      const collections = [
        'users',
        'contacts',
        'organizations',
        'deals',
        'tasks',
        'events',
        'items',
        'documents',
        'transactions',
        'notes',
        'activitylogs'
      ];
      
      for (const collectionName of collections) {
        const exists = await db.listCollections({ name: collectionName }).hasNext();
        if (!exists) {
          await db.createCollection(collectionName);
          console.log(`  ✅ Collection created: ${collectionName}`);
        }
      }
      
      // Create indexes
      await this.createIndexes(db);
      
      console.log(`✅ Database schema initialized`);
    } finally {
      await client.close();
    }
  }
  
  /**
   * Create necessary indexes for collections
   * @param {object} db - MongoDB database instance
   */
  async createIndexes(db) {
    // Users indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
    await db.collection('users').createIndex({ status: 1 });
    await db.collection('users').createIndex({ createdAt: -1 });
    
    // Contacts indexes
    await db.collection('contacts').createIndex({ email: 1 });
    await db.collection('contacts').createIndex({ status: 1 });
    await db.collection('contacts').createIndex({ assignedTo: 1 });
    await db.collection('contacts').createIndex({ createdAt: -1 });
    await db.collection('contacts').createIndex({ firstName: 1, lastName: 1 });
    
    // Deals indexes
    await db.collection('deals').createIndex({ stage: 1 });
    await db.collection('deals').createIndex({ assignedTo: 1 });
    await db.collection('deals').createIndex({ expectedCloseDate: 1 });
    await db.collection('deals').createIndex({ createdAt: -1 });
    
    // Tasks indexes
    await db.collection('tasks').createIndex({ assignedTo: 1, status: 1 });
    await db.collection('tasks').createIndex({ dueDate: 1 });
    await db.collection('tasks').createIndex({ createdAt: -1 });
    
    // Events indexes
    await db.collection('events').createIndex({ startDateTime: 1 });
    await db.collection('events').createIndex({ 'attendees.userId': 1 });
    await db.collection('events').createIndex({ createdAt: -1 });
    
    console.log(`  ✅ Indexes created`);
  }
  
  /**
   * Create initial owner user in the database
   * @param {string} connectionString - Database connection string
   * @param {object} ownerData - Owner user data
   * @returns {Promise<object>} - Created user
   */
  async createOwnerUser(connectionString, ownerData) {
    const client = new MongoClient(connectionString);
    
    try {
      await client.connect();
      const db = client.db();
      
      console.log(`👤 Creating owner user: ${ownerData.email}`);
      
      // Hash password
      const hashedPassword = await bcrypt.hash(ownerData.password, 10);
      
      // Create owner user
      const user = {
        username: ownerData.name || ownerData.email.split('@')[0],
        email: ownerData.email,
        password: hashedPassword,
        firstName: ownerData.firstName || ownerData.name || '',
        lastName: ownerData.lastName || '',
        phoneNumber: ownerData.phone || '',
        role: 'owner',
        isOwner: true,
        status: 'active',
        permissions: this.getOwnerPermissions(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('users').insertOne(user);
      
      console.log(`✅ Owner user created: ${ownerData.email}`);
      
      return {
        _id: result.insertedId,
        ...user,
        password: undefined // Don't return password
      };
    } finally {
      await client.close();
    }
  }
  
  /**
   * Get default owner permissions
   */
  getOwnerPermissions() {
    const modules = ['contacts', 'organizations', 'deals', 'projects', 'tasks', 'events', 'items', 'documents', 'transactions'];
    const permissions = {};
    
    modules.forEach(module => {
      permissions[module] = {
        view: true,
        create: true,
        edit: true,
        delete: true,
        viewAll: true,
        exportData: true
      };
    });
    
    permissions.settings = {
      read: true,
      update: true,
      delete: true
    };
    
    permissions.reports = {
      viewStandard: true,
      viewCustom: true,
      createCustom: true,
      exportReports: true
    };
    
    return permissions;
  }
  
  /**
   * Build MongoDB connection string
   * @param {object} params - Connection parameters
   * @returns {string} - Connection string
   */
  buildConnectionString({ username, password, host, port, databaseName }) {
    // URL encode username and password
    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    
    return `mongodb://${encodedUser}:${encodedPass}@${host}:${port}/${databaseName}?authSource=${databaseName}`;
  }
  
  /**
   * Build admin connection string
   */
  buildAdminConnectionString({ username, password, host, port, databaseName }) {
    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    
    return `mongodb://${encodedUser}:${encodedPass}@${host}:${port}/${databaseName}?authSource=admin`;
  }
  
  /**
   * Delete a database
   * @param {string} databaseName - Database name to delete
   */
  async deleteDatabase(databaseName) {
    const client = new MongoClient(this.adminConnectionString);
    
    try {
      await client.connect();
      const db = client.db(databaseName);
      
      await db.dropDatabase();
      console.log(`✅ Database deleted: ${databaseName}`);
      
      return true;
    } finally {
      await client.close();
    }
  }
  
  /**
   * Get database statistics
   * @param {string} connectionString - Database connection string
   * @returns {Promise<object>} - Database stats
   */
  async getDatabaseStats(connectionString) {
    const client = new MongoClient(connectionString);
    
    try {
      await client.connect();
      const db = client.db();
      
      const stats = await db.stats();
      
      return {
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
        objects: stats.objects
      };
    } finally {
      await client.close();
    }
  }
  
  /**
   * Check if database connection is healthy
   * @param {string} connectionString - Database connection string
   * @returns {Promise<boolean>} - True if healthy
   */
  async checkHealth(connectionString) {
    const client = new MongoClient(connectionString);
    
    try {
      await client.connect();
      await client.db().admin().ping();
      return true;
    } catch (error) {
      console.error(`Database health check failed: ${error.message}`);
      return false;
    } finally {
      await client.close();
    }
  }
}

module.exports = DatabaseManager;

