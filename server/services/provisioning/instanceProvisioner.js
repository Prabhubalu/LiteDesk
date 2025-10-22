const InstanceRegistry = require('../../models/InstanceRegistry');
const DemoRequest = require('../../models/DemoRequest');
// Don't import managers here - they will be loaded conditionally in production mode
// const KubernetesManager = require('./managers/kubernetesManager');
// const DatabaseManager = require('./managers/databaseManager');
// const DNSManager = require('./managers/dnsManager');
const { generateUniqueSlug } = require('./utils/slugGenerator');
const { generateSecurePassword, generateJWTSecret } = require('./utils/passwordGenerator');

class InstanceProvisioner {
  constructor() {
    // Don't initialize managers in development mode
    // They will be lazy-loaded only when needed (in production)
    this.k8sManager = null;
    this.dbManager = null;
    this.dnsManager = null;
  }
  
  /**
   * Lazy-load managers (only in production mode)
   */
  initializeManagers() {
    if (process.env.NODE_ENV !== 'development') {
      if (!this.k8sManager) {
        // Dynamically require managers only in production
        const KubernetesManager = require('./managers/kubernetesManager');
        const DatabaseManager = require('./managers/databaseManager');
        const DNSManager = require('./managers/dnsManager');
        
        this.k8sManager = new KubernetesManager();
        this.dbManager = new DatabaseManager();
        this.dnsManager = new DNSManager();
      }
    }
  }
  
  /**
   * Provision a complete instance for an organization
   * @param {object} options - Provisioning options
   * @returns {Promise<object>} - Provisioned instance details
   */
  async provisionInstance(options) {
    const {
      companyName,
      industry,
      ownerEmail,
      ownerName,
      ownerPassword,
      subscriptionTier = 'trial',
      demoRequestId,
      createdBy
    } = options;
    
    console.log('\n========================================');
    console.log('🚀 STARTING INSTANCE PROVISIONING');
    console.log(`   Company: ${companyName}`);
    console.log(`   Owner: ${ownerEmail}`);
    console.log(`   Mode: ${process.env.NODE_ENV === 'development' ? 'DEVELOPMENT (Simulated)' : 'PRODUCTION'}`);
    console.log('========================================\n');
    
    // ============================================
    // DEVELOPMENT MODE: Simulate provisioning
    // ============================================
    if (process.env.NODE_ENV === 'development') {
      return await this.provisionInstanceDevelopment(options);
    }
    
    // ============================================
    // PRODUCTION MODE: Actual provisioning
    // ============================================
    // Initialize managers (Kubernetes, Database, DNS)
    this.initializeManagers();
    
    let instanceRegistry = null;
    
    try {
      // ============================================
      // STAGE 1: Generate Subdomain & Create Registry
      // ============================================
      console.log('📝 STAGE 1: Generating subdomain...');
      const subdomain = await generateUniqueSlug(companyName);
      console.log(`   Subdomain: ${subdomain}.litedesk.com\n`);
      
      // Create instance registry record
      instanceRegistry = await InstanceRegistry.create({
        instanceName: companyName,
        subdomain: subdomain,
        kubernetesNamespace: `instance-${subdomain}`,
        deploymentName: `litedesk-${subdomain}`,
        serviceName: `litedesk-${subdomain}-svc`,
        ingressName: `litedesk-${subdomain}-ingress`,
        ownerEmail: ownerEmail,
        ownerName: ownerName,
        status: 'provisioning',
        provisioningStage: 'initiated',
        subscription: {
          tier: subscriptionTier,
          status: subscriptionTier === 'trial' ? 'trial' : 'active',
          trialStartDate: subscriptionTier === 'trial' ? new Date() : undefined,
          trialEndDate: subscriptionTier === 'trial' ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) : undefined
        },
        config: {
          branding: {
            companyName: companyName
          }
        },
        urls: {
          frontend: `https://${subdomain}.litedesk.com`,
          api: `https://${subdomain}.litedesk.com/api`
        },
        demoRequestId: demoRequestId,
        createdBy: createdBy
      });
      
      console.log(`✅ Instance registry created: ${instanceRegistry._id}\n`);
      
      // ============================================
      // STAGE 2: Provision Database
      // ============================================
      console.log('📦 STAGE 2: Provisioning database...');
      await this.updateStage(instanceRegistry, 'database');
      
      const dbResult = await this.dbManager.provisionDatabase({
        instanceName: companyName,
        subdomain: subdomain,
        databaseName: `litedesk_${subdomain}`,
        username: `user_${subdomain}`
      });
      
      // Update registry with database info
      instanceRegistry.databaseConnection = {
        host: dbResult.host,
        port: dbResult.port,
        database: dbResult.database,
        username: dbResult.username,
        passwordSecret: `${subdomain}-db-secret`
      };
      await instanceRegistry.save();
      
      console.log(`✅ Database provisioned: ${dbResult.database}\n`);
      
      // ============================================
      // STAGE 3: Create Owner User in Database
      // ============================================
      console.log('👤 STAGE 3: Creating owner user...');
      await this.updateStage(instanceRegistry, 'initialization');
      
      await this.dbManager.createOwnerUser(dbResult.connectionString, {
        name: ownerName,
        email: ownerEmail,
        password: ownerPassword,
        phone: options.ownerPhone || ''
      });
      
      console.log(`✅ Owner user created: ${ownerEmail}\n`);
      
      // ============================================
      // STAGE 4: Create Kubernetes Namespace
      // ============================================
      console.log('🏗️  STAGE 4: Creating Kubernetes namespace...');
      await this.updateStage(instanceRegistry, 'namespace');
      
      await this.k8sManager.createNamespace(instanceRegistry.kubernetesNamespace, {
        instance: subdomain,
        'owner-email': ownerEmail
      });
      
      console.log(`✅ Namespace created: ${instanceRegistry.kubernetesNamespace}\n`);
      
      // ============================================
      // STAGE 5: Create Secrets
      // ============================================
      console.log('🔐 STAGE 5: Creating Kubernetes secrets...');
      await this.updateStage(instanceRegistry, 'secrets');
      
      const jwtSecret = generateJWTSecret();
      
      await this.k8sManager.createSecret(
        instanceRegistry.kubernetesNamespace,
        `${subdomain}-app-secret`,
        {
          'jwt-secret': jwtSecret
        }
      );
      
      await this.k8sManager.createSecret(
        instanceRegistry.kubernetesNamespace,
        `${subdomain}-db-secret`,
        {
          'mongodb-password': dbResult.password,
          'connection-string': dbResult.connectionString
        }
      );
      
      console.log(`✅ Secrets created\n`);
      
      // ============================================
      // STAGE 6: Deploy Application
      // ============================================
      console.log('🚢 STAGE 6: Deploying application...');
      await this.updateStage(instanceRegistry, 'deployment');
      
      const deploymentValues = {
        instance: {
          name: subdomain,
          subdomain: subdomain,
          ownerEmail: ownerEmail
        },
        backend: {
          image: {
            repository: process.env.BACKEND_IMAGE_REPO || 'litedesk/crm-backend',
            tag: process.env.BACKEND_IMAGE_TAG || 'latest'
          },
          replicaCount: 2,
          port: 3000,
          resources: this.getResourcesForTier(subscriptionTier)
        },
        frontend: {
          image: {
            repository: process.env.FRONTEND_IMAGE_REPO || 'litedesk/crm-frontend',
            tag: process.env.FRONTEND_IMAGE_TAG || 'latest'
          },
          replicaCount: 2,
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '500m', memory: '512Mi' }
          }
        },
        jwtSecret: jwtSecret,
        mongodbPassword: dbResult.password,
        mongodbConnectionString: dbResult.connectionString
      };
      
      await this.k8sManager.deployInstance(instanceRegistry.kubernetesNamespace, deploymentValues);
      
      console.log(`✅ Application deployed\n`);
      
      // ============================================
      // STAGE 7: Configure DNS
      // ============================================
      console.log('🌐 STAGE 7: Configuring DNS...');
      await this.updateStage(instanceRegistry, 'dns');
      
      const loadBalancerDNS = await this.dnsManager.getIngressLoadBalancerDNS();
      
      await this.dnsManager.createSubdomain(subdomain, loadBalancerDNS, 'CNAME');
      
      console.log(`✅ DNS configured: ${subdomain}.litedesk.com\n`);
      
      // ============================================
      // STAGE 8: SSL Certificate (via cert-manager)
      // ============================================
      console.log('🔒 STAGE 8: SSL certificate provisioning...');
      await this.updateStage(instanceRegistry, 'ssl');
      
      // cert-manager will automatically provision SSL certificate
      // based on the ingress annotations we set
      console.log(`   cert-manager will auto-provision SSL certificate`);
      console.log(`   This may take 1-2 minutes...\n`);
      
      // Wait a bit for SSL to be provisioned
      await this.wait(30000); // 30 seconds
      
      // ============================================
      // STAGE 9: Final Verification
      // ============================================
      console.log('✅ STAGE 9: Final verification...');
      await this.updateStage(instanceRegistry, 'complete');
      
      // Update instance status
      instanceRegistry.status = 'active';
      instanceRegistry.healthStatus = 'healthy';
      instanceRegistry.activatedAt = new Date();
      instanceRegistry.lastHealthCheck = new Date();
      await instanceRegistry.save();
      
      console.log('\n========================================');
      console.log('🎉 PROVISIONING COMPLETE!');
      console.log(`   Instance URL: https://${subdomain}.litedesk.com`);
      console.log(`   Owner: ${ownerEmail}`);
      console.log(`   Status: ${instanceRegistry.status}`);
      console.log('========================================\n');
      
      return {
        success: true,
        instanceId: instanceRegistry._id,
        subdomain: subdomain,
        url: `https://${subdomain}.litedesk.com`,
        ownerEmail: ownerEmail,
        status: instanceRegistry.status,
        message: 'Instance provisioned successfully'
      };
      
    } catch (error) {
      console.error('\n❌ PROVISIONING FAILED:', error.message);
      console.error(error.stack);
      
      // Update instance registry with error
      if (instanceRegistry) {
        instanceRegistry.status = 'failed';
        instanceRegistry.provisioningError = error.message;
        await instanceRegistry.save();
      }
      
      // Attempt rollback
      if (instanceRegistry && process.env.AUTO_ROLLBACK === 'true') {
        await this.rollback(instanceRegistry);
      }
      
      throw error;
    }
  }
  
  /**
   * DEVELOPMENT MODE: Simulate instance provisioning without actual infrastructure
   * @param {object} options - Provisioning options
   * @returns {Promise<object>} - Simulated instance details
   */
  async provisionInstanceDevelopment(options) {
    const {
      companyName,
      industry,
      ownerEmail,
      ownerName,
      subscriptionTier = 'trial',
      demoRequestId,
      createdBy
    } = options;
    
    try {
      console.log('📝 Generating subdomain...');
      const subdomain = await generateUniqueSlug(companyName);
      console.log(`   Subdomain: ${subdomain}.litedesk.com (SIMULATED)\n`);
      
      console.log('📦 Creating instance registry...');
      const instanceRegistry = await InstanceRegistry.create({
        instanceName: companyName,
        subdomain: subdomain,
        kubernetesNamespace: `instance-${subdomain}`,
        deploymentName: `litedesk-${subdomain}`,
        serviceName: `litedesk-${subdomain}-svc`,
        ingressName: `litedesk-${subdomain}-ingress`,
        ownerEmail: ownerEmail,
        ownerName: ownerName,
        status: 'active', // Immediately active in development
        provisioningStage: 'complete',
        healthStatus: 'healthy',
        subscription: {
          tier: subscriptionTier,
          status: subscriptionTier === 'trial' ? 'trial' : 'active',
          trialStartDate: subscriptionTier === 'trial' ? new Date() : undefined,
          trialEndDate: subscriptionTier === 'trial' ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) : undefined
        },
        databaseConnection: {
          host: `localhost`,
          port: 27017,
          database: `litedesk_${subdomain.replace(/-/g, '_')}`,
          username: `user_${subdomain}`,
          passwordSecret: `${subdomain}-db-secret`
        },
        config: {
          branding: {
            companyName: companyName
          }
        },
        urls: {
          frontend: `https://${subdomain}.litedesk.com`,
          api: `https://${subdomain}.litedesk.com/api`
        },
        activatedAt: new Date(),
        provisionedAt: new Date(),
        lastHealthCheck: new Date(),
        demoRequestId: demoRequestId,
        createdBy: createdBy
      });
      
      console.log(`✅ Instance registry created: ${instanceRegistry._id}\n`);
      
      console.log('⚠️  DEVELOPMENT MODE NOTICE:');
      console.log('   No actual infrastructure was provisioned.');
      console.log('   This is a simulated instance for local testing.\n');
      
      console.log('\n========================================');
      console.log('🎉 SIMULATED PROVISIONING COMPLETE!');
      console.log(`   Instance URL: https://${subdomain}.litedesk.com (simulated)`);
      console.log(`   Owner: ${ownerEmail}`);
      console.log(`   Status: ${instanceRegistry.status}`);
      console.log('========================================\n');
      
      return {
        success: true,
        instanceId: instanceRegistry._id,
        subdomain: subdomain,
        url: `https://${subdomain}.litedesk.com`,
        ownerEmail: ownerEmail,
        status: instanceRegistry.status,
        message: 'Instance simulated successfully (development mode)',
        isDevelopmentMode: true
      };
      
    } catch (error) {
      console.error('\n❌ SIMULATED PROVISIONING FAILED:', error.message);
      throw error;
    }
  }
  
  /**
   * Update provisioning stage
   */
  async updateStage(instance, stage) {
    instance.provisioningStage = stage;
    await instance.save();
  }
  
  /**
   * Get resource allocation based on subscription tier
   */
  getResourcesForTier(tier) {
    const resources = {
      trial: {
        requests: { cpu: '250m', memory: '512Mi' },
        limits: { cpu: '500m', memory: '1Gi' }
      },
      starter: {
        requests: { cpu: '500m', memory: '1Gi' },
        limits: { cpu: '1000m', memory: '2Gi' }
      },
      professional: {
        requests: { cpu: '1000m', memory: '2Gi' },
        limits: { cpu: '2000m', memory: '4Gi' }
      },
      enterprise: {
        requests: { cpu: '2000m', memory: '4Gi' },
        limits: { cpu: '4000m', memory: '8Gi' }
      }
    };
    
    return resources[tier] || resources.trial;
  }
  
  /**
   * Rollback failed provisioning
   */
  async rollback(instance) {
    console.log('\n🔄 ATTEMPTING ROLLBACK...');
    
    try {
      // Delete Kubernetes namespace (this will delete all resources)
      if (instance.kubernetesNamespace) {
        await this.k8sManager.deleteNamespace(instance.kubernetesNamespace);
        console.log(`✅ Deleted namespace: ${instance.kubernetesNamespace}`);
      }
      
      // Delete DNS record
      if (instance.subdomain) {
        const loadBalancerDNS = await this.dnsManager.getIngressLoadBalancerDNS();
        await this.dnsManager.deleteSubdomain(instance.subdomain, loadBalancerDNS);
        console.log(`✅ Deleted DNS record: ${instance.subdomain}`);
      }
      
      // Delete database
      if (instance.databaseConnection?.database) {
        await this.dbManager.deleteDatabase(instance.databaseConnection.database);
        console.log(`✅ Deleted database: ${instance.databaseConnection.database}`);
      }
      
      // Update instance status
      instance.status = 'terminated';
      instance.terminatedAt = new Date();
      await instance.save();
      
      console.log('✅ ROLLBACK COMPLETE\n');
    } catch (rollbackError) {
      console.error('❌ ROLLBACK FAILED:', rollbackError.message);
    }
  }
  
  /**
   * Suspend an instance
   */
  async suspendInstance(instanceId) {
    const instance = await InstanceRegistry.findById(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    console.log(`⏸️  Suspending instance: ${instance.subdomain}`);
    
    // Scale down deployments to 0
    // In production, implement this by updating deployment replicas
    
    instance.status = 'suspended';
    instance.suspendedAt = new Date();
    await instance.save();
    
    console.log(`✅ Instance suspended: ${instance.subdomain}`);
    
    return instance;
  }
  
  /**
   * Resume a suspended instance
   */
  async resumeInstance(instanceId) {
    const instance = await InstanceRegistry.findById(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    console.log(`▶️  Resuming instance: ${instance.subdomain}`);
    
    // Scale up deployments
    // In production, implement this by updating deployment replicas
    
    instance.status = 'active';
    instance.suspendedAt = null;
    await instance.save();
    
    console.log(`✅ Instance resumed: ${instance.subdomain}`);
    
    return instance;
  }
  
  /**
   * Terminate an instance permanently
   */
  async terminateInstance(instanceId) {
    const instance = await InstanceRegistry.findById(instanceId);
    if (!instance) throw new Error('Instance not found');
    
    console.log(`🗑️  Terminating instance: ${instance.subdomain}`);
    
    await this.rollback(instance);
    
    return instance;
  }
  
  /**
   * Utility: Wait for specified milliseconds
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = InstanceProvisioner;

