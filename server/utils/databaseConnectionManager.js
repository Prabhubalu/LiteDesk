const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const {
  PEOPLE_SALES_ROLE_PATH,
  PEOPLE_SALES_LEAD_STATUS_PATH,
  PEOPLE_SALES_CONTACT_STATUS_PATH,
} = require('./peopleFieldRegistry');

/**
 * Database Connection Manager
 * Manages connections to organization-specific databases
 */
class DatabaseConnectionManager {
  constructor() {
    // Master database connection (for Organizations, Users, DemoRequests)
    this.masterConnection = null;
    
    // Cache of organization database connections
    this.organizationConnections = new Map();
    
    // Base MongoDB URI (without database name)
    this.baseMongoUri = null;
    this.masterDbName = process.env.MASTER_DB_NAME || 'arivu_master';
    this.connectionQuery = '';
  }
  
  /**
   * Initialize master database connection
   * Uses the existing mongoose connection from server.js
   */
  async initializeMasterConnection() {
    if (this.masterConnection && this.masterConnection.readyState === 1) {
      return this.masterConnection;
    }
    
    // Use the default mongoose connection (already connected in server.js)
    this.masterConnection = mongoose.connection;
    
    // Extract base URI from environment or use the one set from server.js
    if (!this.baseMongoUri) {
      const { getMongoUris } = require('../lib/mongoConnect');
      const MONGO_URI =
        process.env.MONGODB_URI ||
        process.env.MONGO_URI ||
        getMongoUris().MONGO_URI;
      if (MONGO_URI) {
        // Extract base URI (without database name)
        const [uriWithoutQuery, queryPart] = MONGO_URI.split('?');
        this.connectionQuery = queryPart ? `?${queryPart}` : '';
        const uriParts = uriWithoutQuery.split('/');
        this.baseMongoUri = uriParts.slice(0, -1).join('/'); // Everything except last part
      } else {
        // Fallback: try to extract from mongoose connection
        // This handles cases where MONGO_URI might not be in env but connection exists
        if (mongoose.connection.readyState === 1) {
          // Try to get URI from connection client
          const client = mongoose.connection.client;
          if (client && client.s && client.s.url) {
            const fullUri = client.s.url;
            const [uriWithoutQuery, queryPart] = fullUri.split('?');
            this.connectionQuery = queryPart ? `?${queryPart}` : '';
            this.baseMongoUri = uriWithoutQuery.split('/').slice(0, -1).join('/');
          } else {
            // Last resort: construct from host/port
            const host = mongoose.connection.host || 'localhost';
            const port = mongoose.connection.port || 27017;
            this.baseMongoUri = `mongodb://${host}:${port}`;
            this.connectionQuery = '';
          }
        } else {
          throw new Error('MongoDB connection not established. Please ensure MONGO_URI is set in .env');
        }
      }
    }
    
    console.log(`✅ Master database connection initialized: ${this.masterDbName}`);
    return this.masterConnection;
  }
  
  /**
   * Get or create connection to organization's database
   * @param {string} databaseName - Organization database name (e.g., 'arivu_acme')
   * @returns {Promise<mongoose.Connection>} - Mongoose connection to organization database
   */
  async getOrganizationConnection(databaseName) {
    try {
      // Check cache first
      if (this.organizationConnections.has(databaseName)) {
        const conn = this.organizationConnections.get(databaseName);
        if (conn.readyState === 1) {
          return conn;
        }
        // Connection is dead, remove from cache
        this.organizationConnections.delete(databaseName);
      }
      
      // Create new connection
      if (!this.baseMongoUri) {
        console.log('⚠️  baseMongoUri not set, initializing master connection...');
        await this.initializeMasterConnection();
      }
      
      if (!this.baseMongoUri) {
        throw new Error('Failed to get baseMongoUri. Please ensure MONGO_URI is set in .env');
      }
      
      let orgUri = `${this.baseMongoUri}/${databaseName}`;
      if (this.connectionQuery) {
        orgUri += this.connectionQuery;
      }
      console.log(`🔌 Connecting to organization database: ${orgUri}`);
      
      const connection = mongoose.createConnection(orgUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000, // Increased timeout
      });
      if (typeof connection.asPromise === 'function') {
        await connection.asPromise();
      } else if (connection.readyState !== 1) {
        await new Promise((resolve, reject) => {
          connection.once('open', resolve);
          connection.once('error', reject);
        });
      }

      // Cache the connection
      this.organizationConnections.set(databaseName, connection);
      
      console.log(`✅ Organization database connected: ${databaseName}`);
      return connection;
    } catch (error) {
      console.error(`❌ Failed to connect to organization database ${databaseName}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Create a new database for an organization
   * @param {string} databaseName - Database name to create
   * @param {string} adminUri - MongoDB admin connection string (optional)
   * @returns {Promise<object>} - Database creation result
   */
  async createOrganizationDatabase(databaseName, adminUri = null) {
    await this.initializeMasterConnection();
    const adminConnectionString =
      adminUri ||
      process.env.MONGODB_ADMIN_URI ||
      `${this.baseMongoUri}/${this.masterDbName}${this.connectionQuery}`;

    const client = new MongoClient(adminConnectionString);
    
    try {
      await client.connect();
      console.log(`🔌 Connected to MongoDB admin`);
      
      // Create the database by writing to it
      const db = client.db(databaseName);
      await db.collection('_init').insertOne({ 
        initialized: true, 
        createdAt: new Date(),
        organization: databaseName
      });
      await db.collection('_init').deleteOne({ initialized: true });
      
      console.log(`✅ Database created: ${databaseName}`);
      
      // Initialize database schema
      await this.initializeOrganizationDatabase(databaseName);
      
      return {
        database: databaseName,
        created: true
      };
    } finally {
      await client.close();
    }
  }
  
  /**
   * Initialize organization database with collections and indexes
   * @param {string} databaseName - Database name
   */
  async initializeOrganizationDatabase(databaseName) {
    const connection = await this.getOrganizationConnection(databaseName);
    if (connection.readyState !== 1 && typeof connection.asPromise === 'function') {
      await connection.asPromise();
    }
    const db = connection.db;
    if (!db) {
      throw new Error(`Database handle unavailable for ${databaseName}`);
    }
    
    console.log(`🔧 Initializing database schema for ${databaseName}...`);
    
    // Collections to create
    const collections = [
      'users',
      'organizations',
      'contacts',
      'people',
      'deals',
      'tasks',
      'events',
      'items',
      'documents',
      'transactions',
      'notes',
      'activitylogs',
      'roles',
      'moduleDefinitions',
      'groups'
    ];
    
    for (const collectionName of collections) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (!exists) {
        await db.createCollection(collectionName);
        console.log(`  ✅ Collection created: ${collectionName}`);
      }
    }
    
    // Create basic indexes
    await this.createOrganizationIndexes(db);
    
    console.log(`✅ Database schema initialized for ${databaseName}`);
  }
  
  /**
   * Create indexes for organization database
   * @param {object} db - MongoDB database instance
   */
  async createOrganizationIndexes(db) {
    console.log(`  📊 Creating indexes for organization database...`);
    
    try {
      // ===== USERS INDEXES =====
      await db.collection('users').createIndex({ organizationId: 1, email: 1 }, { unique: true });
      await db.collection('users').createIndex({ organizationId: 1 });
      await db.collection('users').createIndex({ email: 1 });
      await db.collection('users').createIndex({ role: 1 });
      await db.collection('users').createIndex({ status: 1 });
      console.log(`    ✅ Users indexes created`);
      
      // ===== PEOPLE/CONTACTS INDEXES =====
      await db.collection('people').createIndex({ organizationId: 1, assignedTo: 1 });
      await db.collection('people').createIndex({ organizationId: 1, email: 1 }, { sparse: true });
      await db.collection('people').createIndex({ organizationId: 1, [PEOPLE_SALES_ROLE_PATH]: 1 });
      await db.collection('people').createIndex({ organizationId: 1, [PEOPLE_SALES_LEAD_STATUS_PATH]: 1 });
      await db.collection('people').createIndex({ organizationId: 1, [PEOPLE_SALES_CONTACT_STATUS_PATH]: 1 });
      await db.collection('people').createIndex({ organizationId: 1, legacyContactId: 1 }, { sparse: true });
      await db.collection('people').createIndex({ createdBy: 1 });
      await db.collection('people').createIndex({ assignedTo: 1 });
      
      // Also create for contacts collection (backward compatibility)
      await db.collection('contacts').createIndex({ organizationId: 1, email: 1 }, { sparse: true });
      await db.collection('contacts').createIndex({ organizationId: 1 });
      await db.collection('contacts').createIndex({ assignedTo: 1 });
      console.log(`    ✅ People/Contacts indexes created`);
      
      // ===== DEALS INDEXES =====
      await db.collection('deals').createIndex({ organizationId: 1, stage: 1 });
      await db.collection('deals').createIndex({ organizationId: 1, assignedTo: 1 });
      await db.collection('deals').createIndex({ organizationId: 1, status: 1 });
      await db.collection('deals').createIndex({ organizationId: 1, expectedCloseDate: 1 });
      await db.collection('deals').createIndex({ organizationId: 1 });
      await db.collection('deals').createIndex({ assignedTo: 1 });
      await db.collection('deals').createIndex({ stage: 1 });
      console.log(`    ✅ Deals indexes created`);
      
      // ===== TASKS INDEXES =====
      await db.collection('tasks').createIndex({ organizationId: 1, assignedTo: 1, status: 1 });
      await db.collection('tasks').createIndex({ organizationId: 1, dueDate: 1, status: 1 });
      await db.collection('tasks').createIndex({ organizationId: 1, priority: 1, status: 1 });
      await db.collection('tasks').createIndex({ organizationId: 1, projectId: 1 });
      await db.collection('tasks').createIndex(
        { organizationId: 1, assignedTo: 1, deletedAt: 1, dueDate: 1, status: 1 },
        { name: 'task_home_summary_idx' }
      );
      await db.collection('tasks').createIndex({ organizationId: 1 });
      await db.collection('tasks').createIndex({ assignedTo: 1 });
      await db.collection('tasks').createIndex({ status: 1 });
      await db.collection('tasks').createIndex({ dueDate: 1 });
      console.log(`    ✅ Tasks indexes created`);
      
      // ===== EVENTS INDEXES =====
      await db.collection('events').createIndex({ organizationId: 1, startDate: 1 });
      await db.collection('events').createIndex({ organizationId: 1, endDate: 1 });
      await db.collection('events').createIndex({ organizationId: 1, status: 1 });
      await db.collection('events').createIndex({ organizer: 1 });
      await db.collection('events').createIndex({ 'attendees.userId': 1 });
      await db.collection('events').createIndex({ 'relatedTo.type': 1, 'relatedTo.id': 1 });
      await db.collection('events').createIndex({ organizationId: 1 });
      console.log(`    ✅ Events indexes created`);
      
      // ===== ROLES INDEXES =====
      await db.collection('roles').createIndex({ organizationId: 1, name: 1 }, { unique: true });
      await db.collection('roles').createIndex({ organizationId: 1 });
      await db.collection('roles').createIndex({ level: 1 });
      console.log(`    ✅ Roles indexes created`);
      
      // ===== IMPORT HISTORY INDEXES =====
      await db.collection('importhistories').createIndex({ organizationId: 1, module: 1 });
      await db.collection('importhistories').createIndex({ organizationId: 1, importedBy: 1 });
      await db.collection('importhistories').createIndex({ organizationId: 1, status: 1 });
      await db.collection('importhistories').createIndex({ createdAt: -1 });
      await db.collection('importhistories').createIndex({ organizationId: 1 });
      console.log(`    ✅ Import History indexes created`);
      
      // ===== GROUPS INDEXES =====
      await db.collection('groups').createIndex({ organizationId: 1, name: 1 }, { unique: true });
      await db.collection('groups').createIndex({ organizationId: 1, members: 1 });
      await db.collection('groups').createIndex({ organizationId: 1 });
      console.log(`    ✅ Groups indexes created`);
      
      // ===== MODULE DEFINITIONS INDEXES =====
      // Platform-level docs (organizationId = null) are unique on (appKey, moduleKey).
      // Tenant overrides (organizationId set) are unique on (organizationId, appKey, moduleKey).
      // These match the schema-level indexes in models/ModuleDefinition.js.
      await db.collection('moduledefinitions').createIndex(
        { appKey: 1, moduleKey: 1 },
        { unique: true, partialFilterExpression: { organizationId: null } }
      );
      await db.collection('moduledefinitions').createIndex(
        { organizationId: 1, appKey: 1, moduleKey: 1 },
        { unique: true, partialFilterExpression: { organizationId: { $type: 'objectId' } } }
      );
      await db.collection('moduledefinitions').createIndex({ organizationId: 1 });
      await db.collection('moduledefinitions').createIndex({ type: 1 });
      console.log(`    ✅ Module Definitions indexes created`);
      
      // ===== USER PREFERENCES INDEXES =====
      await db.collection('userpreferences').createIndex({ organizationId: 1, userId: 1 }, { unique: true });
      await db.collection('userpreferences').createIndex({ organizationId: 1 });
      await db.collection('userpreferences').createIndex({ userId: 1 });
      console.log(`    ✅ User Preferences indexes created`);
      
      console.log(`  ✅ All indexes created successfully`);
    } catch (error) {
      console.error(`  ❌ Error creating indexes:`, error.message);
      // Don't throw - indexes can be created later if needed
      // Mongoose will also create indexes when models are first used
    }
  }
  
  /**
   * Close all connections
   */
  async closeAllConnections() {
    // Close organization connections
    for (const [dbName, conn] of this.organizationConnections.entries()) {
      if (conn.readyState === 1) {
        await conn.close();
        console.log(`✅ Closed connection: ${dbName}`);
      }
    }
    this.organizationConnections.clear();
    
    // Close master connection
    if (this.masterConnection && this.masterConnection.readyState === 1) {
      await this.masterConnection.close();
      console.log(`✅ Closed master connection`);
    }
  }
  
  /**
   * Get master database connection
   */
  getMasterConnection() {
    return this.masterConnection || mongoose.connection;
  }
}

// Singleton instance
const dbManager = new DatabaseConnectionManager();

module.exports = dbManager;
