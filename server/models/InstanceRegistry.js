const mongoose = require('mongoose');

const InstanceRegistrySchema = new mongoose.Schema({
  // Instance Identification
  instanceName: {
    type: String,
    required: true
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  customDomain: String,
  
  // Technical Details
  kubernetesNamespace: String,
  deploymentName: String,
  serviceName: String,
  ingressName: String,
  
  // Database Connection Info
  databaseConnection: {
    host: String,
    port: {
      type: Number,
      default: 27017
    },
    database: String,
    username: String,
    passwordSecret: String  // Reference to Kubernetes secret
  },
  
  // Resource Allocation
  resources: {
    cpu: {
      type: String,
      default: '500m'  // 500 millicores
    },
    memory: {
      type: String,
      default: '1Gi'
    },
    storage: {
      type: String,
      default: '10Gi'
    },
    replicas: {
      type: Number,
      default: 2
    }
  },
  
  // Instance Status
  status: {
    type: String,
    enum: ['provisioning', 'active', 'suspended', 'failed', 'terminated'],
    default: 'provisioning'
  },
  provisioningStage: {
    type: String,
    enum: ['initiated', 'namespace', 'database', 'secrets', 'deployment', 'service', 'ingress', 'dns', 'ssl', 'initialization', 'complete', 'error'],
    default: 'initiated'
  },
  provisioningError: String,
  
  // Health Monitoring
  healthStatus: {
    type: String,
    enum: ['healthy', 'degraded', 'unhealthy', 'unknown'],
    default: 'unknown'
  },
  lastHealthCheck: Date,
  healthCheckErrors: [String],
  
  // Subscription & Billing
  subscription: {
    tier: {
      type: String,
      enum: ['trial', 'paid'],
      default: 'trial'
    },
    status: {
      type: String,
      enum: ['trial', 'active', 'past_due', 'canceled', 'suspended'],
      default: 'trial'
    },
    trialStartDate: Date,
    trialEndDate: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    mrr: {
      type: Number,
      default: 0
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String
  },
  
  // Owner Information
  ownerEmail: {
    type: String,
    required: true
  },
  ownerName: String,
  ownerUserId: String,  // User ID in the instance database
  
  // Usage Metrics
  metrics: {
    totalUsers: {
      type: Number,
      default: 0
    },
    totalContacts: {
      type: Number,
      default: 0
    },
    totalDeals: {
      type: Number,
      default: 0
    },
    storageUsedGB: {
      type: Number,
      default: 0
    },
    apiCallsThisMonth: {
      type: Number,
      default: 0
    },
    lastMetricsUpdate: Date
  },
  
  // Configuration
  config: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    language: {
      type: String,
      default: 'en'
    },
    features: {
      type: [String],
      default: ['contacts', 'deals', 'tasks', 'events']
    },
    branding: {
      logoUrl: String,
      primaryColor: {
        type: String,
        default: '#3b82f6'
      },
      companyName: String
    }
  },
  
  // URLs
  urls: {
    frontend: String,
    api: String,
    admin: String
  },
  
  // Lifecycle Timestamps
  provisionedAt: Date,
  activatedAt: Date,
  suspendedAt: Date,
  terminatedAt: Date,
  
  // Links
  demoRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DemoRequest'
  },
  
  // Notes & Metadata
  notes: String,
  tags: [String],
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for fast queries
InstanceRegistrySchema.index({ subdomain: 1 }, { unique: true });
InstanceRegistrySchema.index({ status: 1 });
InstanceRegistrySchema.index({ 'subscription.status': 1 });
InstanceRegistrySchema.index({ healthStatus: 1 });
InstanceRegistrySchema.index({ ownerEmail: 1 });
InstanceRegistrySchema.index({ createdAt: -1 });
InstanceRegistrySchema.index({ demoRequestId: 1 });

// Virtual for full URL
InstanceRegistrySchema.virtual('fullUrl').get(function() {
  return this.customDomain || `https://${this.subdomain}.litedesk.com`;
});

// Method to check if instance is active and healthy
InstanceRegistrySchema.methods.isOperational = function() {
  return this.status === 'active' && this.healthStatus === 'healthy';
};

// Method to check if trial is expired
InstanceRegistrySchema.methods.isTrialExpired = function() {
  if (this.subscription.status !== 'trial') return false;
  if (!this.subscription.trialEndDate) return false;
  return new Date() > this.subscription.trialEndDate;
};

// Method to calculate days until trial expires
InstanceRegistrySchema.methods.trialDaysRemaining = function() {
  if (this.subscription.status !== 'trial') return 0;
  if (!this.subscription.trialEndDate) return 0;
  
  const now = new Date();
  const endDate = new Date(this.subscription.trialEndDate);
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Static method to find instances needing health check
InstanceRegistrySchema.statics.findInstancesNeedingHealthCheck = function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.find({
    status: 'active',
    $or: [
      { lastHealthCheck: { $lt: fiveMinutesAgo } },
      { lastHealthCheck: { $exists: false } }
    ]
  });
};

// Pre-save middleware to set provisioning start time
InstanceRegistrySchema.pre('save', function(next) {
  if (this.isNew && !this.provisionedAt) {
    this.provisionedAt = new Date();
  }
  
  // Set activated time when status changes to active
  if (this.isModified('status') && this.status === 'active' && !this.activatedAt) {
    this.activatedAt = new Date();
  }
  
  // Set suspended time
  if (this.isModified('status') && this.status === 'suspended' && !this.suspendedAt) {
    this.suspendedAt = new Date();
  }
  
  // Set terminated time
  if (this.isModified('status') && this.status === 'terminated' && !this.terminatedAt) {
    this.terminatedAt = new Date();
  }
  
  next();
});

module.exports = mongoose.model('InstanceRegistry', InstanceRegistrySchema);

