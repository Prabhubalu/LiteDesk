const dbConnectionManager = require('../utils/databaseConnectionManager');
const Organization = require('../models/Organization');

/**
 * Middleware to switch to organization's database
 * Attaches organization database connection to req.orgDb
 */
const switchToOrganizationDatabase = async (req, res, next) => {
    try {
        // User should already be attached by auth middleware
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Get organization from user
        const organization = await Organization.findById(req.user.organizationId);
        
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        // Check if organization has dedicated database
        if (organization.database && organization.database.name && organization.database.initialized) {
            // Switch to organization's database
            const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organization.database.name);
            req.orgDb = orgDbConnection;
            req.organization = organization;
            
            console.log(`📊 Using organization database: ${organization.database.name}`);
        } else {
            // Fallback to master database (for organizations without dedicated DB)
            req.orgDb = dbConnectionManager.getMasterConnection();
            req.organization = organization;
            console.log(`📊 Using master database (no dedicated DB for org)`);
        }
        
        next();
    } catch (error) {
        console.error('Database switch error:', error);
        res.status(500).json({ message: 'Server error during database connection' });
    }
};

/**
 * Get model from organization database
 * Usage: const User = getOrgModel(req, 'User');
 */
const getOrgModel = (req, modelName) => {
    if (!req.orgDb) {
        throw new Error('Organization database not available. Use switchToOrganizationDatabase middleware first.');
    }
    
    // Get model schema
    const Model = require(`../models/${modelName}`);
    return req.orgDb.model(modelName, Model.schema);
};

module.exports = {
    switchToOrganizationDatabase,
    getOrgModel
};

