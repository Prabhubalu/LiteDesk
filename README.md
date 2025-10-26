# 🚀 LiteDesk - Multi-Instance CRM Platform

> **Enterprise-grade, white-label CRM with automated multi-instance architecture**

LiteDesk is a modern CRM platform built on a unique multi-instance architecture where each customer gets their own isolated application instance with dedicated database, subdomain, and independent scaling.

---

## ✨ Features

### 🏢 Multi-Instance Architecture
- **Complete Isolation:** Each customer gets a dedicated application instance
- **Dedicated Database:** Separate MongoDB database per customer
- **Custom Subdomains:** Automatic subdomain provisioning (e.g., `acme.litedesk.com`)
- **Independent Scaling:** Scale each customer instance independently
- **White-Label Ready:** Full customization per instance

### 🎯 Core CRM Features
- **Contact Management:** Organize and manage customer contacts
- **Deal Pipeline:** Visual sales pipeline with drag-and-drop
- **Task Management:** Track activities and follow-ups
- **Internal Tabs Navigation:** Multi-tasking with browser-like tabs for records and modules
- **Role-Based Access Control:** 5-tier permission system (Owner, Admin, Manager, User, Viewer)
- **Multi-Tenancy:** Organization-based data isolation
- **Subscription Management:** Built-in trial and subscription system

### 🔧 Admin Features
- **Demo Request System:** Capture and qualify leads
- **Instance Provisioning:** One-click conversion to full instance
- **Instance Management Dashboard:** Monitor all customer instances
- **Health Monitoring:** Automated health checks every 5 minutes
- **Metrics Collection:** Usage tracking and analytics
- **Subscription Management:** Manage tiers and billing

### 🛡️ Security & Compliance
- **JWT Authentication:** Secure token-based auth
- **Database-Level Isolation:** Complete data separation
- **Encrypted Connections:** SSL/TLS everywhere
- **RBAC:** Granular permission control
- **Audit Logging:** Track all user actions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Master Control Plane                        │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Frontend  │  │   Backend    │  │  Master MongoDB  │    │
│  │  (Vue.js)  │  │  (Node.js)   │  │                  │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
│         │                │                      │            │
│         └────────────────┴──────────────────────┘            │
│                          │                                   │
│         ┌────────────────────────────────┐                  │
│         │   Instance Provisioner         │                  │
│         │   - Kubernetes Manager         │                  │
│         │   - Database Manager           │                  │
│         │   - DNS Manager                │                  │
│         └────────────────────────────────┘                  │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │        Kubernetes Cluster            │
        │                                      │
        │  ┌─────────────────────────────┐    │
        │  │  Customer Instance 1        │    │
        │  │  - Frontend (Nginx)         │    │
        │  │  - Backend (Node.js)        │    │
        │  │  - MongoDB                  │    │
        │  │  - acme.litedesk.com        │    │
        │  └─────────────────────────────┘    │
        │                                      │
        │  ┌─────────────────────────────┐    │
        │  │  Customer Instance 2        │    │
        │  │  - Frontend (Nginx)         │    │
        │  │  - Backend (Node.js)        │    │
        │  │  - MongoDB                  │    │
        │  │  - corp.litedesk.com        │    │
        │  └─────────────────────────────┘    │
        └──────────────────────────────────────┘
```

---

## 🚀 Quick Start

**New Developer?** → See **[QUICK_START.md](QUICK_START.md)** for 5-minute setup!

**Detailed Setup?** → See **[DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)** for complete guide!

### Prerequisites
- Node.js 20.19+ or 22.12+
- MongoDB 6.0+
- npm (comes with Node.js)

### TL;DR - Get Running in 5 Minutes

```bash
# 1. Clone
git clone https://github.com/yourusername/litedesk.git
cd litedesk

# 2. Install
cd server && npm install
cd ../client && npm install

# 3. Setup MongoDB & .env
brew services start mongodb-community  # Mac
cd server && cp .env.example .env
# Edit .env: Set JWT_SECRET, REFRESH_TOKEN_SECRET, MASTER_API_KEY

# 4. Create Admin Account
node scripts/createDefaultAdmin.js

# 5. Start (2 terminals)
# Terminal 1: cd server && npm start
# Terminal 2: cd client && npm run dev

# 6. Login at http://localhost:5173
# Email: admin@litedesk.com
# Password: Admin@123
```

**That's it!** 🎉 You're ready to start developing.

### For Production Deployment

See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for AWS/Kubernetes deployment.

---

## 📚 Documentation

### Getting Started
- **[Quick Start Guide](QUICK_START.md)** - Get running in 5 minutes ⚡
- **[Developer Setup Guide](DEVELOPER_SETUP.md)** - Complete developer onboarding 📖
- **[MongoDB Setup Guide](MONGODB_SETUP_GUIDE.md)** - MongoDB installation and configuration 🗄️

### Email Integration 📧
- **[START HERE - Email Integration](START_HERE_EMAIL.md)** - Should you use AWS SES? ⚡
- **[AWS SES Setup Guide](docs/AWS_SES_SETUP_GUIDE.md)** - Complete SES implementation walkthrough
- **[Email Service Comparison](docs/EMAIL_SERVICE_COMPARISON.md)** - SES vs SendGrid vs Mailgun
- **[Email Implementation Checklist](docs/EMAIL_IMPLEMENTATION_CHECKLIST.md)** - 8-phase task breakdown
- **[Email Quick Reference](docs/EMAIL_QUICK_REFERENCE.md)** - Commands, costs, troubleshooting

### User Interface & Navigation 🎯 NEW!
- **[START HERE - Internal Tabs](START_HERE_TABS.md)** - Quick overview and benefits ⚡
- **[Tabs Integration Complete](TABS_INTEGRATION_COMPLETE.md)** - Full integration summary ✅
- **[Internal Tabs Implementation](INTERNAL_TABS_IMPLEMENTATION.md)** - Complete tabs navigation system 📑
- **[Tabs Quick Reference](docs/TABS_QUICK_REFERENCE.md)** - Developer guide for tabs integration 🚀

### Technical Documentation  
- **[Technical Specification](TECHNICAL_SPEC.md)** - Complete technical details
- **[Multi-Instance Implementation](MULTI_INSTANCE_IMPLEMENTATION.md)** - Multi-instance architecture
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production AWS/Kubernetes deployment
- **[Build Summary](BUILD_SUMMARY.md)** - Development progress and changelog

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB 7.0
- **Authentication:** JWT + bcrypt
- **Cloud SDK:** AWS SDK (S3, SES, Route 53)
- **Kubernetes:** @kubernetes/client-node
- **Queue:** Bull + Redis (optional)

### Frontend
- **Framework:** Vue.js 3 (Composition API)
- **State Management:** Pinia
- **Routing:** Vue Router
- **Styling:** Tailwind CSS
- **UI Components:** Headless UI

### Infrastructure
- **Containerization:** Docker
- **Orchestration:** Kubernetes (AWS EKS)
- **Package Manager:** Helm 3
- **Web Server:** Nginx
- **SSL:** cert-manager + Let's Encrypt
- **DNS:** AWS Route 53
- **Storage:** AWS S3
- **Email:** AWS SES

### CI/CD
- **GitHub Actions** - Automated builds and deployments
- **AWS ECR** - Docker image registry

---

## 🚢 Deployment

### Production Deployment to AWS

Follow the comprehensive [Deployment Guide](DEPLOYMENT_GUIDE.md) for step-by-step instructions.

**Quick Overview:**
1. Create AWS EKS cluster
2. Install ingress-nginx and cert-manager
3. Configure Route 53 DNS
4. Build and push Docker images
5. Deploy with Helm
6. Configure environment variables
7. Test instance provisioning

### Environment Variables

Copy `server/.env.example` to `server/.env` and configure:

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
MONGO_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# AWS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
ROUTE53_HOSTED_ZONE_ID=your_hosted_zone_id
BASE_DOMAIN=litedesk.com

# Kubernetes
KUBECONFIG_PATH=/path/to/kubeconfig
INGRESS_LOADBALANCER_DNS=your-loadbalancer-dns

# Monitoring (optional)
ENABLE_HEALTH_CHECKER=true
ENABLE_METRICS_COLLECTOR=true
```

---

## 📊 Project Structure

```
litedesk/
├── server/                          # Backend Node.js application
│   ├── models/                      # Mongoose models
│   │   ├── User.js
│   │   ├── Organization.js
│   │   ├── Contact.js
│   │   ├── DemoRequest.js
│   │   └── InstanceRegistry.js      # Multi-instance registry
│   ├── controllers/                 # Request handlers
│   ├── routes/                      # API routes
│   ├── middleware/                  # Auth, RBAC, etc.
│   ├── services/                    # Business logic
│   │   ├── provisioning/            # Instance provisioning
│   │   │   ├── instanceProvisioner.js
│   │   │   ├── managers/            # K8s, DB, DNS managers
│   │   │   └── utils/
│   │   └── monitoring/              # Health checks, metrics
│   └── server.js                    # Entry point
├── client/                          # Frontend Vue.js application
│   ├── src/
│   │   ├── components/              # Reusable components
│   │   ├── views/                   # Page components
│   │   │   ├── Dashboard.vue
│   │   │   ├── DemoRequests.vue
│   │   │   └── InstanceManagement.vue
│   │   ├── stores/                  # Pinia stores
│   │   ├── router/                  # Vue Router
│   │   └── utils/                   # Utilities
│   └── vite.config.js
├── helm/                            # Kubernetes Helm charts
│   └── litedesk/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/               # K8s resource templates
├── .github/
│   └── workflows/                   # GitHub Actions CI/CD
│       ├── deploy-master.yml
│       ├── test.yml
│       ├── docker-publish.yml
│       └── monitoring.yml
├── Dockerfile.backend               # Backend container
├── Dockerfile.frontend              # Frontend container
├── docker-compose.yml               # Local development
├── nginx.conf                       # Nginx configuration
└── README.md                        # This file
```

---

## 🧪 Testing

```bash
# Run backend tests
cd server
npm test

# Run frontend tests
cd client
npm test

# Test Docker builds
docker-compose up --build

# Test Kubernetes deployment (local)
helm install litedesk-test ./helm/litedesk --dry-run --debug
```

---

## 📈 Monitoring

### Health Checks
- **Master Control Plane:** `https://your-domain.com/health`
- **System Status:** `https://your-domain.com/health/status`
- **Automated checks:** Every 5 minutes

### Metrics
- **Instance Dashboard:** View in admin UI `/instances`
- **Aggregated Metrics:** API endpoint `/api/metrics/aggregated`
- **Collection frequency:** Every 15 minutes

### Logs
```bash
# Master control plane logs
kubectl logs -n litedesk-master -l app=litedesk-backend -f

# Customer instance logs
kubectl logs -n litedesk-{customer-slug} -l app=litedesk-backend -f
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- Code follows existing style guidelines
- All tests pass
- Documentation is updated
- No linter errors

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Documentation:** [docs.litedesk.com](https://docs.litedesk.com)
- **Issues:** [GitHub Issues](https://github.com/yourusername/litedesk/issues)
- **Email:** support@litedesk.com
- **Community:** [Discord](https://discord.gg/litedesk)

---

## 🎯 Roadmap

### ✅ Completed
- [x] Multi-tenant CRM with RBAC
- [x] Demo request system
- [x] Multi-instance architecture
- [x] Automated provisioning
- [x] Instance management dashboard
- [x] Health monitoring
- [x] Metrics collection
- [x] Docker containerization
- [x] Kubernetes Helm charts
- [x] CI/CD pipelines

### 🚧 In Progress
- [ ] Stripe payment integration
- [ ] Email automation (trial reminders, etc.)
- [ ] Custom domain support

### 📅 Planned
- [ ] Advanced analytics dashboard
- [ ] API rate limiting per instance
- [ ] Automated backups
- [ ] Instance cloning/templates
- [ ] Multi-region support
- [ ] Mobile app
- [ ] Webhooks
- [ ] Integration marketplace

---

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Inspired by enterprise SaaS best practices
- Community-driven and open-source

---

## 📞 Contact

**Project Maintainer:** Your Name
- Website: [litedesk.com](https://litedesk.com)
- Email: hello@litedesk.com
- Twitter: [@litedesk](https://twitter.com/litedesk)

---

**⭐ Star this repo if you find it helpful!**

**Made with 💙 by developers, for developers**
