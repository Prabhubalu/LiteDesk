const AWS = require('aws-sdk');

class DNSManager {
  constructor() {
    // Initialize AWS Route 53 client
    this.route53 = new AWS.Route53({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    // Hosted Zone ID for your domain (e.g., litedesk.com)
    this.hostedZoneId = process.env.ROUTE53_HOSTED_ZONE_ID;
    this.baseDomain = process.env.BASE_DOMAIN || 'litedesk.com';
  }
  
  /**
   * Create DNS record for a subdomain
   * @param {string} subdomain - The subdomain (e.g., 'acme')
   * @param {string} target - The target (LoadBalancer DNS or IP)
   * @param {string} type - Record type ('A' or 'CNAME')
   * @returns {Promise<object>} - DNS record creation result
   */
  async createSubdomain(subdomain, target, type = 'CNAME') {
    const fullDomain = `${subdomain}.${this.baseDomain}`;
    
    console.log(`🌐 Creating DNS record: ${fullDomain} -> ${target}`);
    
    try {
      const params = {
        HostedZoneId: this.hostedZoneId,
        ChangeBatch: {
          Comment: `LiteDesk instance: ${subdomain}`,
          Changes: [{
            Action: 'UPSERT', // Create or update
            ResourceRecordSet: {
              Name: fullDomain,
              Type: type,
              TTL: 300, // 5 minutes
              ResourceRecords: [{
                Value: target
              }]
            }
          }]
        }
      };
      
      const result = await this.route53.changeResourceRecordSets(params).promise();
      
      console.log(`✅ DNS record created: ${fullDomain}`);
      
      // Wait for change to propagate
      await this.waitForChange(result.ChangeInfo.Id);
      
      return {
        subdomain: subdomain,
        fullDomain: fullDomain,
        target: target,
        type: type,
        changeId: result.ChangeInfo.Id,
        status: result.ChangeInfo.Status
      };
    } catch (error) {
      console.error(`❌ DNS record creation failed: ${error.message}`);
      throw new Error(`Failed to create DNS record: ${error.message}`);
    }
  }
  
  /**
   * Create wildcard SSL DNS validation record
   * @param {string} subdomain - The subdomain
   * @param {object} validationRecord - DNS validation record from cert-manager
   * @returns {Promise<object>} - Validation record creation result
   */
  async createValidationRecord(subdomain, validationRecord) {
    console.log(`🔐 Creating DNS validation record for: ${subdomain}.${this.baseDomain}`);
    
    try {
      const params = {
        HostedZoneId: this.hostedZoneId,
        ChangeBatch: {
          Comment: `SSL validation for ${subdomain}.${this.baseDomain}`,
          Changes: [{
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: validationRecord.name,
              Type: 'TXT',
              TTL: 60,
              ResourceRecords: [{
                Value: `"${validationRecord.value}"`
              }]
            }
          }]
        }
      };
      
      const result = await this.route53.changeResourceRecordSets(params).promise();
      
      console.log(`✅ DNS validation record created`);
      
      await this.waitForChange(result.ChangeInfo.Id);
      
      return result;
    } catch (error) {
      console.error(`❌ DNS validation record creation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Delete DNS record for a subdomain
   * @param {string} subdomain - The subdomain to delete
   * @param {string} target - The current target value
   * @param {string} type - Record type
   * @returns {Promise<object>} - Deletion result
   */
  async deleteSubdomain(subdomain, target, type = 'CNAME') {
    const fullDomain = `${subdomain}.${this.baseDomain}`;
    
    console.log(`🗑️ Deleting DNS record: ${fullDomain}`);
    
    try {
      const params = {
        HostedZoneId: this.hostedZoneId,
        ChangeBatch: {
          Comment: `Delete LiteDesk instance: ${subdomain}`,
          Changes: [{
            Action: 'DELETE',
            ResourceRecordSet: {
              Name: fullDomain,
              Type: type,
              TTL: 300,
              ResourceRecords: [{
                Value: target
              }]
            }
          }]
        }
      };
      
      const result = await this.route53.changeResourceRecordSets(params).promise();
      
      console.log(`✅ DNS record deleted: ${fullDomain}`);
      
      return result;
    } catch (error) {
      console.error(`❌ DNS record deletion failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get DNS record for a subdomain
   * @param {string} subdomain - The subdomain
   * @returns {Promise<object>} - DNS record information
   */
  async getSubdomainRecord(subdomain) {
    const fullDomain = `${subdomain}.${this.baseDomain}.`;  // Note the trailing dot
    
    try {
      const params = {
        HostedZoneId: this.hostedZoneId,
        StartRecordName: fullDomain,
        MaxItems: '1'
      };
      
      const result = await this.route53.listResourceRecordSets(params).promise();
      
      const record = result.ResourceRecordSets.find(r => r.Name === fullDomain);
      
      if (!record) {
        return null;
      }
      
      return {
        name: record.Name,
        type: record.Type,
        ttl: record.TTL,
        values: record.ResourceRecords.map(r => r.Value)
      };
    } catch (error) {
      console.error(`Failed to get DNS record: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Wait for DNS change to propagate
   * @param {string} changeId - The change ID from Route53
   * @param {number} maxWaitTime - Maximum wait time in seconds
   * @returns {Promise<void>}
   */
  async waitForChange(changeId, maxWaitTime = 300) {
    console.log(`⏳ Waiting for DNS change to propagate...`);
    
    const startTime = Date.now();
    
    while (true) {
      try {
        const result = await this.route53.getChange({ Id: changeId }).promise();
        
        if (result.ChangeInfo.Status === 'INSYNC') {
          console.log(`✅ DNS change propagated`);
          return;
        }
        
        // Check if we've exceeded max wait time
        if ((Date.now() - startTime) / 1000 > maxWaitTime) {
          console.log(`⚠️ DNS change still pending after ${maxWaitTime}s, continuing anyway`);
          return;
        }
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`Error checking DNS change status: ${error.message}`);
        throw error;
      }
    }
  }
  
  /**
   * Get the Ingress LoadBalancer DNS name
   * (This would be called after Kubernetes ingress is created)
   * @returns {Promise<string>} - LoadBalancer DNS name
   */
  async getIngressLoadBalancerDNS() {
    // In a real implementation, this would query the Kubernetes cluster
    // to get the LoadBalancer service's external DNS name
    
    // For AWS EKS with ingress-nginx, it would be something like:
    // a1234567890abcdef-1234567890.us-east-1.elb.amazonaws.com
    
    // This is typically retrieved from:
    // kubectl get service ingress-nginx-controller -n ingress-nginx
    
    // For now, return from environment variable
    return process.env.INGRESS_LOADBALANCER_DNS || 'ingress.litedesk.com';
  }
  
  /**
   * Verify DNS resolution
   * @param {string} subdomain - The subdomain to verify
   * @param {number} maxAttempts - Maximum verification attempts
   * @returns {Promise<boolean>} - True if resolved successfully
   */
  async verifyDNSResolution(subdomain, maxAttempts = 10) {
    const dns = require('dns').promises;
    const fullDomain = `${subdomain}.${this.baseDomain}`;
    
    console.log(`🔍 Verifying DNS resolution for: ${fullDomain}`);
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const addresses = await dns.resolve(fullDomain);
        if (addresses && addresses.length > 0) {
          console.log(`✅ DNS resolved: ${fullDomain} -> ${addresses[0]}`);
          return true;
        }
      } catch (error) {
        console.log(`⏳ Attempt ${i + 1}/${maxAttempts}: DNS not yet resolved, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      }
    }
    
    console.log(`⚠️ DNS resolution verification timed out for: ${fullDomain}`);
    return false;
  }
  
  /**
   * List all LiteDesk subdomains
   * @returns {Promise<Array>} - List of subdomains
   */
  async listAllSubdomains() {
    try {
      const params = {
        HostedZoneId: this.hostedZoneId
      };
      
      const result = await this.route53.listResourceRecordSets(params).promise();
      
      // Filter for subdomains of baseDomain
      const subdomains = result.ResourceRecordSets
        .filter(record => 
          record.Name.endsWith(`.${this.baseDomain}.`) && 
          record.Name !== `${this.baseDomain}.`
        )
        .map(record => ({
          name: record.Name.replace(`.${this.baseDomain}.`, ''),
          fullName: record.Name,
          type: record.Type,
          ttl: record.TTL,
          values: record.ResourceRecords ? record.ResourceRecords.map(r => r.Value) : []
        }));
      
      return subdomains;
    } catch (error) {
      console.error(`Failed to list subdomains: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if DNS is properly configured
   * @returns {Promise<boolean>} - True if configured
   */
  async checkConfiguration() {
    try {
      if (!this.hostedZoneId) {
        console.error('❌ ROUTE53_HOSTED_ZONE_ID not configured');
        return false;
      }
      
      // Try to get the hosted zone
      const params = { Id: this.hostedZoneId };
      const result = await this.route53.getHostedZone(params).promise();
      
      console.log(`✅ DNS configured: ${result.HostedZone.Name}`);
      return true;
    } catch (error) {
      console.error(`❌ DNS configuration check failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = DNSManager;

