# LiteDesk Multi-Instance Architecture - Implementation Guide

## 🚨 CRITICAL: Architecture Change

This document outlines the implementation of **separate instance per organization** architecture, which is a significant departure from standard multi-tenant SaaS.

---

## 1. What This Means

### Traditional Multi-Tenant (What most SaaS uses)
```
Single Database → Shared by all organizations
Single Application → Serves all organizations
Data isolated by organizationId field
```

### Multi-Instance (What you're building)
```
Organization A → Dedicated Database + Dedicated App + acme.litedesk.com
Organization B → Dedicated Database + Dedicated App + beta.litedesk.com
Organization C → Dedicated Database + Dedicated App + gamma.litedesk.com
```

---

## 2. Components to Build

### Phase 0: Infrastructure Setup (NEW - Week 1-2)
**What:** Set up the container orchestration infrastructure

**Technology Stack:**
- ✅ **Docker** - Containerize application
- ✅ **Kubernetes (EKS)** - Orchestration
- ✅ **Helm** - Package manager for Kubernetes
- ✅ **MongoDB Atlas** - Managed database (or self-hosted MongoDB operator)
- ✅ **AWS Route 53** - DNS management
- ✅ **cert-manager** - Automatic SSL certificates
- ✅ **Ingress NGINX** - Load balancer & routing

**Deliverables:**
- [x] Kubernetes cluster on AWS EKS
- [x] Helm charts for LiteDesk application
- [x] MongoDB provisioning automation
- [x] DNS wildcard configuration (*.litedesk.com)
- [x] SSL automation setup

**Estimated Effort:** 80-120 hours (2-3 weeks for 1 person)

---

### Phase 1A: Instance Provisioning Service (NEW - Week 3-4)

**What:** Backend service that creates new instances automatically

**Technology:** Node.js + Kubernetes Client API

**Responsibilities:**
1. Generate unique subdomain (slug from company name)
2. Create Kubernetes namespace
3. Provision MongoDB database
4. Deploy application containers (frontend + backend)
5. Configure ingress & SSL
6. Update DNS records
7. Initialize database with owner user
8. Update InstanceRegistry

**File Structure:**
```
/server/services/provisioning/
  ├── instanceProvisioner.js       # Main orchestrator
  ├── kubernetesManager.js          # K8s API interactions
  ├── databaseManager.js            # MongoDB provisioning
  ├── dnsManager.js                 # Route 53 management
  ├── sslManager.js                 # Certificate management
  ├── templates/
  │   ├── deployment.yaml          # K8s deployment template
  │   ├── service.yaml             # K8s service template
  │   ├── ingress.yaml             # Ingress template
  │   └── secrets.yaml             # Secrets template
  └── utils/
      ├── slugGenerator.js          # Generate unique subdomains
      └── passwordGenerator.js      # Secure password generation
```

**Key APIs:**
```javascript
// POST /api/provisioning/create-instance
{
  demoRequestId: ObjectId,
  subscriptionTier: 'trial' | 'starter' | 'professional' | 'enterprise',
  password: String  // For owner user
}

// Returns:
{
  success: true,
  instanceId: ObjectId,
  subdomain: 'acme',
  url: 'https://acme.litedesk.com',
  status: 'provisioning',
  estimatedTime: '5-10 minutes'
}

// GET /api/provisioning/status/:instanceId
// Returns provisioning progress

// POST /api/provisioning/suspend/:instanceId
// Suspend an instance

// POST /api/provisioning/terminate/:instanceId
// Terminate an instance (delete all data)
```

**Estimated Effort:** 120-160 hours (3-4 weeks)

---

### Phase 1B: Master Control Panel (NEW - Week 5-6)

**What:** Admin dashboard to manage all instances

**Location:** `/master` directory (separate from customer instance code)

**Features:**
1. **Demo Requests Dashboard** ✅ Already exists (needs updates)
2. **Instance Management**
   - List all instances
   - View instance details (metrics, health, subscription)
   - Provision new instance (from demo request)
   - Suspend/resume instance
   - Terminate instance
3. **Monitoring Dashboard**
   - Instance health status
   - Resource usage per instance
   - Error logs aggregation
4. **Billing Dashboard**
   - MRR tracking
   - Subscription status per instance
   - Payment processing

**Updated Demo Conversion Flow:**
```javascript
// controllers/demoController.js - UPDATE
exports.convertToInstance = async (req, res) => {
  const { id } = req.params;
  const { password, subscriptionTier = 'trial' } = req.body;
  
  // 1. Get demo request
  const demoRequest = await DemoRequest.findById(id);
  
  // 2. Call provisioning service
  const provisioningResult = await InstanceProvisioner.createInstance({
    companyName: demoRequest.companyName,
    industry: demoRequest.industry,
    ownerEmail: demoRequest.email,
    ownerName: demoRequest.contactName,
    password: password,
    subscriptionTier: subscriptionTier,
    demoRequestId: id
  });
  
  // 3. Update demo request
  demoRequest.status = 'converted';
  demoRequest.convertedToInstanceId = provisioningResult.instanceId;
  demoRequest.convertedAt = new Date();
  await demoRequest.save();
  
  // 4. Send email to customer
  await EmailService.sendWelcomeEmail({
    to: demoRequest.email,
    url: provisioningResult.url,
    password: password  // Temporary password
  });
  
  res.json({
    success: true,
    message: 'Instance provisioning started',
    instance: provisioningResult
  });
};
```

**Estimated Effort:** 60-80 hours (1.5-2 weeks)

---

### Phase 1C: Containerization (NEW - Week 7)

**What:** Package the CRM application as Docker containers

**Files to Create:**
```
/Dockerfile.frontend
/Dockerfile.backend
/docker-compose.yml (for local testing)
/.dockerignore
/helm/
  ├── Chart.yaml
  ├── values.yaml
  └── templates/
      ├── deployment.yaml
      ├── service.yaml
      ├── ingress.yaml
      ├── configmap.yaml
      └── secrets.yaml
```

**Frontend Dockerfile:**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Backend Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ ./
EXPOSE 3000
CMD ["node", "server.js"]
```

**Estimated Effort:** 40 hours (1 week)

---

## 3. Updated Technology Stack

### Infrastructure Layer (NEW)
```json
{
  "kubernetes": "^1.28",
  "@kubernetes/client-node": "^0.20",
  "helm": "^3.13",
  "cert-manager": "^1.13",
  "ingress-nginx": "^4.8"
}
```

### Backend Additions
```json
{
  "@kubernetes/client-node": "^0.20",   // K8s API client
  "slugify": "^1.6",                    // Generate subdomains
  "aws-sdk": "^2.x",                    // Route 53 DNS
  "mongodb": "^6.x",                    // Direct MongoDB driver
  "ejs": "^3.x",                        // Template rendering
  "bull": "^4.x",                       // Queue provisioning jobs
  "redis": "^4.x"                       // Bull queue backend
}
```

---

## 4. Cost Implications

### Infrastructure Costs (Monthly)

**Kubernetes Cluster (AWS EKS):**
- Control plane: $72/month
- Worker nodes (3x t3.large): ~$150/month
- **Total EKS:** ~$220/month

**Per-Instance Costs:**
- MongoDB Atlas M10 (dedicated): ~$57/month
- Compute (2 pods): ~$30/month  
- Storage (10GB): ~$2/month
- **Total per instance:** ~$89/month

**For 10 customers:**
- EKS: $220
- Instances: $890
- **Total:** ~$1,110/month

**For 50 customers:**
- EKS: $220
- Instances: $4,450
- **Total:** ~$4,670/month

**For 100 customers:**
- EKS: $220
- Instances: $8,900
- **Total:** ~$9,120/month

### Cost Optimization Strategies:
1. **Shared MongoDB Cluster** - Run multiple databases on same cluster
2. **Resource Sharing** - Multiple small instances per node
3. **Spot Instances** - Save 60-70% on compute
4. **Reserved Instances** - Save 40% with 1-year commitment
5. **Auto-scaling** - Scale down during low usage

**Optimized costs:**
- Per instance: ~$25-35/month (vs $89)
- 100 customers: ~$3,500/month (vs $9,120)

---

## 5. Pricing Strategy

Given the high infrastructure costs, recommended pricing:

| Tier | Price/Month | Infrastructure Cost | Gross Margin |
|------|-------------|---------------------|--------------|
| Trial (15 days) | $0 | ~$25 | Loss leader |
| Starter | $99 | ~$30 | 70% |
| Professional | $299 | ~$35 | 88% |
| Enterprise | $999+ | ~$50 | 95% |

**Break-even analysis:**
- Need ~30 paying customers to cover base infrastructure
- Target: 100 customers = ~$30,000 MRR
- Costs: ~$3,500 = 88% gross margin

---

## 6. Development Phases (UPDATED)

### Phase 0: Infrastructure Setup ⚙️ (NEW - Weeks 1-2)
- [x] Set up AWS EKS cluster
- [x] Configure Helm
- [x] Set up MongoDB provisioning
- [x] Configure wildcard DNS
- [x] Set up SSL automation

### Phase 1: Foundation ✅ COMPLETED
- [x] Multi-tenancy & RBAC
- [x] Demo Request System
- [x] User Management

### Phase 1A: Instance Provisioning 🆕 (Weeks 3-5)
- [ ] Build provisioning service
- [ ] Kubernetes integration
- [ ] Database automation
- [ ] DNS/SSL automation
- [ ] Testing & validation

### Phase 1B: Master Control Panel 🆕 (Weeks 6-7)
- [ ] Instance management UI
- [ ] Monitoring dashboard
- [ ] Billing integration
- [ ] Admin tools

### Phase 1C: Containerization 🆕 (Week 8)
- [ ] Dockerize frontend
- [ ] Dockerize backend
- [ ] Create Helm charts
- [ ] CI/CD pipeline

### Phase 2: Core CRM (Weeks 9-12)
- [ ] Contacts (enhance)
- [ ] Organizations/Companies
- [ ] Deals pipeline
- [ ] Tasks & Events

### Phase 3+: Continue as planned...

---

## 7. Development Roadmap

**Timeline:** 8-10 weeks for multi-instance infrastructure + 12+ weeks for CRM features

**Team Requirements:**
- 1 DevOps/Infrastructure engineer (full-time, 8 weeks)
- 1 Backend developer (full-time, 8 weeks)
- 1 Frontend developer (part-time, 4 weeks)

**Total Effort:** ~400-500 hours for infrastructure alone

---

## 8. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| High complexity | High | Start with proof-of-concept |
| Infrastructure costs | High | Implement cost optimization |
| Provisioning failures | Medium | Robust error handling & rollback |
| Scaling challenges | Medium | Load testing before launch |
| Security concerns | High | Security audit per instance |

---

## 9. Alternative: Hybrid Approach

**Recommendation:** Start with multi-tenant, add multi-instance later

**Phase 1:** Traditional multi-tenant (what you have now)
- Much cheaper (~$200/month for 100 customers)
- Faster to market
- Easier to manage
- Standard SaaS model

**Phase 2:** Add multi-instance for enterprise tier
- Offer dedicated instances as premium feature
- Charge $999+/month to cover costs
- Most customers stay multi-tenant
- Only enterprise customers get dedicated instances

**Benefits:**
- Lower risk
- Faster launch
- Prove product-market fit first
- Add complexity only when needed
- Much lower costs initially

---

## 10. Next Steps

**Immediate Decision Required:**

1. **Proceed with multi-instance?**
   - ✅ Yes → Hire DevOps engineer, allocate 8-10 weeks
   - ❌ No → Continue with multi-tenant, launch faster

2. **Budget Confirmation:**
   - Infrastructure: ~$220-500/month (base)
   - Development: ~$20,000-30,000 (one-time)
   - Ongoing: Scales with customers (~$25-35 per customer)

3. **Timeline Expectations:**
   - Multi-instance ready: 8-10 weeks
   - CRM features: Additional 12+ weeks
   - Total to MVP: 5-6 months

**My Professional Recommendation:** 
Start with multi-tenant, validate the market, then add multi-instance for enterprise customers. This reduces risk and gets you to market 2x faster with 10x lower costs.

---

*Document Version: 1.0*  
*Created: October 22, 2025*  
*Status: Architecture Planning*

