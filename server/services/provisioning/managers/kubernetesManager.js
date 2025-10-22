const k8s = require('@kubernetes/client-node');
const yaml = require('yaml');
const fs = require('fs').promises;
const path = require('path');

class KubernetesManager {
  constructor() {
    this.kc = new k8s.KubeConfig();
    
    // Load kubeconfig (in production, use in-cluster config)
    if (process.env.KUBERNETES_SERVICE_HOST) {
      // Running inside Kubernetes cluster
      this.kc.loadFromCluster();
    } else {
      // Running locally or in development
      this.kc.loadFromDefault();
    }
    
    // Initialize API clients
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.networkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
  }
  
  /**
   * Create a namespace for the instance
   * @param {string} namespaceName - Name of the namespace
   * @param {object} labels - Labels for the namespace
   * @returns {Promise<object>} - Created namespace
   */
  async createNamespace(namespaceName, labels = {}) {
    try {
      const namespace = {
        metadata: {
          name: namespaceName,
          labels: {
            app: 'litedesk',
            'managed-by': 'litedesk-provisioner',
            ...labels
          }
        }
      };
      
      const response = await this.coreApi.createNamespace(namespace);
      console.log(`✅ Namespace created: ${namespaceName}`);
      return response.body;
    } catch (error) {
      if (error.response?.statusCode === 409) {
        console.log(`⚠️ Namespace already exists: ${namespaceName}`);
        return await this.getNamespace(namespaceName);
      }
      throw new Error(`Failed to create namespace: ${error.message}`);
    }
  }
  
  /**
   * Get a namespace
   * @param {string} namespaceName - Name of the namespace
   * @returns {Promise<object>} - Namespace object
   */
  async getNamespace(namespaceName) {
    try {
      const response = await this.coreApi.readNamespace(namespaceName);
      return response.body;
    } catch (error) {
      throw new Error(`Failed to get namespace: ${error.message}`);
    }
  }
  
  /**
   * Create a secret
   * @param {string} namespace - Namespace name
   * @param {string} secretName - Secret name
   * @param {object} data - Secret data (will be base64 encoded)
   * @returns {Promise<object>} - Created secret
   */
  async createSecret(namespace, secretName, data) {
    try {
      const secret = {
        metadata: {
          name: secretName,
          namespace: namespace
        },
        type: 'Opaque',
        stringData: data
      };
      
      const response = await this.coreApi.createNamespacedSecret(namespace, secret);
      console.log(`✅ Secret created: ${secretName} in ${namespace}`);
      return response.body;
    } catch (error) {
      if (error.response?.statusCode === 409) {
        console.log(`⚠️ Secret already exists: ${secretName}`);
        return await this.getSecret(namespace, secretName);
      }
      throw new Error(`Failed to create secret: ${error.message}`);
    }
  }
  
  /**
   * Get a secret
   * @param {string} namespace - Namespace name
   * @param {string} secretName - Secret name
   * @returns {Promise<object>} - Secret object
   */
  async getSecret(namespace, secretName) {
    try {
      const response = await this.coreApi.readNamespacedSecret(secretName, namespace);
      return response.body;
    } catch (error) {
      throw new Error(`Failed to get secret: ${error.message}`);
    }
  }
  
  /**
   * Deploy using Helm chart values (simplified - in production use Helm directly)
   * @param {string} namespace - Namespace name
   * @param {object} values - Helm values
   * @returns {Promise<object>} - Deployment result
   */
  async deployInstance(namespace, values) {
    try {
      console.log(`🚀 Deploying instance in namespace: ${namespace}`);
      
      // In production, this would use Helm CLI or Helm SDK
      // For now, we'll apply manifests directly
      
      const results = {
        namespace: await this.createNamespace(namespace, {
          instance: values.instance.subdomain,
          'owner-email': values.instance.ownerEmail
        }),
        secrets: {},
        deployments: {},
        services: {},
        ingress: null
      };
      
      // Create secrets
      results.secrets.app = await this.createSecret(
        namespace,
        `${values.instance.name}-app-secret`,
        {
          'jwt-secret': values.jwtSecret || this.generateRandomString(64)
        }
      );
      
      results.secrets.mongodb = await this.createSecret(
        namespace,
        `${values.instance.name}-mongodb-secret`,
        {
          'mongodb-password': values.mongodbPassword,
          'connection-string': values.mongodbConnectionString
        }
      );
      
      // Create backend deployment
      results.deployments.backend = await this.createBackendDeployment(namespace, values);
      
      // Create frontend deployment
      results.deployments.frontend = await this.createFrontendDeployment(namespace, values);
      
      // Create services
      results.services.backend = await this.createService(
        namespace,
        `${values.instance.name}-backend`,
        { app: 'litedesk-backend', instance: values.instance.subdomain },
        values.backend.port || 3000
      );
      
      results.services.frontend = await this.createService(
        namespace,
        `${values.instance.name}-frontend`,
        { app: 'litedesk-frontend', instance: values.instance.subdomain },
        80
      );
      
      // Create ingress
      results.ingress = await this.createIngress(namespace, values);
      
      console.log(`✅ Instance deployed successfully in ${namespace}`);
      return results;
    } catch (error) {
      console.error(`❌ Deployment failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create backend deployment
   */
  async createBackendDeployment(namespace, values) {
    const deployment = {
      metadata: {
        name: `${values.instance.name}-backend`,
        namespace: namespace,
        labels: {
          app: 'litedesk-backend',
          instance: values.instance.subdomain
        }
      },
      spec: {
        replicas: values.backend.replicaCount || 2,
        selector: {
          matchLabels: {
            app: 'litedesk-backend',
            instance: values.instance.subdomain
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'litedesk-backend',
              instance: values.instance.subdomain
            }
          },
          spec: {
            containers: [{
              name: 'backend',
              image: `${values.backend.image.repository}:${values.backend.image.tag}`,
              ports: [{
                containerPort: values.backend.port || 3000,
                name: 'http'
              }],
              env: [
                { name: 'NODE_ENV', value: 'production' },
                { name: 'PORT', value: String(values.backend.port || 3000) },
                {
                  name: 'MONGO_URI',
                  valueFrom: {
                    secretKeyRef: {
                      name: `${values.instance.name}-mongodb-secret`,
                      key: 'connection-string'
                    }
                  }
                },
                {
                  name: 'JWT_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: `${values.instance.name}-app-secret`,
                      key: 'jwt-secret'
                    }
                  }
                },
                { name: 'JWT_EXPIRES_IN', value: '1d' }
              ],
              resources: values.backend.resources || {
                requests: { cpu: '250m', memory: '512Mi' },
                limits: { cpu: '1000m', memory: '1Gi' }
              },
              livenessProbe: {
                httpGet: { path: '/health', port: 'http' },
                initialDelaySeconds: 30,
                periodSeconds: 10
              },
              readinessProbe: {
                httpGet: { path: '/health', port: 'http' },
                initialDelaySeconds: 15,
                periodSeconds: 5
              }
            }]
          }
        }
      }
    };
    
    const response = await this.appsApi.createNamespacedDeployment(namespace, deployment);
    console.log(`✅ Backend deployment created: ${values.instance.name}-backend`);
    return response.body;
  }
  
  /**
   * Create frontend deployment
   */
  async createFrontendDeployment(namespace, values) {
    const deployment = {
      metadata: {
        name: `${values.instance.name}-frontend`,
        namespace: namespace,
        labels: {
          app: 'litedesk-frontend',
          instance: values.instance.subdomain
        }
      },
      spec: {
        replicas: values.frontend.replicaCount || 2,
        selector: {
          matchLabels: {
            app: 'litedesk-frontend',
            instance: values.instance.subdomain
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'litedesk-frontend',
              instance: values.instance.subdomain
            }
          },
          spec: {
            containers: [{
              name: 'frontend',
              image: `${values.frontend.image.repository}:${values.frontend.image.tag}`,
              ports: [{
                containerPort: 80,
                name: 'http'
              }],
              resources: values.frontend.resources || {
                requests: { cpu: '100m', memory: '128Mi' },
                limits: { cpu: '500m', memory: '512Mi' }
              },
              livenessProbe: {
                httpGet: { path: '/health', port: 'http' },
                initialDelaySeconds: 10,
                periodSeconds: 10
              }
            }]
          }
        }
      }
    };
    
    const response = await this.appsApi.createNamespacedDeployment(namespace, deployment);
    console.log(`✅ Frontend deployment created: ${values.instance.name}-frontend`);
    return response.body;
  }
  
  /**
   * Create a service
   */
  async createService(namespace, serviceName, selector, port) {
    const service = {
      metadata: {
        name: serviceName,
        namespace: namespace
      },
      spec: {
        type: 'ClusterIP',
        selector: selector,
        ports: [{
          port: port,
          targetPort: port,
          protocol: 'TCP',
          name: 'http'
        }]
      }
    };
    
    const response = await this.coreApi.createNamespacedService(namespace, service);
    console.log(`✅ Service created: ${serviceName}`);
    return response.body;
  }
  
  /**
   * Create ingress
   */
  async createIngress(namespace, values) {
    const host = `${values.instance.subdomain}.litedesk.com`;
    
    const ingress = {
      metadata: {
        name: `${values.instance.name}-ingress`,
        namespace: namespace,
        annotations: {
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true'
        }
      },
      spec: {
        ingressClassName: 'nginx',
        tls: [{
          hosts: [host],
          secretName: `${values.instance.name}-tls`
        }],
        rules: [{
          host: host,
          http: {
            paths: [
              {
                path: '/api',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: `${values.instance.name}-backend`,
                    port: { number: values.backend.port || 3000 }
                  }
                }
              },
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: `${values.instance.name}-frontend`,
                    port: { number: 80 }
                  }
                }
              }
            ]
          }
        }]
      }
    };
    
    const response = await this.networkingApi.createNamespacedIngress(namespace, ingress);
    console.log(`✅ Ingress created: ${host}`);
    return response.body;
  }
  
  /**
   * Delete a namespace and all its resources
   * @param {string} namespace - Namespace to delete
   */
  async deleteNamespace(namespace) {
    try {
      await this.coreApi.deleteNamespace(namespace);
      console.log(`✅ Namespace deleted: ${namespace}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete namespace: ${error.message}`);
    }
  }
  
  /**
   * Check namespace status
   * @param {string} namespace - Namespace name
   * @returns {Promise<object>} - Status information
   */
  async getNamespaceStatus(namespace) {
    try {
      // Get all pods in namespace
      const pods = await this.coreApi.listNamespacedPod(namespace);
      
      const status = {
        namespace: namespace,
        pods: {
          total: pods.body.items.length,
          running: 0,
          pending: 0,
          failed: 0,
          succeeded: 0
        },
        healthy: false
      };
      
      pods.body.items.forEach(pod => {
        const phase = pod.status.phase;
        if (phase === 'Running') status.pods.running++;
        else if (phase === 'Pending') status.pods.pending++;
        else if (phase === 'Failed') status.pods.failed++;
        else if (phase === 'Succeeded') status.pods.succeeded++;
      });
      
      // Consider healthy if all pods are running
      status.healthy = status.pods.running === status.pods.total && status.pods.total > 0;
      
      return status;
    } catch (error) {
      throw new Error(`Failed to get namespace status: ${error.message}`);
    }
  }
  
  /**
   * Generate a random string
   */
  generateRandomString(length) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }
}

module.exports = KubernetesManager;

